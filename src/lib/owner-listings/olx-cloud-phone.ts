import type { BrowserContext, Page, Response } from 'playwright';
import type { Firestore } from 'firebase-admin/firestore';
import {
  connectToBrowserbaseSession,
  getBrowserbaseSession,
  releaseBrowserbaseSession,
  withBrowserbaseSession,
} from '@/lib/owner-listings/browserbase';
import {
  acquireAgentOlxBrowserLease,
  getAgentOlxConnection,
  markAgentOlxConnection,
  releaseAgentOlxBrowserLease,
} from '@/lib/owner-listings/olx-agent-connection';

export type OlxCloudPhoneStage =
  | 'success'
  | 'not_connected'
  | 'login_required'
  | 'rate_limited'
  | 'access_denied'
  | 'challenge'
  | 'phone_control_missing'
  | 'listing_unavailable'
  | 'not_found'
  | 'failed';

type OlxCloudPhoneResult = {
  phone: string;
  stage: OlxCloudPhoneStage;
  message: string;
};

export function hasOlxSecurityChallengeSignals(urlValue: string, html: string) {
  let challengePath = false;
  try {
    challengePath = /\/(?:captcha|challenge|checkpoint)(?:[/?#]|$)/i.test(
      new URL(urlValue).pathname
    );
  } catch {
    challengePath = false;
  }
  const challengeMarkup =
    /(?:cf-chl-|challenges\.cloudflare\.com|g-recaptcha|h-captcha|cf-turnstile|client-api\.arkoselabs\.com|checking your browser|captcha-container)/i.test(
      html
    );
  return challengePath || challengeMarkup;
}

async function hasVisibleOlxSecurityChallenge(page: Page, html: string) {
  if (hasOlxSecurityChallengeSignals(page.url(), html)) return true;
  return (
    (await page
      .locator(
        'iframe[src*="captcha" i]:visible, iframe[src*="challenges.cloudflare.com" i]:visible, .g-recaptcha:visible, [data-testid*="captcha" i]:visible, [class*="hcaptcha" i]:visible'
      )
      .count()
      .catch(() => 0)) > 0
  );
}

function normalizePhoneCandidate(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('004') && digits.length === 13) return digits.slice(3);
  if (digits.startsWith('4') && digits.length === 11) return digits.slice(1);
  if (/^0[237]\d{8}$/.test(digits)) return digits;
  return '';
}

