import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';
import { adminDb } from '@/firebase/admin';
import type {
  ImobiliareAgentMapping,
  ImobiliareAnalyticsSummary,
  ImobiliareIntegrationPrivate,
  ImobiliarePromotionSettings,
  ImobiliarePortalProfile,
  ImobiliareSyncJobSummary,
  PortalIntegrationPublicStatus,
  PromotionStatus,
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

function slugifyImobiliareTitle(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-') || 'anunt-imobiliar';
}

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

function normalizeNullableString(value?: string | null) {
  const trimmed = (value || '').trim();
  return trimmed || null;
}

function mergePromotionSettings(
  defaults?: ImobiliarePromotionSettings | null,
  overrides?: ImobiliarePromotionSettings | null
): ImobiliarePromotionSettings {
  const mergedPromotions = {
    ...(defaults?.promotions || {}),
    ...(overrides?.promotions || {}),
  };

  return {
    status: overrides?.status || defaults?.status,
    imoradarStatus: overrides?.imoradarStatus || defaults?.imoradarStatus,
    promotions: Object.keys(mergedPromotions).length ? mergedPromotions : undefined,
  };
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

async function setPublicJobSummary(
  agencyId: string,
  field: 'lastReconcileSummary' | 'lastRetrySummary',
  summary: ImobiliareSyncJobSummary
) {
  const timestampField = field === 'lastReconcileSummary' ? 'lastReconcileAt' : 'lastRetryAt';
  await getPublicDocRef(agencyId).set(
    {
      [field]: summary,
      [timestampField]: summary.finishedAt,
      updatedAt: nowIso(),
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

async function loadAgencyLocalAgentProfiles(agencyId: string) {
  const snapshot = await adminDb.collection('users').where('agencyId', '==', agencyId).get();
  return snapshot.docs
    .map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() } as UserProfile))
    .filter((profile) => profile.role === 'admin' || profile.role === 'agent');
}

function buildAgentMappingSummary(
  localAgents: UserProfile[],
  remoteAgents: RemoteAgent[],
  existingMappings?: ImobiliareAgentMapping[] | null
) {
  const byExistingLocalId = new Map((existingMappings || []).map((entry) => [entry.localAgentId, entry]));
  const usedRemoteIds = new Set<number>();
  const mappings: ImobiliareAgentMapping[] = [];

  for (const localAgent of localAgents) {
    const existing = byExistingLocalId.get(localAgent.id);
    if (existing?.remoteAgentId) {
      const matchingRemote = remoteAgents.find((agent) => agent.id === existing.remoteAgentId);
      if (matchingRemote?.id) {
        usedRemoteIds.add(matchingRemote.id);
        mappings.push({
          ...existing,
          remoteAgentName: matchingRemote.name || existing.remoteAgentName || null,
          remoteAgentEmail: matchingRemote.email || existing.remoteAgentEmail || null,
          localAgentName: localAgent.name || existing.localAgentName || null,
          localAgentEmail: localAgent.email || existing.localAgentEmail || null,
          updatedAt: nowIso(),
        });
        continue;
      }
    }

    const normalizedEmail = normalizeText(localAgent.email || '');
    const normalizedName = normalizeText(localAgent.name || '');
    const emailMatch = remoteAgents.find((agent) => agent.id && !usedRemoteIds.has(agent.id) && normalizeText(agent.email || '') === normalizedEmail);
    const nameMatch = remoteAgents.find((agent) => agent.id && !usedRemoteIds.has(agent.id) && normalizeText(agent.name || '') === normalizedName);
    const matched = emailMatch || nameMatch || null;

    if (!matched?.id) {
      continue;
    }

    usedRemoteIds.add(matched.id);
    mappings.push({
      localAgentId: localAgent.id,
      localAgentName: localAgent.name || null,
      localAgentEmail: localAgent.email || null,
      remoteAgentId: matched.id,
      remoteAgentName: matched.name || null,
      remoteAgentEmail: matched.email || null,
      source: emailMatch ? 'matched_by_email' : 'matched_by_name',
      updatedAt: nowIso(),
    });
  }

  return mappings;
}

async function persistAgentMappings(
  agencyId: string,
  mappings: ImobiliareAgentMapping[]
) {
  const integration = await getPrivateIntegration(agencyId);
  if (!integration) {
    throw new Error('Contul imobiliare.ro nu este conectat pentru aceasta agentie.');
  }

  const updated: ImobiliareIntegrationPrivate = {
    ...integration,
    agentMappings: mappings,
    updatedAt: nowIso(),
  };
  await persistPrivateIntegration(agencyId, updated);
  await setPublicStatus(agencyId, { agentMappings: mappings });
  return mappings;
}

async function computeAgencyImobiliareAnalytics(agencyId: string): Promise<ImobiliareAnalyticsSummary> {
  const properties = await getAgencyImobiliareProperties(agencyId);
  let published = 0;
  let unpublished = 0;
  let pending = 0;
  let errors = 0;
  let totalViews = 0;
  let lastSyncAt: string | null = null;

  const topListings = properties
    .map((property) => {
      const promotion = property.promotions?.imobiliare;
      const status = (promotion?.status || 'unpublished') as PromotionStatus['status'];
      const views = typeof promotion?.views === 'number' ? promotion.views : 0;
      const lastSync = promotion?.lastSync || null;

      if (status === 'published') published += 1;
      else if (status === 'pending') pending += 1;
      else if (status === 'error') errors += 1;
      else unpublished += 1;

      totalViews += views;
      if (lastSync && (!lastSyncAt || new Date(lastSync) > new Date(lastSyncAt))) {
        lastSyncAt = lastSync;
      }

      return {
        propertyId: property.id,
        title: property.title,
        views,
        status,
      };
    })
    .sort((left, right) => right.views - left.views)
    .slice(0, 5);

  return {
    totalProperties: properties.length,
    published,
    unpublished,
    pending,
    errors,
    totalViews,
    lastSyncAt,
    topListings,
  };
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
    acpUrl: integration.acpUrl || null,
    performanceReportEmail: integration.performanceReportEmail || null,
    defaultPromotionSettings: integration.defaultPromotionSettings || null,
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

function findPreferredPublishChildLocation(locations: LocationOption[], location?: LocationOption | null) {
  if (!location?.id) {
    return null;
  }

  const normalizedTitle = normalizeText(location.title);
  const children = locations.filter((item) => item.parent_id === location.id && item.depth === 3);
  if (!children.length) {
    return null;
  }

  return (
    children.find((item) => normalizeText(item.title) === normalizedTitle) ||
    children.find((item) => normalizeText(item.custom_display).includes(normalizedTitle)) ||
    children[0] ||
    null
  );
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
  const normalizedAddress = normalizeText(property.address);

  const scored = locations
    .map((location) => {
      const haystack = getLocationHaystack(location);
      const title = normalizeText(location.title);
      const customDisplay = normalizeText(location.custom_display);
      const directZoneMatch = Boolean(normalizedZone && (title === normalizedZone || customDisplay.includes(normalizedZone)));
      const directCityMatch = Boolean(normalizedCity && haystack.includes(normalizedCity));
      const directAddressMatch = Boolean(
        normalizedAddress &&
        ((title && normalizedAddress.includes(title)) || (customDisplay && normalizedAddress.includes(customDisplay)))
      );
      const tokenHits = searchTerms.reduce((sum, token) => sum + (haystack.includes(token.normalized) ? 1 : 0), 0);
      const score =
        (directZoneMatch ? 80 : 0) +
        (directCityMatch ? 25 : 0) +
        (directAddressMatch ? 70 : 0) +
        (location.depth === 3 ? 5 : 0) +
        tokenHits * 12;

      return { location, score, directZoneMatch, directCityMatch, directAddressMatch, tokenHits };
    })
    .filter((entry) => entry.tokenHits > 0 || entry.directZoneMatch || entry.directCityMatch || entry.directAddressMatch)
    .sort((left, right) => right.score - left.score);

  return (
    scored.find((entry) => entry.directAddressMatch)?.location ||
    scored.find((entry) => entry.directZoneMatch)?.location ||
    scored.find((entry) => entry.tokenHits >= 2)?.location ||
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

function isIlfovLocation(location?: LocationOption | null) {
  if (!location) {
    return false;
  }

  const path = getLocationPath(location);
  return path.some((item) => {
    const title = normalizeText(item.title);
    const customDisplay = normalizeText(item.custom_display);
    const slug = normalizeText(item.slug);
    return (
      item.id === 8276 ||
      title === 'ilfovcounty' ||
      title === 'judetulilfov' ||
      customDisplay === 'judetulilfov' ||
      slug === 'ilfov'
    );
  });
}

function containsPiperaHint(property: Property) {
  const values = [
    property.title,
    property.address,
    property.city,
    property.zone,
    property.location,
  ];

  return values.some((value) => normalizeText(value).includes('pipera'));
}

function containsAnyLocationHint(property: Property, hints: string[]) {
  const values = [
    property.title,
    property.address,
    property.city,
    property.zone,
    property.location,
  ].map((value) => normalizeText(value));

  return hints.some((hint) => values.some((value) => value.includes(hint)));
}

function findIlfovCountyLocation(locations: LocationOption[], location?: LocationOption | null) {
  const path = getLocationPath(location || undefined);
  const root = path.find((item) => item.depth === 1 && isIlfovLocation(item));
  if (root) {
    return locations.find((item) => item.id === root.id) || root;
  }

  return (
    locations.find((item) => item.id === 8276) ||
    locations.find((item) => item.depth === 1 && isIlfovLocation(item)) ||
    null
  );
}

function buildInvalidLocationFallbacks(locations: LocationOption[], property: Property, invalidLocationId: number) {
  const invalidLocation =
    locations.find((item) => item.id === invalidLocationId) ||
    findLocationByLegacyId(locations, invalidLocationId);
  const available = locations.filter((item) => item.id !== invalidLocation?.id);
  const fallbackIds: number[] = [];
  const pushFallback = (location?: LocationOption | null) => {
    if (!location?.id || location.id === invalidLocationId || fallbackIds.includes(location.id)) {
      return;
    }

    fallbackIds.push(location.id);
  };
  const pushFallbackId = (locationId?: number | null) => {
    if (typeof locationId !== 'number' || locationId === invalidLocationId || fallbackIds.includes(locationId)) {
      return;
    }

    fallbackIds.push(locationId);
  };
  const invalidTitle = normalizeText(invalidLocation?.title);
  const invalidDisplay = normalizeText(invalidLocation?.custom_display);
  const popestiMatch =
    invalidTitle === 'popestileordeni' ||
    invalidDisplay.includes('popestileordeni') ||
    containsAnyLocationHint(property, ['popestileordeni']);

  pushFallback(pickBestLocationCandidate(available, property));

  if (popestiMatch) {
    if (containsAnyLocationHint(property, ['metalurgiei'])) {
      pushFallbackId(8736);
    }
    if (containsAnyLocationHint(property, ['berceni'])) {
      pushFallbackId(8639);
    }
    if (containsAnyLocationHint(property, ['aparatoriipatriei', 'dimitrieleonida', 'leonida'])) {
      pushFallbackId(8621);
    }

    pushFallbackId(8639);
    pushFallbackId(8736);
    pushFallbackId(8621);
  }

  if (invalidLocation && isIlfovLocation(invalidLocation)) {
    if (containsPiperaHint(property)) {
      const pipera = available.find((item) => {
        const haystack = getLocationHaystack(item);
        return normalizeText(item.title) === 'pipera' || haystack.includes('pipera');
      });
      pushFallback(pipera);
    }

    pushFallback(findIlfovCountyLocation(locations, invalidLocation));
  }

  return fallbackIds;
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
  const publishable = visible.filter((location) => location.depth === 2 || location.depth === 3);

  // Some counties, including Ilfov, expose valid locality-level locations while
  // keeping their child zones hidden. If we keep only depth-3 entries we lose
  // valid selections like Voluntari or Popesti-Leordeni at publish time.
  return publishable.length ? publishable : visible;
}

function getPublishableLocationOptions(locations: LocationOption[]) {
  const byId = new Map<number, LocationOption>();

  for (const location of locations) {
    if (!location || typeof location.id !== 'number') {
      continue;
    }

    // imobiliare.ro can require hidden depth-3 zones for publish even when the
    // UI selector exposes only the parent locality, such as Popesti-Leordeni.
    if (location.is_hidden && location.depth !== 3) {
      continue;
    }

    if (location.depth !== 2 && location.depth !== 3) {
      continue;
    }

    byId.set(location.id, location);
  }

  return Array.from(byId.values());
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
  const propertyRef = adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId);
  const snapshot = await propertyRef.get();
  const existingHistory =
    ((snapshot.data() as Property | undefined)?.portalProfiles?.imobiliare?.lastPublishAuditHistory || [])
      .filter(Boolean)
      .slice(-14);

  await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).set(
    {
      portalProfiles: {
        imobiliare: {
          lastPublishAudit: entry,
          lastPublishAuditHistory: [
            ...existingHistory,
            {
              attemptedAt: entry.attemptedAt,
              stage: entry.stage,
              responseStatus: entry.responseStatus ?? null,
              errorMessage: entry.errorMessage ?? null,
            },
          ],
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

function withoutExplicitLocation(portalProfile?: ImobiliarePortalProfile): ImobiliarePortalProfile | undefined {
  if (!portalProfile) {
    return undefined;
  }

  const nextProfile: ImobiliarePortalProfile = {
    ...portalProfile,
    locationId: null,
    locationLabel: null,
  };

  return nextProfile;
}

async function resolveLocationIdForPublish(agencyId: string, property: Property, portalProfile?: ImobiliarePortalProfile) {
  const publishableLocations = getPublishableLocationOptions(await getAvailableImobiliareLocations(agencyId));
  if (!publishableLocations.length) {
    throw new Error('Imobiliare.ro nu a returnat locatii utilizabile. Incearca din nou sau configureaza manual locationId.');
  }

  if (typeof portalProfile?.locationId === 'number') {
    const exactDepth3Match = publishableLocations.find((item) => item.id === portalProfile.locationId);
    if (exactDepth3Match?.id) {
      const preferredChild = exactDepth3Match.depth === 2 ? findPreferredPublishChildLocation(publishableLocations, exactDepth3Match) : null;
      return preferredChild?.id || exactDepth3Match.id;
    }

    const migratedDepth3Match = findLocationByLegacyId(publishableLocations, portalProfile.locationId);
    if (migratedDepth3Match?.id) {
      const preferredChild = migratedDepth3Match.depth === 2 ? findPreferredPublishChildLocation(publishableLocations, migratedDepth3Match) : null;
      return preferredChild?.id || migratedDepth3Match.id;
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

  if (property.agentId) {
    const integration = await getPrivateIntegration(agencyId);
    const mappedAgent = integration?.agentMappings?.find((entry) => entry.localAgentId === property.agentId);
    if (mappedAgent?.remoteAgentId) {
      return mappedAgent.remoteAgentId;
    }
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
    if (selectedProfile.id) {
      const integration = await getPrivateIntegration(agencyId);
      const nextMappings = [
        ...(integration?.agentMappings || []).filter((entry) => entry.localAgentId !== selectedProfile.id),
        {
          localAgentId: selectedProfile.id,
          localAgentName: selectedProfile.name || null,
          localAgentEmail: selectedProfile.email || null,
          remoteAgentId: existing.id,
          remoteAgentName: existing.name || null,
          remoteAgentEmail: existing.email || null,
          source: 'matched_by_email' as const,
          updatedAt: nowIso(),
        },
      ];
      await persistAgentMappings(agencyId, nextMappings);
    }
    return existing.id;
  }

  const normalizedName = normalizeText(selectedProfile.name || property.agentName || '');
  const byName = remoteAgents.find((agent) => normalizedName && normalizeText(agent.name) === normalizedName);
  if (byName?.id) {
    if (selectedProfile.id) {
      const integration = await getPrivateIntegration(agencyId);
      const nextMappings = [
        ...(integration?.agentMappings || []).filter((entry) => entry.localAgentId !== selectedProfile.id),
        {
          localAgentId: selectedProfile.id,
          localAgentName: selectedProfile.name || null,
          localAgentEmail: selectedProfile.email || null,
          remoteAgentId: byName.id,
          remoteAgentName: byName.name || null,
          remoteAgentEmail: byName.email || null,
          source: 'matched_by_name' as const,
          updatedAt: nowIso(),
        },
      ];
      await persistAgentMappings(agencyId, nextMappings);
    }
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
      if (selectedProfile.id) {
        const integration = await getPrivateIntegration(agencyId);
        const nextMappings = [
          ...(integration?.agentMappings || []).filter((entry) => entry.localAgentId !== selectedProfile.id),
          {
            localAgentId: selectedProfile.id,
            localAgentName: selectedProfile.name || null,
            localAgentEmail: selectedProfile.email || null,
            remoteAgentId: created.id,
            remoteAgentName: created.name || null,
            remoteAgentEmail: created.email || null,
            source: 'created_remote' as const,
            updatedAt: nowIso(),
          },
        ];
        await persistAgentMappings(agencyId, nextMappings);
      }
      return created.id;
    }
  } catch (error) {
    const fallbackRemoteAgent = remoteAgents.find((agent) => typeof agent.id === 'number');
    if (fallbackRemoteAgent?.id) {
      if (selectedProfile.id) {
        const integration = await getPrivateIntegration(agencyId);
        const nextMappings = [
          ...(integration?.agentMappings || []).filter((entry) => entry.localAgentId !== selectedProfile.id),
          {
            localAgentId: selectedProfile.id,
            localAgentName: selectedProfile.name || null,
            localAgentEmail: selectedProfile.email || null,
            remoteAgentId: fallbackRemoteAgent.id,
            remoteAgentName: fallbackRemoteAgent.name || null,
            remoteAgentEmail: fallbackRemoteAgent.email || null,
            source: 'fallback' as const,
            updatedAt: nowIso(),
          },
        ];
        await persistAgentMappings(agencyId, nextMappings);
      }
      return fallbackRemoteAgent.id;
    }
    throw error;
  }

  const fallbackRemoteAgent = remoteAgents.find((agent) => typeof agent.id === 'number');
  if (fallbackRemoteAgent?.id) {
    if (selectedProfile.id) {
      const integration = await getPrivateIntegration(agencyId);
      const nextMappings = [
        ...(integration?.agentMappings || []).filter((entry) => entry.localAgentId !== selectedProfile.id),
        {
          localAgentId: selectedProfile.id,
          localAgentName: selectedProfile.name || null,
          localAgentEmail: selectedProfile.email || null,
          remoteAgentId: fallbackRemoteAgent.id,
          remoteAgentName: fallbackRemoteAgent.name || null,
          remoteAgentEmail: fallbackRemoteAgent.email || null,
          source: 'fallback' as const,
          updatedAt: nowIso(),
        },
      ];
      await persistAgentMappings(agencyId, nextMappings);
    }
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

async function getAgencyDefaultPromotionSettings(agencyId: string) {
  const integration = await getPrivateIntegration(agencyId);
  return integration?.defaultPromotionSettings || null;
}

async function applyPromotions(agencyId: string, customReference: string, portalProfile?: ImobiliarePortalProfile) {
  const defaultPromotionSettings = await getAgencyDefaultPromotionSettings(agencyId);
  const promotionSettings = mergePromotionSettings(defaultPromotionSettings, portalProfile?.promotionSettings);
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

function mapRemoteListingStateToPromotionStatus(state?: string | null): PromotionStatus['status'] {
  const normalized = normalizeText(state);
  if (!normalized || normalized === 'draft') {
    return 'unpublished';
  }
  if (normalized === 'online' || normalized === 'published' || normalized === 'active') {
    return 'published';
  }
  if (normalized.includes('error')) {
    return 'error';
  }
  return 'pending';
}

async function persistPropertyRemoteSnapshot(params: {
  agencyId: string;
  propertyId: string;
  customReference: string;
  remoteId?: number | null;
  path?: string | null;
  state?: string | null;
  errorMessage?: string | null;
}) {
  const { agencyId, propertyId, customReference, remoteId, path, state, errorMessage } = params;
  const promotionStatus = errorMessage ? 'error' : mapRemoteListingStateToPromotionStatus(state);
  const link = promotionStatus === 'unpublished' ? null : path ?? null;
  const normalizedRemoteId = promotionStatus === 'unpublished' ? null : remoteId ?? null;

  await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).set(
    {
      promotions: {
        imobiliare: {
          status: promotionStatus,
          lastSync: nowIso(),
          link,
          remoteId: normalizedRemoteId,
          remoteState: state ?? null,
          errorMessage: errorMessage ?? null,
        },
      },
      portalProfiles: {
        imobiliare: {
          customReference,
          lastValidationError: errorMessage ?? null,
        },
      },
    },
    { merge: true }
  );
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

export async function updateAgencyImobiliareSettings(params: {
  agencyId: string;
  acpUrl?: string | null;
  performanceReportEmail?: string | null;
  defaultPromotionSettings?: ImobiliarePromotionSettings | null;
}) {
  const { agencyId, acpUrl, performanceReportEmail, defaultPromotionSettings } = params;
  const integration = await getPrivateIntegration(agencyId);
  if (!integration) {
    throw new Error('Contul imobiliare.ro nu este conectat pentru aceasta agentie.');
  }

  const updated: ImobiliareIntegrationPrivate = {
    ...integration,
    acpUrl: normalizeNullableString(acpUrl),
    performanceReportEmail: normalizeNullableString(performanceReportEmail),
    defaultPromotionSettings: defaultPromotionSettings || null,
    updatedAt: nowIso(),
  };

  await persistPrivateIntegration(agencyId, updated);
  await setPublicStatus(agencyId, {
    acpUrl: updated.acpUrl || null,
    performanceReportEmail: updated.performanceReportEmail || null,
    defaultPromotionSettings: updated.defaultPromotionSettings || null,
    lastError: null,
  });

  return {
    acpUrl: updated.acpUrl || null,
    performanceReportEmail: updated.performanceReportEmail || null,
    defaultPromotionSettings: updated.defaultPromotionSettings || null,
  };
}

export async function syncAgencyImobiliareAgentMappings(params: { agencyId: string }) {
  const { agencyId } = params;
  const integration = await getPrivateIntegration(agencyId);
  if (!integration) {
    throw new Error('Contul imobiliare.ro nu este conectat pentru aceasta agentie.');
  }

  const [localAgents, remoteAgentsPayload] = await Promise.all([
    loadAgencyLocalAgentProfiles(agencyId),
    imobiliareRequest<unknown>(agencyId, '/api/v3/agents?page=1'),
  ]);
  const remoteAgents = extractAgents(remoteAgentsPayload);
  const mappings = buildAgentMappingSummary(localAgents, remoteAgents, integration.agentMappings);
  await persistAgentMappings(agencyId, mappings);
  return {
    totalLocalAgents: localAgents.length,
    totalRemoteAgents: remoteAgents.length,
    mappedAgents: mappings.length,
    mappings,
  };
}

export async function updatePropertyImobiliarePromotionSettings(params: {
  agencyId: string;
  propertyId: string;
  promotionSettings: ImobiliarePromotionSettings | null;
}) {
  const { agencyId, propertyId, promotionSettings } = params;
  const propertyRef = adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId);
  const propertySnapshot = await propertyRef.get();
  if (!propertySnapshot.exists) {
    throw new Error('Proprietatea nu a fost gasita.');
  }

  const property = {
    id: propertySnapshot.id,
    ...propertySnapshot.data(),
  } as Property;

  const normalizedSettings = promotionSettings || null;

  await propertyRef.set(
    {
      portalProfiles: {
        imobiliare: {
          promotionSettings: normalizedSettings,
        },
      },
    },
    { merge: true }
  );

  const currentStatus = property.promotions?.imobiliare?.status;
  if (currentStatus === 'published') {
    const customReference = property.portalProfiles?.imobiliare?.customReference || property.id;
    const mergedProfile: ImobiliarePortalProfile = {
      ...(property.portalProfiles?.imobiliare || {}),
      promotionSettings: normalizedSettings || undefined,
    };
    await applyPromotions(agencyId, customReference, mergedProfile);
    await propertyRef.set(
      {
        promotions: {
          imobiliare: {
            lastSync: nowIso(),
            errorMessage: null,
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
  }

  return {
    promotionSettings: normalizedSettings,
    appliedRemotely: currentStatus === 'published',
  };
}

async function getAgencyImobiliareProperties(agencyId: string) {
  const snapshot = await adminDb.collection('agencies').doc(agencyId).collection('properties').get();
  return snapshot.docs
    .map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() } as Property))
    .filter((property) => Boolean(property.portalProfiles?.imobiliare || property.promotions?.imobiliare));
}

export async function reconcileAgencyImobiliareListings(params: { agencyId: string }) {
  const { agencyId } = params;
  const startedAt = nowIso();
  const properties = await getAgencyImobiliareProperties(agencyId);
  const summary: ImobiliareSyncJobSummary = {
    startedAt,
    finishedAt: startedAt,
    scanned: 0,
    updated: 0,
    published: 0,
    unpublished: 0,
    pending: 0,
    errors: 0,
    failed: 0,
  };

  for (const property of properties) {
    summary.scanned += 1;
    const customReference = property.portalProfiles?.imobiliare?.customReference || property.id;

    try {
      const listing = await getListingByCustomReference(agencyId, customReference);
      const listingData = listing?.data as Record<string, unknown> | undefined;
      const state = typeof listingData?.state === 'string' ? listingData.state : 'draft';
      const path = typeof listingData?.path === 'string' ? listingData.path : null;
      const remoteId = typeof listingData?.id === 'number' ? listingData.id : null;

      await persistPropertyRemoteSnapshot({
        agencyId,
        propertyId: property.id,
        customReference,
        remoteId,
        path,
        state: listing ? state : 'draft',
        errorMessage: null,
      });

      const status = mapRemoteListingStateToPromotionStatus(listing ? state : 'draft');
      summary.updated += 1;
      if (status === 'published') summary.published += 1;
      if (status === 'unpublished') summary.unpublished += 1;
      if (status === 'pending') summary.pending += 1;
      if (status === 'error') summary.errors += 1;
    } catch (error) {
      summary.failed += 1;
      const message = error instanceof Error ? error.message : 'Reconcilerea listingului a esuat.';
      await persistPropertyRemoteSnapshot({
        agencyId,
        propertyId: property.id,
        customReference,
        errorMessage: message,
      });
      summary.errors += 1;
    }
  }

  summary.finishedAt = nowIso();
  await setPublicJobSummary(agencyId, 'lastReconcileSummary', summary);
  return summary;
}

export async function retryAgencyImobiliareSync(params: {
  agencyId: string;
  requestedByUid: string;
  limit?: number;
}) {
  const { agencyId, requestedByUid, limit = 10 } = params;
  const startedAt = nowIso();
  const properties = await getAgencyImobiliareProperties(agencyId);
  const retryCandidates = properties.filter((property) => {
    const status = property.promotions?.imobiliare?.status;
    return status === 'error' || status === 'pending';
  }).slice(0, Math.max(1, limit));

  const summary: ImobiliareSyncJobSummary = {
    startedAt,
    finishedAt: startedAt,
    scanned: retryCandidates.length,
    updated: 0,
    published: 0,
    unpublished: 0,
    pending: 0,
    errors: 0,
    failed: 0,
    retried: 0,
  };

  for (const property of retryCandidates) {
    try {
      const result = await publishPropertyToImobiliare({
        agencyId,
        propertyId: property.id,
        requestedByUid,
      });
      summary.retried = (summary.retried || 0) + 1;
      summary.updated += 1;
      const status = mapRemoteListingStateToPromotionStatus(result.state);
      if (status === 'published') summary.published += 1;
      if (status === 'unpublished') summary.unpublished += 1;
      if (status === 'pending') summary.pending += 1;
      if (status === 'error') summary.errors += 1;
    } catch {
      summary.failed += 1;
      summary.errors += 1;
    }
  }

  summary.finishedAt = nowIso();
  await setPublicJobSummary(agencyId, 'lastRetrySummary', summary);
  return summary;
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
    acpUrl: tempIntegration.acpUrl || null,
    performanceReportEmail: tempIntegration.performanceReportEmail || null,
    defaultPromotionSettings: tempIntegration.defaultPromotionSettings || null,
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
      acpUrl: null,
      performanceReportEmail: null,
      defaultPromotionSettings: null,
      lastReconcileAt: null,
      lastReconcileSummary: null,
      lastRetryAt: null,
      lastRetrySummary: null,
      updatedAt: nowIso(),
    },
    { merge: true }
  );
}

export async function getAgencyImobiliareStatus(agencyId: string) {
  const publicSnapshot = await getPublicDocRef(agencyId).get();
  const privateIntegration = await getPrivateIntegration(agencyId);
  const analytics = await computeAgencyImobiliareAnalytics(agencyId);
  if (!publicSnapshot.exists) {
    return {
      connected: false,
      username: null,
      connectedAt: null,
      lastTokenRefreshAt: null,
      lastError: null,
      remoteAgentCount: 0,
      remoteAccountName: null,
      acpUrl: privateIntegration?.acpUrl || null,
      performanceReportEmail: privateIntegration?.performanceReportEmail || null,
      defaultPromotionSettings: privateIntegration?.defaultPromotionSettings || null,
      lastReconcileAt: null,
      lastReconcileSummary: null,
      lastRetryAt: null,
      lastRetrySummary: null,
      agentMappings: privateIntegration?.agentMappings || null,
      analytics,
    };
  }
  const publicData = publicSnapshot.data() as PortalIntegrationPublicStatus & { updatedAt?: string };
  return {
    ...publicData,
    acpUrl: publicData.acpUrl ?? privateIntegration?.acpUrl ?? null,
    performanceReportEmail: publicData.performanceReportEmail ?? privateIntegration?.performanceReportEmail ?? null,
    defaultPromotionSettings: publicData.defaultPromotionSettings ?? privateIntegration?.defaultPromotionSettings ?? null,
    lastReconcileAt: publicData.lastReconcileAt ?? null,
    lastReconcileSummary: publicData.lastReconcileSummary ?? null,
    lastRetryAt: publicData.lastRetryAt ?? null,
    lastRetrySummary: publicData.lastRetrySummary ?? null,
    agentMappings: publicData.agentMappings ?? privateIntegration?.agentMappings ?? null,
    analytics: publicData.analytics ?? analytics,
  };
}

export async function resolvePropertyImobiliarePublicUrl(params: {
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
  const remoteIdFromDoc = property.promotions?.imobiliare?.remoteId;
  const title = property.title || '';

  const listing = await getListingByCustomReference(agencyId, customReference).catch(() => null);
  const listingData = listing?.data as Record<string, unknown> | undefined;
  const remoteId =
    typeof listingData?.id === 'number'
      ? listingData.id
      : typeof remoteIdFromDoc === 'number'
        ? remoteIdFromDoc
        : null;
  const path =
    typeof listingData?.path === 'string'
      ? listingData.path
      : property.promotions?.imobiliare?.link || null;

  if (typeof remoteId === 'number' && Number.isFinite(remoteId)) {
    return {
      url: `${IMOBILIARE_BASE_URL}/oferta/${slugifyImobiliareTitle(title)}-${remoteId}`,
      remoteId,
      path: path || null,
    };
  }

  if (typeof path === 'string' && path.includes('/oferta/')) {
    return {
      url: path.startsWith('http://') || path.startsWith('https://')
        ? path
        : `${IMOBILIARE_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`,
      remoteId: null,
      path,
    };
  }

  throw new Error('Nu am putut determina linkul public al anuntului din imobiliare.ro.');
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
  let effectiveCategoryApi = categoryApi;
  let effectiveLocationId = locationId;
  let effectivePayload = payload;
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

  let payloadHash = getPayloadHash(payload);
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
      const publishableLocations = getPublishableLocationOptions(await getAvailableImobiliareLocations(agencyId));
      const fallbackLocationIds = [
        await resolveLocationIdForPublish(
          agencyId,
          property,
          withoutExplicitLocation(portalProfile)
        ).catch(() => null),
        ...buildInvalidLocationFallbacks(publishableLocations, property, locationId),
      ].filter((candidate, index, values): candidate is number => {
        return typeof candidate === 'number' && candidate !== locationId && values.indexOf(candidate) === index;
      });

      for (const fallbackLocationId of fallbackLocationIds) {
        const retryPayload = buildListingPayload({
          property,
          portalProfile,
          remoteAgentId,
          categoryApi,
          locationId: fallbackLocationId,
        });

        try {
          await persistPublishAudit({
            agencyId,
            propertyId,
            entry: {
              attemptedAt: nowIso(),
              stage: 'attempt',
              request: retryPayload,
              categoryApi,
              locationId: fallbackLocationId,
              remoteAgentId,
            },
          });

          listingResponse = await upsertListing(agencyId, retryPayload);
          effectiveLocationId = fallbackLocationId;
          effectivePayload = retryPayload;
          payloadHash = getPayloadHash(retryPayload);
          console.info('[imobiliare] publish retry alternate location_id', {
            ...auditLog,
            originalLocationId: locationId,
            fallbackLocationId,
          });
          break;
        } catch {
          // Continue trying alternative locations before using the generic branches below.
        }
      }

      if (!listingResponse) {
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
        effectiveCategoryApi = retryCategoryApi;
        effectivePayload = retryPayload;
        payloadHash = getPayloadHash(retryPayload);
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
            locationId: effectiveLocationId,
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
        categoryApi: effectiveCategoryApi,
        locationId: effectiveLocationId,
        remoteAgentId,
      },
    });
    await persistPublishAudit({
      agencyId,
      propertyId,
      entry: {
        attemptedAt: nowIso(),
        stage: 'error',
        request: effectivePayload,
        categoryApi: effectiveCategoryApi,
        locationId: effectiveLocationId,
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
      categoryApi: effectiveCategoryApi,
      locationId: effectiveLocationId,
      remoteAgentId,
    },
  });
  await persistPublishAudit({
    agencyId,
    propertyId,
    entry: {
      attemptedAt: nowIso(),
      stage: 'success',
      request: effectivePayload,
      categoryApi: effectiveCategoryApi,
      locationId: effectiveLocationId,
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
