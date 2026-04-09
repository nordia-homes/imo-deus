import { createHash } from 'crypto';
import { adminDb } from '@/firebase/admin';
import type {
  ImobiliareIntegrationPrivate,
  ImobiliarePortalProfile,
  PortalIntegrationPublicStatus,
  Property,
  UserProfile,
} from '@/lib/types';

const IMOBILIARE_BASE_URL = (process.env.IMOBILIARE_API_BASE_URL || 'https://www.imobiliare.ro').replace(/\/+$/, '');
const IMOBILIARE_PROVIDER = 'imobiliare';
const PRIVATE_COLLECTION = 'agencyPrivateIntegrations';

type ImobiliareApiErrorPayload = {
  message?: string;
  error?: string;
  error_description?: string;
  errors?: Record<string, string[]>;
};

type ImobiliareApiError = Error & {
  status?: number;
  payload?: ImobiliareApiErrorPayload | string | null;
};

type RemoteAgent = {
  id: number;
  email?: string | null;
  name?: string | null;
  mobile_number?: string | null;
  phones?: Array<{ value?: string; type?: string }>;
};

type CategoryOption = {
  id: number;
  name: string;
  offerType?: string | null;
  parentName?: string | null;
  selectable?: boolean;
};

type LocationOption = {
  id: number;
  title?: string;
  slug?: string;
  depth?: number;
  parent_id?: number | null;
  parent?: LocationOption | null;
  custom_display?: string;
};

type ParsedLocationCandidate = {
  raw: string;
  normalized: string;
};

type ConnectResult = {
  connected: true;
  username: string;
  remoteAgentCount: number;
  remoteAccountName: string | null;
};

type PublishResult = {
  customReference: string;
  remoteId?: number;
  path?: string | null;
  state?: string | null;
  title?: string | null;
};

function getPrivateDocId(agencyId: string) {
  return `${agencyId}__${IMOBILIARE_PROVIDER}`;
}

function getPrivateDocRef(agencyId: string) {
  return adminDb.collection(PRIVATE_COLLECTION).doc(getPrivateDocId(agencyId));
}

function getPublicDocRef(agencyId: string) {
  return adminDb.collection('agencies').doc(agencyId).collection('integrations').doc(IMOBILIARE_PROVIDER);
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase()
    .trim();
}

function compactObject<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === undefined || entry === null || entry === '') {
        return false;
      }
      if (Array.isArray(entry)) {
        return entry.length > 0;
      }
      return true;
    })
  ) as Partial<T>;
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

function parseStreet(address?: string | null) {
  const cleaned = (address || '').trim();
  if (!cleaned) {
    return { streetName: undefined, streetNumber: undefined };
  }

  const match = cleaned.match(/^(.*?)(?:\s+nr\.?\s*|\s+numarul\s+|\s+)(\d+[A-Za-z\-\/]*)$/i);
  if (!match) {
    return { streetName: cleaned, streetNumber: undefined };
  }

  return {
    streetName: match[1]?.trim() || cleaned,
    streetNumber: match[2]?.trim(),
  };
}

function extractMessage(payload: ImobiliareApiErrorPayload | string | null | undefined, fallback: string) {
  if (!payload) return fallback;
  if (typeof payload === 'string') return payload || fallback;
  if (typeof payload.error_description === 'string' && payload.error_description) return payload.error_description;
  if (typeof payload.message === 'string' && payload.message) return payload.message;
  if (typeof payload.error === 'string' && payload.error) return payload.error;
  if (payload.errors && typeof payload.errors === 'object') {
    const firstMessage = Object.values(payload.errors).flat()[0];
    if (typeof firstMessage === 'string' && firstMessage) {
      return firstMessage;
    }
  }
  return fallback;
}

