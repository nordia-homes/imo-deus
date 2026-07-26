import { describe, expect, it } from 'vitest';

import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';
import { getOwnerListingCanonicalIdentity } from '@/lib/owner-listings/canonical-identity';
import { buildSummary, getOwnerListingMissingFields } from '@/lib/owner-listings/utils';

describe('owner-listing phone isolation policy', () => {
  it('normalizes valid Romanian formats and rejects placeholders', () => {
    expect(normalizeRomanianPhone('+40 723 456 789')).toBe('0723456789');
    expect(normalizeRomanianPhone('0040 723 456 789')).toBe('0723456789');
    expect(normalizeRomanianPhone('723456789')).toBe('0723456789');
    expect(normalizeRomanianPhone('0000000000')).toBe('');
    expect(normalizeRomanianPhone('1234567890')).toBe('');
  });

  it('does not include a global phone in newly built listing summaries', () => {
    const listing = buildSummary({
      source: 'publi24',
      externalId: 'test',
      title: 'Apartament direct proprietar',
      price: '100000 EUR',
      link: 'https://www.publi24.ro/anunturi/test.html',
      area: '50 mp',
      location: 'Bucuresti',
      postedAt: 1,
      ownerPhone: '0723456789',
    });

    expect(listing.ownerPhone).toBeUndefined();
    expect(getOwnerListingMissingFields(listing)).not.toContain('ownerPhone');
  });

  it('never uses a phone as the global canonical identity', () => {
    expect(
      getOwnerListingCanonicalIdentity({
        ownerPhone: '0723456789',
        dedupeSignature: 'content-signature',
      })
    ).toBe('content:content-signature');
  });
});
