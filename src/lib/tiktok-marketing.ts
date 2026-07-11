import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/firebase/admin';
import type {
  Property,
  TikTokMarketingIntegrationPrivate,
  TikTokMarketingIntegrationPublicStatus,
  TikTokPostDraft,
  TikTokStudioAsset,
  TikTokStudioBrandKit,
  TikTokStudioCreativePreset,
  TikTokStudioProject,
  TikTokStudioQualityScore,
  TikTokStudioRepurposeVariant,
  TikTokStudioStoryboardScene,
  TikTokStudioSubtitlePreset,
  TikTokStudioVoiceProfile,
} from '@/lib/types';

const TIKTOK_PROVIDER = 'tiktok';
const PRIVATE_COLLECTION = 'userPrivateIntegrations';
const OAUTH_STATE_COLLECTION = 'tiktokOauthStates';
const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TIKTOK_API_BASE_URL = 'https://open.tiktokapis.com';
const TIKTOK_TOKEN_URL = `${TIKTOK_API_BASE_URL}/v2/oauth/token/`;
const OPENAI_RESPONSES_API_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_SCOPES = ['user.info.basic', 'video.publish'];

type TikTokApiError = Error & {
  status?: number;
  payload?: unknown;
};

type TikTokTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  open_id?: string;
  scope?: string;
  token_type?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  error?: string;
  error_description?: string;
};

type TikTokUserInfoResponse = {
  data?: {
    user?: {
      open_id?: string;
      union_id?: string;
      avatar_url?: string;
      avatar_url_100?: string;
      avatar_large_url?: string;
      display_name?: string;
      username?: string;
    };
  };
  error?: {
    code?: string;
    message?: string;
    log_id?: string;
  };
};

type TikTokCreatorInfo = {
  creator_avatar_url?: string;
  creator_username?: string;
  creator_nickname?: string;
  privacy_level_options?: string[];
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  stitch_disabled?: boolean;
  max_video_post_duration_sec?: number;
};

type TikTokCreatorInfoResponse = {
  data?: TikTokCreatorInfo;
  error?: {
    code?: string;
    message?: string;
    log_id?: string;
  };
};

type TikTokPublishInitResponse = {
  data?: {
    publish_id?: string;
    upload_url?: string;
  };
  error?: {
    code?: string;
    message?: string;
    log_id?: string;
  };
};

type TikTokPublishStatusResponse = {
  data?: {
    status?: string;
    fail_reason?: string;
    publicaly_available_post_id?: string;
    uploaded_bytes?: number;
  };
  error?: {
    code?: string;
    message?: string;
    log_id?: string;
  };
};

type ReadyVideoTour = {
  propertyId: string;
  propertyTitle: string;
  propertyPrice?: string | null;
  propertyLocation?: string | null;
  videoTourUrl: string;
  videoTourThumbnailUrl?: string | null;
  generatedAt?: string | null;
  format?: string | null;
  style?: string | null;
  latestDraft?: TikTokPostDraft | null;
};

function nowIso() {
  return new Date().toISOString();
}

function base64UrlEncode(buffer: Buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function createPkceVerifier() {
  return base64UrlEncode(randomBytes(64));
}

function createPkceChallenge(verifier: string) {
  return base64UrlEncode(createHash('sha256').update(verifier).digest());
}

function getPrivateDocId(uid: string) {
  return `${uid}__${TIKTOK_PROVIDER}`;
}

function getPrivateDocRef(uid: string) {
  return adminDb.collection(PRIVATE_COLLECTION).doc(getPrivateDocId(uid));
}

function getPublicDocRef(uid: string) {
  return adminDb.collection('users').doc(uid).collection('integrations').doc(TIKTOK_PROVIDER);
}

function getOauthStateRef(state: string) {
  return adminDb.collection(OAUTH_STATE_COLLECTION).doc(state);
}

function getDraftsCollection(agencyId: string) {
  return adminDb.collection('agencies').doc(agencyId).collection('tiktokPostDrafts');
}

function getStudioAssetsCollection(agencyId: string) {
  return adminDb.collection('agencies').doc(agencyId).collection('tiktokStudioAssets');
}

function getStudioProjectsCollection(agencyId: string) {
  return adminDb.collection('agencies').doc(agencyId).collection('tiktokStudioProjects');
}

function getDraftRef(agencyId: string, draftId: string) {
  return getDraftsCollection(agencyId).doc(draftId);
}

function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_BASE_URL ||
    'https://imodeus.ai'
  ).replace(/\/+$/, '');
}

function getRedirectUri() {
  return (process.env.TIKTOK_REDIRECT_URI || `${getAppBaseUrl()}/auth/tiktok/callback`).trim();
}

function getTikTokClientKey() {
  return (process.env.TIKTOK_CLIENT_KEY || '').trim();
}

function getTikTokClientSecret() {
  return (process.env.TIKTOK_CLIENT_SECRET || '').trim();
}

