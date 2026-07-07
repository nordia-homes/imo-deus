import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const GRAPH_API_BASE_URL = 'https://graph.facebook.com/v23.0';

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) continue;
    const key = value.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

async function loadDotEnvLocal() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  try {
    const raw = await fs.readFile(envPath, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const equalsIndex = trimmed.indexOf('=');
      if (equalsIndex < 1) return;
      const key = trimmed.slice(0, equalsIndex).trim();
      const value = trimmed.slice(equalsIndex + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) process.env[key] = value;
    });
  } catch {
    // .env.local is optional for this runner.
  }
}

function normalizeAdAccountId(value) {
  const clean = String(value || '').trim();
  if (!clean) return '';
  return clean.startsWith('act_') ? clean : `act_${clean}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUrl(pathname, accessToken) {
  const separator = pathname.includes('?') ? '&' : '?';
  return `${GRAPH_API_BASE_URL}${pathname}${separator}access_token=${encodeURIComponent(accessToken)}`;
}

async function graphGet(pathname, accessToken, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(buildUrl(pathname, accessToken), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = text;
    }
    if (!response.ok) {
      const message = payload?.error?.error_user_msg || payload?.error?.message || `HTTP ${response.status}`;
      return { ok: false, status: response.status, message, payload };
    }
    return { ok: true, status: response.status, payload };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: error instanceof Error ? error.message : 'Unknown request error',
    };
  } finally {
    clearTimeout(timeout);
  }
}

function makeRequiredTests({ adAccountId, pageId }) {
  return [
    {
      feature: 'public_profile',
      path: '/me?fields=id,name',
      requiredCalls: 1,
    },
    {
      feature: 'pages_show_list',
      path: '/me/accounts?fields=id,name&limit=5',
      requiredCalls: 1,
    },
    {
      feature: 'business_management',
      path: '/me/businesses?fields=id,name&limit=5',
      requiredCalls: 1,
    },
    {
      feature: 'pages_read_engagement',
      path: `/${pageId}?fields=id,name,followers_count`,
      requiredCalls: 1,
      skip: !pageId,
    },
    {
      feature: 'ads_read',
      path: `/${adAccountId}/insights?fields=spend,impressions,clicks&date_preset=last_7d`,
      requiredCalls: 1,
      skip: !adAccountId,
    },
    {
      feature: 'ads_management',
      path: `/${adAccountId}/campaigns?fields=id,name,status,objective&limit=5`,
      requiredCalls: 1,
      skip: !adAccountId,
    },
  ];
}

function makeMarketingTierPool({ adAccountId }) {
  return [
    `/${adAccountId}/campaigns?fields=id,name,status,objective&limit=1`,
  ];
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function isRateLimited(message) {
  return String(message || '').toLowerCase().includes('too many calls');
}

function isInvalidAccessToken(message) {
  const normalized = String(message || '').toLowerCase();
  return normalized.includes('access token') && (
    normalized.includes('expired')
    || normalized.includes('invalid')
    || normalized.includes('error validating')
  );
}

function summarize(results) {
  const total = results.length;
  const success = results.filter((item) => item.ok).length;
  const failed = total - success;
  const successRate = total ? Math.round((success / total) * 10000) / 100 : 0;
  return { total, success, failed, successRate };
}

async function main() {
  await loadDotEnvLocal();
  const args = parseArgs(process.argv);
  const accessToken = String(args['access-token'] || process.env.META_TEST_ACCESS_TOKEN || process.env.FACEBOOK_TEST_ACCESS_TOKEN || '').trim();
  const adAccountId = normalizeAdAccountId(args['ad-account-id'] || process.env.META_TEST_AD_ACCOUNT_ID || '1029339220032249');
  const pageId = String(args['page-id'] || process.env.META_TEST_PAGE_ID || '1237866869402002').trim();
  const totalMarketingCalls = Math.max(0, Number(args.total || process.env.META_TEST_CALL_COUNT || 500));
  const delayMs = Math.max(0, Number(args.delay || process.env.META_TEST_DELAY_MS || 250));
  const timeoutMs = Math.max(3000, Number(args.timeout || process.env.META_TEST_TIMEOUT_MS || 15000));
  const dryRun = Boolean(args['dry-run']);
  const skipRequired = Boolean(args['skip-required']) || process.env.META_TEST_SKIP_REQUIRED === 'true';
  const reportDir = path.resolve(process.cwd(), 'tmp', 'meta-api-test-runner');
  const reportPath = path.join(reportDir, `report-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

  const requiredTests = skipRequired ? [] : makeRequiredTests({ adAccountId, pageId }).filter((test) => !test.skip);
  const marketingPool = makeMarketingTierPool({ adAccountId });

  const plan = {
    adAccountId,
    pageId,
    totalRequiredFeatureCalls: requiredTests.length,
    totalMarketingTierCalls: totalMarketingCalls,
    delayMs,
    timeoutMs,
    dryRun,
    skipRequired,
    requiredTests: requiredTests.map(({ feature, path: requestPath }) => ({ feature, path: requestPath })),
    marketingTierPool: marketingPool,
  };

  console.log('Meta API test runner plan:');
  console.log(JSON.stringify(plan, null, 2));

  if (!accessToken && !dryRun) {
    throw new Error('Lipseste META_TEST_ACCESS_TOKEN. Genereaza un token in Graph API Explorer si ruleaza cu --access-token sau seteaza META_TEST_ACCESS_TOKEN.');
  }

  if (dryRun) {
    console.log('Dry-run complet. Nu am facut apeluri catre Meta.');
    return;
  }

  const results = [];
  let sequence = 0;
  let stoppedForRateLimit = false;
  let stoppedForInvalidToken = false;

  for (const test of requiredTests) {
    sequence += 1;
    const startedAt = new Date().toISOString();
    const result = await graphGet(test.path, accessToken, timeoutMs);
    results.push({
      sequence,
      group: 'required_feature',
      feature: test.feature,
      path: test.path,
      startedAt,
      finishedAt: new Date().toISOString(),
      ok: result.ok,
      status: result.status,
      message: result.message || null,
    });
    console.log(`[${sequence}] ${test.feature} ${result.ok ? 'OK' : 'FAIL'} ${result.status}${result.message ? ` - ${result.message}` : ''}`);
    if (!result.ok && isInvalidAccessToken(result.message)) {
      stoppedForInvalidToken = true;
      console.log('Token Meta expirat sau invalid. Opresc rularea ca sa nu creasca error rate-ul pentru App Review.');
      break;
    }
    if (delayMs) await sleep(delayMs);
  }

  for (let index = 0; !stoppedForInvalidToken && index < totalMarketingCalls; index += 1) {
    const requestPath = marketingPool[index % marketingPool.length];
    sequence += 1;
    const startedAt = new Date().toISOString();
    const result = await graphGet(requestPath, accessToken, timeoutMs);
    results.push({
      sequence,
      group: 'marketing_api_access_tier',
      feature: 'Marketing API Access Tier',
      path: requestPath,
      startedAt,
      finishedAt: new Date().toISOString(),
      ok: result.ok,
      status: result.status,
      message: result.message || null,
    });
    if (sequence % 25 === 0 || !result.ok) {
      const partial = summarize(results);
      console.log(`[${sequence}] tier ${result.ok ? 'OK' : 'FAIL'} ${result.status}${result.message ? ` - ${result.message}` : ''} | success ${partial.success}/${partial.total} (${partial.successRate}%)`);
    }
    if (!result.ok && isRateLimited(result.message)) {
      stoppedForRateLimit = true;
      console.log('Rate limit detectat. Opresc rularea ca sa nu creasca error rate-ul pentru App Review.');
      break;
    }
    if (!result.ok && isInvalidAccessToken(result.message)) {
      stoppedForInvalidToken = true;
      console.log('Token Meta expirat sau invalid. Opresc rularea ca sa nu creasca error rate-ul pentru App Review.');
      break;
    }
    if (delayMs) await sleep(delayMs);
  }

  const requiredSummary = summarize(results.filter((item) => item.group === 'required_feature'));
  const marketingSummary = summarize(results.filter((item) => item.group === 'marketing_api_access_tier'));
  const overallSummary = summarize(results);
  const report = {
    createdAt: new Date().toISOString(),
    adAccountId,
    pageId,
    requiredSummary,
    marketingSummary,
    overallSummary,
    metaRequirement: {
      marketingApiAccessTierCallsRequired: 500,
      minimumSuccessRate: 85,
      marketingTierRequirementMet: marketingSummary.total >= 500 && marketingSummary.successRate >= 85,
      stoppedForRateLimit,
      stoppedForInvalidToken,
    },
    results,
  };

  await ensureDir(reportDir);
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log('Meta API test runner complete:');
  console.log(JSON.stringify({
    requiredSummary,
    marketingSummary,
    overallSummary,
    reportPath,
  }, null, 2));

  if (stoppedForInvalidToken) {
    process.exitCode = 4;
  } else if (stoppedForRateLimit) {
    process.exitCode = 3;
  } else if (!report.metaRequirement.marketingTierRequirementMet) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
