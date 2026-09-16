import { adminDb } from '@/firebase/admin';
import { timingSafeEqual } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { TikTokAdsError, normalizeTikTokProviderError } from './errors';
import { createPkcePair, decryptTikTokSecret, encryptTikTokSecret, randomOpaque, sha256Hex } from './crypto';
import type { TikTokMcpConnection } from './types';

const PRIVATE_COLLECTION = 'agencyPrivateIntegrations';
const STATE_COLLECTION = 'tiktokAdsOauthStates';
const CLIENT_COLLECTION = 'tiktokMcpOAuthClients';
const PROVIDER = 'tiktok_ads';
const DEFAULT_MCP_URL = 'https://business-api.tiktok.com/open_mcp/tt-ads-mcp-flat';
const DEFAULT_SCOPE = 'mcp:tt4b';
const HTTP_TIMEOUT_MS = 20_000;

function assertOfficialTikTokUrl(value: string, label: string, options: { openMcp?: boolean } = {}) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TikTokAdsError('INVALID_REQUEST', `${label} nu este un URL valid.`);
  }
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'business-api.tiktok.com' || url.username || url.password || url.port && url.port !== '443') {
    throw new TikTokAdsError('INVALID_REQUEST', `${label} trebuie să folosească exclusiv endpointurile HTTPS oficiale business-api.tiktok.com.`);
  }
  if (options.openMcp && !url.pathname.startsWith('/open_mcp/')) {
    throw new TikTokAdsError('INVALID_REQUEST', `${label} trebuie să indice namespace-ul oficial /open_mcp/.`);
  }
  return url;
}

type ProtectedResourceMetadata = {
  resource: string;
  authorization_servers: string[];
  scopes_supported?: string[];
  bearer_methods_supported?: string[];
};

export type AuthorizationServerMetadata = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  revocation_endpoint?: string;
  code_challenge_methods_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
  scopes_supported?: string[];
};

type OAuthTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
};

type OAuthStateRecord = {
  organizationId: string;
  requestedByUid: string;
  returnTo: string;
  resourceUrl: string;
  authorizationServer: string;
  tokenEndpoint: string;
  revocationEndpoint?: string | null;
  clientId: string;
  encryptedCodeVerifier: string;
  createdAt: string;
  expiresAt: string;
  expiresAtTimestamp: Timestamp;
  consumedAt?: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

export function getTikTokMcpResourceUrl() {
  const configured = (process.env.TIKTOK_ADS_MCP_URL || DEFAULT_MCP_URL).trim();
  const url = assertOfficialTikTokUrl(configured, 'TIKTOK_ADS_MCP_URL', { openMcp: true });
  return url.toString().replace(/\/$/, '');
}

function getCallbackUrl() {
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || 'https://imodeus.ro').replace(/\/+$/, '');
  const configured = (process.env.TIKTOK_ADS_MCP_REDIRECT_URI || `${base}/auth/tiktok-ads/callback`).trim();
  const url = new URL(configured);
  if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.hostname === 'localhost')) {
    throw new TikTokAdsError('INVALID_REQUEST', 'Callback-ul TikTok MCP trebuie să folosească HTTPS.');
  }
  if (url.username || url.password || url.protocol === 'https:' && url.port && url.port !== '443') {
    throw new TikTokAdsError('INVALID_REQUEST', 'Callback-ul TikTok MCP conține credentials sau un port nepermis.');
  }
  return url.toString();
}

function privateRef(organizationId: string) {
  return adminDb.collection(PRIVATE_COLLECTION).doc(`${organizationId}__${PROVIDER}`);
}

function publicRef(organizationId: string) {
  return adminDb.collection('agencies').doc(organizationId).collection('integrations').doc(PROVIDER);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
    const payload = await response.json().catch(() => null) as T | { error?: string; error_description?: string } | null;
    if (!response.ok || !payload) {
      const oauth = payload as { error?: string; error_description?: string } | null;
      throw normalizeTikTokProviderError({ status: response.status, message: oauth?.error_description || oauth?.error });
    }
    return payload as T;
  } catch (error) {
    if (error instanceof TikTokAdsError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new TikTokAdsError('TIMEOUT', 'Metadata OAuth TikTok nu a răspuns la timp.', { retryable: true });
    throw new TikTokAdsError('PROVIDER_UNAVAILABLE', 'Metadata OAuth TikTok nu a putut fi citită.', { retryable: true, cause: error });
  } finally {
    clearTimeout(timeout);
  }
}

