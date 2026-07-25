import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createBrowserbaseContext,
  createBrowserbaseSession,
  isBrowserbaseConfigured,
  openBrowserbasePage,
} from '@/lib/owner-listings/browserbase';

const originalEnvironment = {
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
  extensionId: process.env.BROWSERBASE_EXTENSION_ID,
  region: process.env.BROWSERBASE_REGION,
  proxyCountry: process.env.BROWSERBASE_PROXY_COUNTRY,
  useProxy: process.env.BROWSERBASE_USE_PROXY,
};

function restoreEnvironment() {
  const entries = [
    ['BROWSERBASE_API_KEY', originalEnvironment.apiKey],
    ['BROWSERBASE_PROJECT_ID', originalEnvironment.projectId],
    ['BROWSERBASE_EXTENSION_ID', originalEnvironment.extensionId],
    ['BROWSERBASE_REGION', originalEnvironment.region],
    ['BROWSERBASE_PROXY_COUNTRY', originalEnvironment.proxyCountry],
    ['BROWSERBASE_USE_PROXY', originalEnvironment.useProxy],
  ] as const;
  for (const [key, value] of entries) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

afterEach(() => {
  restoreEnvironment();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Browserbase OLX profiles', () => {
  it('reports missing cloud credentials without performing a request', () => {
    delete process.env.BROWSERBASE_API_KEY;
    delete process.env.BROWSERBASE_PROJECT_ID;

    expect(isBrowserbaseConfigured()).toBe(false);
  });

  it('creates a persistent Romanian profile with the invisible extension', async () => {
    process.env.BROWSERBASE_API_KEY = 'bb-test-key';
    process.env.BROWSERBASE_PROJECT_ID = 'project-test';
    process.env.BROWSERBASE_EXTENSION_ID = 'extension-test';
    process.env.BROWSERBASE_REGION = 'eu-central-1';
    process.env.BROWSERBASE_PROXY_COUNTRY = 'RO';
    process.env.BROWSERBASE_USE_PROXY = 'true';

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 'context-test' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'session-test',
            status: 'RUNNING',
            connectUrl: 'wss://connect.browserbase.test',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        )
      );

    const context = await createBrowserbaseContext();
    const session = await createBrowserbaseSession({
      contextId: context.id,
      purpose: 'olx-phone',
      agencyId: 'agency-test',
      uid: 'agent-test',
    });

    expect(session.id).toBe('session-test');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://api.browserbase.com/v1/contexts');
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      'X-BB-API-Key': 'bb-test-key',
    });

    const sessionBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body || '{}'));
    expect(sessionBody).toMatchObject({
      projectId: 'project-test',
      region: 'eu-central-1',
      keepAlive: false,
      extensionId: 'extension-test',
      browserSettings: {
        context: {
          id: 'context-test',
          persist: true,
        },
        solveCaptchas: false,
      },
      proxies: [
        {
          type: 'browserbase',
          geolocation: { country: 'RO' },
        },
      ],
      userMetadata: {
        app: 'imodeus',
        purpose: 'olx-phone',
        agencyId: 'agency-test',
        uid: 'agent-test',
      },
    });
  });

  it('keeps login sessions alive long enough for manual authentication', async () => {
    process.env.BROWSERBASE_API_KEY = 'bb-test-key';
    process.env.BROWSERBASE_PROJECT_ID = 'project-test';
    process.env.BROWSERBASE_USE_PROXY = 'false';

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'login-session',
          status: 'RUNNING',
          connectUrl: 'wss://connect.browserbase.test',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    await createBrowserbaseSession({
      contextId: 'context-test',
      purpose: 'olx-login',
      agencyId: 'agency-test',
      uid: 'agent-test',
    });

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body || '{}'));
    expect(body.keepAlive).toBe(true);
    expect(body.timeout).toBe(1800);
    expect(body.proxies).toBeUndefined();
  });

  it('opens and activates the OLX account page before showing Live View', async () => {
    process.env.BROWSERBASE_API_KEY = 'bb-test-key';
    process.env.BROWSERBASE_PROJECT_ID = 'project-test';
    const sentMessages: Array<Record<string, unknown>> = [];

    class TestWebSocket {
      private listeners = new Map<string, Array<(event: { data?: string }) => void>>();

      constructor(public url: string) {
        queueMicrotask(() => this.emit('open', {}));
      }

      addEventListener(type: string, listener: (event: { data?: string }) => void) {
        const listeners = this.listeners.get(type) || [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
      }

      send(value: string) {
        const message = JSON.parse(value) as { id: number; method: string };
        sentMessages.push(message);
        queueMicrotask(() => {
          this.emit('message', {
            data: JSON.stringify(
              message.id === 1
                ? { id: 1, result: { targetId: 'olx-target' } }
                : { id: 2, result: {} }
            ),
          });
        });
      }

      close() {
        this.emit('close', {});
      }

      private emit(type: string, event: { data?: string }) {
        for (const listener of this.listeners.get(type) || []) listener(event);
      }
    }

    vi.stubGlobal('WebSocket', TestWebSocket);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'login-session',
          status: 'RUNNING',
          connectUrl: 'wss://connect.browserbase.test',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    await openBrowserbasePage(
      'login-session',
      'https://www.olx.ro/myaccount/?backUrl=%2Fmyaccount'
    );

    expect(sentMessages).toEqual([
      {
        id: 1,
        method: 'Target.createTarget',
        params: {
          url: 'https://www.olx.ro/myaccount/?backUrl=%2Fmyaccount',
        },
      },
      {
        id: 2,
        method: 'Target.activateTarget',
        params: { targetId: 'olx-target' },
      },
    ]);
  });
});
