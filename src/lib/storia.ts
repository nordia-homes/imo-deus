import { createHash, createHmac, randomBytes } from 'crypto';
import { adminDb } from '@/firebase/admin';
import type {
  PortalIntegrationPublicStatus,
  PromotionStatus,
  Property,
  StoriaActivePromotion,
  StoriaIntegrationPrivate,
  StoriaPromotionOption,
  StoriaPromotionRequest,
  StoriaPromotionSettings,
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
    uuid?: string | null;
    last_action_status?: string | null;
    last_action_at?: string | null;
    code?: string | null;
    url?: string | null;
    visible_in_profile?: boolean;
    created_at?: string | null;
    modified_at?: string | null;
    activated_at?: string | null;
    state?: {
      code?: string | null;
      url?: string | null;
      visible_in_profile?: boolean;
      created_at?: string | null;
      modified_at?: string | null;
      activated_at?: string | null;
      recorded_at?: string | null;
      ttl?: string | null;
    } | null;
  };
};

type StoriaPromotionsTaxonomyResponse = {
  site?: string;
  promotions?: Array<{
    promotion_code?: string;
    promotion_description?: string;
    duration_days?: number[];
    account_type?: string[];
  }>;
};

type StoriaApplyPromotionResponse = {
  transaction_id?: string;
  uuid?: string;
  message?: string;
  data?: {
    advert_uuid?: string;
    vas_uuid?: string;
    status?: string;
  };
};

