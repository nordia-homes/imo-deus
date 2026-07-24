import http from 'node:http';
import { chromium } from 'playwright';

const port = Number(process.env.PORT || 8080);
const maxBrowserUses = Math.max(1, Number(process.env.MAX_BROWSER_USES || 20));
let browserPromise = null;
let browserInstance = null;
let browserContext = null;
let browserUses = 0;
let leaseTail = Promise.resolve();

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('004') && digits.length === 13) return digits.slice(3);
  if (digits.startsWith('4') && digits.length === 11) return digits.slice(1);
  if (/^0[237]\d{8}$/.test(digits)) return digits;
  return '';
}

function extractPhone(value, seen = new Set()) {
  const normalized = normalizePhone(value);
  if (normalized) return normalized;
  if (typeof value === 'string') {
    for (const match of value.matchAll(/(?:\+4|004)?0[237]\d(?:[\s.-]?\d){7,8}/g)) {
      const phone = normalizePhone(match[0]);
      if (phone) return phone;
    }
    return '';
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return '';
  seen.add(value);
  for (const nested of Array.isArray(value) ? value : Object.values(value)) {
    const phone = extractPhone(nested, seen);
    if (phone) return phone;
  }
  return '';
}

function extractPhonePayload(text) {
  try {
    return extractPhone(JSON.parse(text || '{}'));
  } catch {
    return extractPhone(text);
  }
}

function extractAdIds(html) {
  const normalized = String(html || '').replace(/\s+/g, ' ');
  const ids = [];
  const add = (value) => {
    if (value && /^\d{6,12}$/.test(value) && !ids.includes(value)) ids.push(value);
  };
  add(normalized.match(/"sku":"(\d{6,12})"/i)?.[1]);
  add(normalized.match(/"id":(\d{6,12}),"title":/i)?.[1]);
  for (const match of normalized.matchAll(/"(?:adId|ad_id|offerId|offer_id)"\s*:\s*"?(\d{6,12})"?/gi)) {
    add(match[1]);
  }
  for (const match of normalized.matchAll(/\\"(?:adId|ad_id|offerId|offer_id)\\"\s*:\s*\\"?(\d{6,12})/gi)) {
    add(match[1]);
  }
  return ids.slice(0, 12);
}

function isLifecycleError(error) {
  return /target (?:page|context|browser).*closed|browser.*(?:closed|disconnected)|connection closed|process exited|crash|econnreset|epipe/i.test(
    error instanceof Error ? error.message : String(error || '')
  );
}

async function disposeBrowser() {
  const browser = browserInstance;
  browserContext = null;
  browserInstance = null;
  browserPromise = null;
  browserUses = 0;
  if (browser?.isConnected()) await browser.close().catch(() => undefined);
}

async function getBrowser() {
  if (browserInstance?.isConnected()) return browserInstance;
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      if (browser.isConnected()) return browser;
    } catch {
      // Retry a poisoned launch below.
    }
    browserPromise = null;
  }
  browserPromise = chromium
    .launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking'],
    })
    .then((browser) => {
      browserInstance = browser;
      browser.on('disconnected', () => {
        if (browserInstance === browser) {
          browserContext = null;
          browserInstance = null;
          browserPromise = null;
          browserUses = 0;
        }
      });
      return browser;
    })
    .catch((error) => {
      browserInstance = null;
      browserPromise = null;
      throw error;
    });
  return browserPromise;
}

async function getBrowserContext(browser) {
  if (browserContext && browserContext.browser()?.isConnected()) return browserContext;

  browserContext = await browser.newContext({
    locale: 'ro-RO',
    timezoneId: 'Europe/Bucharest',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 1600 },
  });
  await browserContext.route(
    '**/*.{png,jpg,jpeg,gif,webp,avif,svg,woff,woff2,ttf,otf,mp4,webm}',
    (route) => route.abort()
  );
  return browserContext;
}

async function resetBrowserContext() {
  const context = browserContext;
  browserContext = null;
  await context?.close().catch(() => undefined);
}

async function withLease(handler) {
  const previous = leaseTail;
  let release = () => undefined;
  leaseTail = new Promise((resolve) => {
    release = resolve;
  });
  await previous.catch(() => undefined);
  try {
    return await handler();
  } finally {
    release();
  }
}

