import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => {
  const documents = new Map<string, Record<string, unknown>>();
  let transactionTail: Promise<unknown> = Promise.resolve();
  const snapshot = (path: string) => ({
    exists: documents.has(path),
    id: path.split('/').at(-1) || '',
    data: () => documents.get(path),
  });
  const document = (path: string): any => ({
    path,
    get: async () => snapshot(path),
    set: async (data: Record<string, unknown>, options?: { merge?: boolean }) => {
      documents.set(path, options?.merge ? { ...(documents.get(path) || {}), ...data } : { ...data });
    },
    create: async (data: Record<string, unknown>) => {
      if (documents.has(path)) throw new Error('already exists');
      documents.set(path, { ...data });
    },
    update: async (data: Record<string, unknown>) => {
      if (!documents.has(path)) throw new Error('missing');
      documents.set(path, { ...documents.get(path), ...data });
    },
    delete: async () => { documents.delete(path); },
    collection: (name: string) => collection(`${path}/${name}`),
  });
  const collection = (path: string): any => ({ doc: (id: string) => document(`${path}/${id}`) });
  const transaction = {
    get: async (ref: any) => snapshot(ref.path),
    set: (ref: any, data: Record<string, unknown>, options?: { merge?: boolean }) => {
      documents.set(ref.path, options?.merge ? { ...(documents.get(ref.path) || {}), ...data } : { ...data });
    },
    create: (ref: any, data: Record<string, unknown>) => {
      if (documents.has(ref.path)) throw new Error('already exists');
      documents.set(ref.path, { ...data });
    },
    update: (ref: any, data: Record<string, unknown>) => {
      if (!documents.has(ref.path)) throw new Error('missing');
      documents.set(ref.path, { ...documents.get(ref.path), ...data });
    },
  };
  return {
    documents,
    db: {
      collection,
      runTransaction: <T>(callback: (value: typeof transaction) => Promise<T>) => {
        const task = transactionTail.then(() => callback(transaction));
        transactionTail = task.then(() => undefined, () => undefined);
        return task;
      },
    },
    reset() {
      documents.clear();
      transactionTail = Promise.resolve();
    },
  };
});

vi.mock('@/firebase/admin', () => ({ adminDb: firestore.db }));

import { encryptTikTokSecret, sha256Hex } from '../crypto';
import {
  createTikTokMcpAuthorization,
  discoverTikTokMcpAuthorization,
  disconnectTikTokMcp,
  finalizeTikTokMcpAuthorization,
  getValidTikTokMcpAccessToken,
} from '../oauth';

const resourceUrl = 'https://business-api.tiktok.com/open_mcp/tt-ads-mcp-layer';
const issuer = `${resourceUrl}/oauth`;

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

function metadataFetch(token?: { access_token: string; refresh_token?: string; expires_in?: number }) {
  return vi.fn(async (request: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(request);
    if (url.includes('oauth-protected-resource')) return json({ resource: resourceUrl, authorization_servers: [issuer], scopes_supported: ['mcp:tt4b'], bearer_methods_supported: ['header'] });
    if (url.includes('.well-known/oauth-authorization-server')) return json({
      issuer,
      authorization_endpoint: 'https://business-api.tiktok.com/portal/mcp-tt4b-authorize',
      token_endpoint: `${issuer}/token`,
      registration_endpoint: `${issuer}/register`,
      revocation_endpoint: `${issuer}/revoke`,
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['mcp:tt4b'],
    });
    if (url.endsWith('/register')) return json({ client_id: 'client-1' });
    if (url.endsWith('/token')) return json(token || { access_token: 'access-1', refresh_token: 'refresh-1', expires_in: 3600 });
    if (url.endsWith('/revoke')) return new Response(null, { status: 200 });
    throw new Error(`unexpected URL ${url}`);
  });
}