type StoriaActivePromotionsResponse = {
  transaction_id?: string;
  message?: string;
  data?: {
    uuid?: string;
    vas?: Array<{
      uuid?: string;
      advert_uuid?: string;
      promotion_code?: string;
      status?: string;
      duration_days?: number;
      created_at?: string;
      updated_at?: string;
      error?: {
        detail?: string;
        title?: string;
      } | Record<string, unknown> | null;
    }>;
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

function normalizeStoriaPublicUrl(rawUrl?: string | null, title?: string | null) {
  const normalized = (rawUrl || '').trim();
  if (!normalized) return null;
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized;
  }
  if (normalized.startsWith('/')) {
    return `${STORIA_SITE_URL}${normalized}`;
  }
  if (/^[A-Za-z0-9_-]{4,32}$/.test(normalized)) {
    return `${STORIA_SITE_URL}/${STORIA_LOCALE}/oferta/${slugifyTitle(title)}-${normalized}`;
  }
  return `${STORIA_SITE_URL}/${normalized.replace(/^\/+/, '')}`;
}

function getAdvertMetadataState(metadata?: AdvertMetadataResponse | null) {
  const state = metadata?.data?.state || null;

  return {
    code: state?.code || metadata?.data?.code || metadata?.data?.last_action_status || null,
    url: state?.url || metadata?.data?.url || null,
    visibleInProfile:
      typeof state?.visible_in_profile === 'boolean'
        ? state.visible_in_profile
        : typeof metadata?.data?.visible_in_profile === 'boolean'
          ? metadata.data.visible_in_profile
          : null,
    createdAt: state?.created_at || metadata?.data?.created_at || null,
    modifiedAt: state?.modified_at || metadata?.data?.modified_at || null,
    activatedAt: state?.activated_at || metadata?.data?.activated_at || null,
  };
}

async function waitForAdvertMetadataState(params: {
  agencyId: string;
  remoteUuid: string;
  targetCodes: string[];
  attempts?: number;
  delayMs?: number;
}) {
  const {
    agencyId,
    remoteUuid,
    targetCodes,
    attempts = 4,
    delayMs = 1200,
  } = params;

  let latestMetadata: AdvertMetadataResponse | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    latestMetadata = await storiaRequest<AdvertMetadataResponse>(agencyId, `/advert/v1/${encodeURIComponent(remoteUuid)}/meta`, {
      method: 'GET',
    }).catch(() => latestMetadata);

    const latestState = getAdvertMetadataState(latestMetadata);
    if (targetCodes.includes((latestState.code || '').toLowerCase())) {
      return latestMetadata;
    }

    if (attempt < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return latestMetadata;
}

function sanitizeStoriaText(value?: string | null) {
  return (value || '')
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeComparableText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
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

function extractApiErrorMessage(payload: unknown, fallback: string) {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload || fallback;
  if (typeof payload !== 'object') return fallback;

  const record = payload as {
    message?: unknown;
    error?: unknown;
    error_description?: unknown;
    detail?: unknown;
    title?: unknown;
    data?: {
      detail?: unknown;
      title?: unknown;
      validation?: Array<{ field?: unknown; detail?: unknown; title?: unknown }>;
    } | null;
  };

  const validationMessages = (record.data?.validation || [])
    .map((item) => {
      const field = typeof item?.field === 'string' ? item.field : '';
      const detail = typeof item?.detail === 'string' ? item.detail : '';
      return [field, detail].filter(Boolean).join(': ');
    })
    .filter(Boolean);

  if (validationMessages.length) {
    return validationMessages.join(' | ');
  }

  return [
    typeof record.message === 'string' ? record.message : '',
    typeof record.error === 'string' ? record.error : '',
    typeof record.error_description === 'string' ? record.error_description : '',
    typeof record.detail === 'string' ? record.detail : '',
    typeof record.title === 'string' ? record.title : '',
    typeof record.data?.detail === 'string' ? record.data.detail : '',
    typeof record.data?.title === 'string' ? record.data.title : '',
  ].filter(Boolean).join(' | ') || fallback;
}

function normalizeRooms(rooms?: number | null) {
  if (!rooms || !Number.isFinite(rooms)) return null;
  const bounded = Math.max(1, Math.min(rooms, 10));
  return bounded >= 10 ? 'urn:concept:more' : `urn:concept:${bounded}`;
}

function normalizeFloorValue(rawFloor?: string | null) {
  const normalized = normalizeComparableText(rawFloor);

  if (!normalized) return null;
  if (normalized === 'parter') return 'urn:concept:ground-floor';
  if (normalized === 'demisol' || normalized === 'subsol') return 'urn:concept:cellar';
  if (normalized === 'mansarda') return 'urn:concept:garret';

  const numeric = Number(normalized.replace(/[^0-9-]/g, ''));
  if (!Number.isFinite(numeric)) return null;
  if (numeric <= 0) return 'urn:concept:ground-floor';
  if (numeric >= 11) return 'urn:concept:11th-floor-and-above';

  const suffixMap: Record<number, string> = {
    1: '1st-floor',
    2: '2nd-floor',
    3: '3rd-floor',
    4: '4th-floor',
    5: '5th-floor',
    6: '6th-floor',
    7: '7th-floor',
    8: '8th-floor',
    9: '9th-floor',
    10: '10th-floor',
  };

  return `urn:concept:${suffixMap[numeric] || '11th-floor-and-above'}`;
}

function mapApartmentHeatingValue(heatingSystem?: string | null) {
  const normalized = normalizeComparableText(heatingSystem);

  if (!normalized) return null;
  if (normalized.includes('termoficare')) return 'urn:concept:urban';
  if (normalized.includes('electr')) return 'urn:concept:electrical';
  if (normalized.includes('centrala') || normalized.includes('pardoseala') || normalized.includes('gaz')) {
    return 'urn:concept:gas';
  }
  if (normalized.includes('soba')) return 'urn:concept:tiled-stove';
  return 'urn:concept:other';
}

function mapPropertyStatusValue(property: Property) {
  const normalizedInterior = normalizeComparableText(property.interiorState);
  const normalizedBuilding = normalizeComparableText(property.buildingState);

  if (normalizedInterior.includes('renovat') || normalizedInterior.includes('buna') || normalizedInterior.includes('bun')) {
    return 'urn:concept:ready-to-use';
  }
  if (normalizedInterior.includes('nou')) {
    return 'urn:concept:ready-to-use';
  }
  if (normalizedBuilding.includes('necesita')) {
    return 'urn:concept:in-renovation';
  }
  if (normalizedBuilding.includes('noua') || normalizedBuilding.includes('reabilitata') || normalizedBuilding.includes('buna')) {
    return 'urn:concept:ready-to-use';
  }

  return null;
}

function mapPropertyToCategoryUrn(property: Property, profile?: StoriaPortalProfile | null) {
  if (profile?.categoryUrn) {
    return profile.categoryUrn;
  }

  const normalizedType = normalizeComparableText(property.propertyType);
  const normalizedTransactionType = normalizeComparableText(property.transactionType);

  if (normalizedType.includes('apartament') || normalizedType.includes('garsoniera')) {
    return normalizedTransactionType === 'inchiriere'
      ? 'urn:concept:apartments-for-rent'
      : 'urn:concept:apartments-for-sale';
  }
  if (normalizedType.includes('casa') || normalizedType.includes('vila')) {
    return normalizedTransactionType === 'inchiriere'
      ? 'urn:concept:houses-for-rent'
      : 'urn:concept:houses-for-sale';
  }
  if (normalizedType.includes('teren')) {
    return normalizedTransactionType === 'inchiriere'
      ? 'urn:concept:lots-for-rent'
      : 'urn:concept:lots-for-sale';
  }
  if (normalizedType.includes('spatiu') || normalizedType.includes('comercial')) {
    return normalizedTransactionType === 'inchiriere'
      ? 'urn:concept:stores-for-rent'
      : 'urn:concept:stores-for-sale';
  }

  throw new Error('Tipul proprietatii nu este mapat inca pentru Storia. Foloseste Apartament, Garsonieră, Casă/Vilă, Teren sau Spațiu Comercial.');
}

function buildAttributes(property: Property, categoryUrn: string) {
  const attributes: Array<{ urn: string; value: string }> = [];
  const add = (urn: string, value: string | number | boolean | null | undefined) => {
    if (value === undefined || value === null || value === '') return;
    attributes.push({ urn, value: String(value) });
  };
  const addMultiple = (urn: string, values: Array<string | null | undefined>) => {
    values
      .filter((value): value is string => typeof value === 'string' && Boolean(value))
      .forEach((value) => add(urn, value));
  };

  const roomUrn = normalizeRooms(property.rooms);
  const netArea = property.squareFootage ? Math.round(property.squareFootage) : null;
  const terrainArea = property.totalSurface ? Math.round(property.totalSurface) : null;
  const floorUrn = normalizeFloorValue(property.floor);
  const apartmentHeatingUrn = mapApartmentHeatingValue(property.heatingSystem);
  const statusUrn = mapPropertyStatusValue(property);
  const normalizedBalconyTerrace = normalizeComparableText(property.balconyTerrace);
  const normalizedLift = normalizeComparableText(property.lift);
  const normalizedKitchen = normalizeComparableText(property.kitchen);
  const normalizedParking = normalizeComparableText(property.parking);
  const normalizedHeatingSystem = normalizeComparableText(property.heatingSystem);

  if (categoryUrn.includes('apartments')) {
    add('urn:concept:number-of-rooms', roomUrn);
    add('urn:concept:net-area-m2', netArea);
    add('urn:concept:construction-year', property.constructionYear || null);
    add('urn:concept:floor', floorUrn);
    add('urn:concept:building-floors', property.totalFloors || null);
    add('urn:concept:heating', apartmentHeatingUrn);
    add('urn:concept:status', statusUrn);
    addMultiple('urn:concept:extras', [
      normalizedBalconyTerrace && normalizedBalconyTerrace !== 'fara'
        ? normalizedBalconyTerrace.includes('teras')
          ? 'urn:concept:terrace'
          : 'urn:concept:balcony'
        : null,
      normalizedLift === 'da' ? 'urn:concept:lift' : null,
      normalizedKitchen === 'inchisa' ? 'urn:concept:separate-kitchen' : null,
      normalizedParking && normalizedParking !== 'fara' ? 'urn:concept:garage' : null,
      normalizedHeatingSystem.includes('aer') ? 'urn:concept:air-conditioning' : null,
    ]);
  }

  if (categoryUrn.includes('houses')) {
    add('urn:concept:number-of-rooms', roomUrn);
    add('urn:concept:net-area-m2', netArea);
    add('urn:concept:terrain-area-m2', terrainArea || netArea);
    add('urn:concept:construction-year', property.constructionYear || null);
    add('urn:concept:status', statusUrn);
  }

  if (categoryUrn.includes('lots')) {
    add('urn:concept:terrain-area-m2', terrainArea || netArea);
  }

  if (categoryUrn.includes('stores')) {
    add('urn:concept:net-area-m2', netArea);
    add('urn:concept:construction-year', property.constructionYear || null);
    add('urn:concept:floor', floorUrn);
    add('urn:concept:status', statusUrn);
    addMultiple('urn:concept:extras', [
      normalizedLift === 'da' ? 'urn:concept:lift' : null,
      normalizedHeatingSystem.includes('aer') ? 'urn:concept:air-conditioning' : null,
      normalizedParking && normalizedParking !== 'fara' ? 'urn:concept:garage' : null,
    ]);
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
    attributes: buildAttributes(property, categoryUrn),
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
      extractApiErrorMessage(payload, 'Autentificarea Storia a esuat.')
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
      extractApiErrorMessage(payload, `Storia API a raspuns cu ${response.status}.`)
    ) as StoriaApiError;
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload as T;
}

async function storiaTaxonomyRequest<T>(path: string): Promise<T> {
  const { apiKey } = requireStoriaConfig();
  const response = await fetch(`${STORIA_API_BASE_URL}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'X-API-KEY': apiKey,
      'User-Agent': STORIA_USER_AGENT,
    },
    cache: 'no-store',
  });

  const payload = await safeJson(response);
  if (!response.ok) {
    const error = new Error(
      extractApiErrorMessage(payload, `Storia Taxonomy API a raspuns cu ${response.status}.`)
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
  const storiaProfilePatch = compactObject({
    remoteUuid,
    remoteUrl,
    ...(categoryUrn ? { categoryUrn } : {}),
    ...(market ? { market } : {}),
    lastValidationError: errorMessage || null,
    lastPublishedAt: !errorMessage && remoteUrl ? nowIso() : null,
    lastPayloadHash: payloadHash || null,
    lastTransactionId: transactionId || null,
  });

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
        storia: storiaProfilePatch,
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

function normalizePromotionSettings(settings?: StoriaPromotionSettings | null): StoriaPromotionSettings | null {
  if (!settings?.selections?.length) return null;

  const selections = settings.selections
    .map((selection) => ({
      promotionCode: (selection?.promotionCode || '').trim(),
      durationDays:
        typeof selection?.durationDays === 'number' && Number.isFinite(selection.durationDays)
          ? selection.durationDays
          : null,
    }))
    .filter((selection) => Boolean(selection.promotionCode));

  if (!selections.length) return null;
  return { selections };
}

function normalizePromotionRequests(requests?: StoriaPromotionRequest[] | null) {
  return (requests || []).filter((request) => Boolean(request?.transactionId && request?.promotionCode));
}

async function persistStoriaPromotionState(params: {
  agencyId: string;
  propertyId: string;
  promotionSettings?: StoriaPromotionSettings | null;
  promotionRequests?: StoriaPromotionRequest[] | null;
  activePromotions?: StoriaActivePromotion[] | null;
  lastPromotionError?: string | null;
}) {
  const { agencyId, propertyId, promotionSettings, promotionRequests, activePromotions, lastPromotionError } = params;
  await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).set(
    {
      portalProfiles: {
        storia: {
          ...(promotionSettings !== undefined ? { promotionSettings } : {}),
          ...(promotionRequests !== undefined ? { promotionRequests } : {}),
          ...(activePromotions !== undefined ? { activePromotions } : {}),
          ...(lastPromotionError !== undefined ? { lastPromotionError } : {}),
          lastPromotionSyncAt: nowIso(),
        },
      },
    },
    { merge: true }
  );
}

function mapPromotionOption(payload: NonNullable<StoriaPromotionsTaxonomyResponse['promotions']>[number]): StoriaPromotionOption {
  return {
    promotionCode: String(payload.promotion_code || ''),
    description: payload.promotion_description || null,
    durationDays: Array.isArray(payload.duration_days) ? payload.duration_days.filter((value) => Number.isFinite(value)) : [],
    accountType: Array.isArray(payload.account_type) ? payload.account_type.filter((value) => typeof value === 'string') : [],
  };
}

function mapActivePromotion(payload: NonNullable<NonNullable<StoriaActivePromotionsResponse['data']>['vas']>[number]): StoriaActivePromotion {
  const errorObject = payload.error && typeof payload.error === 'object' ? payload.error as { detail?: unknown; title?: unknown } : null;
  return {
    vasUuid: payload.uuid || null,
    promotionCode: String(payload.promotion_code || ''),
    durationDays: typeof payload.duration_days === 'number' ? payload.duration_days : null,
    status: String(payload.status || 'unknown'),
    createdAt: payload.created_at || null,
    updatedAt: payload.updated_at || null,
    errorMessage:
      typeof errorObject?.detail === 'string'
        ? errorObject.detail
        : typeof errorObject?.title === 'string'
          ? errorObject.title
          : null,
  };
}

function wrapVasScopeError(error: unknown, actionLabel: string) {
  const typed = error as StoriaApiError;
  if (typed?.status === 401 || typed?.status === 403) {
    const wrapped = new Error(
      `Aplicatia Storia nu are inca acces VAS (${actionLabel}). Cere activarea scope-urilor read:vas si write:vas, apoi reconecteaza integrarea Storia.`
    ) as StoriaApiError;
    wrapped.status = typed.status;
    wrapped.payload = typed.payload;
    return wrapped;
  }
  return error;
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

export async function getAvailableStoriaPromotions() {
  const payload = await storiaTaxonomyRequest<StoriaPromotionsTaxonomyResponse>(`/taxonomy/v1/promotions/${encodeURIComponent(STORIA_SITE_URN)}`);
  return (payload.promotions || [])
    .map(mapPromotionOption)
    .filter((item) => Boolean(item.promotionCode));
}

export async function getPropertyStoriaPromotions(params: { agencyId: string; propertyId: string }) {
  const { agencyId, propertyId } = params;
  const propertySnapshot = await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).get();
  if (!propertySnapshot.exists) {
    throw new Error('Proprietatea nu a fost gasita.');
  }

  const property = { id: propertySnapshot.id, ...propertySnapshot.data() } as Property;
  const availablePromotions = await getAvailableStoriaPromotions();
  const remoteUuid =
    property.portalProfiles?.storia?.remoteUuid ||
    (typeof property.promotions?.storia?.remoteId === 'string' ? property.promotions.storia.remoteId : null);

  let activePromotions = property.portalProfiles?.storia?.activePromotions || [];
  if (remoteUuid) {
    try {
      const payload = await storiaRequest<StoriaActivePromotionsResponse>(agencyId, `/vas/v1/advert/${encodeURIComponent(remoteUuid)}`, {
        method: 'GET',
      });
      activePromotions = (payload.data?.vas || []).map(mapActivePromotion).filter((item) => Boolean(item.promotionCode));
      await persistStoriaPromotionState({
        agencyId,
        propertyId,
        activePromotions,
        promotionRequests: normalizePromotionRequests(property.portalProfiles?.storia?.promotionRequests),
        promotionSettings: normalizePromotionSettings(property.portalProfiles?.storia?.promotionSettings),
        lastPromotionError: null,
      });
    } catch (error) {
      const typed = error as StoriaApiError;
      if (typed.status !== 403 && typed.status !== 401) {
        throw error;
      }
      activePromotions = property.portalProfiles?.storia?.activePromotions || [];
    }
  }

  return {
    availablePromotions,
    selectedPromotions: property.portalProfiles?.storia?.promotionSettings?.selections || [],
    activePromotions,
    promotionRequests: property.portalProfiles?.storia?.promotionRequests || [],
    remoteUuid,
  };
}

export async function updatePropertyStoriaPromotionSettings(params: {
  agencyId: string;
  propertyId: string;
  promotionSettings: StoriaPromotionSettings | null;
}) {
  const { agencyId, propertyId, promotionSettings } = params;
  const propertyRef = adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId);
  const propertySnapshot = await propertyRef.get();
  if (!propertySnapshot.exists) {
    throw new Error('Proprietatea nu a fost gasita.');
  }

  const property = { id: propertySnapshot.id, ...propertySnapshot.data() } as Property;
  const normalizedSettings = normalizePromotionSettings(promotionSettings);

  await persistStoriaPromotionState({
    agencyId,
    propertyId,
    promotionSettings: normalizedSettings,
    promotionRequests: normalizePromotionRequests(property.portalProfiles?.storia?.promotionRequests),
    activePromotions: property.portalProfiles?.storia?.activePromotions || [],
    lastPromotionError: null,
  });

  const currentStatus = property.promotions?.storia?.status;
  if (currentStatus !== 'published' || !normalizedSettings?.selections?.length) {
    return {
      promotionSettings: normalizedSettings,
      appliedRemotely: false,
      message: currentStatus === 'published'
        ? 'Nu exista promovari selectate pentru a fi aplicate.'
        : 'Setarile au fost salvate pentru momentul in care anuntul este publicat.',
    };
  }

  const result = await applyStoriaPromotions({
    agencyId,
    propertyId,
    promotionSettings: normalizedSettings,
  });

  return {
    promotionSettings: normalizedSettings,
    appliedRemotely: true,
    ...result,
  };
}

export async function applyStoriaPromotions(params: {
  agencyId: string;
  propertyId: string;
  promotionSettings?: StoriaPromotionSettings | null;
}) {
  const { agencyId, propertyId } = params;
  const propertyRef = adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId);
  const propertySnapshot = await propertyRef.get();
  if (!propertySnapshot.exists) {
    throw new Error('Proprietatea nu a fost gasita.');
  }

  const property = { id: propertySnapshot.id, ...propertySnapshot.data() } as Property;
  const remoteUuid =
    property.portalProfiles?.storia?.remoteUuid ||
    (typeof property.promotions?.storia?.remoteId === 'string' ? property.promotions.storia.remoteId : null);

  if (!remoteUuid) {
    throw new Error('Anuntul Storia trebuie publicat inainte sa poti aplica promovari.');
  }

  const normalizedSettings = normalizePromotionSettings(params.promotionSettings ?? property.portalProfiles?.storia?.promotionSettings);
  if (!normalizedSettings?.selections?.length) {
    throw new Error('Selecteaza cel putin o promovare pentru Storia.');
  }

  const currentRequests = normalizePromotionRequests(property.portalProfiles?.storia?.promotionRequests);
  const nextRequests = [...currentRequests];

  for (const selection of normalizedSettings.selections) {
    const body = {
      promotion_code: selection.promotionCode,
      ...(selection.durationDays ? { duration_days: selection.durationDays } : {}),
    };

    const payload = await storiaRequest<StoriaApplyPromotionResponse>(agencyId, `/vas/v1/advert/${encodeURIComponent(remoteUuid)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }).catch((error) => {
      throw wrapVasScopeError(error, 'aplicare promovari');
    });

    const transactionId = payload.transaction_id || '';
    nextRequests.unshift({
      transactionId,
      promotionCode: selection.promotionCode,
      durationDays: selection.durationDays ?? null,
      vasUuid: payload.data?.vas_uuid || null,
      status: payload.data?.status === 'applied' ? 'applied' : 'requested',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      errorMessage: null,
    });
  }

  const dedupedRequests = nextRequests
    .filter((request) => Boolean(request.transactionId))
    .slice(0, 20);

  await persistStoriaPromotionState({
    agencyId,
    propertyId,
    promotionSettings: normalizedSettings,
    promotionRequests: dedupedRequests,
    activePromotions: property.portalProfiles?.storia?.activePromotions || [],
    lastPromotionError: null,
  });

  return {
    requested: normalizedSettings.selections.length,
    promotionRequests: dedupedRequests,
  };
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
  const existingRemoteUuid =
    property.portalProfiles?.storia?.remoteUuid ||
    (typeof property.promotions?.storia?.remoteId === 'string' ? property.promotions.storia.remoteId : null);
  const requestPath = existingRemoteUuid ? `/advert/v1/${encodeURIComponent(existingRemoteUuid)}` : '/advert/v1';
  const requestMethod = existingRemoteUuid ? 'PUT' : 'POST';
  const currentMetadata = existingRemoteUuid
    ? await storiaRequest<AdvertMetadataResponse>(agencyId, `/advert/v1/${encodeURIComponent(existingRemoteUuid)}/meta`, {
        method: 'GET',
      }).catch(() => null)
    : null;
  const currentMetadataState = getAdvertMetadataState(currentMetadata);

  await persistPublishAudit({
    agencyId,
    propertyId,
    entry: { attemptedAt: nowIso(), stage: 'attempt' },
  });

  try {
    const publishResponse = await storiaRequest<PublishResponse>(agencyId, requestPath, {
      method: requestMethod,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const remoteUuid = publishResponse.data?.uuid || existingRemoteUuid || null;
    if (!remoteUuid) {
      throw new Error('Storia nu a returnat UUID-ul anuntului.');
    }

    let metadata = await storiaRequest<AdvertMetadataResponse>(agencyId, `/advert/v1/${encodeURIComponent(remoteUuid)}/meta`, {
      method: 'GET',
    }).catch(() => null);

    let metadataState = getAdvertMetadataState(metadata);
    const shouldActivateAfterPublish =
      Boolean(existingRemoteUuid) &&
      ['removed_by_user', 'outdated'].includes((currentMetadataState.code || '').toLowerCase()) &&
      currentMetadataState.visibleInProfile !== false;

    if (shouldActivateAfterPublish) {
      await storiaRequest(agencyId, `/advert/v1/${encodeURIComponent(remoteUuid)}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      metadata = await waitForAdvertMetadataState({
        agencyId,
        remoteUuid,
        targetCodes: ['active'],
      }).catch(() => metadata);
      metadataState = getAdvertMetadataState(metadata);
    }

    const remoteCode = metadataState.code || publishResponse.data?.last_action_status || 'new';
    const remoteUrl = metadataState.url || null;

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
      entry: {
        attemptedAt: nowIso(),
        stage: shouldActivateAfterPublish ? 'reactivated' : requestMethod === 'PUT' ? 'updated' : 'success',
        responseStatus: requestMethod === 'PUT' ? 200 : 201,
      },
    });

    const savedPromotionSettings = normalizePromotionSettings(property.portalProfiles?.storia?.promotionSettings);
    if (savedPromotionSettings?.selections?.length) {
      try {
        await applyStoriaPromotions({
          agencyId,
          propertyId,
          promotionSettings: savedPromotionSettings,
        });
      } catch (promotionError) {
        await persistStoriaPromotionState({
          agencyId,
          propertyId,
          promotionSettings: savedPromotionSettings,
          promotionRequests: normalizePromotionRequests(property.portalProfiles?.storia?.promotionRequests),
          activePromotions: property.portalProfiles?.storia?.activePromotions || [],
          lastPromotionError: promotionError instanceof Error ? promotionError.message : 'Promovarea Storia nu a putut fi aplicata automat.',
        });
      }
    }

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
  }).catch(() => null);
  const metadataState = getAdvertMetadataState(metadata);
  const remoteUrl = normalizeStoriaPublicUrl(
    metadataState.url ||
      property.portalProfiles?.storia?.remoteUrl ||
      property.promotions?.storia?.link ||
      null,
    property.title
  );

  if (metadataState.url) {
    await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).set(
      {
        promotions: {
          storia: {
            link: normalizeStoriaPublicUrl(metadataState.url, property.title),
          },
        },
        portalProfiles: {
          storia: {
            remoteUrl: normalizeStoriaPublicUrl(metadataState.url, property.title),
          },
        },
      },
      { merge: true }
    );
  }

  if (!remoteUrl) {
    throw new Error('Anuntul este publicat, dar Storia nu a returnat inca URL-ul public al anuntului. Reincearca dupa sincronizarea webhook-ului.');
  }

  return {
    url: remoteUrl,
    remoteUuid,
  };
}

export async function refreshPropertyStoriaPublicUrl(params: { agencyId: string; propertyId: string }) {
  const { agencyId, propertyId } = params;
  const propertyRef = adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId);
  const propertySnapshot = await propertyRef.get();
  if (!propertySnapshot.exists) {
    throw new Error('Proprietatea nu a fost gasita.');
  }

  const property = { id: propertySnapshot.id, ...propertySnapshot.data() } as Property;
  const remoteUuid =
    property.portalProfiles?.storia?.remoteUuid ||
    (typeof property.promotions?.storia?.remoteId === 'string' ? property.promotions.storia.remoteId : null);

  if (!remoteUuid) {
    throw new Error('Nu exista UUID remote salvat pentru acest anunt Storia.');
  }

  const metadata = await storiaRequest<AdvertMetadataResponse>(agencyId, `/advert/v1/${encodeURIComponent(remoteUuid)}/meta`, {
    method: 'GET',
  });

  const metadataState = getAdvertMetadataState(metadata);
  const remoteUrl = normalizeStoriaPublicUrl(metadataState.url || null, property.title);
  const remoteCode = metadataState.code || null;

  await propertyRef.set(
    {
      promotions: {
        storia: {
          link: remoteUrl,
          remoteId: remoteUuid,
          remoteState: remoteCode,
          status: remoteCode ? mapRemoteCodeToPromotionStatus(remoteCode) : property.promotions?.storia?.status || 'pending',
          lastSync: nowIso(),
        },
      },
      portalProfiles: {
        storia: {
          remoteUuid,
          remoteUrl,
          lastPublishedAt: remoteUrl ? nowIso() : property.portalProfiles?.storia?.lastPublishedAt || null,
          lastValidationError: remoteUrl ? null : property.portalProfiles?.storia?.lastValidationError || null,
        },
      },
    },
    { merge: true }
  );

  return {
    remoteUuid,
    remoteCode,
    remoteUrl,
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

  const errorMessage =
    notification.error_message ||
    notification.data?.detail ||
    (notification.data?.validation || []).map((item) => item.detail).filter(Boolean).join(' | ') ||
    null;

  if ((notification.flow || '').toLowerCase().includes('vas')) {
    const batch = adminDb.batch();
    snapshot.docs.forEach((docSnapshot) => {
      const property = { id: docSnapshot.id, ...docSnapshot.data() } as Property;
      const currentRequests = normalizePromotionRequests(property.portalProfiles?.storia?.promotionRequests);
      const currentPromotions = property.portalProfiles?.storia?.activePromotions || [];
      const matchedRequest = currentRequests.find((request) => request.transactionId === transactionId);
      const nextRequests = currentRequests.map((request) =>
        request.transactionId === transactionId
          ? {
              ...request,
              vasUuid: request.vasUuid || null,
              status: errorMessage ? 'error' : 'applied',
              updatedAt: nowIso(),
              errorMessage,
            }
          : request
      );

      const promotionCode = matchedRequest?.promotionCode || '';
      const durationDays = matchedRequest?.durationDays ?? null;
      const existingPromotionIndex = currentPromotions.findIndex((promotion) =>
        matchedRequest?.vasUuid ? promotion.vasUuid === matchedRequest.vasUuid : promotion.promotionCode === promotionCode
      );
      const nextPromotion: StoriaActivePromotion = {
        vasUuid: matchedRequest?.vasUuid || null,
        promotionCode,
        durationDays,
        status: errorMessage ? 'error' : String(notification.event_type || 'applied'),
        createdAt: matchedRequest?.createdAt || nowIso(),
        updatedAt: nowIso(),
        errorMessage,
      };
      const nextPromotions =
        existingPromotionIndex >= 0
          ? currentPromotions.map((promotion, index) => (index === existingPromotionIndex ? nextPromotion : promotion))
          : promotionCode
            ? [nextPromotion, ...currentPromotions].slice(0, 20)
            : currentPromotions;

      batch.set(
        docSnapshot.ref,
        {
          portalProfiles: {
            storia: {
              promotionRequests: nextRequests,
              activePromotions: nextPromotions,
              lastPromotionError: errorMessage,
              lastPromotionSyncAt: nowIso(),
            },
          },
        },
        { merge: true }
      );
    });
    await batch.commit();
    return { matched: snapshot.size };
  }

  const remoteCode = notification.data?.code || null;
  const rawRemoteUrl = notification.data?.url || null;

  const batch = adminDb.batch();
  snapshot.docs.forEach((docSnapshot) => {
    const property = { id: docSnapshot.id, ...docSnapshot.data() } as Property;
    const remoteUrl = normalizeStoriaPublicUrl(rawRemoteUrl, property.title);
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