function protectedResourceMetadataUrl(resourceUrl: string) {
  const resource = new URL(resourceUrl);
  return `${resource.origin}/.well-known/oauth-protected-resource${resource.pathname}`;
}

async function getAuthorizationMetadata(issuer: string) {
  const issuerUrl = assertOfficialTikTokUrl(issuer, 'Issuer-ul OAuth TikTok MCP');
  const normalized = issuerUrl.toString().replace(/\/$/, '');
  const candidates = [
    `${normalized}/.well-known/oauth-authorization-server`,
    `${new URL(normalized).origin}/.well-known/oauth-authorization-server${new URL(normalized).pathname}`,
  ];
  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const metadata = await fetchJson<AuthorizationServerMetadata>(candidate, { headers: { Accept: 'application/json' } });
      if (!metadata.issuer || !metadata.authorization_endpoint || !metadata.token_endpoint) continue;
      const metadataIssuer = assertOfficialTikTokUrl(metadata.issuer, 'Issuer-ul din metadata OAuth').toString().replace(/\/$/, '');
      if (metadataIssuer !== normalized) continue;
      assertOfficialTikTokUrl(metadata.authorization_endpoint, 'Authorization endpoint-ul OAuth');
      assertOfficialTikTokUrl(metadata.token_endpoint, 'Token endpoint-ul OAuth');
      if (metadata.registration_endpoint) assertOfficialTikTokUrl(metadata.registration_endpoint, 'Registration endpoint-ul OAuth');
      if (metadata.revocation_endpoint) assertOfficialTikTokUrl(metadata.revocation_endpoint, 'Revocation endpoint-ul OAuth');
      return metadata;
    } catch (error) {
      lastError = error;
    }
  }
  throw new TikTokAdsError('PROVIDER_UNAVAILABLE', 'TikTok nu a publicat metadata OAuth compatibilă pentru MCP.', { cause: lastError });
}

export async function discoverTikTokMcpAuthorization() {
  const resourceUrl = getTikTokMcpResourceUrl();
  const resource = await fetchJson<ProtectedResourceMetadata>(protectedResourceMetadataUrl(resourceUrl), {
    headers: { Accept: 'application/json' },
  });
  if (resource.resource !== resourceUrl || !resource.authorization_servers?.length) {
    throw new TikTokAdsError('PROVIDER_UNAVAILABLE', 'Metadata resource-ului MCP TikTok este incompatibilă.');
  }
  if (!resource.scopes_supported?.includes(DEFAULT_SCOPE)) {
    throw new TikTokAdsError('CAPABILITY_UNAVAILABLE', 'Resource-ul TikTok MCP nu publică scope-ul minim mcp:tt4b.');
  }
  resource.authorization_servers.forEach((issuer) => assertOfficialTikTokUrl(issuer, 'Authorization server-ul TikTok MCP'));
  if (resource.bearer_methods_supported && !resource.bearer_methods_supported.includes('header')) {
    throw new TikTokAdsError('CAPABILITY_UNAVAILABLE', 'Resource-ul TikTok MCP nu confirmă bearer authentication prin header.');
  }
  const authorization = await getAuthorizationMetadata(resource.authorization_servers[0]);
  if (!authorization.code_challenge_methods_supported?.includes('S256')) {
    throw new TikTokAdsError('CAPABILITY_UNAVAILABLE', 'Serverul OAuth TikTok MCP nu confirmă PKCE S256.');
  }
  if (authorization.token_endpoint_auth_methods_supported && !authorization.token_endpoint_auth_methods_supported.includes('none')) {
    throw new TikTokAdsError('CAPABILITY_UNAVAILABLE', 'Serverul OAuth TikTok MCP nu acceptă un client public PKCE.');
  }
  return { resource, authorization };
}

