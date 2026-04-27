import crypto from 'node:crypto';
import type { OwnerListingDetail, OwnerListingSource, OwnerListingSummary } from '@/lib/owner-listings/types';

const SOURCE_LABELS: Record<OwnerListingSource, string> = {
  olx: 'OLX',
  imoradar24: 'Imoradar24',
  publi24: 'Publi24',
};

function stripDiacritics(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizeWhitespace(value: string | null | undefined) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeUrl(url: string, baseUrl?: string) {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
}

export function sourceLabel(source: OwnerListingSource) {
  return SOURCE_LABELS[source];
}

export function parseNumberFromText(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value).replace(/,/g, '.');
  const match = normalized.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parsePriceNumber(value: string | null | undefined) {
  const normalized = normalizeWhitespace(value).replace(/[^\d]/g, '');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseRooms(value: string | null | undefined) {
  return parseNumberFromText(value);
}

export function parseArea(value: string | null | undefined) {
  return parseNumberFromText(value);
}

export function parseRomanianDateToUnix(value: string | null | undefined) {
  const normalized = stripDiacritics(normalizeWhitespace(value)).toLowerCase();
  if (!normalized) return Math.floor(Date.now() / 1000);

  const now = new Date();
  if (normalized.includes('azi')) {
    return Math.floor(now.getTime() / 1000);
  }

  if (normalized.includes('ieri')) {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return Math.floor(yesterday.getTime() / 1000);
  }

  const monthMap: Record<string, number> = {
    ianuarie: 0,
    februarie: 1,
    martie: 2,
    aprilie: 3,
    mai: 4,
    iunie: 5,
    iulie: 6,
    august: 7,
    septembrie: 8,
    octombrie: 9,
    noiembrie: 10,
    decembrie: 11,
  };

  const explicit = normalized.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
  if (explicit) {
    const day = Number(explicit[1]);
    const month = monthMap[explicit[2]];
    const year = Number(explicit[3]);
    if (Number.isFinite(day) && month !== undefined && Number.isFinite(year)) {
      return Math.floor(new Date(year, month, day).getTime() / 1000);
    }
  }

  const numeric = normalized.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]) - 1;
    const year = Number(numeric[3]);
    if (Number.isFinite(day) && Number.isFinite(month) && Number.isFinite(year)) {
      return Math.floor(new Date(year, month, day).getTime() / 1000);
    }
  }

  return Math.floor(now.getTime() / 1000);
}

export function createListingFingerprint(input: {
  source: OwnerListingSource;
  externalId?: string | null;
  title: string;
  location?: string | null;
  price?: string | null;
  area?: string | null;
}) {
  const seed = [
    input.source,
    normalizeWhitespace(input.externalId),
    normalizeWhitespace(input.title).toLowerCase(),
    normalizeWhitespace(input.location).toLowerCase(),
    normalizeWhitespace(input.price).toLowerCase(),
    normalizeWhitespace(input.area).toLowerCase(),
  ].join('|');

  return crypto.createHash('sha1').update(seed).digest('hex');
}

export function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

export function docIdForListing(listing: Pick<OwnerListingSummary, 'source' | 'externalId' | 'fingerprint'>) {
  const sourceId = normalizeWhitespace(listing.externalId) || listing.fingerprint;
  return `${listing.source}_${sourceId.replace(/[^a-zA-Z0-9_-]+/g, '_')}`;
}

export function isOwnerText(text: string) {
  const normalized = stripDiacritics(normalizeWhitespace(text)).toLowerCase();
  const ownerSignals = [
    'proprietar',
    'direct proprietar',
    'persoana fizica',
    'particular',
    'privat',
    'vanzator privat',
    'fara agentie',
    'fara comision',
  ];
  const rejectSignals = [
    'agentie',
    'agenție',
    'broker',
    'dezvoltator',
    'companie',
    'firma',
    'persoană juridică',
  ];

  const explicitlyWithoutAgency =
    normalized.includes('fara agentie') ||
    normalized.includes('fara agenție') ||
    normalized.includes('fara broker') ||
    normalized.includes('fara comision');

  if (!explicitlyWithoutAgency && rejectSignals.some((signal) => normalized.includes(stripDiacritics(signal)))) {
    return false;
  }

  return ownerSignals.some((signal) => normalized.includes(stripDiacritics(signal)));
}

export function buildSummary(input: Omit<OwnerListingSummary, 'sourceLabel' | 'fingerprint' | 'scrapedAt' | 'lastSeenAt' | 'ownerType'>) {
  const now = Math.floor(Date.now() / 1000);
  const fingerprint = createListingFingerprint({
    source: input.source,
    externalId: input.externalId,
    title: input.title,
    location: input.location,
    price: input.price,
    area: input.area,
  });

  return {
    ...input,
    title: normalizeWhitespace(input.title),
    price: normalizeWhitespace(input.price),
    link: normalizeUrl(input.link),
    area: normalizeWhitespace(input.area),
    location: normalizeWhitespace(input.location),
    description: normalizeWhitespace(input.description),
    sourceLabel: sourceLabel(input.source),
    fingerprint,
    ownerType: 'owner' as const,
    scrapedAt: now,
    lastSeenAt: now,
  } satisfies OwnerListingSummary;
}

export function toPropertySeed(detail: OwnerListingDetail) {
  return {
    title: detail.title,
    price: parsePriceNumber(detail.price) ?? 0,
    description: detail.fullDescription || detail.description || `[Anunt importat de la ${detail.sourceLabel}]`,
    images: detail.images.map((url, index) => ({
      url,
      alt: `${detail.title} ${index + 1}`,
    })),
    rooms: parseRooms(String(detail.rooms ?? '')) ?? 0,
    bathrooms: detail.bathrooms ?? 0,
    squareFootage: parseArea(detail.area) ?? 0,
    address: detail.location,
    location: detail.location,
    constructionYear: detail.constructionYear || detail.year,
    propertyType: detail.propertyType || 'Apartament',
    transactionType: detail.transactionType || 'Vanzare',
    floor: detail.floor || '',
    ownerName: detail.contactName || detail.ownerName || '',
    ownerPhone: detail.contactPhone || detail.ownerPhone || '',
  };
}
