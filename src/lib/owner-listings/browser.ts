import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

let browserPromise: Promise<Browser> | null = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
      args: ['--disable-dev-shm-usage', '--no-sandbox'],
    });
  }

  return browserPromise;
}

export async function withScraperPage<T>(handler: (page: Page, context: BrowserContext) => Promise<T>) {
  const browser = await getBrowser();
  const context = await browser.newContext({
    locale: 'ro-RO',
    timezoneId: 'Europe/Bucharest',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 2200 },
  });

  await context.route('**/*.{png,jpg,jpeg,gif,webp,avif,svg,woff,woff2,ttf,otf,mp4,webm}', (route) => route.abort());
  const page = await context.newPage();

  try {
    return await handler(page, context);
  } finally {
    await context.close();
  }
}

export async function waitForScraperReady(page: Page, selectors: string[], timeoutMs = 12000) {
  const startedAt = Date.now();

  for (const selector of selectors) {
    const remaining = Math.max(1000, timeoutMs - (Date.now() - startedAt));
    try {
      await page.waitForSelector(selector, { timeout: remaining });
      return;
    } catch {
      // Try next selector.
    }
  }

  await page.waitForTimeout(1500).catch(() => undefined);
}

export async function fetchScraperHtml(url: string, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status} for ${url}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}