async function safeJson(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

async function requestAccessToken(body: URLSearchParams) {
  const response = await fetch(`${IMOBILIARE_BASE_URL}/api/v1/auth/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
    cache: 'no-store',
  });

  const payload = await safeJson(response);
  if (!response.ok) {
    const error = new Error(extractMessage(payload as ImobiliareApiErrorPayload | string | null, 'Autentificarea la imobiliare.ro a esuat.')) as ImobiliareApiError;
    error.status = response.status;
    error.payload = payload as ImobiliareApiErrorPayload | string | null;
    throw error;
  }

  return payload as {
    access_token: string;
    refresh_token?: string | null;
    expires_in?: number;
    user?: { name?: string | null };
  };
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

async function getPrivateIntegration(agencyId: string) {
  const snapshot = await getPrivateDocRef(agencyId).get();
  if (!snapshot.exists) {
    return null;
  }
  return snapshot.data() as ImobiliareIntegrationPrivate;
}

async function persistPrivateIntegration(agencyId: string, payload: ImobiliareIntegrationPrivate) {
  await getPrivateDocRef(agencyId).set(payload, { merge: true });
}

async function refreshAccessToken(agencyId: string, integration: ImobiliareIntegrationPrivate) {
  if (!integration.refreshToken) {
    throw new Error('Conexiunea imobiliare.ro nu mai are refresh token. Reconecteaza contul.');
  }

  const tokenPayload = await requestAccessToken(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: integration.refreshToken,
    })
  );

  const expiresAt = tokenPayload.expires_in
    ? new Date(Date.now() + tokenPayload.expires_in * 1000).toISOString()
    : null;

  const updated: ImobiliareIntegrationPrivate = {
    ...integration,
    accessToken: tokenPayload.access_token,
    refreshToken: tokenPayload.refresh_token || integration.refreshToken,
    accessTokenExpiresAt: expiresAt,
    updatedAt: nowIso(),
  };

  await persistPrivateIntegration(agencyId, updated);
  await setPublicStatus(agencyId, {
    connected: true,
    username: integration.username,
    lastTokenRefreshAt: nowIso(),
    lastError: null,
    remoteAgentCount: integration.remoteAgentCount,
    remoteAccountName: integration.remoteAccountName || null,
  });

  return updated;
}

async function ensureValidIntegration(agencyId: string) {
  const integration = await getPrivateIntegration(agencyId);
  if (!integration) {
    throw new Error('Contul imobiliare.ro nu este conectat pentru aceasta agentie.');
  }

  if (!integration.accessTokenExpiresAt) {
    return integration;
  }

  const expiresAt = new Date(integration.accessTokenExpiresAt).getTime();
  const shouldRefresh = Number.isFinite(expiresAt) && expiresAt <= Date.now() + 2 * 60 * 1000;
  if (!shouldRefresh) {
    return integration;
  }

  return refreshAccessToken(agencyId, integration);
}

async function imobiliareRequest<T>(agencyId: string, path: string, init?: RequestInit, retry = true): Promise<T> {
  const integration = await ensureValidIntegration(agencyId);
  const response = await fetch(`${IMOBILIARE_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${integration.accessToken}`,
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  if (response.status === 401 && retry) {
    await refreshAccessToken(agencyId, integration);
    return imobiliareRequest<T>(agencyId, path, init, false);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const payload = await safeJson(response);
  if (!response.ok) {
    const error = new Error(extractMessage(payload as ImobiliareApiErrorPayload | string | null, `Imobiliare API a raspuns cu ${response.status}.`)) as ImobiliareApiError;
    error.status = response.status;
    error.payload = payload as ImobiliareApiErrorPayload | string | null;
    throw error;
  }

  return payload as T;
}

function extractAgents(payload: unknown): RemoteAgent[] {
  const root = payload as { data?: unknown };
  if (Array.isArray(root?.data)) {
    return root.data as RemoteAgent[];
  }
  return [];
}

function extractCategories(payload: unknown): CategoryOption[] {
  const seen = new Map<number, CategoryOption>();

  const visit = (node: unknown, parentName?: string | null) => {
    if (!node || typeof node !== 'object') {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((entry) => visit(entry, parentName));
      return;
    }

    const record = node as Record<string, unknown>;
    const idCandidate =
      typeof record.id === 'number'
        ? record.id
        : typeof record.category_api === 'number'
          ? record.category_api
          : typeof record.category_id === 'number'
            ? record.category_id
            : null;

    const ownName =
      typeof record.name === 'string'
        ? record.name
        : typeof record.title === 'string'
          ? record.title
          : typeof record.translatable_title === 'string'
            ? record.translatable_title
            : null;

    if (idCandidate && ownName) {
      if (!seen.has(idCandidate)) {
        const offerType = typeof record.offer_type === 'string' ? record.offer_type : null;
        seen.set(idCandidate, {
          id: idCandidate,
          name: ownName,
          offerType,
          parentName: parentName || null,
          selectable: Boolean(
            offerType ||
            typeof record.sub_category_tag === 'string' ||
            typeof record.category_api === 'number' ||
            idCandidate >= 100
          ),
        });
      }
    }

    const nextParentName = ownName || parentName || null;
    for (const value of Object.values(record)) {
      visit(value, nextParentName);
    }
  };

  visit(payload);
  const root = payload as { data?: unknown };
  if (root?.data) {
    visit(root.data);
  }

  return Array.from(seen.values());
}

function extractLocations(payload: unknown): LocationOption[] {
  const root = payload as { data?: unknown };
  if (Array.isArray(root?.data)) {
    return root.data as LocationOption[];
  }
  if (Array.isArray(payload)) {
    return payload as LocationOption[];
  }
  return [];
}

function collectLocationAncestors(location?: LocationOption | null): LocationOption[] {
  const result: LocationOption[] = [];
  const seen = new Set<number>();
  let current = location?.parent || null;

  while (current && typeof current.id === 'number' && !seen.has(current.id)) {
    seen.add(current.id);
    result.push(current);
    current = current.parent || null;
  }

  return result;
}

function tokenizeLocationText(value?: string | null): ParsedLocationCandidate[] {
  return (value || '')
    .split(/[,/|-]/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((raw) => ({ raw, normalized: normalizeText(raw) }))
    .filter((item) => item.normalized.length >= 2);
}

function buildLocationSearchTerms(property: Property) {
  const values = [
    property.city,
    property.zone,
    property.location,
    property.address,
  ].filter(Boolean) as string[];

  const tokens = values.flatMap((value) => tokenizeLocationText(value));
  const unique = new Map<string, ParsedLocationCandidate>();
  for (const token of tokens) {
    if (!unique.has(token.normalized)) {
      unique.set(token.normalized, token);
    }
  }

  return Array.from(unique.values());
}

function getLocationHaystack(location: LocationOption) {
  const ancestors = collectLocationAncestors(location);
  return [
    location.title,
    location.custom_display,
    location.slug,
    ...ancestors.flatMap((item) => [item.title, item.custom_display, item.slug]),
  ]
    .filter(Boolean)
    .map((item) => normalizeText(item))
    .join(' ');
}

function pickCategoryName(propertyType?: string | null, transactionType?: string | null) {
  const normalizedType = normalizeText(propertyType);
  const normalizedTransaction = normalizeText(transactionType);
  const isRent = normalizedTransaction.includes('inchiri');

  if (normalizedType.includes('garsoniera')) {
    return isRent ? 'Garsoniera de inchiriat' : 'Garsoniera de vanzare';
  }
  if (normalizedType.includes('apartament')) {
    return isRent ? 'Apartament de inchiriat' : 'Apartament de vanzare';
  }
  if (normalizedType.includes('casa') || normalizedType.includes('vila')) {
    return isRent ? 'Casa/Vila de inchiriat' : 'Casa/Vila de vanzare';
  }
  if (normalizedType.includes('teren')) {
    return isRent ? 'Teren de inchiriat' : 'Teren de vanzare';
  }
  if (normalizedType.includes('spatiu') || normalizedType.includes('comercial')) {
    return isRent ? 'Spatii comerciale de inchiriat' : 'Spatii comerciale de vanzare';
  }
  return null;
}

function getCategorySearchTerms(property: Property) {
  const type = normalizeText(property.propertyType);
  const isRent = normalizeText(property.transactionType).includes('inchiri');

  if (type.includes('garsoniera')) {
    return {
      primary: ['garsoniera'],
      secondary: isRent ? ['inchiri'] : ['vanz', 'sell'],
      excluded: [],
    };
  }
  if (type.includes('apartament')) {
    return {
      primary: ['apartament'],
      secondary: isRent ? ['inchiri'] : ['vanz', 'sell'],
      excluded: ['garsoniera'],
    };
  }
  if (type.includes('casa') || type.includes('vila')) {
    return {
      primary: ['casa', 'vila'],
      secondary: isRent ? ['inchiri'] : ['vanz', 'sell'],
      excluded: [],
    };
  }
  if (type.includes('teren')) {
    return {
      primary: ['teren'],
      secondary: isRent ? ['inchiri'] : ['vanz', 'sell'],
      excluded: [],
    };
  }
  if (type.includes('spatiu') || type.includes('comercial')) {
    return {
      primary: ['comercial', 'spatiu'],
      secondary: isRent ? ['inchiri'] : ['vanz', 'sell'],
      excluded: [],
    };
  }

  return {
    primary: [type].filter(Boolean),
    secondary: isRent ? ['inchiri'] : ['vanz', 'sell'],
    excluded: [],
  };
}

async function resolveCategoryApi(agencyId: string, property: Property, portalProfile?: ImobiliarePortalProfile) {
  if (typeof portalProfile?.categoryApi === 'number') {
    return portalProfile.categoryApi;
  }

  const payload = await imobiliareRequest<unknown>(agencyId, '/api/v3/categories');
  const categories = extractCategories(payload);
  const selectableCategories = categories.filter((item) => item.selectable);
  if (!categories.length) {
    throw new Error('Imobiliare.ro nu a returnat categorii utilizabile. Incearca din nou sau configureaza manual categoryApi.');
  }
  const candidatePool = selectableCategories.length ? selectableCategories : categories;

  const desiredName = pickCategoryName(property.propertyType, property.transactionType);
  const normalizedDesiredName = normalizeText(desiredName);
  const normalizedOfferType = normalizeText(property.transactionType).includes('inchiri') ? 'rent' : 'sell';

  const direct = candidatePool.find((item) => {
    const sameName = normalizeText(item.name) === normalizedDesiredName;
    const sameOffer = !item.offerType || normalizeText(item.offerType) === normalizedOfferType;
    return sameName && sameOffer;
  });

  if (direct) {
    return direct.id;
  }

  const terms = getCategorySearchTerms(property);
  const scored = candidatePool
    .map((item) => {
      const sameOffer = !item.offerType || normalizeText(item.offerType) === normalizedOfferType;
      const haystack = `${normalizeText(item.name)} ${normalizeText(item.parentName)}`.trim();
      const hasExcluded = terms.excluded.some((term) => haystack.includes(term));
      const primaryHits = terms.primary.filter((term) => haystack.includes(term)).length;
      const secondaryHits = terms.secondary.filter((term) => haystack.includes(term)).length;
      const score =
        (sameOffer ? 100 : 0) +
        primaryHits * 20 +
        secondaryHits * 5 -
        (hasExcluded ? 30 : 0) +
        (item.selectable ? 25 : 0);

      return { item, score, primaryHits };
    })
    .filter((entry) => entry.primaryHits > 0)
    .sort((left, right) => right.score - left.score);

  if (scored[0]?.item) {
    return scored[0].item.id;
  }

  throw new Error('Nu am putut determina categoria imobiliare.ro pentru aceasta proprietate. Configureaza manual categoryApi.');
}

async function resolveLocationId(agencyId: string, property: Property, portalProfile?: ImobiliarePortalProfile) {
  if (typeof portalProfile?.locationId === 'number') {
    return portalProfile.locationId;
  }

  const payload = await imobiliareRequest<unknown>(agencyId, '/api/v3/locations');
  const locations = extractLocations(payload).filter((item) => item && typeof item.id === 'number');
  if (!locations.length) {
    throw new Error('Imobiliare.ro nu a returnat locatii utilizabile. Incearca din nou sau configureaza manual locationId.');
  }

  const searchTerms = buildLocationSearchTerms(property);
  const normalizedCity = normalizeText(property.city);
  const normalizedZone = normalizeText(property.zone);

  const scored = locations
    .map((location) => {
      const haystack = getLocationHaystack(location);
      const title = normalizeText(location.title);
      const customDisplay = normalizeText(location.custom_display);
      const directZoneMatch = normalizedZone && (title === normalizedZone || customDisplay.includes(normalizedZone));
      const directCityMatch = normalizedCity && haystack.includes(normalizedCity);
      const tokenHits = searchTerms.reduce((sum, token) => sum + (haystack.includes(token.normalized) ? 1 : 0), 0);
      const depthScore = location.depth === 3 ? 30 : location.depth === 2 ? 10 : 0;
      const score =
        (directZoneMatch ? 80 : 0) +
        (directCityMatch ? 25 : 0) +
        tokenHits * 12 +
        depthScore;

      return { location, score, directZoneMatch, directCityMatch, tokenHits };
    })
    .filter((entry) => entry.tokenHits > 0 || entry.directZoneMatch || entry.directCityMatch)
    .sort((left, right) => right.score - left.score);

  const preferred =
    scored.find((entry) => entry.location.depth === 3 && (entry.directZoneMatch || entry.tokenHits >= 2)) ||
    scored.find((entry) => entry.location.depth === 3 && entry.directCityMatch) ||
    scored[0];

  if (preferred?.location?.id) {
    return preferred.location.id;
  }

  throw new Error('Nu am putut determina location_id pentru proprietate. Completeaza orasul/zona sau configureaza manual locationId.');
}

function pickLocalAgentProfile(profiles: Array<UserProfile | null | undefined>) {
  return profiles.find((profile) => profile?.email) || profiles.find(Boolean) || null;
}

async function loadUserProfile(userId?: string | null) {
  if (!userId) return null;
  const snapshot = await adminDb.collection('users').doc(userId).get();
  if (!snapshot.exists) {
    return null;
  }
  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as UserProfile;
}

function extractPhone(profile?: UserProfile | null, property?: Property | null) {
  return profile?.phone || property?.ownerPhone || '';
}

async function ensureRemoteAgentId(params: {
  agencyId: string;
  property: Property;
  portalProfile?: ImobiliarePortalProfile;
  requestedByUid: string;
}) {
  const { agencyId, property, portalProfile, requestedByUid } = params;
  if (typeof portalProfile?.remoteAgentId === 'number') {
    return portalProfile.remoteAgentId;
  }

  const assignedAgentProfile = await loadUserProfile(property.agentId);
  const fallbackProfile = await loadUserProfile(requestedByUid);
  const selectedProfile = pickLocalAgentProfile([assignedAgentProfile, fallbackProfile]);

  if (!selectedProfile?.email) {
    throw new Error('Agentul local nu are email. Este necesar pentru maparea unui agent in imobiliare.ro.');
  }

  const agentsPayload = await imobiliareRequest<unknown>(agencyId, '/api/v3/agents?page=1');
  const remoteAgents = extractAgents(agentsPayload);
  const normalizedEmail = normalizeText(selectedProfile.email);
  const existing = remoteAgents.find((agent) => normalizeText(agent.email) === normalizedEmail);
  if (existing?.id) {
    return existing.id;
  }

  const normalizedName = normalizeText(selectedProfile.name || property.agentName || '');
  const byName = remoteAgents.find((agent) => normalizedName && normalizeText(agent.name) === normalizedName);
  if (byName?.id) {
    return byName.id;
  }

  const phone = extractPhone(selectedProfile, property);
  try {
    const created = await imobiliareRequest<RemoteAgent>(agencyId, '/api/v3/agents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: selectedProfile.email,
        name: selectedProfile.name || property.agentName || 'Agent ImoDeus',
        phones: phone
          ? [{ value: phone, type: 'phone_number' }]
          : [{ value: '+40000000000', type: 'phone_number' }],
        list_on_portal: true,
        job_title: 'Agent',
        contact_email: selectedProfile.email,
        access_crm: false,
        agent_is_admin: false,
      }),
    });

    if (created?.id) {
      return created.id;
    }
  } catch (error) {
    const fallbackRemoteAgent = remoteAgents.find((agent) => typeof agent.id === 'number');
    if (fallbackRemoteAgent?.id) {
      return fallbackRemoteAgent.id;
    }
    throw error;
  }

  const fallbackRemoteAgent = remoteAgents.find((agent) => typeof agent.id === 'number');
  if (fallbackRemoteAgent?.id) {
    return fallbackRemoteAgent.id;
  }

  throw new Error('Nu am putut crea sau selecta un agent remote din contul imobiliare.ro. Configureaza manual remoteAgentId.');
}

function buildBaseDataProperties(property: Property, portalProfile?: ImobiliarePortalProfile) {
  const overrides = (portalProfile?.dataPropertiesOverrides || {}) as Record<string, unknown>;
  const base = compactObject({
    bedroom_count: property.rooms ? String(property.rooms) : undefined,
    bathroom_count: typeof property.bathrooms === 'number' ? String(property.bathrooms) : undefined,
    usable_surface: property.squareFootage ? String(property.squareFootage) : undefined,
    built_area: property.totalSurface ? String(property.totalSurface) : undefined,
    total_usable_surface: property.squareFootage ? String(property.squareFootage) : undefined,
    year_built: property.constructionYear ? String(property.constructionYear) : undefined,
    floor_number: property.floor ? String(property.floor).replace(/[^\d\-]/g, '') || String(property.floor) : undefined,
    number_of_floors: property.totalFloors ? String(property.totalFloors) : undefined,
    comfort: property.comfort && ['1', '2', '3', 'lux'].includes(normalizeText(property.comfort)) ? property.comfort : undefined,
    compartmentalization_type: property.partitioning
      ? normalizeText(property.partitioning).includes('semi')
        ? 'semi-detached'
        : normalizeText(property.partitioning).includes('decomandat')
          ? 'detached'
          : undefined
      : undefined,
    collaboration: typeof property.commissionValue === 'number' && property.commissionValue > 0 ? true : undefined,
    collaboration_commission_percentage:
      property.commissionType === 'percentage' && typeof property.commissionValue === 'number'
        ? property.commissionValue
        : undefined,
    collaboration_commission_value:
      property.commissionType === 'fixed' && typeof property.commissionValue === 'number'
        ? property.commissionValue
        : undefined,
    other_private_details: property.notes || undefined,
    other_price_details: typeof property.commissionValue === 'number'
      ? property.commissionType === 'percentage'
        ? `Comision ${property.commissionValue}%`
        : `Comision ${property.commissionValue}`
      : undefined,
  });

  return {
    ...base,
    ...overrides,
  };
}

function buildListingPayload(params: {
  property: Property;
  portalProfile?: ImobiliarePortalProfile;
  remoteAgentId: number;
  categoryApi: number;
  locationId: number;
}) {
  const { property, portalProfile, remoteAgentId, categoryApi, locationId } = params;
  const parsedStreet = parseStreet(property.address);
  const title = (portalProfile?.titleOverride || property.title || '').trim().slice(0, 80);
  const description = (portalProfile?.descriptionOverride || property.description || '').trim();
  const priceCurrency = portalProfile?.priceCurrency || 'EUR';
  const transactionType = normalizeText(property.transactionType).includes('inchiri') ? 'rent' : 'sell';

  if (!title) {
    throw new Error('Proprietatea nu are titlu pentru publicare.');
  }

  if (!description || description.length < 80) {
    throw new Error('Descrierea proprietatii trebuie sa aiba minimum 80 de caractere pentru publicare pe imobiliare.ro.');
  }

  if (!property.price || property.price <= 0) {
    throw new Error('Pretul proprietatii trebuie sa fie mai mare ca 0 pentru publicare.');
  }

  const payload = compactObject({
    custom_reference: portalProfile?.customReference || property.id,
    agents: [remoteAgentId],
    category_api: categoryApi,
    offer_type: transactionType,
    data_properties: buildBaseDataProperties(property, portalProfile),
    description,
    location_id: locationId,
    latitude: typeof property.latitude === 'number' ? String(property.latitude) : undefined,
    longitude: typeof property.longitude === 'number' ? String(property.longitude) : undefined,
    map_marker_type: portalProfile?.mapMarkerType || 'pin',
    price: property.price,
    price_currency: priceCurrency,
    title,
    street_name: portalProfile?.streetName || parsedStreet.streetName,
    street_number: portalProfile?.streetNumber || parsedStreet.streetNumber,
    block: portalProfile?.block,
    entrance: portalProfile?.entrance,
    apartment_number: portalProfile?.apartmentNumber,
    grid_id: portalProfile?.gridId,
  });

  if (!payload.custom_reference || !Array.isArray(payload.agents) || !payload.agents.length) {
    throw new Error('Payloadul pentru publicare nu este valid.');
  }

  return payload;
}

async function getListingByCustomReference(agencyId: string, customReference: string) {
  try {
    return await imobiliareRequest<{ data?: Record<string, unknown> }>(
      agencyId,
      `/api/v3/listings/${encodeURIComponent(customReference)}`
    );
  } catch (error) {
    const typedError = error as ImobiliareApiError;
    if (typedError.status === 404) {
      return null;
    }
    throw error;
  }
}

async function upsertListing(agencyId: string, payload: Record<string, unknown>) {
  const customReference = String(payload.custom_reference);
  const existing = await getListingByCustomReference(agencyId, customReference);

  if (existing?.data) {
    return imobiliareRequest<{ data?: Record<string, unknown> }>(
      agencyId,
      `/api/v3/listings/${encodeURIComponent(customReference)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );
  }

  return imobiliareRequest<Record<string, unknown>>(agencyId, '/api/v3/listings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

async function uploadListingMedia(agencyId: string, customReference: string, property: Property) {
  if (!Array.isArray(property.images) || property.images.length === 0) {
    throw new Error('Proprietatea trebuie sa aiba cel putin o imagine pentru publicare.');
  }

  const formData = new FormData();
  for (const [index, image] of property.images.slice(0, 30).entries()) {
    const response = await fetch(image.url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Nu am putut descarca imaginea ${index + 1} pentru publicare.`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    const extension = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
    const blob = new Blob([arrayBuffer], { type: mimeType });
    formData.append('images', blob, `property-${customReference}-${index + 1}.${extension}`);
  }

  await imobiliareRequest<unknown>(agencyId, `/api/v3/listings/${encodeURIComponent(customReference)}/medias`, {
    method: 'POST',
    body: formData,
  });
}

async function syncMediaLinks(agencyId: string, customReference: string, portalProfile?: ImobiliarePortalProfile) {
  const mediaLinks = portalProfile?.mediaLinks || [];
  if (!mediaLinks.length) {
    return;
  }

  const existing = await imobiliareRequest<{ data?: Array<{ id: number }> }>(
    agencyId,
    `/api/v3/listings/${encodeURIComponent(customReference)}/media-links`
  ).catch(() => ({ data: [] }));

  if (Array.isArray(existing.data)) {
    for (const mediaLink of existing.data) {
      if (typeof mediaLink?.id === 'number') {
        await imobiliareRequest(
          agencyId,
          `/api/v3/listings/${encodeURIComponent(customReference)}/media-links/${mediaLink.id}`,
          { method: 'DELETE' }
        ).catch(() => undefined);
      }
    }
  }

  for (const link of mediaLinks) {
    await imobiliareRequest(agencyId, `/api/v3/listings/${encodeURIComponent(customReference)}/media-links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(link),
    });
  }
}

async function applyPromotions(agencyId: string, customReference: string, portalProfile?: ImobiliarePortalProfile) {
  const promotionSettings = portalProfile?.promotionSettings || {};
  const payload = {
    status: promotionSettings.status || 'online',
    ...(promotionSettings.imoradarStatus ? { imoradar_status: promotionSettings.imoradarStatus } : {}),
    ...(promotionSettings.promotions ? { promotions: promotionSettings.promotions } : {}),
  };

  await imobiliareRequest(agencyId, `/api/v3/listings/${encodeURIComponent(customReference)}/promotions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

async function persistPropertyPublishState(params: {
  agencyId: string;
  propertyId: string;
  customReference: string;
  result: { remoteId?: number; path?: string | null; state?: string | null; errorMessage?: string | null };
  payloadHash?: string | null;
}) {
  const { agencyId, propertyId, customReference, result, payloadHash } = params;
  await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).set(
    {
      promotions: {
        imobiliare: {
          status: result.errorMessage ? 'error' : result.state === 'draft' ? 'pending' : 'published',
          lastSync: nowIso(),
          link: result.path || undefined,
          remoteId: result.remoteId,
          remoteState: result.state || undefined,
          errorMessage: result.errorMessage || undefined,
        },
      },
      portalProfiles: {
        imobiliare: {
          customReference,
          lastValidationError: result.errorMessage || null,
          lastPublishedAt: result.errorMessage ? null : nowIso(),
          lastPayloadHash: payloadHash || null,
        },
      },
    },
    { merge: true }
  );
}

export async function connectAgencyImobiliareAccount(agencyId: string, username: string, password: string): Promise<ConnectResult> {
  const tokenPayload = await requestAccessToken(
    new URLSearchParams({
      username,
      password,
    })
  );

  const expiresAt = tokenPayload.expires_in
    ? new Date(Date.now() + tokenPayload.expires_in * 1000).toISOString()
    : null;

  const tempIntegration: ImobiliareIntegrationPrivate = {
    provider: 'imobiliare',
    agencyId,
    username,
    accessToken: tokenPayload.access_token,
    accessTokenExpiresAt: expiresAt,
    refreshToken: tokenPayload.refresh_token || null,
    connectedAt: nowIso(),
    updatedAt: nowIso(),
    remoteAgentCount: 0,
    remoteAccountName: tokenPayload.user?.name || null,
  };

  await persistPrivateIntegration(agencyId, tempIntegration);

  const agentsPayload = await imobiliareRequest<unknown>(agencyId, '/api/v3/agents?page=1');
  const agents = extractAgents(agentsPayload);
  const finalPayload: ImobiliareIntegrationPrivate = {
    ...tempIntegration,
    remoteAgentCount: agents.length,
  };

  await persistPrivateIntegration(agencyId, finalPayload);
  await setPublicStatus(agencyId, {
    connected: true,
    username,
    connectedAt: tempIntegration.connectedAt,
    lastTokenRefreshAt: nowIso(),
    lastError: null,
    remoteAgentCount: agents.length,
    remoteAccountName: tempIntegration.remoteAccountName,
  });

  return {
    connected: true,
    username,
    remoteAgentCount: agents.length,
    remoteAccountName: tempIntegration.remoteAccountName || null,
  };
}

export async function disconnectAgencyImobiliareAccount(agencyId: string) {
  const integration = await getPrivateIntegration(agencyId);
  if (integration?.accessToken) {
    await fetch(`${IMOBILIARE_BASE_URL}/api/v3/logout`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${integration.accessToken}`,
      },
      cache: 'no-store',
    }).catch(() => undefined);
  }

  await getPrivateDocRef(agencyId).delete().catch(() => undefined);
  await getPublicDocRef(agencyId).set(
    {
      connected: false,
      username: null,
      connectedAt: null,
      lastTokenRefreshAt: null,
      lastError: null,
      remoteAgentCount: 0,
      remoteAccountName: null,
      updatedAt: nowIso(),
    },
    { merge: true }
  );
}