function getConfiguredScopes() {
  return (process.env.TIKTOK_SCOPES || DEFAULT_SCOPES.join(','))
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function isPrivateModeOnly() {
  return (process.env.TIKTOK_UNAUDITED_PRIVATE_ONLY || 'true').toLowerCase() !== 'false';
}

function getDefaultPrivacyLevel() {
  return process.env.TIKTOK_DEFAULT_PRIVACY_LEVEL || 'SELF_ONLY';
}

function requireTikTokConfig() {
  const clientKey = getTikTokClientKey();
  const clientSecret = getTikTokClientSecret();
  if (!clientKey || !clientSecret) {
    throw new Error('Configureaza TIKTOK_CLIENT_KEY si TIKTOK_CLIENT_SECRET in .env.local.');
  }
  return { clientKey, clientSecret };
}

function getTokenEncryptionKey() {
  const configured = process.env.TIKTOK_TOKEN_ENCRYPTION_KEY || process.env.TOKEN_ENCRYPTION_KEY || '';
  const source = configured || getTikTokClientSecret();
  if (!source) {
    throw new Error('Configureaza TIKTOK_TOKEN_ENCRYPTION_KEY pentru stocarea securizata a token-urilor TikTok.');
  }
  return createHash('sha256').update(source).digest();
}

function encryptToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getTokenEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

function decryptToken(payload: string) {
  const [version, ivRaw, tagRaw, encryptedRaw] = payload.split(':');
  if (version !== 'v1' || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error('Tokenul TikTok salvat are un format invalid.');
  }
  const decipher = createDecipheriv('aes-256-gcm', getTokenEncryptionKey(), Buffer.from(ivRaw, 'base64'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

async function safeJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractTikTokError(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object') {
    const root = payload as {
      error?: string | { code?: string; message?: string; error_description?: string };
      error_description?: string;
      message?: string;
    };
    if (typeof root.error === 'string') return root.error_description || root.error || fallback;
    if (root.error && typeof root.error === 'object') {
      return root.error.message || root.error.error_description || root.error.code || fallback;
    }
    return root.error_description || root.message || fallback;
  }
  return fallback;
}

function assertTikTokOk(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== 'object' || !('error' in payload)) return;
  const error = (payload as { error?: { code?: string; message?: string } }).error;
  if (error?.code && error.code !== 'ok') {
    throw new Error(error.message || `${fallback} (${error.code})`);
  }
}

async function tiktokRequest<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${TIKTOK_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}),
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });
  const payload = await safeJson(response);
  if (!response.ok) {
    const error = new Error(extractTikTokError(payload, `TikTok API a raspuns cu ${response.status}.`)) as TikTokApiError;
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  assertTikTokOk(payload, 'TikTok API a returnat o eroare.');
  return payload as T;
}

async function requestAccessToken(code: string, codeVerifier: string) {
  const { clientKey, clientSecret } = requireTikTokConfig();
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: getRedirectUri(),
  });
  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    body: body.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    cache: 'no-store',
  });
  const payload = await safeJson(response) as TikTokTokenResponse | null;
  if (!response.ok || !payload?.access_token) {
    throw new Error(extractTikTokError(payload, 'Nu am putut obtine tokenul OAuth TikTok.'));
  }
  return payload;
}

async function refreshAccessToken(integration: TikTokMarketingIntegrationPrivate) {
  if (!integration.encryptedRefreshToken) {
    throw new Error('Conexiunea TikTok nu are refresh token. Reconecteaza contul.');
  }

  const { clientKey, clientSecret } = requireTikTokConfig();
  const refreshToken = decryptToken(integration.encryptedRefreshToken);
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    body: body.toString(),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    cache: 'no-store',
  });
  const payload = await safeJson(response) as TikTokTokenResponse | null;
  if (!response.ok || !payload?.access_token) {
    throw new Error(extractTikTokError(payload, 'Nu am putut reimprospata tokenul TikTok.'));
  }

  const refreshed: TikTokMarketingIntegrationPrivate = {
    ...integration,
    updatedAt: nowIso(),
    encryptedAccessToken: encryptToken(payload.access_token),
    encryptedRefreshToken: payload.refresh_token ? encryptToken(payload.refresh_token) : integration.encryptedRefreshToken,
    accessTokenExpiresAt: payload.expires_in ? new Date(Date.now() + payload.expires_in * 1000).toISOString() : integration.accessTokenExpiresAt,
    refreshTokenExpiresAt: payload.refresh_expires_in ? new Date(Date.now() + payload.refresh_expires_in * 1000).toISOString() : integration.refreshTokenExpiresAt,
    scopes: payload.scope ? payload.scope.split(',').map((scope) => scope.trim()).filter(Boolean) : integration.scopes,
  };

  await getPrivateDocRef(integration.uid).set(refreshed, { merge: true });
  await setPublicStatus(integration.uid, toPublicIntegration(refreshed));
  return refreshed;
}

async function getPrivateIntegration(uid: string) {
  const snapshot = await getPrivateDocRef(uid).get();
  if (!snapshot.exists) return null;
  return snapshot.data() as TikTokMarketingIntegrationPrivate;
}

async function getAccessTokenForUser(uid: string) {
  const integration = await getPrivateIntegration(uid);
  if (!integration?.encryptedAccessToken) {
    throw new Error('Conecteaza mai intai contul TikTok.');
  }

  const expiresAt = integration.accessTokenExpiresAt ? new Date(integration.accessTokenExpiresAt).getTime() : 0;
  const shouldRefresh = expiresAt > 0 && expiresAt - Date.now() < 10 * 60 * 1000;
  const usableIntegration = shouldRefresh ? await refreshAccessToken(integration) : integration;

  return {
    integration: usableIntegration,
    accessToken: decryptToken(usableIntegration.encryptedAccessToken),
  };
}

async function setPublicStatus(uid: string, patch: Partial<TikTokMarketingIntegrationPublicStatus>) {
  await getPublicDocRef(uid).set(
    {
      provider: TIKTOK_PROVIDER,
      connected: false,
      updatedAt: nowIso(),
      ...patch,
    },
    { merge: true }
  );
}

function toPublicIntegration(privateIntegration: TikTokMarketingIntegrationPrivate): TikTokMarketingIntegrationPublicStatus {
  const {
    agencyId,
    uid,
    encryptedAccessToken,
    encryptedRefreshToken,
    tokenEncryptionVersion,
    ...publicFields
  } = privateIntegration;
  void agencyId;
  void uid;
  void encryptedAccessToken;
  void encryptedRefreshToken;
  void tokenEncryptionVersion;
  return publicFields;
}

async function fetchTikTokUser(accessToken: string) {
  const fields = 'open_id,union_id,avatar_url,avatar_url_100,avatar_large_url,display_name,username';
  const response = await tiktokRequest<TikTokUserInfoResponse>(`/v2/user/info/?fields=${encodeURIComponent(fields)}`, accessToken);
  return response.data?.user || {};
}

