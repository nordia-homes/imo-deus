import { describe, expect, it } from 'vitest';
import type { Property } from '@/lib/types';
import { isCompletePropertyRecord } from '@/lib/property-record';

describe('isCompletePropertyRecord', () => {
  it('accepts a property with the fields required by the properties page', () => {
    const property = {
      id: 'property-1',
      title: 'Apartament test',
      price: 125000,
    } as Property;

    expect(isCompletePropertyRecord(property)).toBe(true);
  });

  it('rejects a Storia mapping-only ghost document', () => {
    const ghostProperty = {
      id: 'property-1',
      promotions: { storia: { remoteAdId: 10311156 } },
      portalProfiles: { storia: { remoteAdId: 10311156 } },
    } as unknown as Partial<Property>;

    expect(isCompletePropertyRecord(ghostProperty)).toBe(false);
  });

  it('rejects a property with a non-finite price', () => {
    const property = {
      id: 'property-1',
      title: 'Apartament test',
      price: Number.NaN,
    } as unknown as Partial<Property>;

    expect(isCompletePropertyRecord(property)).toBe(false);
  });
});
