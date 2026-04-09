import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';
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
const IMOBILIARE_LOCATIONS_SQL_PATHS = [
  process.env.IMOBILIARE_LOCATIONS_SQL_PATH,
  'C:\\Users\\Cristian\\Desktop\\Imodeus\\API imobiliare\\locations.sql',
].filter(Boolean) as string[];
const IMOBILIARE_LOCATIONS_INDEX_PATH = path.join(process.cwd(), 'src', 'data', 'imobiliare-locations-index.json');

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
  old_id?: number | null;
  title?: string;
  slug?: string;
  depth?: number;
  is_hidden?: boolean;
  parent_id?: number | null;
  parent?: LocationOption | null;
  custom_display?: string;
};

export type ImobiliareLocationCatalogEntry = {
  id: number;
  oldId?: number | null;
  title: string;
  depth?: number;
  county?: string;
  locality?: string;
  zone?: string;
  display: string;
  searchText: string;
};

type ParsedLocationCandidate = {
  raw: string;
  normalized: string;
};

type SqlLocationRow = {
  id: number;
  old_id: number | null;
  title?: string;
  parent_id?: number | null;
  depth?: number;
  is_hidden?: boolean;
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

type PublishAuditEntry = {
  attemptedAt: string;
  stage: 'attempt' | 'error' | 'success' | 'retry-category';
  request: Record<string, unknown>;
  categoryApi: number;
  locationId: number;
  remoteAgentId: number;
  responseStatus?: number | null;
  responsePayload?: unknown;
  errorMessage?: string | null;
};

let sqlLocationsCache: SqlLocationRow[] | null = null;

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
  if (payload.errors && typeof payload.errors === 'object') {
    const flattened = Object.entries(payload.errors)
      .flatMap(([field, messages]) =>
        (messages || [])
          .filter((message): message is string => typeof message === 'string' && Boolean(message))
          .map((message) => `${field}: ${message}`)
      )
      .filter(Boolean);
    if (flattened.length) {
      return flattened.join(' | ');
    }
  }
  if (typeof payload.error_description === 'string' && payload.error_description) return payload.error_description;
  if (typeof payload.message === 'string' && payload.message) return payload.message;
  if (typeof payload.error === 'string' && payload.error) return payload.error;
  return fallback;
}

function extractAllowedNumericValues(message: string | null | undefined, fieldName: string) {
  if (!message) return [];
  const normalizedField = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`${normalizedField}\\s*:\\s*[^\\d]*([\\d,\\s]+)`, 'i');
  const match = message.match(regex);
  if (!match?.[1]) {
    return [];
  }

  return match[1]
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((value) => Number.isFinite(value));
}