function extractPhone(value: unknown, seen = new Set<unknown>()): string {
  const normalized = normalizePhoneCandidate(value);
  if (normalized) return normalized;
  if (typeof value === 'string') {
    const matches = value.match(/(?:\+4|004)?0[237]\d(?:[\s.-]?\d){7,8}/g) || [];
    for (const match of matches) {
      const phone = normalizePhoneCandidate(match);
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

function extractPhonePayload(text: string) {
  try {
    return extractPhone(JSON.parse(text || '{}'));
  } catch {
    return extractPhone(text);
  }
}

function extractAdIds(html: string) {
  const normalized = String(html || '').replace(/\s+/g, ' ');
  const ids: string[] = [];
  const add = (value?: string) => {
    if (value && /^\d{6,12}$/.test(value) && !ids.includes(value)) ids.push(value);
  };
  add(normalized.match(/"sku":"(\d{6,12})"/i)?.[1]);
  add(normalized.match(/"id":(\d{6,12}),"title":/i)?.[1]);
  for (const match of normalized.matchAll(
    /"(?:adId|ad_id|offerId|offer_id)"\s*:\s*"?(\d{6,12})"?/gi
  )) {
    add(match[1]);
  }
  for (const match of normalized.matchAll(
    /\\"(?:adId|ad_id|offerId|offer_id)\\"\s*:\s*\\"?(\d{6,12})/gi
  )) {
    add(match[1]);
  }
  return ids.slice(0, 16);
}

function isPhoneResponse(response: Pick<Response, 'url'>) {
  return /\/(?:limited-)?phones?(?:[/?#]|$)|\/api\/v1\/offers\/\d{6,12}(?:[/?#]|$)/i.test(
    response.url()
  );
}

async function requestPhoneThroughExtension(page: Page) {
  return page.evaluate(() => {
    return new Promise<{ phone?: string; status?: string }>((resolve) => {
      const requestId = `imodeus-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const timer = window.setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve({ status: 'extension_timeout' });
      }, 6500);
      const handler = (event: MessageEvent) => {
        const payload = event.data as {
          source?: string;
          type?: string;
          requestId?: string;
          phone?: string;
          status?: string;
        };
        if (
          event.source !== window ||
          payload?.source !== 'imodeus-olx-extension' ||
          payload?.type !== 'IMODEUS_OLX_PHONE_RESULT' ||
          payload?.requestId !== requestId
        ) {
          return;
        }
        window.clearTimeout(timer);
        window.removeEventListener('message', handler);
        resolve({ phone: payload.phone || '', status: payload.status || '' });
      };
      window.addEventListener('message', handler);
      window.postMessage(
        {
          source: 'imodeus-app',
          type: 'IMODEUS_OLX_PHONE_REQUEST',
          requestId,
        },
        '*'
      );
    });
  }).catch(() => ({ status: 'extension_unavailable' }));
}

async function resolvePhoneInPage(page: Page, url: string): Promise<OlxCloudPhoneResult> {
  const capturedPhones: string[] = [];
  const responseStatuses: number[] = [];
  const responseTasks: Promise<void>[] = [];

  const captureResponse = (response: Response) => {
    if (!isPhoneResponse(response)) return;
    responseStatuses.push(response.status());
    const task = response
      .text()
      .then((text) => {
        const phone = extractPhonePayload(text);
        if (phone) capturedPhones.push(phone);
      })
      .catch(() => undefined);
    responseTasks.push(task);
  };
  page.on('response', captureResponse);

  try {
    const navigationResponse = await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    await page.waitForTimeout(900);
    const html = await page.content().catch(() => '');
    const challenge = await hasVisibleOlxSecurityChallenge(page, html);
    const loginRequired =
      /\/(?:account|login|auth)(?:[/?#]|$)/i.test(new URL(page.url()).pathname) ||
      (await page
        .locator(
          'form[action*="login" i], input[type="email"]:visible, input[type="password"]:visible, [data-testid*="login" i]:visible'
        )
        .count()
        .catch(() => 0)) > 0;

    if (loginRequired) {
      return {
        phone: '',
        stage: 'login_required',
        message: 'Sesiunea OLX a expirat. Reconecteaza contul OLX.',
      };
    }
    if (challenge) {
      return {
        phone: '',
        stage: 'challenge',
        message: 'OLX solicita o verificare manuala a contului.',
      };
    }

    const extensionResult = await requestPhoneThroughExtension(page);
    const extensionPhone = normalizePhoneCandidate(
      'phone' in extensionResult ? extensionResult.phone : ''
    );
    if (extensionPhone) {
      return {
        phone: extensionPhone,
        stage: 'success',
        message: 'Telefon preluat prin extensia OLX securizata.',
      };
    }

    const phoneResponsePromise = page
      .waitForResponse((response) => isPhoneResponse(response), { timeout: 12_000 })
      .catch(() => null);
    const buttons = [
      page.locator('[data-testid="show-phone"]:visible').last(),
      page
        .locator(
          '[data-cy*="phone" i]:visible, [data-testid*="phone" i]:visible, [aria-label*="telefon" i]:visible, [aria-label*="phone" i]:visible'
        )
        .last(),
      page.getByRole('button', { name: /arat|afi|num|telefon|phone|contact/i }).last(),
      page
        .locator('button:visible, a:visible, [role="button"]:visible')
        .filter({ hasText: /arat|afi|num|telefon|phone|contact/i })
        .last(),
    ];
    let foundPhoneControl = false;
    for (const button of buttons) {
      if (
        (await button.count().catch(() => 0)) > 0 &&
        (await button.isVisible().catch(() => false))
      ) {
        foundPhoneControl = true;
        await button.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => undefined);
        await button.click({ force: true, timeout: 10_000 }).catch(() => undefined);
        await page.waitForTimeout(1400);
        break;
      }
    }
    await phoneResponsePromise;
    await Promise.allSettled(responseTasks);
    if (capturedPhones[0]) {
      return {
        phone: capturedPhones[0],
        stage: 'success',
        message: 'Telefon preluat din sesiunea OLX a agentului.',
      };
    }

    const adIds = extractAdIds(html);
    if (adIds.length) {
      const directPayload = await page.evaluate(async ({ ids }) => {
        const statuses: number[] = [];
        for (const id of ids) {
          for (const suffix of ['limited-phones', 'phones', 'phone']) {
            const response = await fetch(`https://www.olx.ro/api/v1/offers/${id}/${suffix}`, {
              credentials: 'include',
              headers: {
                accept: 'application/json, text/plain, */*',
                'x-requested-with': 'XMLHttpRequest',
              },
            }).catch(() => null);
            if (!response) continue;
            statuses.push(response.status);
            const text = await response.text().catch(() => '');
            if (response.ok && text) return { text, statuses };
          }
        }
        return { text: '', statuses };
      }, { ids: adIds }).catch(() => ({ text: '', statuses: [] as number[] }));
      responseStatuses.push(...directPayload.statuses);
      const phone = extractPhonePayload(directPayload.text);
      if (phone) {
        return {
          phone,
          stage: 'success',
          message: 'Telefon preluat din profilul OLX al agentului.',
        };
      }
    }

    const domValue = await page.evaluate(() => {
      const phoneLink = Array.from(document.querySelectorAll('a[href^="tel:"]'))
        .map((node) => node.getAttribute('href') || '')
        .find(Boolean);
      return phoneLink || document.body.innerText || '';
    }).catch(() => '');
    const domPhone = extractPhone(domValue);
    if (domPhone) {
      return {
        phone: domPhone,
        stage: 'success',
        message: 'Telefon preluat din pagina OLX.',
      };
    }

    if (responseStatuses.includes(429)) {
      return {
        phone: '',
        stage: 'rate_limited',
        message: 'OLX a limitat temporar afisarea telefoanelor pentru acest cont.',
      };
    }
    if (responseStatuses.some((status) => status === 401 || status === 403)) {
      return {
        phone: '',
        stage: 'access_denied',
        message: 'OLX nu permite momentan afisarea telefonului pentru acest cont.',
      };
    }
    if (Number(navigationResponse?.status() || 0) >= 400) {
      return {
        phone: '',
        stage: 'listing_unavailable',
        message: 'Anuntul OLX nu mai este disponibil.',
      };
    }
    return {
      phone: '',
      stage: foundPhoneControl ? 'not_found' : 'phone_control_missing',
      message: foundPhoneControl
        ? 'OLX nu a returnat un numar pentru acest anunt.'
        : 'Anuntul OLX nu ofera un buton pentru afisarea telefonului.',
    };
  } finally {
    page.off('response', captureResponse);
  }
}

