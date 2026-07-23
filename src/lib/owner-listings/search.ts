import type { OwnerListingSummary } from '@/lib/owner-listings/types';
import { parseOptionalNumber } from '@/lib/owner-listings/utils';

export function normalizeOwnerListingSearchValue(value: unknown) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDigits(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}

export function hasOwnerListingRefinementFilters(params: URLSearchParams) {
  return Boolean(
    params.get('search')?.trim()
    || params.get('rooms')
    || (params.get('propertyType') && params.get('propertyType') !== 'all')
    || (params.get('transactionType') && params.get('transactionType') !== 'all')
    || (params.get('constructionYear') && params.get('constructionYear') !== 'all')
    || params.get('priceMin')
    || params.get('priceMax'),
  );
}

export function matchesOwnerListingFilters(listing: OwnerListingSummary, params: URLSearchParams) {
  const source = params.get('source');
  if (source === 'imobiliare') {
    const origin = normalizeOwnerListingSearchValue(`${listing.originSourceLabel || ''} ${listing.originSourceUrl || ''}`);
    if (!origin.includes('imobiliare')) return false;
  }

  const propertyType = params.get('propertyType');
  if (propertyType && propertyType !== 'all' && listing.propertyType !== propertyType) return false;

  const transactionType = params.get('transactionType');
  if (transactionType && transactionType !== 'all' && listing.transactionType !== transactionType) return false;

  const rooms = parseOptionalNumber(params.get('rooms'));
  if (rooms !== null && parseOptionalNumber(listing.roomsValue ?? listing.rooms) !== rooms) return false;

  const constructionYear = params.get('constructionYear');
  if (constructionYear && constructionYear !== 'all') {
    const year = parseOptionalNumber(listing.constructionYearValue ?? listing.constructionYear ?? listing.year);
    if (year === null) return false;
    if (constructionYear === '1977-1990' && (year < 1977 || year > 1990)) return false;
    if (constructionYear === '1990-2000' && (year < 1990 || year > 2000)) return false;
    if (constructionYear === 'after-2000' && year <= 2000) return false;
  }

  const price = parseOptionalNumber(listing.priceValue ?? listing.price);
  const priceMin = parseOptionalNumber(params.get('priceMin'));
  const priceMax = parseOptionalNumber(params.get('priceMax'));
  if (priceMin !== null && (price === null || price < priceMin)) return false;
  if (priceMax !== null && (price === null || price > priceMax)) return false;

  const search = normalizeOwnerListingSearchValue(params.get('search'));
  if (search) {
    const searchableText = normalizeOwnerListingSearchValue([
      listing.title,
      listing.location,
      listing.ownerPhone,
      listing.price,
      listing.area,
      listing.description,
      listing.sourceLabel,
      listing.originSourceLabel,
    ].join(' '));
    const searchableDigits = normalizeDigits([
      listing.ownerPhone,
      listing.price,
      listing.priceValue,
      listing.area,
    ].join(' '));
    const searchTerms = search.split(' ').filter(Boolean);

    const matchesEveryTerm = searchTerms.every((term) => {
      if (searchableText.includes(term)) return true;
      const digits = normalizeDigits(term);
      return Boolean(digits && searchableDigits.includes(digits));
    });

    if (!matchesEveryTerm) return false;
  }

  return true;
}