function parseSqlTuple(tuple: string) {
  const values: string[] = [];
  let current = '';
  let inString = false;

  for (let index = 0; index < tuple.length; index += 1) {
    const char = tuple[index];
    const next = tuple[index + 1];

    if (char === "'") {
      if (inString && next === "'") {
        current += "'";
        index += 1;
        continue;
      }
      inString = !inString;
      continue;
    }

    if (char === ',' && !inString) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  if (current.length || tuple.endsWith(',')) {
    values.push(current.trim());
  }

  return values;
}

async function loadSqlLocationRows() {
  if (sqlLocationsCache) {
    return sqlLocationsCache;
  }

  for (const candidatePath of IMOBILIARE_LOCATIONS_SQL_PATHS) {
    try {
      const sql = await readFile(candidatePath, 'utf8');
      const rows: SqlLocationRow[] = sql
        .split(/\r?\n/)
        .filter((line) => line.startsWith('insert into `locations`'))
        .map((line) => {
          const valuesMatch = line.match(/values\((.*)\);$/i);
          if (!valuesMatch?.[1]) {
            return null;
          }
          const values = parseSqlTuple(valuesMatch[1]);
          const id = Number(values[0]);
          if (!Number.isFinite(id)) {
            return null;
          }

          const oldId = values[1] && values[1].toUpperCase() !== 'NULL' ? Number(values[1]) : null;
          const parentId = values[6] && values[6].toUpperCase() !== 'NULL' ? Number(values[6]) : null;
          const depth = values[7] ? Number(values[7]) : undefined;
          const isHidden = values[10] ? values[10] === '1' : undefined;

          const row: SqlLocationRow = {
            id,
            old_id: Number.isFinite(oldId as number) ? oldId : null,
            title: values[2] || undefined,
            parent_id: Number.isFinite(parentId as number) ? parentId : null,
            depth: Number.isFinite(depth as number) ? depth : undefined,
            is_hidden: isHidden,
          };

          return row;
        })
        .filter((row): row is SqlLocationRow => row !== null);

      if (rows.length) {
        sqlLocationsCache = rows;
        return rows;
      }
    } catch {
      continue;
    }
  }

  try {
    const bundled = JSON.parse(await readFile(IMOBILIARE_LOCATIONS_INDEX_PATH, 'utf8')) as SqlLocationRow[];
    if (Array.isArray(bundled) && bundled.length) {
      sqlLocationsCache = bundled;
      return sqlLocationsCache;
    }
  } catch {
    // Fall through to API-backed locations below.
  }

  sqlLocationsCache = [];
  return sqlLocationsCache;
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

async function getAvailableImobiliareLocations(agencyId: string) {
  const sqlRows = await loadSqlLocationRows();
  if (sqlRows.length) {
    const byId = new Map<number, LocationOption>();
    for (const row of sqlRows) {
      byId.set(row.id, {
        id: row.id,
        old_id: row.old_id,
        title: row.title,
        depth: row.depth,
        is_hidden: row.is_hidden,
        parent_id: row.parent_id ?? null,
      });
    }

    for (const location of byId.values()) {
      if (location.parent_id && byId.has(location.parent_id)) {
        location.parent = byId.get(location.parent_id) || null;
      }
    }

    return Array.from(byId.values());
  }

  const locationsPayload = await imobiliareRequest<unknown>(agencyId, '/api/v3/locations');
  return extractLocations(locationsPayload);
}

async function getLocationWithDescendants(agencyId: string, locationId: number) {
  const payload = await imobiliareRequest<unknown>(agencyId, `/api/v3/locations/${locationId}`).catch(() => null);
  return payload ? extractLocations(payload) : [];
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

  const visit = (node: unknown, parentName?: string | null, inheritedCategoryApi?: number | null) => {
    if (!node || typeof node !== 'object') {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((entry) => visit(entry, parentName, inheritedCategoryApi));
      return;
    }

    const record = node as Record<string, unknown>;
    const idCandidate =
      typeof record.id === 'number'
        ? record.id
        : typeof record.category_api === 'number'
          ? record.category_api
          : typeof inheritedCategoryApi === 'number'
            ? inheritedCategoryApi
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
    for (const [key, value] of Object.entries(record)) {
      const numericKey = /^\d+$/.test(key) ? Number(key) : null;
      visit(value, nextParentName, numericKey ?? inheritedCategoryApi ?? null);
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
  const seen = new Map<number, LocationOption>();

  const visit = (node: unknown, inheritedParent?: LocationOption | null) => {
    if (!node || typeof node !== 'object') {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach((entry) => visit(entry, inheritedParent));
      return;
    }

    const record = node as Record<string, unknown>;
    const id = typeof record.id === 'number' ? record.id : null;
    const title = typeof record.title === 'string' ? record.title : null;
    const depth = typeof record.depth === 'number' ? record.depth : null;
    const customDisplay = typeof record.custom_display === 'string' ? record.custom_display : undefined;
    const slug = typeof record.slug === 'string' ? record.slug : undefined;
    const isHidden = typeof record.is_hidden === 'boolean' ? record.is_hidden : undefined;
    const oldId = typeof record.old_id === 'number' ? record.old_id : undefined;
    const parent =
      record.parent && typeof record.parent === 'object'
        ? (record.parent as LocationOption)
        : inheritedParent || null;

    const looksLikeLocation = Boolean(id && (title || depth !== null || customDisplay || slug));
    if (looksLikeLocation && id) {
      if (!seen.has(id)) {
        seen.set(id, {
          id,
          old_id: oldId,
          title: title || undefined,
          slug,
          depth: depth ?? undefined,
          is_hidden: isHidden,
          parent_id: typeof record.parent_id === 'number' ? record.parent_id : parent?.id || null,
          parent,
          custom_display: customDisplay,
        });
      }
    }

    const currentLocation = id && seen.has(id) ? seen.get(id)! : inheritedParent || null;
    for (const [key, value] of Object.entries(record)) {
      if (key === 'parent') {
        continue;
      }
      visit(value, currentLocation);
    }
  };

  visit(payload, null);
  const root = payload as { data?: unknown };
  if (root?.data) {
    visit(root.data, null);
  }

  return Array.from(seen.values());
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

function getLocationPath(location?: LocationOption | null) {
  if (!location) {
    return [] as LocationOption[];
  }

  return [...collectLocationAncestors(location)].reverse().concat(location);
}

function formatLocationDisplay(location: LocationOption) {
  const customDisplay = location.custom_display?.trim();
  if (customDisplay) {
    return customDisplay;
  }

  const parts = getLocationPath(location)
    .map((item) => item.title?.trim())
    .filter((item): item is string => Boolean(item));

  return parts.join(' / ') || location.title?.trim() || String(location.id);
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

function findLocationByLegacyId(locations: LocationOption[], legacyId?: number | null) {
  if (typeof legacyId !== 'number') {
    return null;
  }

  return locations.find((item) => item.old_id === legacyId) || null;
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

function pickBestLocationCandidate(locations: LocationOption[], property: Property) {
  const searchTerms = buildLocationSearchTerms(property);
  const normalizedCity = normalizeText(property.city);
  const normalizedZone = normalizeText(property.zone);

  const scored = locations
    .map((location) => {
      const haystack = getLocationHaystack(location);
      const title = normalizeText(location.title);
      const customDisplay = normalizeText(location.custom_display);
      const directZoneMatch = Boolean(normalizedZone && (title === normalizedZone || customDisplay.includes(normalizedZone)));
      const directCityMatch = Boolean(normalizedCity && haystack.includes(normalizedCity));
      const tokenHits = searchTerms.reduce((sum, token) => sum + (haystack.includes(token.normalized) ? 1 : 0), 0);
      const score =
        (directZoneMatch ? 80 : 0) +
        (directCityMatch ? 25 : 0) +
        tokenHits * 12;

      return { location, score, directZoneMatch, directCityMatch, tokenHits };
    })
    .filter((entry) => entry.tokenHits > 0 || entry.directZoneMatch || entry.directCityMatch)
    .sort((left, right) => right.score - left.score);

  return (
    scored.find((entry) => entry.directZoneMatch || entry.tokenHits >= 2)?.location ||
    scored.find((entry) => entry.directCityMatch)?.location ||
    scored[0]?.location ||
    null
  );
}

function locationLooksRelevant(location: LocationOption, property: Property) {
  const haystack = getLocationHaystack(location);
  const zone = normalizeText(property.zone);
  const city = normalizeText(property.city);
  const locationText = normalizeText(property.location);

  if (zone && haystack.includes(zone)) {
    return true;
  }
  if (locationText && haystack.includes(locationText)) {
    return true;
  }
  if (city && haystack.includes(city)) {
    return true;
  }

  return false;
}

function buildPublishAuditLog(params: {
  agencyId: string;
  propertyId: string;
  categoryApi: number;
  locationId: number;
  remoteAgentId: number;
  payload: Record<string, unknown>;
}) {
  const { agencyId, propertyId, categoryApi, locationId, remoteAgentId, payload } = params;
  return {
    agencyId,
    propertyId,
    categoryApi,
    locationId,
    remoteAgentId,
    customReference: payload.custom_reference,
    offerType: payload.offer_type,
    title: payload.title,
    price: payload.price,
    priceCurrency: payload.price_currency,
    agents: payload.agents,
    streetName: payload.street_name,
    streetNumber: payload.street_number,
    dataProperties: payload.data_properties,
  };
}

function sanitizeCategoryOptions(categories: CategoryOption[]) {
  const byId = new Map<number, CategoryOption>();

  for (const category of categories) {
    if (!category || typeof category.id !== 'number') {
      continue;
    }

    const name = (category.name || '').trim();
    if (!name) {
      continue;
    }

    byId.set(category.id, {
      ...category,
      name,
      parentName: category.parentName?.trim() || null,
      selectable: category.selectable !== false,
    });
  }

  return Array.from(byId.values()).sort((left, right) => {
    const leftLabel = `${left.parentName || ''} ${left.name}`.trim();
    const rightLabel = `${right.parentName || ''} ${right.name}`.trim();
    return leftLabel.localeCompare(rightLabel, 'ro');
  });
}

function sanitizeLocationOptions(locations: LocationOption[]) {
  const byId = new Map<number, LocationOption>();

  for (const location of locations) {
    if (!location || typeof location.id !== 'number' || location.is_hidden) {
      continue;
    }
    byId.set(location.id, location);
  }

  const visible = Array.from(byId.values());
  const depth3 = visible.filter((location) => location.depth === 3);
  return depth3.length ? depth3 : visible;
}

function buildLocationCatalog(locations: LocationOption[]): ImobiliareLocationCatalogEntry[] {
  const visible = locations.filter((location) => location && typeof location.id === 'number' && !location.is_hidden);
  const visibleChildCounts = new Map<number, number>();

  for (const location of visible) {
    if (typeof location.parent_id === 'number') {
      visibleChildCounts.set(location.parent_id, (visibleChildCounts.get(location.parent_id) || 0) + 1);
    }
  }

  const candidates = visible.filter((location) => {
    if (location.depth === 3) {
      return true;
    }
    if (location.depth === 2) {
      return !visibleChildCounts.has(location.id);
    }
    return false;
  });

  const byId = new Map<number, ImobiliareLocationCatalogEntry>();

  for (const location of candidates) {
    const path = getLocationPath(location);
    const county = path.find((item) => item.depth === 1)?.title?.trim();
    const locality = path.find((item) => item.depth === 2)?.title?.trim() || location.title?.trim();
    const zoneCandidate = path.find((item) => item.depth === 3)?.title?.trim();
    const zone = zoneCandidate && normalizeText(zoneCandidate) !== normalizeText(locality) ? zoneCandidate : undefined;
    const display = formatLocationDisplay(location);
    const searchText = [
      display,
      location.title,
      county,
      locality,
      zone,
      location.custom_display,
    ]
      .filter(Boolean)
      .join(' ');

    byId.set(location.id, {
      id: location.id,
      oldId: location.old_id,
      title: location.title?.trim() || display,
      depth: location.depth,
      county,
      locality,
      zone,
      display,
      searchText,
    });
  }

  return Array.from(byId.values()).sort((left, right) => left.display.localeCompare(right.display, 'ro'));
}

async function persistPublishAudit(params: {
  agencyId: string;
  propertyId: string;
  entry: PublishAuditEntry;
}) {
  const { agencyId, propertyId, entry } = params;
  await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).set(
    {
      portalProfiles: {
        imobiliare: {
          lastPublishAudit: entry,
        },
      },
    },
    { merge: true }
  );
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

async function resolveCategoryApi(
  agencyId: string,
  property: Property,
  portalProfile?: ImobiliarePortalProfile,
  allowedCategoryIds?: number[]
) {
  const payload = await imobiliareRequest<unknown>(agencyId, '/api/v3/categories');
  const categories = sanitizeCategoryOptions(extractCategories(payload));
  const selectableCategories = categories.filter((item) => item.selectable);
  if (!categories.length) {
    throw new Error('Imobiliare.ro nu a returnat categorii utilizabile. Incearca din nou sau configureaza manual categoryApi.');
  }
  const baseCandidatePool = selectableCategories.length ? selectableCategories : categories;
  const candidatePool = allowedCategoryIds?.length
    ? baseCandidatePool.filter((item) => allowedCategoryIds.includes(item.id))
    : baseCandidatePool;

  if (!allowedCategoryIds?.length && typeof portalProfile?.categoryApi === 'number' && portalProfile.categoryApi >= 100) {
    const exactSavedCategory = candidatePool.find((item) => item.id === portalProfile.categoryApi);
    if (exactSavedCategory) {
      return exactSavedCategory.id;
    }
  }

  if (!candidatePool.length && allowedCategoryIds?.length) {
    return allowedCategoryIds[0];
  }

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
  return resolveLocationIdForPublish(agencyId, property, portalProfile);
}

async function resolveLocationIdForPublish(agencyId: string, property: Property, portalProfile?: ImobiliarePortalProfile) {
  const publishableLocations = sanitizeLocationOptions(await getAvailableImobiliareLocations(agencyId));
  if (!publishableLocations.length) {
    throw new Error('Imobiliare.ro nu a returnat locatii utilizabile. Incearca din nou sau configureaza manual locationId.');
  }

  if (typeof portalProfile?.locationId === 'number') {
    const exactDepth3Match = publishableLocations.find((item) => item.id === portalProfile.locationId);
    if (exactDepth3Match?.id) {
      return exactDepth3Match.id;
    }

    const migratedDepth3Match = findLocationByLegacyId(publishableLocations, portalProfile.locationId);
    if (migratedDepth3Match?.id) {
      return migratedDepth3Match.id;
    }
  }

  const explicitZoneMatch = publishableLocations.find((item) => {
    const zone = normalizeText(property.zone);
    const locationText = normalizeText(property.location);
    const title = normalizeText(item.title);
    const customDisplay = normalizeText(item.custom_display);
    const haystack = getLocationHaystack(item);
    return Boolean(
      (zone && (title === zone || customDisplay === zone || haystack.includes(zone))) ||
      (locationText && (title === locationText || customDisplay === locationText || haystack.includes(locationText)))
    );
  });
  if (explicitZoneMatch?.id) {
    return explicitZoneMatch.id;
  }

  const preferred = pickBestLocationCandidate(publishableLocations, property);
  if (preferred?.id) {
    return preferred.id;
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
  const normalizedPropertyType = normalizeText(property.propertyType);
  const normalizedInteriorState = normalizeText(property.interiorState);

  const housingType =
    normalizedPropertyType.includes('garsoniera')
      ? 'studio'
      : normalizedPropertyType.includes('apartament')
        ? 'apartment'
        : normalizedPropertyType.includes('casa') || normalizedPropertyType.includes('vila')
          ? 'house'
          : undefined;

  const buildingType =
    normalizedPropertyType.includes('garsoniera') || normalizedPropertyType.includes('apartament')
      ? 'apartment-building'
      : normalizedPropertyType.includes('casa') || normalizedPropertyType.includes('vila')
        ? 'house'
        : undefined;

  const base = compactObject({
    bedroom_count: property.rooms ? String(property.rooms) : undefined,
    bathroom_count: typeof property.bathrooms === 'number' ? String(property.bathrooms) : undefined,
    usable_surface: property.squareFootage ? String(property.squareFootage) : undefined,
    built_area: property.totalSurface ? String(property.totalSurface) : undefined,
    total_usable_surface: property.squareFootage ? String(property.squareFootage) : undefined,
    year_built: property.constructionYear ? String(property.constructionYear) : undefined,
    floor_number: property.floor ? String(property.floor).replace(/[^\d\-]/g, '') || String(property.floor) : undefined,
    number_of_floors: property.totalFloors ? String(property.totalFloors) : undefined,
    housing_type: housingType,
    building_type: buildingType,
    comfort: property.comfort && ['1', '2', '3', 'lux'].includes(normalizeText(property.comfort)) ? property.comfort : undefined,
    construction_stage:
      normalizedInteriorState.includes('renovat') || normalizedInteriorState.includes('buna') || normalizedInteriorState.includes('nou')
        ? 'completed'
        : undefined,
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
    return updateListing(agencyId, customReference, payload);
  }

  return imobiliareRequest<Record<string, unknown>>(agencyId, '/api/v3/listings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

async function updateListing(agencyId: string, customReference: string, payload: Record<string, unknown>) {
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
    formData.append('images[]', blob, `property-${customReference}-${index + 1}.${extension}`);
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
  portalProfilePatch?: Partial<ImobiliarePortalProfile>;
}) {
  const { agencyId, propertyId, customReference, result, payloadHash, portalProfilePatch } = params;
  const promotionPatch = {
    status: result.errorMessage ? 'error' : result.state === 'draft' ? 'pending' : 'published',
    lastSync: nowIso(),
    link: result.path ?? null,
    remoteId: typeof result.remoteId === 'number' ? result.remoteId : null,
    remoteState: result.state ?? null,
    errorMessage: result.errorMessage ?? null,
  };

  const normalizedPortalProfilePatch = Object.fromEntries(
    Object.entries(portalProfilePatch || {}).map(([key, value]) => [key, value ?? null])
  );

  await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).set(
    {
      promotions: {
        imobiliare: promotionPatch,
      },
      portalProfiles: {
        imobiliare: {
          customReference,
          ...normalizedPortalProfilePatch,
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
  const locationId = await resolveLocationIdForPublish(agencyId, property, portalProfile);
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
  const auditLog = buildPublishAuditLog({
    agencyId,
    propertyId,
    categoryApi,
    locationId,
    remoteAgentId,
    payload,
  });
  console.info('[imobiliare] publish attempt', auditLog);
  await persistPublishAudit({
    agencyId,
    propertyId,
    entry: {
      attemptedAt: nowIso(),
      stage: 'attempt',
      request: payload,
      categoryApi,
      locationId,
      remoteAgentId,
    },
  });

  const payloadHash = getPayloadHash(payload);
  let listingResponse: Record<string, unknown> | { data?: Record<string, unknown> } | null = null;
  try {
    listingResponse = await upsertListing(agencyId, payload);
  } catch (error) {
    const typedError = error as ImobiliareApiError;
    const errorMessage = typedError.message || extractMessage(typedError.payload, 'Publicarea in imobiliare.ro a esuat.');
    console.error('[imobiliare] publish failed', {
      ...auditLog,
      status: typedError.status || null,
      errorMessage,
      externalPayload: typedError.payload || null,
    });
    await persistPublishAudit({
      agencyId,
      propertyId,
      entry: {
        attemptedAt: nowIso(),
        stage: 'error',
        request: payload,
        categoryApi,
        locationId,
        remoteAgentId,
        responseStatus: typedError.status || null,
        responsePayload: typedError.payload || null,
        errorMessage,
      },
    });
    const allowedCategoryIds = extractAllowedNumericValues(errorMessage, 'category_api');
    const hasInvalidLocationError = /location_id/i.test(errorMessage);

    if (hasInvalidLocationError) {
      try {
        listingResponse = await updateListing(agencyId, String(payload.custom_reference), payload);
        console.info('[imobiliare] publish retry force update after location_id error', {
          ...auditLog,
          locationId,
        });
      } catch {
        // Continue with the normal fallback branches below.
      }
    }

    if (!listingResponse) {
      if (allowedCategoryIds.length) {
        const retryCategoryApi = await resolveCategoryApi(agencyId, property, portalProfile, allowedCategoryIds);
        const retryPayload = buildListingPayload({
          property,
          portalProfile: {
            ...(portalProfile || {}),
            categoryApi: retryCategoryApi,
          },
          remoteAgentId,
          categoryApi: retryCategoryApi,
          locationId,
        });

        listingResponse = await upsertListing(agencyId, retryPayload);
        console.info('[imobiliare] publish retry category_api', {
          ...auditLog,
          retryCategoryApi,
        });
        await persistPublishAudit({
          agencyId,
          propertyId,
          entry: {
            attemptedAt: nowIso(),
            stage: 'retry-category',
            request: retryPayload,
            categoryApi: retryCategoryApi,
            locationId,
            remoteAgentId,
          },
        });
      } else {
        throw error;
      }
    }
  }

  if (!listingResponse) {
    throw new Error('Publicarea in imobiliare.ro a esuat inainte de crearea listingului.');
  }

  const listingData = ('data' in listingResponse ? listingResponse.data : listingResponse) as Record<string, unknown> | undefined;
  const result = {
    customReference: String(payload.custom_reference),
    remoteId: typeof listingData?.id === 'number' ? listingData.id : undefined,
    path: typeof listingData?.path === 'string' ? listingData.path : null,
    state: typeof listingData?.state === 'string' ? listingData.state : 'online',
    title: typeof listingData?.title === 'string' ? listingData.title : null,
  };

  try {
    try {
      await uploadListingMedia(agencyId, result.customReference, property);
    } catch (error) {
      const typedError = error as ImobiliareApiError;
      const errorMessage = typedError.message || extractMessage(typedError.payload, 'Uploadul imaginilor catre imobiliare.ro a esuat.');
      throw Object.assign(new Error(`media: ${errorMessage}`), {
        status: typedError.status,
        payload: typedError.payload,
      }) as ImobiliareApiError;
    }

    try {
      await syncMediaLinks(agencyId, result.customReference, portalProfile);
    } catch (error) {
      const typedError = error as ImobiliareApiError;
      const errorMessage = typedError.message || extractMessage(typedError.payload, 'Sincronizarea linkurilor media catre imobiliare.ro a esuat.');
      throw Object.assign(new Error(`media-links: ${errorMessage}`), {
        status: typedError.status,
        payload: typedError.payload,
      }) as ImobiliareApiError;
    }

    try {
      await applyPromotions(agencyId, result.customReference, portalProfile);
    } catch (error) {
      const typedError = error as ImobiliareApiError;
      const errorMessage = typedError.message || extractMessage(typedError.payload, 'Activarea anuntului pe imobiliare.ro a esuat.');
      throw Object.assign(new Error(`promotions: ${errorMessage}`), {
        status: typedError.status,
        payload: typedError.payload,
      }) as ImobiliareApiError;
    }
  } catch (error) {
    const typedError = error as ImobiliareApiError;
    const errorMessage = typedError.message || extractMessage(typedError.payload, 'Listingul a fost creat, dar sincronizarea finala cu imobiliare.ro a esuat.');

    await persistPropertyPublishState({
      agencyId,
      propertyId,
      customReference: result.customReference,
      result: {
        ...result,
        errorMessage,
      },
      payloadHash,
      portalProfilePatch: {
        categoryApi,
        locationId,
        remoteAgentId,
      },
    });
    await persistPublishAudit({
      agencyId,
      propertyId,
      entry: {
        attemptedAt: nowIso(),
        stage: 'error',
        request: payload,
        categoryApi,
        locationId,
        remoteAgentId,
        responseStatus: typedError.status || null,
        responsePayload: typedError.payload || null,
        errorMessage,
      },
    });

    throw error;
  }

  await persistPropertyPublishState({
    agencyId,
    propertyId,
    customReference: result.customReference,
    result,
    payloadHash,
    portalProfilePatch: {
      categoryApi,
      locationId,
      remoteAgentId,
    },
  });
  await persistPublishAudit({
    agencyId,
    propertyId,
    entry: {
      attemptedAt: nowIso(),
      stage: 'success',
      request: payload,
      categoryApi,
      locationId,
      remoteAgentId,
      responseStatus: 200,
      responsePayload: listingResponse,
    },
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
          link: null,
          remoteId: null,
          errorMessage: null,
          remoteState: 'draft',
        },
      },
      portalProfiles: {
        imobiliare: {
          lastValidationError: null,
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
  const categories = sanitizeCategoryOptions(extractCategories(payload));
  const strict = categories.filter((item) => item.selectable && item.id >= 100);
  if (strict.length) {
    return strict;
  }

  const selectable = categories.filter((item) => item.selectable !== false);
  if (selectable.length) {
    return selectable;
  }

  return categories;
}

export async function getImobiliareLocations(agencyId: string) {
  return sanitizeLocationOptions(await getAvailableImobiliareLocations(agencyId));
}

export async function getImobiliareLocationCatalog(agencyId: string) {
  return buildLocationCatalog(await getAvailableImobiliareLocations(agencyId));
}