async function resolvePhone(url) {
  return withLease(async () => {
    let lastError;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      if (browserUses >= maxBrowserUses) await disposeBrowser();
      let page;
      try {
        const browser = await getBrowser();
        const context = await getBrowserContext(browser);
        browserUses += 1;
        page = await context.newPage();
        const capturedPhones = [];
        const phoneResponses = [];
        const responseTasks = [];
        page.on('response', (response) => {
          if (!/\/(?:limited-)?phones?(?:[/?#]|$)/i.test(response.url())) return;
          const task = response
            .text()
            .then((text) => {
              const phone = extractPhonePayload(text);
              if (phone) capturedPhones.push(phone);
              phoneResponses.push({
                status: response.status(),
                denied: /disallowed|forbidden|unauthorized|login|autentific/i.test(text),
              });
            })
            .catch(() => undefined);
          responseTasks.push(task);
        });

        const pageResponse = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
        await page.waitForTimeout(700);
        const html = await page.content();
        const adIds = extractAdIds(html);

        const responseWait = page
          .waitForResponse((response) => /\/(?:limited-)?phones?(?:[/?#]|$)/i.test(response.url()), {
            timeout: 8000,
          })
          .catch(() => undefined);

        const buttons = [
          page.locator('[data-testid="show-phone"]:visible').last(),
          page
            .locator(
              '[data-cy*="phone" i]:visible, [data-testid*="phone" i]:visible, [aria-label*="telefon" i]:visible'
            )
            .last(),
          page.getByRole('button', { name: /arat|afi[șs]|num[aă]r|telefon|phone|contact/i }).last(),
        ];
        let showPhoneCount = 0;
        for (const button of buttons) {
          const count = await button.count().catch(() => 0);
          showPhoneCount = Math.max(showPhoneCount, count);
          if (count > 0 && (await button.isVisible().catch(() => false))) {
            await button.click({ force: true, timeout: 10000 }).catch(() => undefined);
            await page.waitForTimeout(1200);
            break;
          }
        }
        await responseWait;
        await Promise.allSettled(responseTasks);
        if (capturedPhones[0]) return { phone: capturedPhones[0], stage: 'click_reveal' };

        if (adIds.length) {
          const payload = await page.evaluate(async ({ ids }) => {
            const statuses = [];
            for (const id of ids) {
              for (const suffix of ['limited-phones', 'phones', 'phone']) {
                const response = await fetch(`https://www.olx.ro/api/v1/offers/${id}/${suffix}`, {
                  credentials: 'include',
                  headers: { accept: 'application/json, text/plain, */*' },
                }).catch(() => null);
                if (!response) continue;
                const text = await response.text().catch(() => '');
                statuses.push({
                  status: response.status,
                  denied: /disallowed|forbidden|unauthorized|login|autentific/i.test(text),
                });
                if (response.ok) return { text, statuses };
              }
            }
            return { text: '', statuses };
          }, { ids: adIds });
          phoneResponses.push(...payload.statuses);
          const phone = extractPhonePayload(payload.text);
          if (phone) return { phone, stage: 'session_api' };
        }

        const domPhone = await page.evaluate(() => {
          const tel = Array.from(document.querySelectorAll('a[href^="tel:"]'))
            .map((node) => node.getAttribute('href') || '')
            .find(Boolean);
          return tel || document.body.innerText || '';
        });
        const phone = extractPhone(domPhone);
        if (phone) return { phone, stage: 'dom' };

        const currentUrl = page.url();
        const loginRequired =
          /\/(?:cont|account|login|auth)(?:[/?#]|$)/i.test(new URL(currentUrl).pathname) ||
          (await page
            .locator(
              'form[action*="login" i], input[type="email"]:visible, [data-testid*="login" i]:visible'
            )
            .count()
            .catch(() => 0)) > 0;
        const statuses = phoneResponses.map((entry) => entry.status);
        const stage =
          Number(pageResponse?.status() || 0) >= 400
            ? 'listing_unavailable'
            : loginRequired
              ? 'login_required'
              : statuses.includes(429)
                ? 'rate_limited'
                : phoneResponses.some((entry) => entry.denied) ||
                    statuses.some((status) => status === 401 || status === 403)
                  ? 'access_denied'
                  : showPhoneCount === 0
                    ? 'phone_control_missing'
                    : 'not_found';
        if (attempt === 1 && (stage === 'access_denied' || stage === 'rate_limited')) {
          await resetBrowserContext();
          continue;
        }
        return { phone: '', stage };
      } catch (error) {
        lastError = error;
        if (attempt === 2 || !isLifecycleError(error)) throw error;
        await disposeBrowser();
      } finally {
        await page?.close().catch(() => undefined);
      }
    }
    throw lastError;
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    sendJson(response, 200, { ok: true });
    return;
  }
  if (request.method !== 'POST' || request.url !== '/resolve') {
    sendJson(response, 404, { phone: '', stage: 'not_found' });
    return;
  }
  try {
    const chunks = [];
    for await (const chunk of request) {
      chunks.push(chunk);
      if (chunks.reduce((sum, value) => sum + value.length, 0) > 16384) {
        throw new Error('Payload too large');
      }
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    const parsedUrl = new URL(String(body.url || ''));
    if (parsedUrl.protocol !== 'https:' || !/(^|\.)olx\.ro$/i.test(parsedUrl.hostname)) {
      sendJson(response, 400, { phone: '', stage: 'invalid_url' });
      return;
    }
    const result = await resolvePhone(parsedUrl.toString());
    sendJson(response, 200, result);
  } catch (error) {
    console.warn('OLX browser worker request failed.', {
      errorType: error instanceof Error ? error.name : typeof error,
      lifecycle: isLifecycleError(error),
    });
    sendJson(response, 200, { phone: '', stage: isLifecycleError(error) ? 'browser_restarted' : 'failed' });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`OLX phone browser listening on ${port}.`);
});

process.on('SIGTERM', async () => {
  await disposeBrowser();
  server.close(() => process.exit(0));
});
