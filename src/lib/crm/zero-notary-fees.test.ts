import { describe, expect, it } from 'vitest';
import { actionSchema } from '../ai-assistant/contracts';

describe('property zero notary fees offer', () => {
  it('preserves the offer when creating a property', () => {
    const parsed = actionSchema.parse({ kind: 'create_property', property: {
      title: 'Apartament', address: 'București', location: 'București', price: 100000,
      rooms: 2, bathrooms: 1, squareFootage: 50, propertyType: 'Apartament',
      transactionType: 'Vânzare', zeroNotaryFees: true,
    } });
    expect(parsed.kind === 'create_property' && parsed.property.zeroNotaryFees).toBe(true);
  });
  it.each([true, false])('accepts explicitly enabling/disabling the offer: %s', (zeroNotaryFees) => {
    const parsed = actionSchema.parse({ kind: 'update_property', propertyId: 'test', patch: { zeroNotaryFees } });
    expect(parsed.kind === 'update_property' && parsed.patch.zeroNotaryFees).toBe(zeroNotaryFees);
  });
  it('rejects truthy strings rather than accidentally enabling the offer', () => {
    expect(actionSchema.safeParse({ kind: 'update_property', propertyId: 'test', patch: { zeroNotaryFees: 'false' } }).success).toBe(false);
  });
});
