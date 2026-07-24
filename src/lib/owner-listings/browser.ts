import {
  chromium,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
} from 'playwright';

let browserPromise: Promise<Browser> | null = null;
let browserInstance: Browser | null = null;
let browserUseCount = 0;
let browserLeaseTail: Promise<void> = Promise.resolve();
const remoteBrowserPromises = new Map<string, Promise<Browser>>();
const MAX_BROWSER_USES = Math.max(1, Number(process.env.SCRAPER_BROWSER_MAX_USES || 6));
const SCRAPER_ASSET_PATTERN = '**/*.{png,jpg,jpeg,gif,webp,avif,svg,woff,woff2,ttf,otf,mp4,webm}';

export type ScraperPageOptions = {
  storageState?: BrowserContextOptions['storageState'];
  blockAssets?: boolean;
};

export function isBrowserLifecycleError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return /target (?:page|context|browser).*closed|browser.*(?:closed|disconnected)|connection closed|browser process|process exited|has been closed|crash|econnreset|epipe/i.test(
    message
  );
}

async function disposeLocalBrowser() {
  const browser = browserInstance;
  browserInstance = null;
  browserPromise = null;
  browserUseCount = 0;

  if (browser?.isConnected()) {
    await browser.close().catch(() => undefined);
  }
}

async function withBrowserLease<T>(handler: () => Promise<T>) {
  const previousLease = browserLeaseTail;
  let releaseLease: () => void = () => undefined;
  browserLeaseTail = new Promise<void>((resolve) => {
    releaseLease = resolve;
  });

  await previousLease.catch(() => undefined);
  try {
    return await handler();
  } finally {
    releaseLease();
  }
}

async function getBrowser() {
  if (browserInstance?.isConnected()) {
    return browserInstance;
  }

  if (browserPromise) {
    try {
      const existingBrowser = await browserPromise;
      if (existingBrowser.isConnected()) {
        browserInstance = existingBrowser;
        return existingBrowser;
      }
    } catch {
      // The rejected launch must not poison every subsequent request.
    }
    browserPromise = null;
    browserInstance = null;
  }

  const launchPromise = chromium.launch({
      headless: true,
      channel: 'chromium',
      args: [
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-background-networking',
        '--no-zygote',
        '--single-process',
      ],
    })
    .then((browser) => {
      browserInstance = browser;
      browser.on('disconnected', () => {
        if (browserInstance === browser) {
          browserInstance = null;
          browserPromise = null;
          browserUseCount = 0;
        }
      });
      return browser;
    })
    .catch((error) => {
      browserInstance = null;
      browserPromise = null;
      throw error;
    });

  browserPromise = launchPromise;
  return launchPromise;
}

async function getRemoteBrowser(cdpUrl: string) {
  const normalizedUrl = cdpUrl.trim();
  if (!normalizedUrl) {
    throw new Error('Missing CDP browser URL');
  }

  const existingPromise = remoteBrowserPromises.get(normalizedUrl);
  if (existingPromise) {
    try {
      const existingBrowser = await existingPromise;
      if (existingBrowser.isConnected()) {
        return existingBrowser;
      }
    } catch {
      // Reconnect below.
    }
    remoteBrowserPromises.delete(normalizedUrl);
  }

  const remoteBrowserPromise = chromium.connectOverCDP(normalizedUrl)
    .then((browser) => {
      browser.on('disconnected', () => {
        if (remoteBrowserPromises.get(normalizedUrl) === remoteBrowserPromise) {
          remoteBrowserPromises.delete(normalizedUrl);
        }
      });
      return browser;
    })
    .catch((error) => {
      remoteBrowserPromises.delete(normalizedUrl);
      throw error;
    });
  remoteBrowserPromises.set(normalizedUrl, remoteBrowserPromise);
  return remoteBrowserPromise;
}