export async function createTikTokAuthorization(params: { agencyId: string; requestedByUid: string }) {
  const { clientKey } = requireTikTokConfig();
  const state = randomBytes(24).toString('hex');
  const codeVerifier = createPkceVerifier();
  const codeChallenge = createPkceChallenge(codeVerifier);
  await getOauthStateRef(state).set({
    state,
    agencyId: params.agencyId,
    requestedByUid: params.requestedByUid,
    codeVerifier,
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });

  const url = new URL(TIKTOK_AUTH_URL);
  url.searchParams.set('client_key', clientKey);
  url.searchParams.set('redirect_uri', getRedirectUri());
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', getConfiguredScopes().join(','));
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('disable_auto_auth', process.env.TIKTOK_DISABLE_AUTO_AUTH || '1');

  return {
    state,
    authorizationUrl: url.toString(),
  };
}

export async function finalizeTikTokAuthorization(params: { code: string; state: string }) {
  const stateSnapshot = await getOauthStateRef(params.state).get();
  if (!stateSnapshot.exists) {
    throw new Error('State-ul de autorizare TikTok nu mai este valid. Reincearca din TikTok Studio.');
  }

  const stateData = stateSnapshot.data() as {
    agencyId: string;
    requestedByUid?: string | null;
    codeVerifier?: string | null;
    expiresAt?: string | null;
  };

  if (stateData.expiresAt && new Date(stateData.expiresAt).getTime() < Date.now()) {
    await getOauthStateRef(params.state).delete().catch(() => undefined);
    throw new Error('Autorizarea TikTok a expirat. Reincearca din TikTok Studio.');
  }

  if (!stateData.codeVerifier) {
    await getOauthStateRef(params.state).delete().catch(() => undefined);
    throw new Error('Autorizarea TikTok nu contine PKCE verifier. Reincearca din TikTok Studio.');
  }

  const token = await requestAccessToken(params.code, stateData.codeVerifier);
  const user = await fetchTikTokUser(token.access_token || '');
  const uid = stateData.requestedByUid || '';
  if (!uid) throw new Error('Nu am putut identifica utilizatorul care a pornit conectarea TikTok.');

  const privatePayload: TikTokMarketingIntegrationPrivate = {
    provider: TIKTOK_PROVIDER,
    agencyId: stateData.agencyId,
    uid,
    connected: true,
    connectedAt: nowIso(),
    updatedAt: nowIso(),
    encryptedAccessToken: encryptToken(token.access_token || ''),
    encryptedRefreshToken: token.refresh_token ? encryptToken(token.refresh_token) : null,
    tokenEncryptionVersion: 1,
    lastError: null,
    lastAuthorizedByUid: uid,
    openId: token.open_id || user.open_id || null,
    unionId: user.union_id || null,
    displayName: user.display_name || null,
    username: user.username || null,
    avatarUrl: user.avatar_large_url || user.avatar_url_100 || user.avatar_url || null,
    scopes: token.scope ? token.scope.split(',').map((scope) => scope.trim()).filter(Boolean) : getConfiguredScopes(),
    accessTokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null,
    refreshTokenExpiresAt: token.refresh_expires_in ? new Date(Date.now() + token.refresh_expires_in * 1000).toISOString() : null,
    privateModeOnly: isPrivateModeOnly(),
  };

  await getPrivateDocRef(uid).set(privatePayload, { merge: true });
  await setPublicStatus(uid, toPublicIntegration(privatePayload));
  await getOauthStateRef(params.state).delete().catch(() => undefined);

  return {
    connected: true,
    agencyId: stateData.agencyId,
    uid,
  };
}

export async function disconnectTikTokMarketing(uid: string) {
  await getPrivateDocRef(uid).delete().catch(() => undefined);
  await setPublicStatus(uid, {
    connected: false,
    connectedAt: null,
    lastError: null,
    openId: null,
    unionId: null,
    displayName: null,
    username: null,
    avatarUrl: null,
    scopes: [],
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    privateModeOnly: isPrivateModeOnly(),
  });
  return { connected: false };
}

export async function getTikTokMarketingStatus(uid: string) {
  const publicSnapshot = await getPublicDocRef(uid).get();
  const publicStatus = publicSnapshot.exists
    ? publicSnapshot.data() as TikTokMarketingIntegrationPublicStatus
    : null;

  return {
    provider: TIKTOK_PROVIDER,
    connected: false,
    privateModeOnly: isPrivateModeOnly(),
    ...publicStatus,
  } satisfies TikTokMarketingIntegrationPublicStatus;
}

function formatPropertyPrice(property: Property) {
  const price = Number((property as { price?: unknown }).price || 0);
  if (!price) return null;
  const currency = String((property as { currency?: unknown }).currency || 'EUR');
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(price);
}

function getPropertyLocation(property: Property) {
  const data = property as {
    city?: string | null;
    zone?: string | null;
    address?: string | null;
    location?: string | null;
  };
  return [data.zone, data.city].filter(Boolean).join(', ') || data.location || data.address || null;
}

function getPropertyDetailsForPrompt(property: Property) {
  const data = property as Record<string, unknown>;
  return {
    title: String(data.title || ''),
    description: String(data.description || ''),
    price: formatPropertyPrice(property),
    location: getPropertyLocation(property),
    rooms: data.rooms || data.bedrooms || null,
    area: data.area || data.surface || data.usableArea || null,
    type: data.type || data.category || null,
  };
}

