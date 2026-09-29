import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => {
  const documents = new Map<string, Record<string, unknown>>();
  const doc = (path: string): any => ({
    get: async () => ({ exists: documents.has(path), data: () => documents.get(path) }),
    set: async (value: Record<string, unknown>, options?: { merge?: boolean }) => documents.set(path, options?.merge ? { ...documents.get(path), ...value } : value),
    delete: async () => documents.delete(path),
    collection: (name: string) => collection(`${path}/${name}`),
  });
  const collection = (path: string): any => ({ doc: (id: string) => doc(`${path}/${id}`) });
  return { documents, db: { collection } };
});
vi.mock('@/firebase/admin', () => ({ adminDb: firestore.db }));
vi.mock('@/lib/tiktok-video-library', () => ({ buildTikTokVideoLibrary: vi.fn() }));
vi.mock('@/lib/tiktok-organic-media', () => ({ planTikTokVideoChunks: vi.fn(), prepareTikTokVideo: vi.fn(), uploadTikTokVideo: vi.fn() }));

import { createTikTokAuthorization, finalizeTikTokAuthorization, getTikTokMarketingStatus } from '@/lib/tiktok-marketing';

const original = { ...process.env };
beforeEach(() => {
  firestore.documents.clear();
  process.env.TIKTOK_CLIENT_KEY = 'production-key';
  process.env.TIKTOK_CLIENT_SECRET = 'production-secret';
  process.env.TIKTOK_SANDBOX_CLIENT_KEY = 'sandbox-key';
  process.env.TIKTOK_SANDBOX_CLIENT_SECRET = 'sandbox-secret';
  process.env.TIKTOK_TOKEN_ENCRYPTION_KEY = 'stable-encryption-key';
  process.env.TIKTOK_REDIRECT_URI = 'https://imodeus.ro/auth/tiktok/callback';
});
afterEach(() => { process.env = { ...original }; vi.unstubAllGlobals(); });

describe('TikTok organic Sandbox OAuth', () => {
  it('uses sandbox credentials for authorization and token exchange without changing production credentials', async () => {
    const auth = await createTikTokAuthorization({ agencyId: 'agency', requestedByUid: 'user', environment: 'sandbox' });
    const authorizeUrl = new URL(auth.authorizationUrl);
    expect(authorizeUrl.searchParams.get('client_key')).toBe('sandbox-key');
    expect(authorizeUrl.searchParams.get('redirect_uri')).toBe('https://imodeus.ro/auth/tiktok/callback');
    expect(firestore.documents.get(`tiktokOauthStates/${auth.state}`)?.environment).toBe('sandbox');

    const requests: URLSearchParams[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
      if (input.endsWith('/v2/oauth/token/')) {
        requests.push(new URLSearchParams(String(init?.body)));
        return new Response(JSON.stringify({ access_token: 'access', refresh_token: 'refresh', open_id: 'tiktok-user', scope: 'user.info.basic,video.publish', expires_in: 3600 }), { status: 200 });
      }
      return new Response(JSON.stringify({ data: { user: { open_id: 'tiktok-user', display_name: 'Tester' } }, error: { code: 'ok' } }), { status: 200 });
    }));
    await finalizeTikTokAuthorization({ code: 'test-code', state: auth.state });
    expect(requests).toHaveLength(1);
    expect(requests[0].get('client_key')).toBe('sandbox-key');
    expect(requests[0].get('client_secret')).toBe('sandbox-secret');
    expect(firestore.documents.get('userPrivateIntegrations/user__tiktok')?.environment).toBe('sandbox');
    expect((await getTikTokMarketingStatus('user')).environment).toBe('sandbox');
    expect((await getTikTokMarketingStatus('user')).sandboxAvailable).toBe(true);
    const production = await createTikTokAuthorization({ agencyId: 'agency', requestedByUid: 'user' });
    expect(new URL(production.authorizationUrl).searchParams.get('client_key')).toBe('production-key');
  });
});