function buildContextOptions(options: ScraperPageOptions): BrowserContextOptions {
  const storageStatePath = process.env.OLX_STORAGE_STATE_PATH;
  return {
    locale: 'ro-RO',
    timezoneId: 'Europe/Bucharest',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 2200 },
    ...(options.storageState
      ? { storageState: options.storageState }
      : storageStatePath
        ? { storageState: storageStatePath }
        : {}),
  };
}

export async function withScraperPage<T>(
  handler: (page: Page, context: BrowserContext) => Promise<T>,
  options: ScraperPageOptions = {}
) {
  return withBrowserLease(async () => {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      if (browserUseCount >= MAX_BROWSER_USES) {
        await disposeLocalBrowser();
      }

      let context: BrowserContext | null = null;
      try {
        const browser = await getBrowser();
        context = await browser.newContext(buildContextOptions(options));
        browserUseCount += 1;

        if (options.blockAssets !== false) {
          await context.route(SCRAPER_ASSET_PATTERN, (route) => route.abort());
        }

        const page = await context.newPage();
        return await handler(page, context);
      } catch (error) {
        lastError = error;
        if (attempt === 2 || !isBrowserLifecycleError(error)) {
          throw error;
        }

        await disposeLocalBrowser();
      } finally {
        await context?.close().catch(() => undefined);
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Browserul de scraping nu este disponibil.');
  });
}

export async function withRemoteBrowserPage<T>(
  cdpUrl: string,
  handler: (page: Page, context: BrowserContext) => Promise<T>
) {
  const browser = await getRemoteBrowser(cdpUrl);
  const context = browser.contexts()[0];
  if (!context) {
    throw new Error(`No browser context available for CDP URL ${cdpUrl}`);
  }

  const page = await context.newPage();

  try {
    return await handler(page, context);
  } finally {
    await page.close().catch(() => undefined);
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

export type ScraperResponse = {
  html: string;
  finalUrl: string;
  status: number;
};

export type FetchScraperResponseOptions = {
  acceptHttpErrors?: boolean;
  maxAttempts?: number;
};

export async function fetchScraperResponse(
  url: string,
  timeoutMs = 30000,
  options: FetchScraperResponseOptions = {}
): Promise<ScraperResponse> {
  let lastError: unknown;
  const maxAttempts = Math.max(1, Math.min(options.maxAttempts ?? 3, 3));

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
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
        redirect: 'follow',
      });

      if (response.ok || options.acceptHttpErrors) {
        return { html: await response.text(), finalUrl: response.url || url, status: response.status };
      }

      const error = new Error(`Request failed with status ${response.status} for ${url}`) as Error & {
        retryable?: boolean;
        status?: number;
      };
      const retryable = response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500;
      error.retryable = retryable;
      error.status = response.status;
      if (!retryable || attempt === maxAttempts) {
        throw error;
      }

      lastError = error;
      await response.body?.cancel().catch(() => undefined);
    } catch (error) {
      lastError = error;
      if ((error as { retryable?: boolean })?.retryable === false || attempt === maxAttempts) {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }

    await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
  }

  throw lastError instanceof Error ? lastError : new Error(`Request failed for ${url}`);
}

export async function fetchScraperHtml(
  url: string,
  timeoutMs = 30000,
  options: FetchScraperResponseOptions = {}
) {
  return (await fetchScraperResponse(url, timeoutMs, options)).html;
}

export async function fetchScraperHtmlViaBrowser(
  url: string,
  selectors: string[] = ['body'],
  timeoutMs = 30000
) {
  return withScraperPage(async (page) => {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await waitForScraperReady(page, selectors, Math.min(timeoutMs, 12000));
    return page.content();
  });
}

export async function fetchScraperResponseViaBrowser(
  url: string,
  selectors: string[] = ['body'],
  timeoutMs = 30000
): Promise<ScraperResponse> {
  return withScraperPage(async (page) => {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await waitForScraperReady(page, selectors, Math.min(timeoutMs, 12000));
    return {
      html: await page.content(),
      finalUrl: page.url() || url,
      status: response?.status() || 200,
    };
  });
}
