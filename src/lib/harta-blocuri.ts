const HARTA_BLOCURI_MAP_BASE_URL = 'https://map.byteremix.com/maps/7';
const HARTA_BLOCURI_SOURCE_URL = 'https://www.hartablocuri.ro/';
const LOOKUP_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const MAX_GEOJSON_SIZE = 40 * 1024 * 1024;
const MAX_MATCHING_FEATURES = 12;
const MAX_RETURNED_RESULTS = 6;

type HartaBlocuriFeature = {
  geometry?: { coordinates?: unknown };
  properties?: { id?: unknown; title?: unknown; s?: unknown };
};

type HartaBlocuriFeatureCollection = { features?: unknown };
type HartaBlocuriRawDetail = { key?: unknown; value?: unknown };

type HartaBlocuriCandidate = {
  id: number;
  title: string;
  latitude: number;
  longitude: number;
};

export type HartaBlocuriDetail = { label: string; value: string };

export type HartaBlocuriResult = HartaBlocuriCandidate & {
  name: string;
  address: string;
  constructionYear: string;
  exactMatch: boolean;
  details: HartaBlocuriDetail[];
  sourceUrl: string;
};

export class HartaBlocuriLookupError extends Error {
  status: number;

  constructor(message: string, status = 503) {
    super(message);
    this.name = 'HartaBlocuriLookupError';
    this.status = status;
  }
}

type CacheEntry = { expiresAt: number; results: HartaBlocuriResult[] };
const lookupCache = new Map<string, CacheEntry>();

const STREET_PREFIX_PATTERN = /\b(?:str(?:ada)?\.?|bd(?:ul)?\.?|b-dul\.?|bulevard(?:ul)?|sos(?:eaua)?\.?|șos(?:eaua)?\.?|calea|alee(?:a)?\.?|intrarea|dr(?:umul)?\.?|spl(?:aiul)?\.?|piata|piața)\b/i;

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (_entity, code: string) => {
    const normalizedCode = code.toLowerCase();
    if (normalizedCode === 'amp') return '&';
    if (normalizedCode === 'lt') return '<';
    if (normalizedCode === 'gt') return '>';
    if (normalizedCode === 'quot') return '"';
    if (normalizedCode === 'apos') return "'";
    if (normalizedCode === 'nbsp') return ' ';

    const isHex = normalizedCode.startsWith('#x');
    const numericValue = Number.parseInt(normalizedCode.slice(isHex ? 2 : 1), isHex ? 16 : 10);
    if (!Number.isFinite(numericValue) || numericValue <= 0) return '';
    try {
      return String.fromCodePoint(numericValue);
    } catch {
      return '';
    }
  });
}