export async function listTikTokReadyVideoTours(agencyId: string, limit = 60): Promise<ReadyVideoTour[]> {
  const propertiesSnapshot = await adminDb
    .collection('agencies')
    .doc(agencyId)
    .collection('properties')
    .limit(250)
    .get();
  const draftsSnapshot = await getDraftsCollection(agencyId)
    .orderBy('updatedAt', 'desc')
    .limit(200)
    .get()
    .catch(() => null);

  const latestDraftByProperty = new Map<string, TikTokPostDraft>();
  draftsSnapshot?.docs.forEach((doc) => {
    const draft = { id: doc.id, ...doc.data() } as TikTokPostDraft;
    if (!draft.propertyId) return;
    if (!latestDraftByProperty.has(draft.propertyId)) {
      latestDraftByProperty.set(draft.propertyId, draft);
    }
  });

  return propertiesSnapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Property, 'id'>) }) as Property)
    .filter((property) => property.videoTour?.status === 'ready' && Boolean(property.videoTour?.url))
    .sort((a, b) => {
      const aTime = a.videoTour?.generatedAt ? new Date(a.videoTour.generatedAt).getTime() : 0;
      const bTime = b.videoTour?.generatedAt ? new Date(b.videoTour.generatedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, limit)
    .map((property) => ({
      propertyId: property.id,
      propertyTitle: property.title || 'Proprietate ImoDeus',
      propertyPrice: formatPropertyPrice(property),
      propertyLocation: getPropertyLocation(property),
      videoTourUrl: property.videoTour?.url || '',
      videoTourThumbnailUrl: property.videoTour?.thumbnailUrl || property.images?.[0]?.url || null,
      generatedAt: property.videoTour?.generatedAt || null,
      format: property.videoTour?.format || null,
      style: property.videoTour?.style || null,
      latestDraft: latestDraftByProperty.get(property.id) || null,
    }));
}

export async function listTikTokPortfolioProperties(agencyId: string, limit = 120) {
  const propertiesSnapshot = await adminDb
    .collection('agencies')
    .doc(agencyId)
    .collection('properties')
    .limit(limit)
    .get();

  return propertiesSnapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Omit<Property, 'id'>) }) as Property)
    .filter((property) => Array.isArray(property.images) && property.images.some((image) => image?.url))
    .map((property) => ({
      id: property.id,
      title: property.title || 'Proprietate ImoDeus',
      address: property.address || '',
      location: getPropertyLocation(property),
      price: formatPropertyPrice(property),
      description: property.description || '',
      keyFeatures: property.keyFeatures || '',
      rooms: property.rooms || null,
      bathrooms: property.bathrooms || null,
      squareFootage: property.squareFootage || null,
      propertyType: property.propertyType || '',
      images: (property.images || [])
        .filter((image) => image?.url)
        .slice(0, 24)
        .map((image, index) => ({
          url: image.url,
          alt: image.alt || `Fotografie ${index + 1}`,
        })),
    }));
}

export async function getTikTokDashboardSummary(agencyId: string, uid: string) {
  const [status, readyVideoTours, portfolioProperties, draftsSnapshot] = await Promise.all([
    getTikTokMarketingStatus(uid),
    listTikTokReadyVideoTours(agencyId),
    listTikTokPortfolioProperties(agencyId),
    getDraftsCollection(agencyId).orderBy('updatedAt', 'desc').limit(80).get().catch(() => null),
  ]);

  const drafts = (draftsSnapshot?.docs || []).map((doc) => ({ id: doc.id, ...doc.data() }) as TikTokPostDraft);
  const totals = drafts.reduce(
    (acc, draft) => {
      acc.total += 1;
      if (draft.status === 'published') acc.published += 1;
      if (draft.status === 'publishing' || draft.status === 'processing') acc.processing += 1;
      if (draft.status === 'error') acc.errors += 1;
      return acc;
    },
    { total: 0, published: 0, processing: 0, errors: 0 }
  );

  return {
    status,
    readyVideoTours,
    portfolioProperties,
    studioAssets: await listTikTokStudioAssets(agencyId).catch(() => []),
    studioProjects: await listTikTokStudioProjects(agencyId).catch(() => []),
    drafts,
    totals,
    config: {
      configured: Boolean(getTikTokClientKey() && getTikTokClientSecret()),
      redirectUri: getRedirectUri(),
      privateModeOnly: isPrivateModeOnly(),
      defaultPrivacyLevel: getDefaultPrivacyLevel(),
    },
  };
}

function sanitizeHashtag(value: string) {
  const cleaned = value
    .replace(/^#+/, '')
    .replace(/[^\p{L}\p{N}_]/gu, '')
    .trim();
  return cleaned ? `#${cleaned}` : '';
}

function normalizeHashtags(values: unknown) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((item) => sanitizeHashtag(String(item || ''))).filter(Boolean))).slice(0, 12);
}

function fallbackDescription(property: Property) {
  const details = getPropertyDetailsForPrompt(property);
  const location = details.location ? ` in ${details.location}` : '';
  const price = details.price ? ` Pret: ${details.price}.` : '';
  return {
    description: `${details.title || 'O proprietate speciala'}${location}, prezentata intr-un tur video creat pentru TikTok.${price} Pentru detalii si vizionare, contacteaza echipa ImoDeus.`,
    hashtags: ['#imobiliare', '#apartamentdevanzare', '#turvideo', '#faraComision'],
  };
}

export async function generateTikTokDescription(input: {
  agencyId: string;
  propertyId: string;
  tone?: 'premium' | 'social' | 'urgent' | 'elegant';
}) {
  const propertySnapshot = await adminDb
    .collection('agencies')
    .doc(input.agencyId)
    .collection('properties')
    .doc(input.propertyId)
    .get();
  if (!propertySnapshot.exists) {
    throw new Error('Proprietatea nu a fost gasita.');
  }

  const property = { id: propertySnapshot.id, ...(propertySnapshot.data() as Omit<Property, 'id'>) } as Property;
  const fallback = fallbackDescription(property);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;

  const details = getPropertyDetailsForPrompt(property);
  const prompt = [
    'Scrie descrierea pentru campul de descriere al unui video TikTok imobiliar.',
    'Nu scrie subtitrari. Nu scrie script audio. Scrie doar descrierea postarii TikTok si hashtag-uri.',
    'Ton: natural, romanesc, atractiv, premium, dar nu rigid.',
    'Descrierea trebuie sa fie editabila, scurta spre medie, cu diacritice.',
    'Nu inventa date. Foloseste doar datele proprietatii.',
    'Returneaza strict JSON cu forma: {"description":"...","hashtags":["#..."]}.',
    `Stil cerut: ${input.tone || 'social'}.`,
    `Date proprietate: ${JSON.stringify(details)}`,
  ].join('\n');

  try {
    const response = await fetch(OPENAI_RESPONSES_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL || 'gpt-4.1',
        input: prompt,
        max_output_tokens: 700,
      }),
      cache: 'no-store',
    });
    const payload = await safeJson(response);
    if (!response.ok) throw new Error('OpenAI a refuzat generarea descrierii TikTok.');
    const text = extractOpenAiText(payload);
    const parsed = JSON.parse(text) as { description?: string; hashtags?: string[] };
    return {
      description: String(parsed.description || fallback.description).trim(),
      hashtags: normalizeHashtags(parsed.hashtags?.length ? parsed.hashtags : fallback.hashtags),
    };
  } catch {
    return fallback;
  }
}

