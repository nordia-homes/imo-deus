import { createHash, createHmac, randomBytes } from 'crypto';
import { adminDb } from '@/firebase/admin';
import type {
  PortalIntegrationPublicStatus,
  PromotionStatus,
  Property,
  StoriaIntegrationPrivate,
  StoriaPortalProfile,
} from '@/lib/types';

const STORIA_PROVIDER = 'storia';
const PRIVATE_COLLECTION = 'agencyPrivateIntegrations';
const OAUTH_STATE_COLLECTION = 'storiaOauthStates';
const STORIA_API_BASE_URL = 'https://api.olxgroup.com';
const STORIA_SITE_URL = 'https://www.storia.ro';
const STORIA_SITE_URN = 'urn:site:storiaro';
const STORIA_LOCALE = 'ro';
const STORIA_USER_AGENT = 'ImoDeus CRM';

type StoriaApiError = Error & {
  status?: number;
  payload?: unknown;
};

type StoriaWebhookNotification = {
  transaction_id?: string;
  object_id?: string;
  flow?: string;
  event_type?: string;
  error_message?: string | null;
  data?: {
    code?: string | null;
    url?: string | null;
    detail?: string | null;
    title?: string | null;
    validation?: Array<{ field?: string; detail?: string; title?: string }>;
    visible_in_profile?: boolean;
    created_at?: string | null;
    modified_at?: string | null;
    activated_at?: string | null;
  } | null;
};

type TokenResponse = {
  access_token: string;
  refresh_token?: string | null;
  token_type?: string;
  expires_in?: number;
  scope?: string;
};

type PublishResponse = {
  transaction_id?: string;
  message?: string;
  data?: {
    uuid?: string;
    last_action_status?: string;
  };
};

type AdvertMetadataResponse = {
  transaction_id?: string;
  message?: string;
  data?: {
    code?: string | null;
    url?: string | null;
    visible_in_profile?: boolean;
    created_at?: string | null;
    modified_at?: string | null;
    activated_at?: string | null;
  };
};

function getPrivateDocId(agencyId: string) {
  return `${agencyId}__${STORIA_PROVIDER}`;
}

function getPrivateDocRef(agencyId: string) {
  return adminDb.collection(PRIVATE_COLLECTION).doc(getPrivateDocId(agencyId));
}

function getPublicDocRef(agencyId: string) {
  return adminDb.collection('agencies').doc(agencyId).collection('integrations').doc(STORIA_PROVIDER);
}

function getOauthStateRef(state: string) {
  return adminDb.collection(OAUTH_STATE_COLLECTION).doc(state);
}

function nowIso() {
  return new Date().toISOString();
}

function getClientId() {
  return (process.env.STORIA_CLIENT_ID || '').trim();
}

function getClientSecret() {
  return process.env.STORIA_CLIENT_SECRET || '';
}

function getApiKey() {
  return (process.env.STORIA_API_KEY || '').trim();
}

function getWebhookSecret() {
  return process.env.STORIA_WEBHOOK_SECRET || '';
}

function requireStoriaConfig() {
  const clientId = getClientId();
  const clientSecret = getClientSecret();
  const apiKey = getApiKey();

  if (!clientId || !clientSecret || !apiKey) {
    throw new Error('Variabilele STORIA_CLIENT_ID, STORIA_CLIENT_SECRET si STORIA_API_KEY trebuie configurate.');
  }

  return { clientId, clientSecret, apiKey };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function getPayloadHash(payload: unknown) {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function slugifyTitle(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-') || 'anunt-imobiliar';
}

function sanitizeStoriaText(value?: string | null) {
  return (value || '')
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactObject<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === undefined || entry === null || entry === '') return false;
      if (Array.isArray(entry)) return entry.length > 0;
      return true;
    })
  ) as Partial<T>;
}

function normalizeRooms(rooms?: number | null) {
  if (!rooms || !Number.isFinite(rooms)) return null;
  const bounded = Math.max(1, Math.min(rooms, 10));
  return bounded >= 10 ? 'urn:concept:more' : `urn:concept:${bounded}`;
}