export function cleanHartaBlocuriText(value: unknown) {
  if (typeof value !== 'string') return '';
  return collapseWhitespace(
    decodeHtmlEntities(
      value
        .replace(/<\s*br\s*\/?>/gi, ' ')
        .replace(/<\s*\/\s*(?:p|div|li)\s*>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
    )
  );
}

function normalizeStreetPrefix(value: string) {
  return value
    .replace(/^str(?:ada)?\.?\s+/i, 'Strada ')
    .replace(/^(?:bd(?:ul)?\.?|b-dul\.?|bulevard(?:ul)?)\s+/i, 'Bulevardul ')
    .replace(/^(?:sos(?:eaua)?\.?|șos(?:eaua)?\.?)\s+/i, 'Șoseaua ')
    .replace(/^alee(?:a)?\.?\s+/i, 'Aleea ')
    .replace(/^dr(?:umul)?\.?\s+/i, 'Drumul ')
    .replace(/^spl(?:aiul)?\.?\s+/i, 'Splaiul ')
    .replace(/^piata\s+/i, 'Piața ');
}

export function normalizeHartaBlocuriAddressInput(input: string) {
  const cleanedInput = collapseWhitespace(input.replace(/[\r\n\t]+/g, ' ')).slice(0, 240);
  if (!cleanedInput) return '';

  const segments = cleanedInput.split(',').map(collapseWhitespace).filter(Boolean);
  const streetSegmentIndex = segments.findIndex((segment) => STREET_PREFIX_PATTERN.test(segment));
  let address = streetSegmentIndex >= 0 ? segments[streetSegmentIndex] : segments[0] || cleanedInput;
  const nextSegment = streetSegmentIndex >= 0 ? segments[streetSegmentIndex + 1] : segments[1];

  if (nextSegment && /^(?:nr|num[aă]r(?:ul)?|no|#)\.?\s*\d/i.test(nextSegment)) {
    address = `${address} ${nextSegment}`;
  }

  address = normalizeStreetPrefix(address)
    .replace(/\b(?:num[aă]r(?:ul)?|no|#|nr)\.?\s*(\d)/i, 'nr. $1')
    .replace(/\s*[,;]+\s*$/, '');

  if (!/\bnr\.\s*\d/i.test(address) && /\s(\d+[a-zA-Z]?(?:[\/-]\d+[a-zA-Z]?)?)\s*$/.test(address)) {
    address = address.replace(/\s(\d+[a-zA-Z]?(?:[\/-]\d+[a-zA-Z]?)?)\s*$/, ' nr. $1');
  }

  return collapseWhitespace(address);
}

function normalizeComparableAddress(value: string) {
  return normalizeStreetPrefix(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(?:numar(?:ul)?|no|#|nr)\.?\s*/g, ' nr ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractStreetNumber(value: string) {
  return normalizeComparableAddress(value).match(/\bnr\s+(\d+[a-z]?(?:[/-]\d+[a-z]?)?)/i)?.[1]?.toLowerCase() || '';
}

function scoreCandidateTitle(title: string, targetStreetNumber: string) {
  if (!targetStreetNumber) return 0;
  const normalizedTitle = normalizeComparableAddress(title).replace(/\s+/g, '');
  if (normalizedTitle === targetStreetNumber) return 100;
  if (normalizedTitle.startsWith(targetStreetNumber)) return 50;
  return 0;
}

export function selectHartaBlocuriCandidates(payload: HartaBlocuriFeatureCollection, query: string): HartaBlocuriCandidate[] {
  if (!Array.isArray(payload.features)) return [];
  const targetStreetNumber = extractStreetNumber(query);
  const candidates = payload.features.flatMap((rawFeature) => {
    const feature = rawFeature as HartaBlocuriFeature;
    const id = Number(feature.properties?.id);
    const coordinates = feature.geometry?.coordinates;

    if (feature.properties?.s !== false || !Number.isSafeInteger(id) || !Array.isArray(coordinates) || coordinates.length < 2) {
      return [];
    }

    const longitude = Number(coordinates[0]);
    const latitude = Number(coordinates[1]);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return [];

    return [{ id, title: cleanHartaBlocuriText(feature.properties?.title), latitude, longitude }];
  });

  return candidates
    .sort((left, right) => scoreCandidateTitle(right.title, targetStreetNumber) - scoreCandidateTitle(left.title, targetStreetNumber))
    .slice(0, MAX_MATCHING_FEATURES);
}

export function parseHartaBlocuriDetails(rawDetails: unknown): HartaBlocuriDetail[] {
  if (!Array.isArray(rawDetails)) return [];
  const seenLabels = new Set<string>();

  return rawDetails.flatMap((rawDetail) => {
    const detail = rawDetail as HartaBlocuriRawDetail;
    const label = cleanHartaBlocuriText(detail.key).replace(/:\s*$/, '');
    const value = cleanHartaBlocuriText(detail.value);
    const normalizedLabel = normalizeComparableAddress(label);
    if (!label || !value || seenLabels.has(normalizedLabel)) return [];
    seenLabels.add(normalizedLabel);
    return [{ label, value }];
  });
}

function findDetail(details: HartaBlocuriDetail[], acceptedLabels: string[]) {
  const normalizedLabels = new Set(acceptedLabels.map(normalizeComparableAddress));
  return details.find((detail) => normalizedLabels.has(normalizeComparableAddress(detail.label)))?.value || '';
}

export function buildHartaBlocuriResult(candidate: HartaBlocuriCandidate, rawDetails: unknown, query: string): HartaBlocuriResult | null {
  const details = parseHartaBlocuriDetails(rawDetails);
  if (details.length === 0) return null;

  const name = findDetail(details, ['Nume', 'Name']) || candidate.title || 'Imobil identificat';
  const address = findDetail(details, ['Adresă', 'Adresa', 'Address']);
  const constructionYear = findDetail(details, ['Anul finalizării', 'Anul finalizarii', 'An construcție', 'An constructie']);

  return {
    ...candidate,
    name,
    address,
    constructionYear,
    exactMatch: !!address && normalizeComparableAddress(address) === normalizeComparableAddress(query),
    details,
    sourceUrl: `${HARTA_BLOCURI_MAP_BASE_URL}?id=${candidate.id}`,
  };
}

async function fetchWithTimeout(url: string, timeoutMs: number, signal?: AbortSignal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromParent = () => controller.abort();
  signal?.addEventListener('abort', abortFromParent, { once: true });
  try {
    return await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'ImoDeus.ai/1.0 (building information lookup)' },
      cache: 'no-store',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromParent);
  }
}

async function fetchCandidates(query: string, signal?: AbortSignal) {
  const url = new URL(`${HARTA_BLOCURI_MAP_BASE_URL}/locations`);
  url.searchParams.set('filters', JSON.stringify({ 'Adresă': { type: 'exact', value: query } }));
  const response = await fetchWithTimeout(url.toString(), 45_000, signal);

  if (!response.ok) {
    throw new HartaBlocuriLookupError(response.status === 429
      ? 'HartaBlocuri.ro a limitat temporar numărul de verificări. Încearcă din nou mai târziu.'
      : 'HartaBlocuri.ro nu a putut fi accesat momentan.');
  }

  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > MAX_GEOJSON_SIZE) {
    throw new HartaBlocuriLookupError('Răspunsul primit de la HartaBlocuri.ro este prea mare pentru a fi procesat.');
  }

  const responseText = await response.text();
  if (responseText.length > MAX_GEOJSON_SIZE) {
    throw new HartaBlocuriLookupError('Răspunsul primit de la HartaBlocuri.ro este prea mare pentru a fi procesat.');
  }

  try {
    return selectHartaBlocuriCandidates(JSON.parse(responseText) as HartaBlocuriFeatureCollection, query);
  } catch {
    throw new HartaBlocuriLookupError('HartaBlocuri.ro a trimis un răspuns care nu poate fi procesat.');
  }
}

async function fetchDetails(candidate: HartaBlocuriCandidate, query: string, signal?: AbortSignal) {
  const response = await fetchWithTimeout(`${HARTA_BLOCURI_MAP_BASE_URL}/locations/${candidate.id}`, 12_000, signal);
  if (!response.ok) return null;
  try {
    return buildHartaBlocuriResult(candidate, await response.json(), query);
  } catch {
    return null;
  }
}

function readCache(cacheKey: string) {
  const cached = lookupCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    lookupCache.delete(cacheKey);
    return null;
  }
  return cached.results;
}

function writeCache(cacheKey: string, results: HartaBlocuriResult[]) {
  if (lookupCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = lookupCache.keys().next().value as string | undefined;
    if (oldestKey) lookupCache.delete(oldestKey);
  }
  lookupCache.set(cacheKey, { expiresAt: Date.now() + LOOKUP_CACHE_TTL_MS, results });
}

export async function lookupHartaBlocuriByAddress(input: string, signal?: AbortSignal) {
  const query = normalizeHartaBlocuriAddressInput(input);
  if (query.length < 5) throw new HartaBlocuriLookupError('Introdu adresa completă a imobilului.', 400);

  const cacheKey = normalizeComparableAddress(query);
  const cached = readCache(cacheKey);
  if (cached) return { query, results: cached, sourceUrl: HARTA_BLOCURI_SOURCE_URL };

  try {
    const candidates = await fetchCandidates(query, signal);
    if (candidates.length === 0) {
      writeCache(cacheKey, []);
      return { query, results: [], sourceUrl: HARTA_BLOCURI_SOURCE_URL };
    }

    const resolvedResults = (await Promise.all(candidates.map((candidate) => fetchDetails(candidate, query, signal))))
      .filter((result): result is HartaBlocuriResult => !!result)
      .sort((left, right) => Number(right.exactMatch) - Number(left.exactMatch));

    if (resolvedResults.length === 0) {
      throw new HartaBlocuriLookupError('Detaliile blocului nu au putut fi preluate de la HartaBlocuri.ro.');
    }

    const exactResults = resolvedResults.filter((result) => result.exactMatch);
    const results = (exactResults.length > 0 ? exactResults : resolvedResults).slice(0, MAX_RETURNED_RESULTS);
    writeCache(cacheKey, results);
    return { query, results, sourceUrl: HARTA_BLOCURI_SOURCE_URL };
  } catch (error) {
    if (error instanceof HartaBlocuriLookupError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new HartaBlocuriLookupError('Verificarea a durat prea mult. Încearcă din nou.', 504);
    }
    throw new HartaBlocuriLookupError('Nu am putut prelua datele de la HartaBlocuri.ro momentan.');
  }
}