function extractOpenAiText(payload: unknown) {
  const output = (payload as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> })?.output_text;
  if (output) return output;
  const nested = (payload as { output?: Array<{ content?: Array<{ text?: string }> }> })?.output || [];
  return nested.flatMap((item) => item.content || []).map((item) => item.text || '').join('\n').trim();
}

function appendLog(
  draft: TikTokPostDraft | null,
  entry: NonNullable<TikTokPostDraft['publishLog']>[number]
) {
  return [...(draft?.publishLog || []), entry].slice(-20);
}

export async function createTikTokPostDraft(input: {
  agencyId: string;
  propertyId: string;
  requestedByUid: string;
  description?: string;
  hashtags?: string[];
  privacyLevel?: string;
  disableComment?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
  aiGeneratedContent?: boolean;
}) {
  const propertySnapshot = await adminDb
    .collection('agencies')
    .doc(input.agencyId)
    .collection('properties')
    .doc(input.propertyId)
    .get();
  if (!propertySnapshot.exists) throw new Error('Proprietatea nu a fost gasita.');

  const property = { id: propertySnapshot.id, ...(propertySnapshot.data() as Omit<Property, 'id'>) } as Property;
  if (property.videoTour?.status !== 'ready' || !property.videoTour?.url) {
    throw new Error('Proprietatea nu are un video tur pregatit pentru TikTok.');
  }

  const generated = !input.description ? await generateTikTokDescription({
    agencyId: input.agencyId,
    propertyId: input.propertyId,
  }) : null;
  const now = nowIso();
  const ref = getDraftsCollection(input.agencyId).doc();
  const draft: TikTokPostDraft = {
    id: ref.id,
    agencyId: input.agencyId,
    propertyId: input.propertyId,
    videoTourUrl: property.videoTour.url,
    videoTourThumbnailUrl: property.videoTour.thumbnailUrl || property.images?.[0]?.url || null,
    propertyTitle: property.title || 'Proprietate ImoDeus',
    createdAt: now,
    updatedAt: now,
    createdByUid: input.requestedByUid,
    status: 'draft',
    description: (input.description || generated?.description || '').trim(),
    hashtags: normalizeHashtags(input.hashtags?.length ? input.hashtags : generated?.hashtags || []),
    privacyLevel: isPrivateModeOnly() ? 'SELF_ONLY' : input.privacyLevel || getDefaultPrivacyLevel(),
    disableComment: Boolean(input.disableComment),
    disableDuet: Boolean(input.disableDuet),
    disableStitch: Boolean(input.disableStitch),
    aiGeneratedContent: input.aiGeneratedContent !== false,
    coverTimestampMs: 1000,
    publishLog: [{ at: now, status: 'draft', message: 'Draft TikTok creat in ImoDeus Studio.' }],
  };

  await ref.set(draft);
  await updatePropertyTikTokSummary(input.agencyId, input.propertyId, draft);
  return draft;
}

