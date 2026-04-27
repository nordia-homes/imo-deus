import { locations, type City } from '@/lib/locations';
import type { Agency } from '@/lib/types';

export type OwnerListingScope = {
  key: string;
  cityKey: City;
  displayName: string;
  searchKeywords: string[];
  olxSearchUrls: string[];
  publi24SearchUrls: string[];
  imoradar24SearchUrls: string[];
};

function normalizeText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function slugify(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function agencyCityFromText(value?: string | null): City | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  if (normalized.includes('bucuresti') || normalized.includes('bucharest')) {
    return 'Bucuresti-Ilfov';
  }

  const match = (Object.keys(locations) as City[]).find((city) => normalizeText(city) === normalized);
  if (match) return match;

  const fuzzy = (Object.keys(locations) as City[]).find((city) => {
    const cityNormalized = normalizeText(city);
    return normalized.includes(cityNormalized) || cityNormalized.includes(normalized);
  });

  return fuzzy || null;
}

export function resolveAgencyOwnerListingScope(agency: Agency | null | undefined): OwnerListingScope | null {
  const cityKey =
    agencyCityFromText(agency?.city) ||
    agencyCityFromText(agency?.address) ||
    agencyCityFromText(agency?.registeredOffice) ||
    null;

  if (!cityKey) {
    return null;
  }

  if (cityKey !== 'Bucuresti-Ilfov') {
    return null;
  }

  const citySlug = slugify(cityKey);
  const searchKeywords = [
    'bucuresti',
    'sector',
    'ilfov',
    'popesti-leordeni',
    'voluntari',
    'otopeni',
    'bragadiru',
    'chiajna',
    'dobroesti',
    'mogosoaia',
    'pantelimon',
    'corbeanca',
    'tunari',
  ];

  const olxSearchUrls = [
    'https://www.olx.ro/imobiliare/apartamente-garsoniere-de-vanzare/bucuresti-ilfov-judet/?currency=EUR&search%5Bprivate_business%5D=private',
  ];

  const publi24SearchUrls = [
    'https://www.publi24.ro/anunturi/imobiliare/de-vanzare/apartamente/bucuresti/?commercial=false',
    'https://www.publi24.ro/anunturi/imobiliare/de-vanzare/apartamente/ilfov/?commercial=false',
  ];

  const imoradar24SearchUrls = [
    'https://www.imoradar24.ro/apartamente-de-vanzare/bucuresti/proprietar?location=8608,8276&sort=latest',
  ];

  return {
    key: citySlug,
    cityKey,
    displayName: cityKey,
    searchKeywords,
    olxSearchUrls,
    publi24SearchUrls,
    imoradar24SearchUrls,
  };
}

export function matchesScopeLocation(scope: OwnerListingScope, text?: string | null) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return scope.searchKeywords.some((keyword) => keyword && normalized.includes(keyword));
}