export async function getAgencyImobiliareStatus(agencyId: string) {
  const publicSnapshot = await getPublicDocRef(agencyId).get();
  if (!publicSnapshot.exists) {
    return {
      connected: false,
      username: null,
      connectedAt: null,
      lastTokenRefreshAt: null,
      lastError: null,
      remoteAgentCount: 0,
      remoteAccountName: null,
    };
  }
  return publicSnapshot.data() as PortalIntegrationPublicStatus & { updatedAt?: string };
}

export async function publishPropertyToImobiliare(params: {
  agencyId: string;
  propertyId: string;
  requestedByUid: string;
}): Promise<PublishResult> {
  const { agencyId, propertyId, requestedByUid } = params;
  const propertySnapshot = await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).get();

  if (!propertySnapshot.exists) {
    throw new Error('Proprietatea nu a fost gasita.');
  }

  const property = {
    id: propertySnapshot.id,
    ...propertySnapshot.data(),
  } as Property;

  const portalProfile = property.portalProfiles?.imobiliare;
  const categoryApi = await resolveCategoryApi(agencyId, property, portalProfile);
  const locationId = await resolveLocationId(agencyId, property, portalProfile);
  const remoteAgentId = await ensureRemoteAgentId({
    agencyId,
    property,
    portalProfile,
    requestedByUid,
  });

  const payload = buildListingPayload({
    property,
    portalProfile,
    remoteAgentId,
    categoryApi,
    locationId,
  });

  const payloadHash = getPayloadHash(payload);
  const listingResponse = await upsertListing(agencyId, payload);
  await uploadListingMedia(agencyId, String(payload.custom_reference), property);
  await syncMediaLinks(agencyId, String(payload.custom_reference), portalProfile);
  await applyPromotions(agencyId, String(payload.custom_reference), portalProfile);

  const listingData = ('data' in listingResponse ? listingResponse.data : listingResponse) as Record<string, unknown> | undefined;
  const result = {
    customReference: String(payload.custom_reference),
    remoteId: typeof listingData?.id === 'number' ? listingData.id : undefined,
    path: typeof listingData?.path === 'string' ? listingData.path : null,
    state: typeof listingData?.state === 'string' ? listingData.state : 'online',
    title: typeof listingData?.title === 'string' ? listingData.title : null,
  };

  await persistPropertyPublishState({
    agencyId,
    propertyId,
    customReference: result.customReference,
    result,
    payloadHash,
  });

  return result;
}

export async function unpublishPropertyFromImobiliare(params: {
  agencyId: string;
  propertyId: string;
}) {
  const { agencyId, propertyId } = params;
  const propertySnapshot = await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).get();
  if (!propertySnapshot.exists) {
    throw new Error('Proprietatea nu a fost gasita.');
  }

  const property = {
    id: propertySnapshot.id,
    ...propertySnapshot.data(),
  } as Property;
  const customReference = property.portalProfiles?.imobiliare?.customReference || property.id;

  await imobiliareRequest(agencyId, `/api/v3/listings/${encodeURIComponent(customReference)}/promotions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: 'draft',
    }),
  });

  await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).set(
    {
      promotions: {
        imobiliare: {
          status: 'unpublished',
          lastSync: nowIso(),
          errorMessage: null,
          remoteState: 'draft',
        },
      },
    },
    { merge: true }
  );

  return {
    customReference,
    state: 'draft',
  };
}

export async function getImobiliareCategories(agencyId: string) {
  const payload = await imobiliareRequest<unknown>(agencyId, '/api/v3/categories');
  return extractCategories(payload);
}