async function getOrRegisterClient(metadata: AuthorizationServerMetadata) {
  if (!metadata.registration_endpoint) {
    throw new TikTokAdsError('CAPABILITY_UNAVAILABLE', 'Serverul TikTok MCP nu publică dynamic client registration.');
  }
  assertOfficialTikTokUrl(metadata.registration_endpoint, 'Registration endpoint-ul OAuth');
  const callbackUrl = getCallbackUrl();
  const cacheId = sha256Hex(`${metadata.issuer}|${callbackUrl}`);
  const ref = adminDb.collection(CLIENT_COLLECTION).doc(cacheId);
  const existing = await ref.get();
  const clientId = existing.data()?.clientId;
  if (existing.exists && typeof clientId === 'string' && clientId) return clientId;

  const registered = await fetchJson<{ client_id?: string }>(metadata.registration_endpoint, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Imodeus TikTok Ads',
      redirect_uris: [callbackUrl],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    }),
  });
  if (!registered.client_id) throw new TikTokAdsError('PROVIDER_UNAVAILABLE', 'TikTok nu a returnat client_id la înregistrarea MCP.');
  await ref.create({ clientId: registered.client_id, issuer: metadata.issuer, redirectUri: callbackUrl, createdAt: nowIso() })
    .catch(async () => {
      const winner = await ref.get();
      if (!winner.exists) throw new TikTokAdsError('CONFLICT', 'Înregistrarea clientului MCP nu a putut fi serializată.');
    });
  const stored = await ref.get();
  return String(stored.data()?.clientId || registered.client_id);
}

function safeReturnTo(value?: string) {
  if (!value) return '/properties';
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || value.includes('\r') || value.includes('\n')) return '/properties';
  return /^\/(properties|marketing)(\/|$)/.test(value) ? value : '/properties';
}

export async function createTikTokMcpAuthorization(input: { organizationId: string; requestedByUid: string; returnTo?: string }) {
  const { resource, authorization } = await discoverTikTokMcpAuthorization();
  const clientId = await getOrRegisterClient(authorization);
  const state = randomOpaque();
  const { verifier, challenge } = createPkcePair();
  const stateRecord: OAuthStateRecord = {
    organizationId: input.organizationId,
    requestedByUid: input.requestedByUid,
    returnTo: safeReturnTo(input.returnTo),
    resourceUrl: resource.resource,
    authorizationServer: authorization.issuer,
    tokenEndpoint: authorization.token_endpoint,
    revocationEndpoint: authorization.revocation_endpoint || null,
    clientId,
    encryptedCodeVerifier: encryptTikTokSecret(verifier, 'oauth-state'),
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    expiresAtTimestamp: Timestamp.fromMillis(Date.now() + 10 * 60_000),
    consumedAt: null,
  };
  await adminDb.collection(STATE_COLLECTION).doc(sha256Hex(state)).create(stateRecord);
  const url = new URL(authorization.authorization_endpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', getCallbackUrl());
  url.searchParams.set('scope', DEFAULT_SCOPE);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('resource', resource.resource);
  return { authorizationUrl: url.toString(), callbackBinding: sha256Hex(state) };
}

function tokenExpiry(seconds?: number) {
  return typeof seconds === 'number' && seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString() : null;
}

function assertTokenContract(tokens: OAuthTokenResponse) {
  if (tokens.token_type && tokens.token_type.toLowerCase() !== 'bearer') {
    throw new TikTokAdsError('CONNECTION_EXPIRED', 'TikTok a returnat un token_type incompatibil pentru MCP.');
  }
  const grantedScopes = tokens.scope?.split(/[ ,]+/).filter(Boolean);
  if (grantedScopes?.length && !grantedScopes.includes(DEFAULT_SCOPE)) {
    throw new TikTokAdsError('PERMISSION_MISSING', 'TikTok nu a acordat scope-ul minim mcp:tt4b.');
  }
}

async function exchangeToken(state: OAuthStateRecord, code: string) {
  assertOfficialTikTokUrl(state.tokenEndpoint, 'Token endpoint-ul OAuth');
  assertOfficialTikTokUrl(state.resourceUrl, 'Resource endpoint-ul TikTok MCP', { openMcp: true });
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: state.clientId,
    code,
    redirect_uri: getCallbackUrl(),
    code_verifier: decryptTikTokSecret(state.encryptedCodeVerifier, 'oauth-state'),
    resource: state.resourceUrl,
  });
  return fetchJson<OAuthTokenResponse>(state.tokenEndpoint, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
}

function constantTimeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function finalizeTikTokMcpAuthorization(input: { code: string; state: string; callbackBinding: string }) {
  const stateHash = sha256Hex(input.state);
  if (!input.callbackBinding || !constantTimeEqual(input.callbackBinding, stateHash)) {
    throw new TikTokAdsError('UNAUTHORIZED', 'Sesiunea browserului nu corespunde autorizării TikTok Ads.');
  }
  const stateRef = adminDb.collection(STATE_COLLECTION).doc(stateHash);
  const state = await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(stateRef);
    if (!snapshot.exists) throw new TikTokAdsError('UNAUTHORIZED', 'Sesiunea TikTok Ads nu mai este validă.');
    const data = snapshot.data() as OAuthStateRecord;
    if (data.consumedAt) throw new TikTokAdsError('UNAUTHORIZED', 'Callback-ul TikTok Ads a fost deja folosit.');
    if (Date.parse(data.expiresAt) <= Date.now()) throw new TikTokAdsError('UNAUTHORIZED', 'Sesiunea TikTok Ads a expirat.');
    transaction.update(stateRef, { consumedAt: nowIso() });
    return data;
  });
  const tokens = await exchangeToken(state, input.code);
  if (!tokens.access_token) throw new TikTokAdsError('PROVIDER_UNAVAILABLE', 'TikTok nu a returnat access token-ul MCP.');
  assertTokenContract(tokens);
  const now = nowIso();
  const connection: TikTokMcpConnection = {
    organizationId: state.organizationId,
    provider: PROVIDER,
    transport: 'mcp',
    connected: true,
    encryptedAccessToken: encryptTikTokSecret(tokens.access_token),
    encryptedRefreshToken: tokens.refresh_token ? encryptTikTokSecret(tokens.refresh_token) : null,
    accessTokenExpiresAt: tokenExpiry(tokens.expires_in),
    refreshTokenExpiresAt: tokenExpiry(tokens.refresh_token_expires_in),
    scope: (tokens.scope || DEFAULT_SCOPE).split(/[ ,]+/).filter(Boolean),
    clientId: state.clientId,
    authorizationServer: state.authorizationServer,
    resourceUrl: state.resourceUrl,
    connectedAt: now,
    updatedAt: now,
    revokedAt: null,
    lastAuthorizedByUid: state.requestedByUid,
    lastErrorCode: null,
    tokenEncryptionVersion: 3,
  };
  await Promise.all([
    privateRef(state.organizationId).set(connection),
    publicRef(state.organizationId).set({
      provider: PROVIDER,
      transport: 'mcp',
      connected: true,
      connectedAt: now,
      updatedAt: now,
      lastErrorCode: null,
      capabilityDiscoveryStatus: 'pending',
    }),
    stateRef.delete(),
  ]);
  return { organizationId: state.organizationId, requestedByUid: state.requestedByUid, returnTo: state.returnTo };
}

export async function getTikTokMcpConnection(organizationId: string) {
  const snapshot = await privateRef(organizationId).get();
  if (!snapshot.exists) return null;
  const connection = snapshot.data() as TikTokMcpConnection;
  if (connection.organizationId !== organizationId || connection.provider !== PROVIDER) {
    throw new TikTokAdsError('TENANT_ACCESS_DENIED', 'Conexiunea TikTok nu aparține organizației curente.');
  }
  assertOfficialTikTokUrl(connection.authorizationServer, 'Issuer-ul OAuth TikTok MCP');
  assertOfficialTikTokUrl(connection.resourceUrl, 'Resource endpoint-ul TikTok MCP', { openMcp: true });
  return connection;
}

