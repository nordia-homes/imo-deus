import { describe, expect, it, vi } from 'vitest';
import type { OwnerListingSummary } from '@/lib/owner-listings/types';

vi.mock('@/firebase/admin', () => ({ adminDb: {} }));

import { getOwnerListingEnrichmentTaskTypes } from '@/lib/owner-listings/enrichment-queue';

function listing(
  overrides: Partial<OwnerListingSummary> = {}
): OwnerListingSummary {
  return {
    source: 'publi24',
    sourceLabel: 'Publi24',
    externalId: 'publi24-test',
    title: 'Apartament direct proprietar',
    price: '100000 EUR',
    link: 'https://www.publi24.ro/anunturi/test.html',
    area: '50 mp',
    location: 'Bucuresti',
    postedAt: 1,
    fingerprint: 'publi24-test',
    ownerType: 'owner',
    scrapedAt: 1,
    lastSeenAt: 1,
    publicationStatus: 'ready',
    ...overrides,
  };
}

describe('Publi24 phone enrichment policy', () => {
  it('does not queue phone extraction globally for a ready Publi24 listing', () => {
    expect(getOwnerListingEnrichmentTaskTypes(listing())).toEqual([]);
  });

  it('does not queue a phone job when Publi24 already has a phone', () => {
    expect(
      getOwnerListingEnrichmentTaskTypes(listing({ ownerPhone: '0723456789' }))
    ).toEqual([]);
  });

  it('queues only detail enrichment for newly discovered Publi24 listings', () => {
    expect(
      getOwnerListingEnrichmentTaskTypes(
        listing({ publicationStatus: 'discovered', description: '' })
      )
    ).toEqual(['detail']);
  });

  it('does not change the phone policy for OLX', () => {
    expect(
      getOwnerListingEnrichmentTaskTypes(
        listing({
          source: 'olx',
          sourceLabel: 'OLX',
          link: 'https://www.olx.ro/d/oferta/test.html',
        })
      )
    ).toEqual([]);
  });
});