async function verifyOlxAccountPage(page: Page, context: BrowserContext) {
  await page.goto('https://www.olx.ro/myaccount/?backUrl=%2Fmyaccount', {
    waitUntil: 'domcontentloaded',
    timeout: 45_000,
  });
  await page.waitForTimeout(1500);
  const url = new URL(page.url());
  const html = await page.content().catch(() => '');
  const hasLoginForm =
    (await page
      .locator(
        'form[action*="login" i], input[type="email"]:visible, input[type="password"]:visible, [data-testid*="login" i]:visible'
      )
      .count()
      .catch(() => 0)) > 0 ||
    /\b(?:autentificare|conecteaza-te|creeaza cont)\b/i.test(
      await page.locator('body').innerText().catch(() => '')
    );
  const cookies = await context.cookies('https://www.olx.ro').catch(() => []);
  const hasAuthenticatedCookie = cookies.some((cookie) =>
    /(?:access|auth|login|session|token|user)/i.test(cookie.name)
  );
  const hasAccountControls =
    (await page
      .locator(
        'a[href*="/myaccount/settings" i], a[href*="/myaccount/answers" i], a[href*="/myaccount/notifications" i], [data-testid*="user-menu" i], [data-testid*="account-menu" i]'
      )
      .count()
      .catch(() => 0)) > 0;
  const accountPath = /^\/myaccount(?:\/|$)/i.test(url.pathname);
  const challenge = await hasVisibleOlxSecurityChallenge(page, html);
  return {
    connected:
      accountPath &&
      !hasLoginForm &&
      !challenge &&
      (hasAuthenticatedCookie || hasAccountControls),
    challenge,
  };
}