async function refreshConnection(organizationId: string, connection: TikTokMcpConnection) {
  if (!connection.encryptedRefreshToken) throw new TikTokAdsError('CONNECTION_EXPIRED', 'Conexiunea TikTok trebuie reautorizată.');
  const metadata = await getAuthorizationMetadata(connection.authorizationServer);
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: connection.clientId,
    refresh_token: decryptTikTokSecret(connection.encryptedRefreshToken),
    resource: connection.resourceUrl,
  });
  const tokens = await fetchJson<OAuthTokenResponse>(metadata.token_endpoint, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!tokens.access_token) throw new TikTokAdsError('CONNECTION_EXPIRED', 'TikTok nu a reînnoit access token-ul MCP.');
  assertTokenContract(tokens);
  const patch: Partial<TikTokMcpConnection> & Record<string, unknown> = {
    encryptedAccessToken: encryptTikTokSecret(tokens.access_token),
    accessTokenExpiresAt: tokenExpiry(tokens.expires_in),
    updatedAt: nowIso(),
    lastErrorCode: null,
    refreshLeaseOwner: null,
    refreshLeaseUntil: null,
  };
  if (tokens.refresh_token) patch.encryptedRefreshToken = encryptTikTokSecret(tokens.refresh_token);
  if (tokens.refresh_token_expires_in) patch.refreshTokenExpiresAt = tokenExpiry(tokens.refresh_token_expires_in);
  await privateRef(organizationId).set(patch, { merge: true });
  return tokens.access_token;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getValidTikTokMcpAccessToken(organizationId: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const connection = await getTikTokMcpConnection(organizationId);
    if (!connection?.connected || connection.revokedAt) throw new TikTokAdsError('CONNECTION_REVOKED', 'Conectează TikTok Ads pentru această organizație.');
    if (!connection.accessTokenExpiresAt || Date.parse(connection.accessTokenExpiresAt) > Date.now() + 60_000) {
      return { accessToken: decryptTikTokSecret(connection.encryptedAccessToken), connection };
    }
    const leaseOwner = randomOpaque(12);
    const leaseResult = await adminDb.runTransaction(async (transaction) => {
      const ref = privateRef(organizationId);
      const snapshot = await transaction.get(ref);
      const current = snapshot.data() as (TikTokMcpConnection & { refreshLeaseUntil?: string | null }) | undefined;
      if (!current) return 'missing' as const;
      if (!current.accessTokenExpiresAt || Date.parse(current.accessTokenExpiresAt) > Date.now() + 60_000) return 'fresh' as const;
      if (current.refreshLeaseUntil && Date.parse(current.refreshLeaseUntil) > Date.now()) return 'busy' as const;
      transaction.update(ref, { refreshLeaseOwner: leaseOwner, refreshLeaseUntil: new Date(Date.now() + 30_000).toISOString() });
      return 'acquired' as const;
    });
    if (leaseResult === 'missing') throw new TikTokAdsError('CONNECTION_REVOKED', 'Conectează TikTok Ads pentru această organizație.');
    if (leaseResult === 'fresh') {
      const refreshed = await getTikTokMcpConnection(organizationId);
      if (!refreshed) throw new TikTokAdsError('CONNECTION_REVOKED', 'Conectează TikTok Ads pentru această organizație.');
      return { accessToken: decryptTikTokSecret(refreshed.encryptedAccessToken), connection: refreshed };
    }
    if (leaseResult === 'acquired') {
      try {
        const current = await getTikTokMcpConnection(organizationId);
        if (!current) throw new TikTokAdsError('CONNECTION_REVOKED', 'Conectează TikTok Ads pentru această organizație.');
        const accessToken = await refreshConnection(organizationId, current);
        return { accessToken, connection: (await getTikTokMcpConnection(organizationId))! };
      } catch (error) {
        await privateRef(organizationId).set({ refreshLeaseOwner: null, refreshLeaseUntil: null, lastErrorCode: error instanceof TikTokAdsError ? error.code : 'PROVIDER_UNAVAILABLE' }, { merge: true });
        throw error;
      }
    }
    await delay(250 * (attempt + 1));
  }
  throw new TikTokAdsError('CONFLICT', 'Tokenul TikTok este reînnoit de o altă cerere. Reîncearcă.');
}

export async function disconnectTikTokMcp(organizationId: string) {
  const connection = await getTikTokMcpConnection(organizationId);
  if (connection) {
    try {
      const metadata = await getAuthorizationMetadata(connection.authorizationServer);
      if (metadata.revocation_endpoint) {
        const encryptedTokens = [connection.encryptedRefreshToken, connection.encryptedAccessToken].filter((token): token is string => Boolean(token));
        for (const encryptedToken of encryptedTokens) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
          try {
            const body = new URLSearchParams({ token: decryptTikTokSecret(encryptedToken), client_id: connection.clientId });
            await fetch(metadata.revocation_endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: body.toString(),
              cache: 'no-store',
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timeout);
          }
        }
      }
    } catch {
      // Local revocation remains authoritative; a provider outage must not leave a usable local token.
    }
  }
  const now = nowIso();
  await Promise.all([
    privateRef(organizationId).delete(),
    publicRef(organizationId).set({ provider: PROVIDER, transport: 'mcp', connected: false, updatedAt: now, disconnectedAt: now }, { merge: false }),
  ]);
  return { connected: false };
}