function mapPropertyToCategoryUrn(property: Property, profile?: StoriaPortalProfile | null) {
  if (profile?.categoryUrn) {
    return profile.categoryUrn;
  }

  const normalizedType = (property.propertyType || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const isRent = property.transactionType === 'Închiriere';

  if (normalizedType.includes('apartament') || normalizedType.includes('garsoniera')) {
    return isRent ? 'urn:concept:apartments-for-rent' : 'urn:concept:apartments-for-sale';
  }
  if (normalizedType.includes('casa') || normalizedType.includes('vila')) {
    return isRent ? 'urn:concept:houses-for-rent' : 'urn:concept:houses-for-sale';
  }
  if (normalizedType.includes('teren')) {
    return isRent ? 'urn:concept:lots-for-rent' : 'urn:concept:lots-for-sale';
  }
  if (normalizedType.includes('spatiu') || normalizedType.includes('comercial')) {
    return isRent ? 'urn:concept:stores-for-rent' : 'urn:concept:stores-for-sale';
  }

  throw new Error('Tipul proprietatii nu este mapat inca pentru Storia. Foloseste Apartament, Garsonieră, Casă/Vilă, Teren sau Spațiu Comercial.');
}

function buildAttributes(property: Property, categoryUrn: string, market: 'primary' | 'secondary') {
  const attributes: Array<{ urn: string; value: string | number | boolean }> = [];
  const add = (urn: string, value: string | number | boolean | null | undefined) => {
    if (value === undefined || value === null || value === '') return;
    attributes.push({ urn, value });
  };

  const roomUrn = normalizeRooms(property.rooms);
  const netArea = property.squareFootage ? Math.round(property.squareFootage) : null;
  const terrainArea = property.totalSurface ? Math.round(property.totalSurface) : null;

  add('urn:concept:market', `urn:concept:${market}`);

  if (categoryUrn.includes('apartments')) {
    add('urn:concept:number-of-rooms', roomUrn);
    add('urn:concept:net-area-m2', netArea);
    add('urn:concept:construction-year', property.constructionYear || null);
  }

  if (categoryUrn.includes('houses')) {
    add('urn:concept:number-of-rooms', roomUrn);
    add('urn:concept:net-area-m2', netArea);
    add('urn:concept:terrain-area-m2', terrainArea || netArea);
    add('urn:concept:construction-year', property.constructionYear || null);
  }

  if (categoryUrn.includes('lots')) {
    add('urn:concept:terrain-area-m2', terrainArea || netArea);
  }

  if (categoryUrn.includes('stores')) {
    add('urn:concept:net-area-m2', netArea);
    add('urn:concept:construction-year', property.constructionYear || null);
  }

  return attributes;
}

function buildAdvertPayload(property: Property) {
  const profile = property.portalProfiles?.storia || null;
  const categoryUrn = mapPropertyToCategoryUrn(property, profile);
  const market = profile?.market || 'secondary';
  const title = sanitizeStoriaText(profile?.titleOverride || property.title);
  const description = sanitizeStoriaText(profile?.descriptionOverride || property.description || '');

  if (title.length < 5) {
    throw new Error('Titlul proprietatii trebuie sa aiba minimum 5 caractere pentru Storia.');
  }
  if (description.length < 50) {
    throw new Error('Descrierea proprietatii trebuie sa aiba minimum 50 de caractere pentru publicare pe Storia.');
  }
  if (!property.latitude || !property.longitude) {
    throw new Error('Proprietatea are nevoie de latitudine si longitudine pentru publicare pe Storia.');
  }
  if (!property.images?.length) {
    throw new Error('Proprietatea are nevoie de cel putin o imagine pentru publicare pe Storia.');
  }

  const priceCurrency = property.transactionType === 'Închiriere' ? 'EUR' : 'EUR';
  const payload = compactObject({
    title: title.slice(0, 70),
    description,
    category_urn: categoryUrn,
    site_urn: STORIA_SITE_URN,
    market,
    price: {
      value: property.price,
      currency: priceCurrency,
    },
    location: {
      lat: property.latitude,
      lon: property.longitude,
      exact: Boolean(profile?.locationExact),
    },
    images: property.images
      .map((image) => image?.url)
      .filter((url): url is string => typeof url === 'string' && Boolean(url))
      .map((url) => ({ url })),
    attributes: buildAttributes(property, categoryUrn, market),
    custom_fields: {
      id: profile?.customReference || property.id,
      reference_id: profile?.customReference || property.id,
    },
    auto_extend: true,
  });

  return { payload, categoryUrn, market };
}

function mapRemoteCodeToPromotionStatus(code?: string | null): PromotionStatus['status'] {
  const normalized = (code || '').toLowerCase();
  if (normalized === 'active') return 'published';
  if (normalized === 'new' || normalized === 'unpaid' || normalized === 'blocked') return 'pending';
  if (normalized.startsWith('removed') || normalized === 'outdated' || normalized === 'moderated') return 'unpublished';
  return 'error';
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

async function requestAccessToken(body: Record<string, string>) {
  const { clientId, clientSecret, apiKey } = requireStoriaConfig();
  const basicCredentials = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');

  const response = await fetch(`${STORIA_API_BASE_URL}/oauth/v1/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Basic ${basicCredentials}`,
      'X-API-KEY': apiKey,
      'User-Agent': STORIA_USER_AGENT,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const payload = await safeJson(response);
  if (!response.ok) {
    const error = new Error(
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? String((payload as { message?: unknown }).message || 'Autentificarea Storia a esuat.')
        : 'Autentificarea Storia a esuat.'
    ) as StoriaApiError;
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload as TokenResponse;
}

async function getPrivateIntegration(agencyId: string) {
  const snapshot = await getPrivateDocRef(agencyId).get();
  if (!snapshot.exists) return null;
  return snapshot.data() as StoriaIntegrationPrivate;
}

async function persistPrivateIntegration(agencyId: string, payload: StoriaIntegrationPrivate) {
  await getPrivateDocRef(agencyId).set(payload, { merge: true });
}

async function setPublicStatus(agencyId: string, patch: Partial<PortalIntegrationPublicStatus>) {
  await getPublicDocRef(agencyId).set(
    {
      connected: false,
      updatedAt: nowIso(),
      ...patch,
    },
    { merge: true }
  );
}

async function refreshAccessToken(agencyId: string, integration: StoriaIntegrationPrivate) {
  if (!integration.refreshToken) {
    throw new Error('Conexiunea Storia nu mai are refresh token. Reconecteaza contul.');
  }

  const tokenPayload = await requestAccessToken({
    grant_type: 'refresh_token',
    refresh_token: integration.refreshToken,
  });

  const expiresAt = tokenPayload.expires_in
    ? new Date(Date.now() + tokenPayload.expires_in * 1000).toISOString()
    : null;

  const updated: StoriaIntegrationPrivate = {
    ...integration,
    accessToken: tokenPayload.access_token,
    refreshToken: tokenPayload.refresh_token || integration.refreshToken,
    accessTokenExpiresAt: expiresAt,
    updatedAt: nowIso(),
  };

  await persistPrivateIntegration(agencyId, updated);
  await setPublicStatus(agencyId, {
    connected: true,
    lastTokenRefreshAt: nowIso(),
    lastError: null,
  });

  return updated;
}

async function ensureValidIntegration(agencyId: string) {
  const integration = await getPrivateIntegration(agencyId);
  if (!integration) {
    throw new Error('Contul Storia nu este conectat pentru aceasta agentie.');
  }

  if (!integration.accessTokenExpiresAt) return integration;
  const expiresAt = new Date(integration.accessTokenExpiresAt).getTime();
  const shouldRefresh = Number.isFinite(expiresAt) && expiresAt <= Date.now() + 2 * 60 * 1000;
  if (!shouldRefresh) return integration;
  return refreshAccessToken(agencyId, integration);
}

async function storiaRequest<T>(agencyId: string, path: string, init?: RequestInit, retry = true): Promise<T> {
  const integration = await ensureValidIntegration(agencyId);
  const { apiKey } = requireStoriaConfig();
  const response = await fetch(`${STORIA_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${integration.accessToken}`,
      'X-API-KEY': apiKey,
      'User-Agent': STORIA_USER_AGENT,
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  if (response.status === 401 && retry) {
    await refreshAccessToken(agencyId, integration);
    return storiaRequest<T>(agencyId, path, init, false);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const payload = await safeJson(response);
  if (!response.ok) {
    const error = new Error(
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? String((payload as { message?: unknown }).message || `Storia API a raspuns cu ${response.status}.`)
        : `Storia API a raspuns cu ${response.status}.`
    ) as StoriaApiError;
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload as T;
}

async function persistPropertyPublishState(params: {
  agencyId: string;
  propertyId: string;
  remoteUuid: string | null;
  remoteUrl: string | null;
  remoteCode: string | null;
  payloadHash: string | null;
  categoryUrn?: string | null;
  market?: 'primary' | 'secondary' | null;
  errorMessage?: string | null;
  transactionId?: string | null;
}) {
  const {
    agencyId,
    propertyId,
    remoteUuid,
    remoteUrl,
    remoteCode,
    payloadHash,
    categoryUrn,
    market,
    errorMessage,
    transactionId,
  } = params;

  const promotionStatus = errorMessage ? 'error' : mapRemoteCodeToPromotionStatus(remoteCode);

  await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).set(
    {
      promotions: {
        storia: {
          status: promotionStatus,
          lastSync: nowIso(),
          link: remoteUrl || null,
          remoteId: remoteUuid || null,
          errorMessage: errorMessage || null,
          remoteState: remoteCode || null,
        },
      },
      portalProfiles: {
        storia: {
          remoteUuid,
          remoteUrl,
          categoryUrn: categoryUrn ?? undefined,
          market: market ?? undefined,
          lastValidationError: errorMessage || null,
          lastPublishedAt: !errorMessage && remoteUrl ? nowIso() : null,
          lastPayloadHash: payloadHash || null,
          lastTransactionId: transactionId || null,
        },
      },
    },
    { merge: true }
  );
}

async function persistPublishAudit(params: {
  agencyId: string;
  propertyId: string;
  entry: {
    attemptedAt: string;
    stage?: string | null;
    responseStatus?: number | null;
    errorMessage?: string | null;
  };
}) {
  const { agencyId, propertyId, entry } = params;
  const snapshot = await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).get();
  const history =
    ((snapshot.data() as Property | undefined)?.portalProfiles?.storia?.lastPublishAuditHistory || []).slice(-9);

  await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).set(
    {
      portalProfiles: {
        storia: {
          lastPublishAuditHistory: [...history, entry],
        },
      },
    },
    { merge: true }
  );
}

export async function createStoriaAuthorization(params: { agencyId: string; requestedByUid: string }) {
  const { agencyId, requestedByUid } = params;
  const { clientId } = requireStoriaConfig();
  const state = randomBytes(24).toString('hex');
  await getOauthStateRef(state).set({
    state,
    agencyId,
    requestedByUid,
    createdAt: nowIso(),
  });

  const authorizationUrl = `${STORIA_SITE_URL}/${STORIA_LOCALE}/crm/authorization/?response_type=code&client_id=${encodeURIComponent(clientId)}&state=${encodeURIComponent(state)}`;
  return { state, authorizationUrl };
}

export async function finalizeStoriaAuthorization(params: { code: string; state: string }) {
  const { code, state } = params;
  const stateSnapshot = await getOauthStateRef(state).get();
  if (!stateSnapshot.exists) {
    throw new Error('State-ul de autorizare Storia nu mai este valid. Reincearca conectarea din ImoDeus.');
  }

  const stateData = stateSnapshot.data() as {
    agencyId: string;
    requestedByUid?: string;
  };

  const tokenPayload = await requestAccessToken({
    grant_type: 'authorization_code',
    code,
  });

  const expiresAt = tokenPayload.expires_in
    ? new Date(Date.now() + tokenPayload.expires_in * 1000).toISOString()
    : null;

  const payload: StoriaIntegrationPrivate = {
    provider: STORIA_PROVIDER,
    agencyId: stateData.agencyId,
    accessToken: tokenPayload.access_token,
    accessTokenExpiresAt: expiresAt,
    refreshToken: tokenPayload.refresh_token || null,
    connectedAt: nowIso(),
    updatedAt: nowIso(),
    authorizationState: state,
    lastAuthorizedByUid: stateData.requestedByUid || null,
    lastAuthorizedAt: nowIso(),
  };

  await persistPrivateIntegration(stateData.agencyId, payload);
  await setPublicStatus(stateData.agencyId, {
    connected: true,
    connectedAt: payload.connectedAt,
    lastTokenRefreshAt: nowIso(),
    lastError: null,
  });
  await getOauthStateRef(state).delete().catch(() => undefined);

  return {
    connected: true,
    agencyId: stateData.agencyId,
  };
}

export async function disconnectAgencyStoriaAccount(agencyId: string) {
  await getPrivateDocRef(agencyId).delete().catch(() => undefined);
  await getPublicDocRef(agencyId).set(
    {
      connected: false,
      connectedAt: null,
      lastTokenRefreshAt: null,
      lastError: null,
      updatedAt: nowIso(),
    },
    { merge: true }
  );
}

export async function getAgencyStoriaStatus(agencyId: string) {
  const publicSnapshot = await getPublicDocRef(agencyId).get();
  const privateIntegration = await getPrivateIntegration(agencyId);
  if (!publicSnapshot.exists) {
    return {
      connected: false,
      connectedAt: privateIntegration?.connectedAt || null,
      lastTokenRefreshAt: null,
      lastError: null,
    };
  }
  return publicSnapshot.data() as PortalIntegrationPublicStatus & { updatedAt?: string };
}

export async function publishPropertyToStoria(params: {
  agencyId: string;
  propertyId: string;
  requestedByUid: string;
}) {
  const { agencyId, propertyId } = params;
  const propertySnapshot = await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).get();
  if (!propertySnapshot.exists) {
    throw new Error('Proprietatea nu a fost gasita.');
  }

  const property = { id: propertySnapshot.id, ...propertySnapshot.data() } as Property;
  const { payload, categoryUrn, market } = buildAdvertPayload(property);
  const payloadHash = getPayloadHash(payload);

  await persistPublishAudit({
    agencyId,
    propertyId,
    entry: { attemptedAt: nowIso(), stage: 'attempt' },
  });

  try {
    const publishResponse = await storiaRequest<PublishResponse>(agencyId, '/advert/v1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const remoteUuid = publishResponse.data?.uuid || null;
    if (!remoteUuid) {
      throw new Error('Storia nu a returnat UUID-ul anuntului.');
    }

    const metadata = await storiaRequest<AdvertMetadataResponse>(agencyId, `/advert/v1/${encodeURIComponent(remoteUuid)}/meta`, {
      method: 'GET',
    }).catch(() => null);

    const remoteCode = metadata?.data?.code || publishResponse.data?.last_action_status || 'new';
    const remoteUrl = metadata?.data?.url || null;

    await persistPropertyPublishState({
      agencyId,
      propertyId,
      remoteUuid,
      remoteUrl,
      remoteCode,
      payloadHash,
      categoryUrn,
      market,
      transactionId: publishResponse.transaction_id || null,
    });
    await persistPublishAudit({
      agencyId,
      propertyId,
      entry: { attemptedAt: nowIso(), stage: 'success', responseStatus: 201 },
    });

    return {
      remoteUuid,
      remoteUrl,
      remoteCode,
      transactionId: publishResponse.transaction_id || null,
    };
  } catch (error) {
    const typed = error as StoriaApiError;
    const errorMessage = typed.message || 'Publicarea in Storia a esuat.';

    await persistPropertyPublishState({
      agencyId,
      propertyId,
      remoteUuid: property.portalProfiles?.storia?.remoteUuid || null,
      remoteUrl: property.portalProfiles?.storia?.remoteUrl || null,
      remoteCode: property.promotions?.storia?.remoteState || null,
      payloadHash,
      categoryUrn,
      market,
      errorMessage,
    });
    await persistPublishAudit({
      agencyId,
      propertyId,
      entry: {
        attemptedAt: nowIso(),
        stage: 'error',
        responseStatus: typed.status || null,
        errorMessage,
      },
    });

    throw error;
  }
}

export async function unpublishPropertyFromStoria(params: { agencyId: string; propertyId: string }) {
  const { agencyId, propertyId } = params;
  const propertySnapshot = await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).get();
  if (!propertySnapshot.exists) {
    throw new Error('Proprietatea nu a fost gasita.');
  }

  const property = { id: propertySnapshot.id, ...propertySnapshot.data() } as Property;
  const remoteUuid = property.portalProfiles?.storia?.remoteUuid || (typeof property.promotions?.storia?.remoteId === 'string' ? property.promotions.storia.remoteId : null);
  if (!remoteUuid) {
    throw new Error('Anuntul Storia nu are un UUID remote salvat.');
  }

  await storiaRequest(agencyId, `/advert/v1/${encodeURIComponent(remoteUuid)}/deactivate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  await persistPropertyPublishState({
    agencyId,
    propertyId,
    remoteUuid,
    remoteUrl: property.portalProfiles?.storia?.remoteUrl || null,
    remoteCode: 'removed_by_user',
    payloadHash: property.portalProfiles?.storia?.lastPayloadHash || null,
  });

  return {
    remoteUuid,
    state: 'removed_by_user',
  };
}

export async function resolvePropertyStoriaPublicUrl(params: { agencyId: string; propertyId: string }) {
  const { agencyId, propertyId } = params;
  const propertySnapshot = await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).get();
  if (!propertySnapshot.exists) {
    throw new Error('Proprietatea nu a fost gasita.');
  }
  const property = { id: propertySnapshot.id, ...propertySnapshot.data() } as Property;
  const remoteUuid = property.portalProfiles?.storia?.remoteUuid || (typeof property.promotions?.storia?.remoteId === 'string' ? property.promotions.storia.remoteId : null);

  if (!remoteUuid) {
    throw new Error('Nu exista UUID remote salvat pentru acest anunt Storia.');
  }

  const metadata = await storiaRequest<AdvertMetadataResponse>(agencyId, `/advert/v1/${encodeURIComponent(remoteUuid)}/meta`, {
    method: 'GET',
  });
  const remoteUrl = metadata.data?.url || property.portalProfiles?.storia?.remoteUrl || null;

  if (!remoteUrl) {
    throw new Error('Nu am putut determina linkul public al anuntului din Storia.');
  }

  return {
    url: remoteUrl.startsWith('http') ? remoteUrl : `${STORIA_SITE_URL}/${slugifyTitle(property.title)}`,
    remoteUuid,
  };
}

export async function handleStoriaWebhookNotification(notification: StoriaWebhookNotification, signatureHeader?: string | null) {
  const objectId = notification.object_id || '';
  const transactionId = notification.transaction_id || '';
  const secret = getWebhookSecret();
  if (!objectId || !transactionId) {
    throw new Error('Webhook Storia invalid: lipsesc object_id sau transaction_id.');
  }

  if (secret) {
    const expected = createHmac('sha1', secret).update(`${objectId},${transactionId}`, 'utf8').digest('hex');
    if ((signatureHeader || '').trim().toLowerCase() !== expected.toLowerCase()) {
      throw new Error('Semnatura webhook-ului Storia este invalida.');
    }
  }

  const snapshot = await adminDb.collectionGroup('properties').where('promotions.storia.remoteId', '==', objectId).get();
  if (snapshot.empty) {
    return { matched: 0 };
  }

  const remoteCode = notification.data?.code || null;
  const remoteUrl = notification.data?.url || null;
  const errorMessage =
    notification.error_message ||
    notification.data?.detail ||
    (notification.data?.validation || []).map((item) => item.detail).filter(Boolean).join(' | ') ||
    null;

  const batch = adminDb.batch();
  snapshot.docs.forEach((docSnapshot) => {
    batch.set(
      docSnapshot.ref,
      {
        promotions: {
          storia: {
            status: errorMessage ? 'error' : mapRemoteCodeToPromotionStatus(remoteCode),
            lastSync: nowIso(),
            link: remoteUrl,
            remoteId: objectId,
            errorMessage,
            remoteState: remoteCode,
          },
        },
        portalProfiles: {
          storia: {
            remoteUuid: objectId,
            remoteUrl,
            lastValidationError: errorMessage,
            lastPublishedAt: !errorMessage && remoteUrl ? nowIso() : null,
            lastTransactionId: transactionId,
          },
        },
      },
      { merge: true }
    );
  });
  await batch.commit();

  return { matched: snapshot.size };
}