export async function confirmAgentOlxConnection(
  adminDb: Firestore,
  agencyId: string,
  uid: string
) {
  const connection = await getAgentOlxConnection(adminDb, agencyId, uid);
  if (!connection?.loginSessionId && !connection?.contextId) {
    return {
      connected: false,
      message: 'Profilul de conectare OLX nu mai este disponibil.',
    };
  }

  let browser: Awaited<ReturnType<typeof connectToBrowserbaseSession>>['browser'] | null = null;
  let shouldReleaseSession = false;
  try {
    const loginSession = connection.loginSessionId
      ? await getBrowserbaseSession(connection.loginSessionId).catch(() => null)
      : null;
    let verification: Awaited<ReturnType<typeof verifyOlxAccountPage>>;
    if (loginSession?.connectUrl && connection.loginSessionId) {
      const resources = await connectToBrowserbaseSession(connection.loginSessionId);
      browser = resources.browser;
      verification = await verifyOlxAccountPage(resources.page, resources.context);
    } else if (connection.contextId) {
      shouldReleaseSession = true;
      verification = await withBrowserbaseSession(
        {
          contextId: connection.contextId,
          purpose: 'olx-phone',
          agencyId,
          uid,
        },
        async ({ page, context }) => verifyOlxAccountPage(page, context)
      );
    } else {
      throw new Error('Profilul persistent OLX nu mai este disponibil.');
    }
    if (!verification.connected) {
      const message = verification.challenge
        ? 'OLX solicita finalizarea verificarii de securitate in fereastra de conectare.'
        : 'Autentificarea OLX nu este finalizata. Conecteaza-te si incearca din nou.';
      await markAgentOlxConnection(adminDb, agencyId, uid, {
        status: 'connecting',
        error: message,
      });
      return { connected: false, message };
    }

    shouldReleaseSession = true;
    await markAgentOlxConnection(adminDb, agencyId, uid, {
      status: 'connected',
      verified: true,
      clearLoginSession: true,
    });
    return {
      connected: true,
      message: 'Contul OLX a fost conectat.',
    };
  } catch {
    shouldReleaseSession = true;
    await markAgentOlxConnection(adminDb, agencyId, uid, {
      status: 'error',
      error: 'Nu am putut verifica sesiunea OLX. Porneste din nou conectarea.',
      clearLoginSession: true,
    });
    return {
      connected: false,
      message: 'Nu am putut verifica sesiunea OLX. Porneste din nou conectarea.',
    };
  } finally {
    await browser?.close().catch(() => undefined);
    if (shouldReleaseSession && connection.loginSessionId) {
      await releaseBrowserbaseSession(connection.loginSessionId).catch(() => undefined);
    }
  }
}

export async function resolveOlxPhoneViaAgentCloud(input: {
  adminDb: Firestore;
  agencyId: string;
  uid: string;
  url: string;
}): Promise<OlxCloudPhoneResult> {
  const connection = await getAgentOlxConnection(input.adminDb, input.agencyId, input.uid);
  if (!connection?.contextId || connection.status !== 'connected') {
    return {
      phone: '',
      stage: 'not_connected',
      message: 'Agentul trebuie sa isi conecteze contul OLX.',
    };
  }

  const leaseId = await acquireAgentOlxBrowserLease(
    input.adminDb,
    input.agencyId,
    input.uid
  );
  if (!leaseId) {
    return {
      phone: '',
      stage: 'failed',
      message: 'Profilul OLX proceseaza deja un alt anunt. Preluarea va fi reincercata automat.',
    };
  }

  try {
    const result = await withBrowserbaseSession(
      {
        contextId: connection.contextId,
        purpose: 'olx-phone',
        agencyId: input.agencyId,
        uid: input.uid,
      },
      async ({ page }) => {
        return resolvePhoneInPage(page, input.url);
      }
    );

    if (result.stage === 'login_required') {
      await markAgentOlxConnection(input.adminDb, input.agencyId, input.uid, {
        status: 'expired',
        error: result.message,
        used: true,
      });
    } else {
      await markAgentOlxConnection(input.adminDb, input.agencyId, input.uid, {
        status: 'connected',
        error: null,
        used: true,
        verified: result.stage === 'success',
      });
    }
    return result;
  } catch {
    return {
      phone: '',
      stage: 'failed',
      message: 'Browserul cloud OLX este temporar indisponibil.',
    };
  } finally {
    await releaseAgentOlxBrowserLease(
      input.adminDb,
      input.agencyId,
      input.uid,
      leaseId
    ).catch(() => undefined);
  }
}
