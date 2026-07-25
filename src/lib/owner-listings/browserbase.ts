import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

const BROWSERBASE_API_URL = 'https://api.browserbase.com/v1';

export type BrowserbaseSessionPurpose = 'olx-login' | 'olx-phone';

export type BrowserbaseSession = {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'ERROR' | 'TIMED_OUT' | 'COMPLETED';
  connectUrl?: string;
  expiresAt?: string;
  contextId?: string;
};

type BrowserbaseLiveUrls = {
  debuggerFullscreenUrl: string;
  debuggerUrl: string;
  wsUrl: string;
};

export class BrowserbaseConfigurationError extends Error {
  status = 503;

  constructor(message = 'Browserul cloud OLX nu este configurat.') {
    super(message);
    this.name = 'BrowserbaseConfigurationError';
  }
}

class BrowserbaseApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'BrowserbaseApiError';
    this.status = status;
  }
}

function getBrowserbaseConfiguration() {
  return {
    apiKey: String(process.env.BROWSERBASE_API_KEY || '').trim(),
    projectId: String(process.env.BROWSERBASE_PROJECT_ID || '').trim(),
    extensionId: String(process.env.BROWSERBASE_EXTENSION_ID || '').trim(),
    region: String(process.env.BROWSERBASE_REGION || 'eu-central-1').trim(),
    proxyCountry: String(process.env.BROWSERBASE_PROXY_COUNTRY || 'RO').trim().toUpperCase(),
    useProxy: !/^(?:0|false|no)$/i.test(String(process.env.BROWSERBASE_USE_PROXY || 'true').trim()),
  };
}

export function isBrowserbaseConfigured() {
  const configuration = getBrowserbaseConfiguration();
  return Boolean(configuration.apiKey && configuration.projectId);
}

function requireBrowserbaseConfiguration() {
  const configuration = getBrowserbaseConfiguration();
  if (!configuration.apiKey || !configuration.projectId) {
    throw new BrowserbaseConfigurationError(
      'Integrarea OLX necesita BROWSERBASE_API_KEY si BROWSERBASE_PROJECT_ID.'
    );
  }
  return configuration;
}

