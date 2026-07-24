import type { Firestore } from 'firebase-admin/firestore';
import { isBrowserLifecycleError, withScraperPage } from '@/lib/owner-listings/browser';

type AgentOlxPhoneInput = {
  adminDb: Firestore;
  agencyId: string;
  uid: string;
  url: string;
  skipStoredSession?: boolean;
};

type StoredOlxSession = {
  storageState?: unknown;
};

type OlxPhoneDebug = {
  stage: string;
  adId?: string;
  adIdCandidates?: string[];
  directStatus?: number;
  capturedStatus?: number;
  hasShowPhoneButton?: boolean;
  hasChallenge?: boolean;
  hasLoginSignal?: boolean;
};

function normalizePhoneCandidate(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('4') && digits.length === 11 && digits.slice(1).startsWith('07')) {
    return digits.slice(1);
  }
  if (digits.startsWith('004') && digits.length === 13 && digits.slice(3).startsWith('07')) {
    return digits.slice(3);
  }
  if (digits.startsWith('07') && digits.length === 10) {
    return digits;
  }
  if (digits.startsWith('0') && digits.length >= 9 && digits.length <= 10) {
    return digits;
  }
  return '';
}

function extractPhoneFromText(value: string) {
  const directPatterns = [
    /(?:\+4|004)?07\d(?:[\s.-]?\d){7,8}/g,
    /(?:\+4|004)?0(?:2|3)\d(?:[\s.-]?\d){7,8}/g,
    /\b0\d(?:[\s.-]?\d){7,12}\b/g,
  ];

  for (const pattern of directPatterns) {
    for (const match of value.matchAll(pattern)) {
      const phone = normalizePhoneCandidate(match[0]);
      if (phone) return phone;
    }
  }

  return '';
}

function extractPhoneFromUnknownPayload(value: unknown, seen = new Set<unknown>()): string {
  const directPhone = normalizePhoneCandidate(value);
  if (directPhone) return directPhone;

  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? extractPhoneFromText(value) : '';
  }

  if (seen.has(value)) return '';
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const phone = extractPhoneFromUnknownPayload(item, seen);
      if (phone) return phone;
    }
    return '';
  }

  const record = value as Record<string, unknown>;
  const priorityKeys = ['phone', 'phones', 'telephone', 'mobile', 'contactPhone', 'contact_phone', 'value'];
  for (const key of priorityKeys) {
    if (key in record) {
      const phone = extractPhoneFromUnknownPayload(record[key], seen);
      if (phone) return phone;
    }
  }

  for (const nestedValue of Object.values(record)) {
    const phone = extractPhoneFromUnknownPayload(nestedValue, seen);
    if (phone) return phone;
  }

  return '';
}

function extractPhoneFromLimitedPhonesPayload(text: string) {
  try {
    const payload = JSON.parse(text || '{}') as unknown;
    return extractPhoneFromUnknownPayload(payload);
  } catch {
    return extractPhoneFromText(text);
  }
}

