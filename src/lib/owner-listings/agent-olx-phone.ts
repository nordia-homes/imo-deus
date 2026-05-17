import { chromium, type Browser } from 'playwright';
import type { Firestore } from 'firebase-admin/firestore';

let browserPromise: Promise<Browser> | null = null;

type AgentOlxPhoneInput = {
  adminDb: Firestore;
  agencyId: string;
  uid: string;
  url: string;
};

type StoredOlxSession = {
  storageState?: unknown;
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

function extractPhoneFromLimitedPhonesPayload(text: string) {
  try {
    const payload = JSON.parse(text || '{}') as { data?: { phones?: string[] | null } | null };
    return payload.data?.phones?.map((value) => normalizePhoneCandidate(value)).find(Boolean) || '';
  } catch {
    return '';
  }
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

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox'],
    });
  }

  return browserPromise;
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

export async function scrapeOlxPhoneForAgent(input: AgentOlxPhoneInput) {
  if (!/^https:\/\/(?:www\.)?olx\.ro\//i.test(input.url || '')) {
    return { phone: '', message: 'URL-ul OLX este invalid.' };
  }

  let browser: Browser;
  try {
    browser = await getBrowser();
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('Executable doesn') || message.includes('playwright install')) {
      return {
        phone: '',
        message: 'Browserul Playwright pentru scraping OLX nu este instalat pe server. Redeploy-ul aplicatiei va instala Chromium automat.',
      };
    }

    return {
      phone: '',
      message: error instanceof Error ? error.message : 'Nu am putut porni browserul pentru scraping OLX.',
    };
  }

  const sessionRef = input.adminDb
    .collection('agencies')
    .doc(input.agencyId)
    .collection('agentOlxSessions')
    .doc(input.uid);
  const sessionSnapshot = await sessionRef.get();
  const session = sessionSnapshot.data() as StoredOlxSession | undefined;
  const context = await browser.newContext({
    locale: 'ro-RO',
    timezoneId: 'Europe/Bucharest',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 2200 },
    ...(session?.storageState ? { storageState: session.storageState as never } : {}),
  });
  await context.route('**/*.{png,jpg,jpeg,gif,webp,avif,svg,woff,woff2,ttf,otf,mp4,webm}', (route) => route.abort());

  const page = await context.newPage();
  const capturedPhones: string[] = [];

  const capturePhoneResponse = async (response: { url: () => string; text: () => Promise<string> }) => {
    if (!/\/limited-phones(?:[/?#]|$)/i.test(response.url())) return;
    const text = await response.text().catch(() => '');
    const phone = extractPhoneFromLimitedPhonesPayload(text);
    if (phone) capturedPhones.push(phone);
  };

  page.on('response', (response) => {
    void capturePhoneResponse(response);
  });

  try {
    await page.goto(input.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(1000).catch(() => undefined);

    const html = await page.content().catch(() => '');
    const adId = extractAdIdFromHtml(html);
    if (adId) {
      const directPayload = await page.evaluate(async ({ currentAdId }) => {
        const response = await fetch(`https://www.olx.ro/api/v1/offers/${currentAdId}/limited-phones`, {
          credentials: 'include',
          headers: { accept: 'application/json, text/plain, */*' },
        }).catch(() => null);

        return response?.ok ? await response.text().catch(() => '') : '';
      }, { currentAdId: adId }).catch(() => '');
      const directPhone = extractPhoneFromLimitedPhonesPayload(directPayload);
      if (directPhone) {
        await sessionRef.set({ storageState: await context.storageState(), updatedAt: new Date().toISOString() }, { merge: true });
        return { phone: directPhone, message: 'Telefon preluat din sesiunea OLX a agentului.' };
      }
    }

    const showPhoneButtonCandidates = [
      page.locator('[data-testid="show-phone"]').last(),
      page.getByRole('button', { name: /arat|afis|afi|numar|telefon/i }).last(),
      page.locator('button').filter({ hasText: /arat|afis|afi|numar|telefon/i }).last(),
    ];

    const phoneResponsePromise = page
      .waitForResponse((response) => /\/limited-phones(?:[/?#]|$)/i.test(response.url()), { timeout: 12000 })
      .then(async (response) => {
        await capturePhoneResponse(response);
      })
      .catch(() => undefined);

    for (const button of showPhoneButtonCandidates) {
      if ((await button.count().catch(() => 0)) > 0) {
        await button.click({ force: true, timeout: 10000 }).catch(() => undefined);
        await page.waitForTimeout(1500).catch(() => undefined);
        break;
      }
    }

    await phoneResponsePromise;

    const networkPhone = capturedPhones.find(Boolean) || '';
    if (networkPhone) {
      await sessionRef.set({ storageState: await context.storageState(), updatedAt: new Date().toISOString() }, { merge: true });
      return { phone: networkPhone, message: 'Telefon preluat din OLX.' };
    }

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
      return { phone: phoneFromDom, message: 'Telefon preluat din pagina OLX.' };
    }

    await sessionRef.set({ storageState: await context.storageState(), updatedAt: new Date().toISOString() }, { merge: true });
    return {
      phone: '',
      message: 'Nu am gasit telefonul in sesiunea web/mobil. Incearca o data din desktop pentru a conecta sesiunea OLX sau introdu numarul manual.',
    };
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }
}
