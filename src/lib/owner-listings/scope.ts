import { locations, type City } from '@/lib/locations';
import type { Agency } from '@/lib/types';

export type OwnerListingScope = {
  key: string;
  cityKey: City;
  displayName: string;
  defaultCityKeys: City[];
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

function agencyCityFromText(value?: string | null): City | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  if (normalized.includes('bucuresti') || normalized.includes('bucharest')) {
    return 'Bucuresti-Ilfov';
  }

  const exactMatch = (Object.keys(locations) as City[]).find((city) => normalizeText(city) === normalized);
  if (exactMatch) {
    return exactMatch;
  }

  const fuzzyMatch = (Object.keys(locations) as City[]).find((city) => {
    const cityNormalized = normalizeText(city);
    return normalized.includes(cityNormalized) || cityNormalized.includes(normalized);
  });

  return fuzzyMatch || null;
}

const OWNER_LISTING_SCOPE_REGISTRY: OwnerListingScope[] = [
  {
    key: 'bucuresti-ilfov',
    cityKey: 'Bucuresti-Ilfov',
    displayName: 'Bucuresti-Ilfov',
    defaultCityKeys: ['Bucuresti-Ilfov'],
    searchKeywords: [
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
    ],
    olxSearchUrls: [
      'https://www.olx.ro/imobiliare/apartamente-garsoniere-de-vanzare/bucuresti-ilfov-judet/?currency=EUR&search%5Bprivate_business%5D=private',
    ],
    publi24SearchUrls: [
      'https://www.publi24.ro/anunturi/imobiliare/de-vanzare/apartamente/bucuresti/?commercial=false',
      'https://www.publi24.ro/anunturi/imobiliare/de-vanzare/apartamente/ilfov/?commercial=false',
    ],
    imoradar24SearchUrls: [
      'https://www.imoradar24.ro/apartamente-de-vanzare/bucuresti/proprietar?location=8608,8276&sort=latest',
    ],
  },
];

export function listOwnerListingScopes() {
  return OWNER_LISTING_SCOPE_REGISTRY.map((scope) => ({ ...scope }));
}

export function getOwnerListingScope(scopeKey: string) {
  return OWNER_LISTING_SCOPE_REGISTRY.find((scope) => scope.key === scopeKey) || null;
}

export function getOwnerListingScopeKeys() {
  return OWNER_LISTING_SCOPE_REGISTRY.map((scope) => scope.key);
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

  return OWNER_LISTING_SCOPE_REGISTRY.find((scope) => scope.defaultCityKeys.includes(cityKey)) || null;
}

export function matchesScopeLocation(scope: OwnerListingScope, text?: string | null) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return scope.searchKeywords.some((keyword) => keyword && normalized.includes(keyword));
}
