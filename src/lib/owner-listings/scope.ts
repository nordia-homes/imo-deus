import { locations, type City } from '@/lib/locations';
import type { Agency } from '@/lib/types';
import type { OwnerListingPropertyType, OwnerListingTransactionType } from '@/lib/owner-listings/types';

export type OwnerListingUrlKind = 'coverage' | 'fresh-radar';

export type OwnerListingSourceUrl = {
  url: string;
  kind: OwnerListingUrlKind;
  propertyType?: OwnerListingPropertyType;
  transactionType?: OwnerListingTransactionType;
  label: string;
};

export type OwnerListingScope = {
  key: string;
  cityKey: City;
  displayName: string;
  defaultCityKeys: City[];
  searchKeywords: string[];
  olxFreshRadarUrls: string[];
  publi24FreshRadarUrls: string[];
  olxSearchUrls: string[];
  publi24SearchUrls: string[];
  imoradar24SearchUrls: string[];
  olxSourceUrls: OwnerListingSourceUrl[];
  publi24SourceUrls: OwnerListingSourceUrl[];
  imoradar24SourceUrls: OwnerListingSourceUrl[];
};

type CityConfig = {
  key: string;
  cityKey: City;
  displayName: string;
  keywords: string[];
  olxSlug: string;
  publi24LocationPath: string;
  imoradarSlug: string;
  includeIlfovVariants?: boolean;
};

