import type { OwnerListing, PropertyTypeFilter, SourceFilterValue } from '@/components/owner-listings/types';

export function extractPrice(priceStr: string): number | null {
  if (!priceStr) return null;
  const match = priceStr.replace(/\s/g, '').match(/[\d.]+/);
  if (!match) return null;
  return Number(match[0].replace(/\./g, ''));
}

export function formatPriceNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

export function extractRoomsValue(rooms: number | string | null | undefined): number | null {
  if (typeof rooms === 'number') {
    return Number.isFinite(rooms) ? rooms : null;
  }

  if (typeof rooms !== 'string') {
    return null;
  }

  const match = rooms.match(/\d+/);
  if (!match) return null;

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatAreaValue(area: string | null | undefined): string | null {
  if (!area) return null;
  const match = area.match(/\d+(?:[.,]\d+)?/);
  if (!match) return null;
  return `${match[0].replace('.', ',')} mp`;
}

export function normalizeText(value?: string | null) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeDigits(value?: string | null) {
  return (value ?? '').replace(/\D/g, '');
}

export function isListingNew(listing: Pick<OwnerListing, 'isNew' | 'newUntilAt'>, referenceUnix = Math.floor(Date.now() / 1000)) {
  if (!listing.isNew) {
    return false;
  }

  if (typeof listing.newUntilAt !== 'number') {
    return true;
  }

  return listing.newUntilAt > referenceUnix;
}

export function matchesPropertyType(listing: OwnerListing, propertyTypeFilter: PropertyTypeFilter) {
  const listingType = normalizeText(listing.propertyType);
  const listingText = normalizeText(`${listing.title || ''} ${listing.description || ''}`);
  const searchableText = `${listingType} ${listingText}`;

  switch (propertyTypeFilter) {
    case 'apartamente':
      return searchableText.includes('apartament') || searchableText.includes('garsoniera') || searchableText.includes('studio');
    case 'case':
      return searchableText.includes('casa') || searchableText.includes('vila') || searchableText.includes('duplex') || searchableText.includes('triplex');
    case 'terenuri':
      return searchableText.includes('teren');
    case 'spatii-comerciale':
      return searchableText.includes('spatiu comercial') || searchableText.includes('spatii comerciale') || searchableText.includes('birou') || searchableText.includes('hala') || searchableText.includes('magazin');
    default:
      return true;
  }
}

export function matchesSourceFilter(listing: OwnerListing, sourceFilter: SourceFilterValue | null) {
  if (!sourceFilter) {
    return true;
  }

  if (sourceFilter === 'imobiliare') {
    return normalizeText(listing.originSourceLabel) === 'imobiliare.ro';
  }

  return listing.source === sourceFilter;
}
