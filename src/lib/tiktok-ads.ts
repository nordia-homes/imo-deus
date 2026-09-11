import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { adminDb } from '@/firebase/admin';

const PROVIDER = 'tiktok_ads';
const PRIVATE_COLLECTION = 'agencyPrivateIntegrations';
const OAUTH_STATE_COLLECTION = 'tiktokAdsOauthStates';
const API_BASE = 'https://business-api.tiktok.com/open_api/v1.3';
const AUTH_URL = 'https://ads.tiktok.com/marketing_api/auth';

type TikTokAdsPrivateIntegration = {
  agencyId: string;
  provider: typeof PROVIDER;
  connected: boolean;
  accessTokenEncrypted: string;
  advertiserId: string | null;
  advertiserName: string | null;
  advertisers: Array<{ id: string; name: string }>;
  connectedAt: string;
  updatedAt: string;
};

type TikTokApiResponse<T> = {
  code?: number;
  message?: string;
  request_id?: string;
  data?: T;
};

function nowIso() {
  return new Date().toISOString();
}

function getConfig() {
  return {
    appId: (process.env.TIKTOK_ADS_APP_ID || '').trim(),
    appSecret: (process.env.TIKTOK_ADS_APP_SECRET || '').trim(),
    redirectUri: (
      process.env.TIKTOK_ADS_REDIRECT_URI ||
      `${(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || 'https://imodeus.ro').replace(/\/+$/, '')}/auth/tiktok-ads/callback`
    ).trim(),
  };
}

function requireConfig() {
  const config = getConfig();
  if (!config.appId || !config.appSecret) {
    throw new Error('Configurează TIKTOK_ADS_APP_ID și TIKTOK_ADS_APP_SECRET pentru TikTok Marketing API.');
  }
  return config;
}

function getEncryptionKey() {
  const config = getConfig();
  const source = process.env.TIKTOK_ADS_TOKEN_ENCRYPTION_KEY || process.env.TOKEN_ENCRYPTION_KEY || config.appSecret;
  if (!source) throw new Error('Configurează cheia de criptare pentru tokenurile TikTok Ads.');
  return createHash('sha256').update(source).digest();
}

function encryptToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptTikTokAdsToken(payload: string) {
  const [version, iv, tag, encrypted] = payload.split(':');
  if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('Token TikTok Ads invalid.');
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function privateRef(agencyId: string) {
  return adminDb.collection(PRIVATE_COLLECTION).doc(`${agencyId}__${PROVIDER}`);
}

function publicRef(agencyId: string) {
  return adminDb.collection('agencies').doc(agencyId).collection('integrations').doc(PROVIDER);
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: 'no-store' });
  const payload = await response.json().catch(() => null) as TikTokApiResponse<T> | null;
  if (!response.ok || !payload || (typeof payload.code === 'number' && payload.code !== 0)) {
    throw new Error(payload?.message || `TikTok Marketing API a răspuns cu ${response.status}.`);
  }
  return payload.data as T;
}

export async function createTikTokAdsAuthorization(params: {
  agencyId: string;
  requestedByUid: string;
  returnTo?: string;
}) {
  const { appId, redirectUri } = requireConfig();
  const state = randomBytes(32).toString('hex');
  const returnTo = params.returnTo?.startsWith('/properties/') ? params.returnTo : '/properties';
  await adminDb.collection(OAUTH_STATE_COLLECTION).doc(state).set({
    agencyId: params.agencyId,
    requestedByUid: params.requestedByUid,
    returnTo,
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });

  const query = new URLSearchParams({ app_id: appId, state, redirect_uri: redirectUri });
  return { authorizationUrl: `${AUTH_URL}?${query.toString()}` };
}

export async function finalizeTikTokAdsAuthorization(params: { authCode: string; state: string }) {
  const stateRef = adminDb.collection(OAUTH_STATE_COLLECTION).doc(params.state);
  const stateSnapshot = await stateRef.get();
  const stateData = stateSnapshot.data() as {
    agencyId?: string;
    requestedByUid?: string;
    returnTo?: string;
    expiresAt?: string;
  } | undefined;

  if (!stateSnapshot.exists || !stateData?.agencyId || !stateData.expiresAt || Date.parse(stateData.expiresAt) < Date.now()) {
    throw new Error('Sesiunea de conectare TikTok Ads a expirat.');
  }

  const { appId, appSecret } = requireConfig();
  const tokenData = await requestJson<{ access_token?: string }>(`${API_BASE}/oauth2/access_token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, secret: appSecret, auth_code: params.authCode }),
  });
  if (!tokenData?.access_token) throw new Error('TikTok nu a returnat tokenul de acces pentru reclame.');

  const advertisersUrl = new URL(`${API_BASE}/oauth2/advertiser/get/`);
  advertisersUrl.searchParams.set('app_id', appId);
  advertisersUrl.searchParams.set('secret', appSecret);
  advertisersUrl.searchParams.set('access_token', tokenData.access_token);
  const advertiserData = await requestJson<{
    list?: Array<{ advertiser_id?: string; advertiser_name?: string }>;
  }>(advertisersUrl.toString());
  const advertisers = (advertiserData?.list || [])
    .filter((item) => item.advertiser_id)
    .map((item) => ({ id: item.advertiser_id!, name: item.advertiser_name || `Cont ${item.advertiser_id}` }));
  const selected = advertisers[0] || null;
  const now = nowIso();
  const privatePayload: TikTokAdsPrivateIntegration = {
    agencyId: stateData.agencyId,
    provider: PROVIDER,
    connected: true,
    accessTokenEncrypted: encryptToken(tokenData.access_token),
    advertiserId: selected?.id || null,
    advertiserName: selected?.name || null,
    advertisers,
    connectedAt: now,
    updatedAt: now,
  };

  await Promise.all([
    privateRef(stateData.agencyId).set(privatePayload),
    publicRef(stateData.agencyId).set({
      provider: PROVIDER,
      connected: true,
      advertiserId: privatePayload.advertiserId,
      advertiserName: privatePayload.advertiserName,
      advertiserCount: advertisers.length,
      connectedAt: now,
      updatedAt: now,
    }),
    stateRef.delete(),
  ]);

  return { agencyId: stateData.agencyId, returnTo: stateData.returnTo || '/properties' };
}

export async function getTikTokAdsStatus(agencyId: string) {
  const configured = Boolean(getConfig().appId && getConfig().appSecret);
  const snapshot = await publicRef(agencyId).get();
  const data = snapshot.data() as {
    connected?: boolean;
    advertiserId?: string | null;
    advertiserName?: string | null;
    advertiserCount?: number;
    updatedAt?: string;
  } | undefined;

  return {
    configured,
    connected: Boolean(data?.connected),
    advertiserId: data?.advertiserId || null,
    advertiserName: data?.advertiserName || null,
    advertiserCount: data?.advertiserCount || 0,
    updatedAt: data?.updatedAt || null,
  };
}