const TARGET_CITY_CONFIGS: CityConfig[] = [
  {
    key: 'bucuresti-ilfov',
    cityKey: 'Bucuresti-Ilfov',
    displayName: 'Bucuresti-Ilfov',
    keywords: [
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
    olxSlug: 'bucuresti-ilfov-judet',
    publi24LocationPath: 'bucuresti',
    imoradarSlug: 'bucuresti',
    includeIlfovVariants: true,
  },
  {
    key: 'cluj-napoca',
    cityKey: 'Cluj-Napoca',
    displayName: 'Cluj-Napoca',
    keywords: ['cluj', 'cluj-napoca', 'floresti', 'baciu', 'apahida', 'gilau'],
    olxSlug: 'cluj-napoca',
    publi24LocationPath: 'cluj/cluj-napoca',
    imoradarSlug: 'judetul-cluj/cluj-napoca',
  },
  {
    key: 'timisoara',
    cityKey: 'Timisoara',
    displayName: 'Timisoara',
    keywords: ['timisoara', 'giroc', 'dumbravita', 'ghiroda', 'mosnita'],
    olxSlug: 'timisoara',
    publi24LocationPath: 'timis/timisoara',
    imoradarSlug: 'judetul-timis/timisoara',
  },
  {
    key: 'brasov',
    cityKey: 'Brasov',
    displayName: 'Brasov',
    keywords: ['brasov', 'sanpetru', 'sacele'],
    olxSlug: 'brasov',
    publi24LocationPath: 'brasov/brasov',
    imoradarSlug: 'judetul-brasov/brasov',
  },
  {
    key: 'iasi',
    cityKey: 'Iasi',
    displayName: 'Iasi',
    keywords: ['iasi', 'miroslava', 'valea lupului', 'rediu', 'barnova'],
    olxSlug: 'iasi-judet',
    publi24LocationPath: 'iasi/iasi',
    imoradarSlug: 'judetul-iasi/iasi',
  },
  {
    key: 'constanta',
    cityKey: 'Constanta',
    displayName: 'Constanta',
    keywords: ['constanta', 'mamaia', 'navodari', 'ovidiu', 'eforie'],
    olxSlug: 'constanta',
    publi24LocationPath: 'constanta/constanta',
    imoradarSlug: 'judetul-constanta/constanta',
  },
  {
    key: 'oradea',
    cityKey: 'Oradea',
    displayName: 'Oradea',
    keywords: ['oradea', 'santandrei', 'sanmartin'],
    olxSlug: 'oradea',
    publi24LocationPath: 'bihor/oradea',
    imoradarSlug: 'judetul-bihor/oradea',
  },
  {
    key: 'arad',
    cityKey: 'Arad',
    displayName: 'Arad',
    keywords: ['arad'],
    olxSlug: 'arad',
    publi24LocationPath: 'arad/arad',
    imoradarSlug: 'judetul-arad/arad',
  },
  {
    key: 'craiova',
    cityKey: 'Craiova',
    displayName: 'Craiova',
    keywords: ['craiova'],
    olxSlug: 'craiova',
    publi24LocationPath: 'dolj/craiova',
    imoradarSlug: 'judetul-dolj/craiova',
  },
  {
    key: 'galati',
    cityKey: 'Galati',
    displayName: 'Galati',
    keywords: ['galati', 'galati'],
    olxSlug: 'galati',
    publi24LocationPath: 'galati/galati',
    imoradarSlug: 'judetul-galati/galati',
  },
  {
    key: 'braila',
    cityKey: 'Braila',
    displayName: 'Braila',
    keywords: ['braila'],
    olxSlug: 'braila',
    publi24LocationPath: 'braila/braila',
    imoradarSlug: 'judetul-braila/braila',
  },
  {
    key: 'buzau',
    cityKey: 'Buzau',
    displayName: 'Buzau',
    keywords: ['buzau'],
    olxSlug: 'buzau',
    publi24LocationPath: 'buzau/buzau',
    imoradarSlug: 'judetul-buzau/buzau',
  },
  {
    key: 'ploiesti',
    cityKey: 'Ploiesti',
    displayName: 'Ploiesti',
    keywords: ['ploiesti'],
    olxSlug: 'ploiesti',
    publi24LocationPath: 'prahova/ploiesti',
    imoradarSlug: 'judetul-prahova/ploiesti',
  },
  {
    key: 'alba-iulia',
    cityKey: 'Alba Iulia',
    displayName: 'Alba Iulia',
    keywords: ['alba iulia', 'alba-iulia'],
    olxSlug: 'alba-iulia',
    publi24LocationPath: 'alba/alba-iulia',
    imoradarSlug: 'judetul-alba/alba-iulia',
  },
  {
    key: 'baia-mare',
    cityKey: 'Baia Mare',
    displayName: 'Baia Mare',
    keywords: ['baia mare', 'baia-mare'],
    olxSlug: 'baia-mare',
    publi24LocationPath: 'maramures/baia-mare',
    imoradarSlug: 'judetul-maramures/baia-mare',
  },
];

const CATEGORY_MATRIX: Array<{
  propertyType: OwnerListingPropertyType;
  transactionType: OwnerListingTransactionType;
  label: string;
  olxPath: string;
  publi24Path: string;
  imoradarPath: string;
}> = [
  {
    propertyType: 'apartment',
    transactionType: 'sale',
    label: 'apartamente de vanzare',
    olxPath: 'apartamente-garsoniere-de-vanzare',
    publi24Path: 'de-vanzare/apartamente',
    imoradarPath: 'apartamente-de-vanzare',
  },
  {
    propertyType: 'apartment',
    transactionType: 'rent',
    label: 'apartamente de inchiriat',
    olxPath: 'apartamente-garsoniere-de-inchiriat',
    publi24Path: 'de-inchiriat/apartamente',
    imoradarPath: 'apartamente-de-inchiriat',
  },
  {
    propertyType: 'house',
    transactionType: 'sale',
    label: 'case de vanzare',
    olxPath: 'case-de-vanzare',
    publi24Path: 'de-vanzare/case',
    imoradarPath: 'case-de-vanzare',
  },
  {
    propertyType: 'house',
    transactionType: 'rent',
    label: 'case de inchiriat',
    olxPath: 'case-de-inchiriat',
    publi24Path: 'de-inchiriat/case',
    imoradarPath: 'case-de-inchiriat',
  },
  {
    propertyType: 'land',
    transactionType: 'sale',
    label: 'terenuri de vanzare',
    olxPath: 'terenuri',
    publi24Path: 'de-vanzare/terenuri',
    imoradarPath: 'terenuri-de-vanzare',
  },
  {
    propertyType: 'commercial',
    transactionType: 'sale',
    label: 'spatii comerciale de vanzare',
    olxPath: 'spatii-comerciale-de-vanzare',
    publi24Path: 'de-vanzare/spatii-comerciale',
    imoradarPath: 'spatii-comerciale-de-vanzare',
  },
  {
    propertyType: 'commercial',
    transactionType: 'rent',
    label: 'spatii comerciale de inchiriat',
    olxPath: 'spatii-comerciale-de-inchiriat',
    publi24Path: 'de-inchiriat/spatii-comerciale',
    imoradarPath: 'spatii-comerciale-de-inchiriat',
  },
];

function normalizeText(value?: string | null) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function olxCoverageUrl(citySlug: string, categoryPath: string) {
  return `https://www.olx.ro/imobiliare/${categoryPath}/${citySlug}/?currency=EUR&search%5Bprivate_business%5D=private&search%5Border%5D=created_at:desc`;
}

function publi24CoverageUrl(locationPath: string, categoryPath: string) {
  return `https://www.publi24.ro/anunturi/imobiliare/${categoryPath}/${locationPath}/?commercial=false`;
}

function imoradarCoverageUrl(citySlug: string, categoryPath: string) {
  return `https://www.imoradar24.ro/${categoryPath}/${citySlug}/proprietar?sort=latest`;
}

function olxFreshRadarUrl(citySlug: string) {
  return `https://www.olx.ro/imobiliare/${citySlug}/?currency=EUR&search%5Bprivate_business%5D=private&search%5Border%5D=created_at:desc`;
}

function publi24FreshRadarUrl(locationPath: string) {
  return `https://www.publi24.ro/anunturi/imobiliare/${locationPath}/?commercial=false`;
}

function buildCoverageUrls(
  config: CityConfig,
  source: 'olx' | 'publi24' | 'imoradar24'
): OwnerListingSourceUrl[] {
  const citySlugs =
    config.includeIlfovVariants && source === 'imoradar24'
      ? [config.imoradarSlug, 'judetul-ilfov']
      : [source === 'olx' ? config.olxSlug : source === 'publi24' ? config.publi24LocationPath : config.imoradarSlug];

  return citySlugs.flatMap((citySlug) =>
    CATEGORY_MATRIX.map((category) => ({
      label: `${config.displayName} - ${category.label}`,
      kind: 'coverage' as const,
      propertyType: category.propertyType,
      transactionType: category.transactionType,
      url:
        source === 'olx'
          ? olxCoverageUrl(citySlug, category.olxPath)
          : source === 'publi24'
            ? publi24CoverageUrl(citySlug, category.publi24Path)
            : imoradarCoverageUrl(citySlug, category.imoradarPath),
    }))
  );
}

function buildScope(config: CityConfig): OwnerListingScope {
  const olxCoverageUrls = buildCoverageUrls(config, 'olx');
  const publi24CoverageUrls = buildCoverageUrls(config, 'publi24');
  const imoradar24CoverageUrls = buildCoverageUrls(config, 'imoradar24');
  const olxFreshRadarUrls = [olxFreshRadarUrl(config.olxSlug)];
  const publi24FreshRadarUrls = [publi24FreshRadarUrl(config.publi24LocationPath)];

  return {
    key: config.key,
    cityKey: config.cityKey,
    displayName: config.displayName,
    defaultCityKeys: [config.cityKey],
    searchKeywords: Array.from(new Set([config.displayName, config.key, ...config.keywords].map(normalizeText).filter(Boolean))),
    olxFreshRadarUrls,
    publi24FreshRadarUrls,
    olxSearchUrls: olxCoverageUrls.map((entry) => entry.url),
    publi24SearchUrls: publi24CoverageUrls.map((entry) => entry.url),
    imoradar24SearchUrls: imoradar24CoverageUrls.map((entry) => entry.url),
    olxSourceUrls: [
      ...olxFreshRadarUrls.map((url) => ({ url, kind: 'fresh-radar' as const, label: `${config.displayName} - radar OLX` })),
      ...olxCoverageUrls,
    ],
    publi24SourceUrls: [
      ...publi24FreshRadarUrls.map((url) => ({
        url,
        kind: 'fresh-radar' as const,
        label: `${config.displayName} - radar Publi24`,
      })),
      ...publi24CoverageUrls,
    ],
    imoradar24SourceUrls: imoradar24CoverageUrls,
  };
}

const OWNER_LISTING_SCOPE_REGISTRY: OwnerListingScope[] = TARGET_CITY_CONFIGS.map(buildScope);

export function listOwnerListingScopes() {
  return OWNER_LISTING_SCOPE_REGISTRY.map((scope) => ({ ...scope }));
}

export function getOwnerListingScope(scopeKey: string) {
  return OWNER_LISTING_SCOPE_REGISTRY.find((scope) => scope.key === scopeKey) || null;
}

export function getOwnerListingScopeKeys() {
  return OWNER_LISTING_SCOPE_REGISTRY.map((scope) => scope.key);
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