function extractAdIdFromHtml(html: string) {
  const normalized = html.replace(/\s+/g, ' ');
  return (
    normalized.match(/"sku":"(\d{6,12})"/i)?.[1] ||
    normalized.match(/"id":(\d{6,12}),"title":/i)?.[1] ||
    normalized.match(/"(?:offer|ad|listing)"\s*:\s*\{[\s\S]{0,400}?"id":\s*"?(\d{6,12})"?/i)?.[1] ||
    normalized.match(/"(?:adId|ad_id|offerId|offer_id)":\s*"?(\d{6,12})"?/i)?.[1] ||
    normalized.match(/window\.__PRERENDERED_STATE__\s*=\s*".*?\\"id\\":(\d{6,12})/i)?.[1] ||
    normalized.match(/window\.__PRERENDERED_STATE__\s*=\s*".*?\\"(?:adId|ad_id|offerId|offer_id)\\":\\"?(\d{6,12})/i)?.[1] ||
    normalized.match(/\bdata-(?:ad|offer)-id=["']?(\d{6,12})["']?/i)?.[1] ||
    normalized.match(/\bad-id=(\d{6,12})\b/i)?.[1] ||
    ''
  );
}

function extractAdIdCandidatesFromHtml(html: string) {
  const normalized = html.replace(/\s+/g, ' ');
  const candidates: string[] = [];
  const add = (value?: string) => {
    if (value && /^\d{6,12}$/.test(value) && !candidates.includes(value)) {
      candidates.push(value);
    }
  };

  add(normalized.match(/"sku":"(\d{6,12})"/i)?.[1]);
  add(normalized.match(/"id":(\d{6,12}),"title":/i)?.[1]);
  add(normalized.match(/"ad_id"\s*:\s*"?(\d{6,12})"?/i)?.[1]);
  add(normalized.match(/"adId"\s*:\s*"?(\d{6,12})"?/i)?.[1]);
  add(normalized.match(/"offer_id"\s*:\s*"?(\d{6,12})"?/i)?.[1]);
  add(normalized.match(/"offerId"\s*:\s*"?(\d{6,12})"?/i)?.[1]);

  for (const match of normalized.matchAll(/"(?:offer|ad|listing)"\s*:\s*\{[\s\S]{0,900}?"id":\s*"?(\d{6,12})"?/gi)) {
    add(match[1]);
  }

  for (const match of normalized.matchAll(/window\.__PRERENDERED_STATE__\s*=\s*".*?\\"id\\":(\d{6,12})/gi)) {
    add(match[1]);
  }

  for (const match of normalized.matchAll(/\\"(?:offer|ad|listing)\\"\s*:\s*\{[\s\S]{0,900}?\\"id\\":\s*\\"?(\d{6,12})/gi)) {
    add(match[1]);
  }

  for (const match of normalized.matchAll(/\bdata-(?:ad|offer)-id=["']?(\d{6,12})["']?/gi)) {
    add(match[1]);
  }

  return candidates.slice(0, 24);
}

function buildOlxPhoneApiUrls(adId: string) {
  return [
    `https://www.olx.ro/api/v1/offers/${adId}/limited-phones`,
    `https://www.olx.ro/api/v1/offers/${adId}/phones`,
    `https://www.olx.ro/api/v1/offers/${adId}/phone`,
    `https://www.olx.ro/api/v1/offers/${adId}`,
  ];
}

export function getSafeOlxBrowserFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  if (message.includes('Executable doesn') || message.includes('playwright install')) {
    return {
      message: 'Serviciul de extragere OLX nu are browserul instalat corect. Anuntul a fost trimis automat la retry.',
      stage: 'browser_missing',
    };
  }

  if (isBrowserLifecycleError(error)) {
    return {
      message: 'Serviciul OLX s-a reincarcat dupa o intrerupere temporara. Anuntul a fost trimis automat la retry.',
      stage: 'browser_restarted',
    };
  }

  return {
    message: 'Serviciul de extragere OLX este temporar indisponibil. Anuntul a fost trimis automat la retry.',
    stage: 'browser_failed',
  };
}

export async function scrapeOlxPhoneForAgent(input: AgentOlxPhoneInput) {
  const debug: OlxPhoneDebug = { stage: 'start' };

  if (!/^https:\/\/(?:www\.)?olx\.ro\//i.test(input.url || '')) {
    return { phone: '', message: 'URL-ul OLX este invalid.', debug: { ...debug, stage: 'invalid_url' } };
  }

  const sessionRef = input.adminDb
    .collection('agencies')
    .doc(input.agencyId)
    .collection('agentOlxSessions')
    .doc(input.uid);
  const sessionSnapshot = input.skipStoredSession ? null : await sessionRef.get();
  const session = sessionSnapshot?.data() as StoredOlxSession | undefined;

  try {
    const browserResult = await withScraperPage(async (page, context) => {
  const capturedPhones: string[] = [];

  const capturePhoneResponse = async (response: { url: () => string; text: () => Promise<string> }) => {
    if (!/\/(?:limited-)?phones?(?:[/?#]|$)|\/api\/v1\/offers\/\d{6,12}(?:[/?#]|$)/i.test(response.url())) return;
    const text = await response.text().catch(() => '');
    const phone = extractPhoneFromLimitedPhonesPayload(text);
    if (phone) capturedPhones.push(phone);
  };

  page.on('response', (response) => {
    if (/\/(?:limited-)?phones?(?:[/?#]|$)|\/api\/v1\/offers\/\d{6,12}(?:[/?#]|$)/i.test(response.url())) {
      debug.capturedStatus = response.status();
    }
    void capturePhoneResponse(response);
  });

  try {
    debug.stage = 'goto';
    await page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1000).catch(() => undefined);

    debug.stage = 'loaded';
    const html = await page.content().catch(() => '');
    const adIdCandidates = extractAdIdCandidatesFromHtml(html);
    const adId = adIdCandidates[0] || extractAdIdFromHtml(html);
    debug.adId = adId || undefined;
    debug.adIdCandidates = adIdCandidates.slice(0, 8);
    debug.hasChallenge = /captcha|robot|verify|challenge|cloudflare|checking your browser/i.test(html);
    debug.hasLoginSignal = /autentific|login|conecteaz/i.test(html);
    if (debug.hasChallenge && session?.storageState) {
      return {
        phone: '',
        message: 'Sesiunea OLX salvata a expirat si va fi reinnoita automat.',
        retryWithoutStoredSession: true,
        debug: { ...debug, stage: 'stored_session_challenge' },
      };
    }

    debug.stage = 'click_reveal';
    const showPhoneButtonCandidates = [
      page.locator('[data-testid="show-phone"]').last(),
      page.locator('[data-cy*="phone" i], [data-testid*="phone" i], [aria-label*="telefon" i], [aria-label*="phone" i]').last(),
      page.getByRole('button', { name: /arat|afiș|afis|afi|num[aă]r|telefon|phone|contact/i }).last(),
      page.locator('button, a, [role="button"]').filter({ hasText: /arat|afiș|afis|afi|num[aă]r|telefon|phone|contact/i }).last(),
    ];
    debug.hasShowPhoneButton = (await showPhoneButtonCandidates[0].count().catch(() => 0)) > 0;

    const phoneResponsePromise = page
      .waitForResponse((response) => /\/(?:limited-)?phones?(?:[/?#]|$)|\/api\/v1\/offers\/\d{6,12}(?:[/?#]|$)/i.test(response.url()), { timeout: 15000 })
      .then(async (response) => {
        await capturePhoneResponse(response);
      })
      .catch(() => undefined);

    for (const button of showPhoneButtonCandidates) {
      if ((await button.count().catch(() => 0)) > 0) {
        await button.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => undefined);
        await button.click({ force: true, timeout: 10000 }).catch(() => undefined);
        await page.waitForTimeout(1500).catch(() => undefined);
        break;
      }
    }

    await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('button, a, [role="button"], [data-testid], [data-cy]'));
      const phoneTextPattern = /arat|afiș|afis|afi|număr|numar|telefon|phone|contact/i;
      for (const node of candidates) {
        const label = [
          node.textContent || '',
          node.getAttribute('aria-label') || '',
          node.getAttribute('data-testid') || '',
          node.getAttribute('data-cy') || '',
        ].join(' ');
        if (phoneTextPattern.test(label)) {
          node.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
          node.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
          node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        }
      }
    }).catch(() => undefined);
    await page.waitForTimeout(2200).catch(() => undefined);

    await phoneResponsePromise;

    const networkPhone = capturedPhones.find(Boolean) || '';
    if (networkPhone) {
      await sessionRef.set({ storageState: await context.storageState(), updatedAt: new Date().toISOString() }, { merge: true });
      return { phone: networkPhone, message: 'Telefon preluat din OLX.', debug: { ...debug, stage: 'click_reveal_success' } };
    }

    if (adIdCandidates.length && !debug.hasChallenge) {
      debug.stage = 'direct_api';
      const directResult = await page.evaluate(async ({ apiUrlsByAdId }) => {
        const statuses: Array<{ id: string; status: number }> = [];
        const entries = Object.entries(apiUrlsByAdId).slice(0, 5) as Array<[string, string[]]>;
        for (const [id, endpoints] of entries) {
          for (const endpoint of endpoints) {
            const response = await fetch(endpoint, {
              credentials: 'include',
              headers: {
                accept: 'application/json, text/plain, */*',
                'x-requested-with': 'XMLHttpRequest',
              },
            }).catch(() => null);

            statuses.push({ id, status: response?.status || 0 });
            const text = response ? await response.text().catch(() => '') : '';
            if (response?.ok && text) {
              return { ok: true, status: response.status, id, text, statuses };
            }
          }
        }

        return { ok: false, status: statuses[0]?.status || 0, id: entries[0]?.[0] || '', text: '', statuses };
      }, { apiUrlsByAdId: Object.fromEntries(adIdCandidates.map((id) => [id, buildOlxPhoneApiUrls(id)])) }).catch(() => '');
      debug.directStatus = typeof directResult === 'object' && directResult ? directResult.status : 0;
      debug.adId = typeof directResult === 'object' && directResult?.id ? directResult.id : debug.adId;
      const directPhone = extractPhoneFromLimitedPhonesPayload(typeof directResult === 'object' && directResult ? directResult.text : '');
      if (directPhone) {
        await sessionRef.set({ storageState: await context.storageState(), updatedAt: new Date().toISOString() }, { merge: true });
        return { phone: directPhone, message: 'Telefon preluat din sesiunea OLX a agentului.', debug: { ...debug, stage: 'direct_api_success' } };
      }
    }

    debug.stage = 'dom_extract';
    const domText = await page.evaluate(() => {
      const tel = Array.from(document.querySelectorAll('a[href^="tel:"]'))
        .map((node) => node.getAttribute('href') || '')
        .map((href) => href.replace(/^tel:/i, ''))
        .find(Boolean);
      return tel || document.body.innerText || '';
    }).catch(() => '');
    const phoneFromDom = extractPhoneFromText(domText);
    if (phoneFromDom) {
      await sessionRef.set({ storageState: await context.storageState(), updatedAt: new Date().toISOString() }, { merge: true });
      return { phone: phoneFromDom, message: 'Telefon preluat din pagina OLX.', debug: { ...debug, stage: 'dom_extract_success' } };
    }

    if (debug.hasChallenge) {
      await sessionRef.delete().catch(() => undefined);
    }
    const statusHint = debug.directStatus ? ` API OLX a raspuns cu status ${debug.directStatus}.` : '';
    const challengeHint = debug.hasChallenge ? ' OLX afiseaza o verificare anti-bot.' : '';
    const loginHint = debug.hasLoginSignal ? ' OLX pare sa ceara autentificare.' : '';
    const idHint = !debug.adId ? ' Nu am putut identifica ID-ul numeric al anuntului.' : '';
    return {
      phone: '',
      message: `Nu am gasit telefonul in sesiunea web/mobil.${statusHint}${challengeHint}${loginHint}${idHint}`.trim(),
      debug: { ...debug, stage: 'not_found' },
    };
  } catch (error) {
    if (isBrowserLifecycleError(error)) {
      throw error;
    }

    return {
      phone: '',
      message: 'Nu am putut prelua imediat telefonul din pagina OLX. Anuntul va fi reincercat automat.',
      debug: { ...debug, stage: 'failed' },
    };
  } finally {
    await page.close().catch(() => undefined);
  }

    }, {
      storageState: session?.storageState as never,
    });

    if ('retryWithoutStoredSession' in browserResult && browserResult.retryWithoutStoredSession) {
      await sessionRef.delete().catch(() => undefined);
      return scrapeOlxPhoneForAgent({ ...input, skipStoredSession: true });
    }

    return browserResult;
  } catch (error) {
    const safeFailure = getSafeOlxBrowserFailure(error);
    console.warn('OLX phone browser attempt failed.', {
      stage: safeFailure.stage,
      agencyId: input.agencyId,
      errorMessage: error instanceof Error ? error.message.slice(0, 6000) : String(error || '').slice(0, 6000),
      listingUrlHost: (() => {
        try {
          return new URL(input.url).host;
        } catch {
          return 'invalid';
        }
      })(),
    });
    return {
      phone: '',
      message: safeFailure.message,
      debug: { ...debug, stage: safeFailure.stage },
    };
  }
}