export async function updateTikTokPostDraft(input: {
  agencyId: string;
  draftId: string;
  description?: string;
  hashtags?: string[];
  privacyLevel?: string;
  disableComment?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
  aiGeneratedContent?: boolean;
  coverTimestampMs?: number | null;
}) {
  const ref = getDraftRef(input.agencyId, input.draftId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error('Draftul TikTok nu a fost gasit.');
  const draft = { id: snapshot.id, ...snapshot.data() } as TikTokPostDraft;
  const patch: Partial<TikTokPostDraft> = {
    updatedAt: nowIso(),
  };
  if (typeof input.description === 'string') patch.description = input.description.trim();
  if (Array.isArray(input.hashtags)) patch.hashtags = normalizeHashtags(input.hashtags);
  if (typeof input.privacyLevel === 'string') patch.privacyLevel = isPrivateModeOnly() ? 'SELF_ONLY' : input.privacyLevel;
  if (typeof input.disableComment === 'boolean') patch.disableComment = input.disableComment;
  if (typeof input.disableDuet === 'boolean') patch.disableDuet = input.disableDuet;
  if (typeof input.disableStitch === 'boolean') patch.disableStitch = input.disableStitch;
  if (typeof input.aiGeneratedContent === 'boolean') patch.aiGeneratedContent = input.aiGeneratedContent;
  if (input.coverTimestampMs !== undefined) patch.coverTimestampMs = input.coverTimestampMs;

  await ref.set(patch, { merge: true });
  const updated = { ...draft, ...patch } as TikTokPostDraft;
  await updatePropertyTikTokSummary(input.agencyId, updated.propertyId, updated);
  return updated;
}

export async function getTikTokCreatorInfo(uid: string) {
  const { accessToken } = await getAccessTokenForUser(uid);
  const response = await tiktokRequest<TikTokCreatorInfoResponse>('/v2/post/publish/creator_info/query/', accessToken, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return response.data || {};
}

function buildTikTokTitle(draft: TikTokPostDraft) {
  const tags = draft.hashtags.join(' ');
  return [draft.description, tags].filter(Boolean).join('\n\n').trim().slice(0, 2200);
}

async function downloadVideo(videoUrl: string) {
  const response = await fetch(videoUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Nu am putut descarca video turul pentru TikTok (${response.status}).`);
  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'video/mp4';
  return {
    bytes: new Uint8Array(arrayBuffer),
    contentType,
  };
}

async function initTikTokFileUpload(input: {
  accessToken: string;
  draft: TikTokPostDraft;
  videoSize: number;
  chunkSize: number;
  totalChunkCount: number;
}) {
  const response = await tiktokRequest<TikTokPublishInitResponse>('/v2/post/publish/video/init/', input.accessToken, {
    method: 'POST',
    body: JSON.stringify({
      post_info: {
        title: buildTikTokTitle(input.draft),
        privacy_level: isPrivateModeOnly() ? 'SELF_ONLY' : input.draft.privacyLevel,
        disable_duet: input.draft.disableDuet,
        disable_comment: input.draft.disableComment,
        disable_stitch: input.draft.disableStitch,
        video_cover_timestamp_ms: input.draft.coverTimestampMs ?? 1000,
        is_aigc: input.draft.aiGeneratedContent,
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: input.videoSize,
        chunk_size: input.chunkSize,
        total_chunk_count: input.totalChunkCount,
      },
    }),
  });

  const publishId = response.data?.publish_id;
  const uploadUrl = response.data?.upload_url;
  if (!publishId || !uploadUrl) {
    throw new Error('TikTok nu a returnat publish_id si upload_url.');
  }
  return { publishId, uploadUrl };
}

async function uploadVideoToTikTok(uploadUrl: string, bytes: Uint8Array, contentType: string, chunkSize: number) {
  const total = bytes.byteLength;
  let offset = 0;

  while (offset < total) {
    const endExclusive = Math.min(offset + chunkSize, total);
    const chunk = bytes.slice(offset, endExclusive);
    const endInclusive = endExclusive - 1;
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType || 'video/mp4',
        'Content-Length': String(chunk.byteLength),
        'Content-Range': `bytes ${offset}-${endInclusive}/${total}`,
      },
      body: chunk,
    });
    if (!response.ok) {
      throw new Error(`Upload-ul catre TikTok a esuat la ${offset}-${endInclusive} (${response.status}).`);
    }
    offset = endExclusive;
  }
}

function mapTikTokPublishStatus(status?: string): TikTokPostDraft['status'] {
  const normalized = (status || '').toUpperCase();
  if (['PUBLISH_COMPLETE', 'SUCCESS', 'PUBLISHED'].includes(normalized)) return 'published';
  if (['FAILED', 'PUBLISH_FAILED', 'SEND_TO_USER_INBOX_FAILED'].includes(normalized)) return 'error';
  if (['PROCESSING_UPLOAD', 'PROCESSING_DOWNLOAD', 'PUBLISHING', 'PROCESSING'].includes(normalized)) return 'processing';
  return 'processing';
}

export async function publishTikTokPostDraft(input: {
  agencyId: string;
  draftId: string;
  requestedByUid: string;
}) {
  const ref = getDraftRef(input.agencyId, input.draftId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error('Draftul TikTok nu a fost gasit.');
  let draft = { id: snapshot.id, ...snapshot.data() } as TikTokPostDraft;
  if (!draft.description.trim()) throw new Error('Descrierea TikTok este obligatorie.');
  if (!draft.videoTourUrl) throw new Error('Draftul nu are video tur atasat.');

  const now = nowIso();
  draft = {
    ...draft,
    status: 'publishing',
    lastPublishAttemptAt: now,
    updatedAt: now,
    lastPublishError: null,
    publishLog: appendLog(draft, { at: now, status: 'publishing', message: 'Publicarea TikTok a pornit.' }),
  };
  await ref.set(draft, { merge: true });
  await updatePropertyTikTokSummary(input.agencyId, draft.propertyId || null, draft);

  try {
    const { accessToken } = await getAccessTokenForUser(input.requestedByUid);
    const video = await downloadVideo(draft.videoTourUrl);
    const maxChunkSize = Number(process.env.TIKTOK_MAX_FILE_UPLOAD_CHUNK_BYTES || 10_000_000);
    const chunkSize = Math.min(Math.max(maxChunkSize, 1_000_000), video.bytes.byteLength);
    const totalChunkCount = Math.max(1, Math.ceil(video.bytes.byteLength / chunkSize));
    const { publishId, uploadUrl } = await initTikTokFileUpload({
      accessToken,
      draft,
      videoSize: video.bytes.byteLength,
      chunkSize,
      totalChunkCount,
    });

    await ref.set({
      publishId,
      updatedAt: nowIso(),
      publishLog: appendLog(draft, { at: nowIso(), status: 'publishing', message: 'TikTok a alocat upload URL.', tiktokObjectId: publishId }),
    }, { merge: true });

    await uploadVideoToTikTok(uploadUrl, video.bytes, video.contentType, chunkSize);
    const processingDraft: TikTokPostDraft = {
      ...draft,
      publishId,
      status: 'processing',
      updatedAt: nowIso(),
      publishLog: appendLog(draft, { at: nowIso(), status: 'processing', message: 'Video incarcat. TikTok proceseaza postarea.', tiktokObjectId: publishId }),
    };
    await ref.set(processingDraft, { merge: true });
    await updatePropertyTikTokSummary(input.agencyId, draft.propertyId || null, processingDraft);
    return processingDraft;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Publicarea TikTok a esuat.';
    const failedDraft: Partial<TikTokPostDraft> = {
      status: 'error',
      updatedAt: nowIso(),
      lastPublishError: message,
      publishLog: appendLog(draft, { at: nowIso(), status: 'error', message }),
    };
    await ref.set(failedDraft, { merge: true });
    await updatePropertyTikTokSummary(input.agencyId, draft.propertyId || null, { ...draft, ...failedDraft } as TikTokPostDraft);
    throw error;
  }
}

export async function refreshTikTokPostDraftStatus(input: {
  agencyId: string;
  draftId: string;
  requestedByUid: string;
}) {
  const ref = getDraftRef(input.agencyId, input.draftId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new Error('Draftul TikTok nu a fost gasit.');
  const draft = { id: snapshot.id, ...snapshot.data() } as TikTokPostDraft;
  if (!draft.publishId) return draft;

  const { accessToken } = await getAccessTokenForUser(input.requestedByUid);
  const response = await tiktokRequest<TikTokPublishStatusResponse>('/v2/post/publish/status/fetch/', accessToken, {
    method: 'POST',
    body: JSON.stringify({ publish_id: draft.publishId }),
  });
  const status = mapTikTokPublishStatus(response.data?.status);
  const message = response.data?.fail_reason || `Status TikTok: ${response.data?.status || 'processing'}.`;
  const patch: Partial<TikTokPostDraft> = {
    status,
    updatedAt: nowIso(),
    lastStatusCheckedAt: nowIso(),
    publishedAt: status === 'published' ? nowIso() : draft.publishedAt || null,
    lastPublishError: status === 'error' ? message : draft.lastPublishError || null,
    publishLog: appendLog(draft, { at: nowIso(), status, message, tiktokObjectId: draft.publishId }),
  };

  await ref.set(patch, { merge: true });
  const updated = { ...draft, ...patch } as TikTokPostDraft;
  await updatePropertyTikTokSummary(input.agencyId, draft.propertyId || null, updated);
  return updated;
}

async function updatePropertyTikTokSummary(agencyId: string, propertyId: string | null | undefined, draft: TikTokPostDraft) {
  if (!propertyId) return;
  await adminDb
    .collection('agencies')
    .doc(agencyId)
    .collection('properties')
    .doc(propertyId)
    .set({
      tiktokMarketing: {
        latestDraftId: draft.id,
        status: draft.status,
        publishId: draft.publishId || null,
        description: draft.description || null,
        updatedAt: nowIso(),
        publishedAt: draft.publishedAt || null,
        errorMessage: draft.lastPublishError || null,
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
}

export async function listTikTokPostDrafts(agencyId: string) {
  const snapshot = await getDraftsCollection(agencyId).orderBy('updatedAt', 'desc').limit(100).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as TikTokPostDraft);
}

export async function listTikTokStudioAssets(agencyId: string) {
  const snapshot = await getStudioAssetsCollection(agencyId).orderBy('updatedAt', 'desc').limit(120).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as TikTokStudioAsset);
}

export async function listTikTokStudioProjects(agencyId: string) {
  const snapshot = await getStudioProjectsCollection(agencyId).orderBy('updatedAt', 'desc').limit(80).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as TikTokStudioProject);
}

export async function createTikTokStudioAsset(input: {
  agencyId: string;
  ownerUid: string;
  type: 'video' | 'image';
  name: string;
  url: string;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  source?: TikTokStudioAsset['source'];
}) {
  const now = nowIso();
  const ref = getStudioAssetsCollection(input.agencyId).doc();
  const asset: TikTokStudioAsset = {
    id: ref.id,
    agencyId: input.agencyId,
    ownerUid: input.ownerUid,
    createdAt: now,
    updatedAt: now,
    type: input.type,
    name: input.name || (input.type === 'video' ? 'Video importat' : 'Fotografie importata'),
    url: input.url,
    thumbnailUrl: input.thumbnailUrl || null,
    mimeType: input.mimeType || null,
    sizeBytes: input.sizeBytes || null,
    durationSeconds: null,
    source: input.source || 'upload',
    studioProjectId: null,
    status: 'ready',
    editorState: {
      aspectRatio: '9:16',
      trimStartSeconds: 0,
      trimEndSeconds: null,
      headline: null,
      description: null,
      hashtags: null,
      voiceId: null,
      subtitleStyle: 'heygen_pink',
    },
  };

  await ref.set(asset);
  return asset;
}

export async function deleteTikTokStudioAsset(agencyId: string, assetId: string) {
  if (!assetId) {
    const error = new Error('Asset-ul TikTok Studio lipseste.') as TikTokApiError;
    error.status = 400;
    throw error;
  }

  const ref = getStudioAssetsCollection(agencyId).doc(assetId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    const error = new Error('Asset-ul TikTok Studio nu a fost gasit.') as TikTokApiError;
    error.status = 404;
    throw error;
  }

  await ref.delete();
  return { id: assetId };
}

export async function createTikTokStudioProject(input: {
  agencyId: string;
  ownerUid: string;
  title?: string;
  mode?: TikTokStudioProject['mode'];
  sourceAssetIds: string[];
  script?: string;
  voiceId?: string | null;
  voiceProfile?: TikTokStudioVoiceProfile | null;
  subtitleStyle?: TikTokStudioSubtitlePreset;
  creativePreset?: TikTokStudioCreativePreset;
  hook?: string | null;
  caption?: string | null;
  captionVariants?: string[] | null;
  hashtags?: string[] | null;
  storyboard?: TikTokStudioStoryboardScene[] | null;
  timeline?: TikTokStudioStoryboardScene[] | null;
  qualityScore?: TikTokStudioQualityScore | null;
  brandKit?: TikTokStudioBrandKit | null;
  repurposeVariants?: TikTokStudioRepurposeVariant[] | null;
  scheduledAt?: string | null;
  aspectRatio?: TikTokStudioProject['aspectRatio'];
  settings?: Record<string, unknown> | null;
}) {
  const sourceAssetIds = Array.from(new Set(input.sourceAssetIds.map((id) => String(id || '').trim()).filter(Boolean)));
  if (sourceAssetIds.length < 2) {
    throw new Error('Selecteaza cel putin doua fotografii pentru randarea AI video.');
  }
  if (!String(input.script || '').trim()) {
    throw new Error('Scriptul voiceover este obligatoriu pentru randarea AI video.');
  }

  const now = nowIso();
  const ref = getStudioProjectsCollection(input.agencyId).doc();
  const project: TikTokStudioProject = {
    id: ref.id,
    agencyId: input.agencyId,
    ownerUid: input.ownerUid,
    createdAt: now,
    updatedAt: now,
    title: input.title?.trim() || 'Video AI pentru TikTok',
    status: 'draft',
    mode: input.mode || 'photo_to_video',
    sourceAssetIds,
    outputAssetId: null,
    script: input.script?.trim() || '',
    voiceId: input.voiceId || null,
    voiceProfile: input.voiceProfile || input.brandKit?.defaultVoiceProfile || null,
    subtitleStyle: input.subtitleStyle || 'heygen_pink',
    creativePreset: input.creativePreset || 'luxury_real_estate',
    hook: input.hook || null,
    caption: input.caption || null,
    captionVariants: input.captionVariants || null,
    hashtags: input.hashtags || null,
    storyboard: input.storyboard || null,
    timeline: input.timeline || input.storyboard || null,
    qualityScore: input.qualityScore || null,
    brandKit: input.brandKit || null,
    repurposeVariants: input.repurposeVariants || ['tiktok_9_16'],
    scheduledAt: input.scheduledAt || null,
    aspectRatio: input.aspectRatio || '9:16',
    settings: input.settings || null,
    errorMessage: null,
  };

  await ref.set(project);
  return project;
}

export async function renderTikTokStudioProject(input: {
  agencyId: string;
  projectId: string;
  requestedByUid: string;
}) {
  const projectRef = getStudioProjectsCollection(input.agencyId).doc(input.projectId);
  const projectSnapshot = await projectRef.get();
  if (!projectSnapshot.exists) throw new Error('Proiectul TikTok Studio nu a fost gasit.');
  const project = { id: projectSnapshot.id, ...projectSnapshot.data() } as TikTokStudioProject;
  if (project.mode !== 'photo_to_video') {
    throw new Error('Randarea cloud asteapta un proiect AI format din fotografii selectate.');
  }
  if (project.ownerUid !== input.requestedByUid) {
    throw new Error('Nu poti randa un proiect creat de alt utilizator.');
  }

  const assetSnapshots = await Promise.all(
    project.sourceAssetIds.map((assetId) => getStudioAssetsCollection(input.agencyId).doc(assetId).get())
  );
  const sourceAssets = assetSnapshots
    .filter((snapshot) => snapshot.exists)
    .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }) as TikTokStudioAsset)
    .filter((asset) => asset.type === 'image');
  if (sourceAssets.length < 2) {
    throw new Error('Proiectul are nevoie de cel putin doua fotografii valide.');
  }

  await projectRef.set({
    status: 'rendering',
    updatedAt: nowIso(),
    errorMessage: null,
  } satisfies Partial<TikTokStudioProject>, { merge: true });

  try {
    const { renderTikTokStudioPhotoVideo } = await import('@/lib/tiktok-video-studio-renderer');
    const render = await renderTikTokStudioPhotoVideo({
      agencyId: input.agencyId,
      project,
      sourceAssets,
    });

    const now = nowIso();
    const assetRef = getStudioAssetsCollection(input.agencyId).doc();
    const outputAsset: TikTokStudioAsset = {
      id: assetRef.id,
      agencyId: input.agencyId,
      ownerUid: input.requestedByUid,
      createdAt: now,
      updatedAt: now,
      type: 'video',
      name: `${project.title || 'Video AI TikTok'} - randare AI`,
      url: render.videoUrl,
      thumbnailUrl: render.thumbnailUrl,
      mimeType: 'video/mp4',
      sizeBytes: render.sizeBytes,
      durationSeconds: render.durationSeconds,
      source: 'ai_generated',
      studioProjectId: project.id,
      status: 'ready',
      editorState: {
        aspectRatio: project.aspectRatio,
        trimStartSeconds: 0,
        trimEndSeconds: null,
        headline: null,
        description: project.caption || project.script || null,
        hashtags: project.hashtags || null,
        voiceId: project.voiceId || null,
        subtitleStyle: project.subtitleStyle || 'heygen_pink',
        repurposeVariant: project.repurposeVariants?.[0] || 'tiktok_9_16',
      },
      errorMessage: null,
    };

    await assetRef.set(outputAsset);
    const readyProject: TikTokStudioProject = {
      ...project,
      status: 'ready',
      updatedAt: now,
      outputAssetId: outputAsset.id,
      errorMessage: null,
    };
    await projectRef.set(readyProject, { merge: true });
    return { project: readyProject, asset: outputAsset };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Randarea AI video a esuat.';
    await projectRef.set({
      status: 'error',
      updatedAt: nowIso(),
      errorMessage: message,
    } satisfies Partial<TikTokStudioProject>, { merge: true });
    throw error;
  }
}

export async function createTikTokPostDraftFromStudioAsset(input: {
  agencyId: string;
  assetId: string;
  requestedByUid: string;
  description?: string;
  hashtags?: string[];
  privacyLevel?: string;
  disableComment?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
  aiGeneratedContent?: boolean;
  scheduledAt?: string | null;
  repurposeVariant?: TikTokStudioRepurposeVariant | null;
}) {
  const assetSnapshot = await getStudioAssetsCollection(input.agencyId).doc(input.assetId).get();
  if (!assetSnapshot.exists) throw new Error('Asset-ul TikTok Studio nu a fost gasit.');

  const asset = { id: assetSnapshot.id, ...assetSnapshot.data() } as TikTokStudioAsset;
  if (asset.type !== 'video') {
    throw new Error('Pentru publicare TikTok directa, asset-ul trebuie sa fie video. Fotografiile trebuie randate intai ca video AI.');
  }

  const now = nowIso();
  const ref = getDraftsCollection(input.agencyId).doc();
  const draft: TikTokPostDraft = {
    id: ref.id,
    agencyId: input.agencyId,
    propertyId: null,
    sourceType: asset.studioProjectId ? 'studio_project' : 'studio_asset',
    studioAssetId: asset.id,
    studioProjectId: asset.studioProjectId || null,
    videoTourUrl: asset.url,
    videoTourThumbnailUrl: asset.thumbnailUrl || null,
    propertyTitle: asset.name || 'Video TikTok Studio',
    createdAt: now,
    updatedAt: now,
    createdByUid: input.requestedByUid,
    status: 'draft',
    description: (input.description || asset.editorState?.description || 'Video pregatit in ImoDeus TikTok Studio.').trim(),
    hashtags: normalizeHashtags(input.hashtags?.length ? input.hashtags : asset.editorState?.hashtags?.length ? asset.editorState.hashtags : ['#imobiliare', '#tiktokstudio', '#imodeus']),
    privacyLevel: isPrivateModeOnly() ? 'SELF_ONLY' : input.privacyLevel || getDefaultPrivacyLevel(),
    disableComment: Boolean(input.disableComment),
    disableDuet: Boolean(input.disableDuet),
    disableStitch: Boolean(input.disableStitch),
    aiGeneratedContent: input.aiGeneratedContent !== false,
    coverTimestampMs: 1000,
    scheduledAt: input.scheduledAt || null,
    scheduleStatus: input.scheduledAt ? 'scheduled' : 'none',
    repurposeVariant: input.repurposeVariant || asset.editorState?.repurposeVariant || null,
    publishLog: [{ at: now, status: 'draft', message: 'Draft TikTok creat dintr-un video importat in Studio.' }],
  };

  await ref.set(draft);
  return draft;
}