beforeEach(() => {
  firestore.reset();
  process.env.TIKTOK_ADS_MCP_TOKEN_ENCRYPTION_KEY = 'test-key-that-is-long-and-dedicated';
  process.env.NEXT_PUBLIC_APP_URL = 'https://imodeus.example';
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TIKTOK_ADS_MCP_TOKEN_ENCRYPTION_KEY;
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe('TikTok MCP OAuth lifecycle', () => {
  it('uses metadata discovery, PKCE, browser binding, one-time state and token exchange', async () => {
    vi.stubGlobal('fetch', metadataFetch());
    const authorization = await createTikTokMcpAuthorization({ organizationId: 'org-1', requestedByUid: 'user-1', returnTo: 'https://evil.example' });
    const url = new URL(authorization.authorizationUrl);
    const state = url.searchParams.get('state') || '';
    expect(url.origin + url.pathname).toBe('https://business-api.tiktok.com/portal/mcp-tt4b-authorize');
    expect(url.searchParams.get('scope')).toBe('mcp:tt4b');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(authorization.callbackBinding).toBe(sha256Hex(state));
    const storedState = firestore.documents.get(`tiktokAdsOauthStates/${sha256Hex(state)}`);
    expect(storedState).toMatchObject({ organizationId: 'org-1', requestedByUid: 'user-1', returnTo: '/properties', consumedAt: null });

    const connected = await finalizeTikTokMcpAuthorization({ code: 'code-1', state, callbackBinding: authorization.callbackBinding });
    expect(connected).toMatchObject({ organizationId: 'org-1', requestedByUid: 'user-1', returnTo: '/properties' });
    expect(firestore.documents.get('agencyPrivateIntegrations/org-1__tiktok_ads')).toMatchObject({ connected: true, transport: 'mcp', tokenEncryptionVersion: 3 });
    expect(firestore.documents.has(`tiktokAdsOauthStates/${sha256Hex(state)}`)).toBe(false);
    await expect(finalizeTikTokMcpAuthorization({ code: 'code-1', state, callbackBinding: authorization.callbackBinding })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects a missing browser binding and expired state before token exchange', async () => {
    const fetchMock = metadataFetch();
    vi.stubGlobal('fetch', fetchMock);
    await expect(finalizeTikTokMcpAuthorization({ code: 'code', state: 'state', callbackBinding: 'wrong' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    const state = 'expired-state';
    firestore.documents.set(`tiktokAdsOauthStates/${sha256Hex(state)}`, {
      organizationId: 'org-1', requestedByUid: 'user-1', returnTo: '/properties', resourceUrl, authorizationServer: issuer,
      tokenEndpoint: `${issuer}/token`, clientId: 'client-1', encryptedCodeVerifier: encryptTikTokSecret('verifier', 'oauth-state'),
      createdAt: new Date(Date.now() - 20_000).toISOString(), expiresAt: new Date(Date.now() - 1_000).toISOString(), consumedAt: null,
    });
    await expect(finalizeTikTokMcpAuthorization({ code: 'code', state, callbackBinding: sha256Hex(state) })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('serializes concurrent refreshes and revokes both token classes on disconnect', async () => {
    let tokenCalls = 0;
    const fetchMock = metadataFetch({ access_token: 'access-new', refresh_token: 'refresh-new', expires_in: 3600 });
    vi.stubGlobal('fetch', vi.fn(async (request: RequestInfo | URL, init?: RequestInit) => {
      if (String(request).endsWith('/token')) tokenCalls += 1;
      return fetchMock(request, init);
    }));
    firestore.documents.set('agencyPrivateIntegrations/org-1__tiktok_ads', {
      organizationId: 'org-1', provider: 'tiktok_ads', transport: 'mcp', connected: true,
      encryptedAccessToken: encryptTikTokSecret('access-old'), encryptedRefreshToken: encryptTikTokSecret('refresh-old'),
      accessTokenExpiresAt: new Date(Date.now() - 1_000).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      scope: ['mcp:tt4b'], clientId: 'client-1', authorizationServer: issuer, resourceUrl,
      connectedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tokenEncryptionVersion: 3,
    });
    const [left, right] = await Promise.all([getValidTikTokMcpAccessToken('org-1'), getValidTikTokMcpAccessToken('org-1')]);
    expect(left.accessToken).toBe('access-new');
    expect(right.accessToken).toBe('access-new');
    expect(tokenCalls).toBe(1);

    await disconnectTikTokMcp('org-1');
    expect(firestore.documents.has('agencyPrivateIntegrations/org-1__tiktok_ads')).toBe(false);
    expect(firestore.documents.get('agencies/org-1/integrations/tiktok_ads')).toMatchObject({ connected: false, transport: 'mcp' });
    const revokeCalls = (fetch as ReturnType<typeof vi.fn>).mock.calls.filter(([request]) => String(request).endsWith('/revoke'));
    expect(revokeCalls).toHaveLength(2);
  });

  it('rejects an authorization server outside the official TikTok host before fetching it', async () => {
    const fetchMock = vi.fn(async () => json({
      resource: resourceUrl,
      authorization_servers: ['https://evil.example/oauth'],
      scopes_supported: ['mcp:tt4b'],
      bearer_methods_supported: ['header'],
    }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(discoverTikTokMcpAuthorization()).rejects.toMatchObject({ code: 'INVALID_REQUEST' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