async function browserbaseRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const configuration = requireBrowserbaseConfiguration();
  const response = await fetch(`${BROWSERBASE_API_URL}${path}`, {
    ...init,
    headers: {
      'X-BB-API-Key': configuration.apiKey,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as
      | { message?: string; error?: { message?: string } }
      | null;
    const providerMessage = payload?.error?.message || payload?.message || '';
    const safeMessage =
      response.status === 401 || response.status === 403
        ? 'Credentialele browserului cloud OLX nu sunt valide.'
        : response.status === 404
          ? 'Profilul sau sesiunea OLX nu mai exista in browserul cloud.'
          : response.status === 429
            ? 'Browserul cloud OLX a atins temporar limita de utilizare.'
            : 'Browserul cloud OLX nu a putut procesa cererea.';
    throw new BrowserbaseApiError(
      providerMessage ? `${safeMessage} (${providerMessage.slice(0, 180)})` : safeMessage,
      response.status
    );
  }

  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

export async function createBrowserbaseContext() {
  const configuration = requireBrowserbaseConfiguration();
  return browserbaseRequest<{ id: string }>('/contexts', {
    method: 'POST',
    body: JSON.stringify({ projectId: configuration.projectId }),
  });
}

export async function getBrowserbaseContext(contextId: string) {
  return browserbaseRequest<{ id: string; projectId: string; updatedAt?: string }>(
    `/contexts/${encodeURIComponent(contextId)}`
  );
}

export async function deleteBrowserbaseContext(contextId: string) {
  await browserbaseRequest(`/contexts/${encodeURIComponent(contextId)}`, {
    method: 'DELETE',
  });
}

export async function createBrowserbaseSession(input: {
  contextId: string;
  purpose: BrowserbaseSessionPurpose;
  agencyId: string;
  uid: string;
}) {
  const configuration = requireBrowserbaseConfiguration();
  const isInteractive = input.purpose === 'olx-login';
  const body: Record<string, unknown> = {
    projectId: configuration.projectId,
    region: configuration.region,
    timeout: isInteractive ? 1800 : 300,
    keepAlive: isInteractive,
    browserSettings: {
      context: {
        id: input.contextId,
        persist: true,
      },
      viewport: {
        width: 1440,
        height: 960,
      },
      solveCaptchas: false,
      os: 'linux',
    },
    userMetadata: {
      app: 'imodeus',
      purpose: input.purpose,
      agencyId: input.agencyId.slice(0, 100),
      uid: input.uid.slice(0, 100),
    },
  };

  if (configuration.extensionId) {
    body.extensionId = configuration.extensionId;
  }

  if (configuration.useProxy) {
    body.proxies = [
      {
        type: 'browserbase',
        geolocation: {
          country: configuration.proxyCountry,
        },
      },
    ];
  }

  try {
    return await browserbaseRequest<BrowserbaseSession>('/sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  } catch (error) {
    const proxyUnavailable =
      configuration.useProxy &&
      error instanceof BrowserbaseApiError &&
      /proxies? (?:are|is) not included|proxy.+(?:plan|upgrade)/i.test(error.message);
    if (!proxyUnavailable) throw error;
    delete body.proxies;
    return browserbaseRequest<BrowserbaseSession>('/sessions', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }
}

export async function getBrowserbaseSession(sessionId: string) {
  return browserbaseRequest<BrowserbaseSession>(`/sessions/${encodeURIComponent(sessionId)}`);
}

export async function getBrowserbaseSessionLiveUrls(sessionId: string) {
  return browserbaseRequest<BrowserbaseLiveUrls>(
    `/sessions/${encodeURIComponent(sessionId)}/debug`
  );
}

export async function openBrowserbasePage(sessionId: string, url: string) {
  const session = await getBrowserbaseSession(sessionId);
  if (!session.connectUrl) {
    throw new BrowserbaseApiError('Sesiunea OLX nu mai permite navigarea.', 409);
  }

  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(session.connectUrl!);
    let settled = false;
    const timeout = setTimeout(() => {
      finish(new BrowserbaseApiError('Sesiunea OLX nu a deschis pagina de autentificare.', 504));
    }, 20_000);

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      socket.close();
      if (error) reject(error);
      else resolve();
    };

    socket.addEventListener('open', () => {
      socket.send(
        JSON.stringify({
          id: 1,
          method: 'Target.createTarget',
          params: { url },
        })
      );
    });
    socket.addEventListener('message', (event) => {
      try {
        const payload = JSON.parse(String(event.data || '{}')) as {
          id?: number;
          result?: { targetId?: string };
          error?: { message?: string };
        };
        if (payload.error) {
          finish(
            new BrowserbaseApiError(
              payload.error.message || 'Browserul cloud nu a putut deschide OLX.',
              502
            )
          );
          return;
        }
        if (payload.id === 1 && payload.result?.targetId) {
          socket.send(
            JSON.stringify({
              id: 2,
              method: 'Target.activateTarget',
              params: { targetId: payload.result.targetId },
            })
          );
          return;
        }
        if (payload.id === 2) finish();
      } catch {
        // Ignore unrelated Chrome DevTools Protocol events.
      }
    });
    socket.addEventListener('error', () => {
      finish(new BrowserbaseApiError('Nu ne-am putut conecta la sesiunea OLX.', 502));
    });
    socket.addEventListener('close', () => {
      if (!settled) {
        finish(new BrowserbaseApiError('Sesiunea OLX s-a inchis inainte de navigare.', 409));
      }
    });
  });
}

export async function releaseBrowserbaseSession(sessionId: string) {
  const configuration = requireBrowserbaseConfiguration();
  await browserbaseRequest(`/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'POST',
    body: JSON.stringify({
      status: 'REQUEST_RELEASE',
      projectId: configuration.projectId,
    }),
  }).catch((error) => {
    if (error instanceof BrowserbaseApiError && (error.status === 404 || error.status === 409)) {
      return;
    }
    throw error;
  });
}

export async function connectToBrowserbaseSession(sessionId: string) {
  const session = await getBrowserbaseSession(sessionId);
  if (!session.connectUrl) {
    throw new BrowserbaseApiError('Sesiunea OLX nu mai permite conectarea.', 409);
  }
  const browser = await chromium.connectOverCDP(session.connectUrl, { timeout: 30_000 });
  const context = browser.contexts()[0];
  if (!context) {
    await browser.close().catch(() => undefined);
    throw new BrowserbaseApiError('Sesiunea OLX nu contine un profil activ.', 409);
  }
  const page = context.pages()[0] || await context.newPage();
  return { browser, context, page, session };
}

export async function withBrowserbaseSession<T>(
  input: {
    contextId: string;
    purpose: BrowserbaseSessionPurpose;
    agencyId: string;
    uid: string;
  },
  handler: (resources: {
    browser: Browser;
    context: BrowserContext;
    page: Page;
    session: BrowserbaseSession;
  }) => Promise<T>
) {
  const session = await createBrowserbaseSession(input);
  let browser: Browser | null = null;

  try {
    const connected = await connectToBrowserbaseSession(session.id);
    browser = connected.browser;
    return await handler(connected);
  } finally {
    await browser?.close().catch(() => undefined);
    await releaseBrowserbaseSession(session.id).catch(() => undefined);
  }
}
