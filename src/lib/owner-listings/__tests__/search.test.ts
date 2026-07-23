import { describe, expect, it } from 'vitest';
import {
  hasOwnerListingRefinementFilters,
  matchesOwnerListingFilters,
  normalizeOwnerListingSearchValue,
} from '@/lib/owner-listings/search';
import type { OwnerListingSummary } from '@/lib/owner-listings/types';

const listing: OwnerListingSummary = {
  source: 'imoradar24',
  sourceLabel: 'Imoradar24',
  originSourceLabel: 'Imobiliare.ro',
  originSourceUrl: 'https://www.imobiliare.ro/oferta/123',
  externalId: '123',
  title: 'Apartament cu 3 camere în Piața Victoriei',
  price: '145.000 €',
  priceValue: 145000,
  link: 'https://www.imoradar24.ro/anunt/123',
  area: '78 mp',
  location: 'București, Sector 1',
  postedAt: 1,
  firstDiscoveredAt: 2,
  rooms: '3',
  roomsValue: 3,
  constructionYear: '1988',
  constructionYearValue: 1988,
  propertyType: 'apartment',
  transactionType: 'sale',
  description: 'Aproape de metrou și parc.',
  ownerPhone: '+40 722 123 456',
  fingerprint: 'fingerprint',
  ownerType: 'owner',
  scrapedAt: 1,
  lastSeenAt: 2,
};

describe('owner listing search', () => {
  it('normalizes Romanian diacritics and whitespace', () => {
    expect(normalizeOwnerListingSearchValue('  Piața   Victoriei  ')).toBe('piata victoriei');
  });

  it('matches every text term across the complete listing search corpus', () => {
    const params = new URLSearchParams({ search: 'apartament victoriei metrou' });
    expect(matchesOwnerListingFilters(listing, params)).toBe(true);
    expect(matchesOwnerListingFilters(listing, new URLSearchParams({ search: 'apartament cluj' }))).toBe(false);
  });

  it('matches phone and price searches independently of formatting', () => {
    expect(matchesOwnerListingFilters(listing, new URLSearchParams({ search: '0722123456' }))).toBe(true);
    expect(matchesOwnerListingFilters(listing, new URLSearchParams({ search: '145000' }))).toBe(true);
  });

  it('applies source and structured filters consistently', () => {
    const matching = new URLSearchParams({
      source: 'imobiliare',
      propertyType: 'apartment',
      transactionType: 'sale',
      rooms: '3',
      constructionYear: '1977-1990',
      priceMin: '140000',
      priceMax: '150000',
    });
    expect(matchesOwnerListingFilters(listing, matching)).toBe(true);

    matching.set('rooms', '2');
    expect(matchesOwnerListingFilters(listing, matching)).toBe(false);
  });

  it('detects only filters that require an exact matching count', () => {
    expect(hasOwnerListingRefinementFilters(new URLSearchParams({ source: 'olx' }))).toBe(false);
    expect(hasOwnerListingRefinementFilters(new URLSearchParams({ search: 'garsoniera' }))).toBe(true);
    expect(hasOwnerListingRefinementFilters(new URLSearchParams({ propertyType: 'all' }))).toBe(false);
    expect(hasOwnerListingRefinementFilters(new URLSearchParams({ priceMax: '100000' }))).toBe(true);
  });
});
