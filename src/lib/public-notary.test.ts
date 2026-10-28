import { describe, expect, it } from 'vitest';
import { calculatePublicNotaryFees, splitNotaryCosts, type NotaryInputs } from './public-notary';

const base: NotaryInputs = { price: 100000, currency: 'ron', exchangeRate: 5, ownershipDuration: 'over3', buyerType: 'individual', sellerType: 'individual', mortgage: false, mortgageValue: 0, mortgageCurrency: 'ron' };
describe('public notary calculator — source tariff compatibility', () => {
  it('assigns authentication to the seller without counting costs twice', () => {
    for (const mortgage of [false, true]) {
      const fees = calculatePublicNotaryFees({ ...base, mortgage, mortgageValue: 50000 });
      const split = splitNotaryCosts(fees);
      expect(split.sellerTotal).toBe(1040);
      expect(split.buyerTotal).toBe(mortgage ? 2865 : 2209);
      expect(split.buyerTotal + split.sellerTotal).toBe(fees.totalFees);
    }
  });
  it('matches the source sale breakdown', () => {
    expect(calculatePublicNotaryFees(base)).toEqual({ notaryFee: 2059, ancpiFee: 150, saleTax: 1000, authenticationFee: 40, mortgageNotaryFee: 0, mortgageAncpiFee: 0, totalFees: 3249 });
  });
  it('preserves the source discontinuity above 100,000 lei', () => {
    expect(calculatePublicNotaryFees({ ...base, price: 100001 }).notaryFee).toBe(2029);
  });
  it('applies minimum fees and rounds upward', () => {
    expect(calculatePublicNotaryFees({ ...base, price: 1 }).totalFees).toBe(375);
  });
  it('uses the selected exchange rate for both property and mortgage', () => {
    expect(calculatePublicNotaryFees({ ...base, price: 20000, currency: 'eur', mortgage: true, mortgageValue: 10000, mortgageCurrency: 'eur' }))
      .toEqual({ notaryFee: 2059, ancpiFee: 150, saleTax: 1000, authenticationFee: 40, mortgageNotaryFee: 506, mortgageAncpiFee: 150, totalFees: 3905 });
  });
  it('handles corporate buyer and seller and short ownership', () => {
    expect(calculatePublicNotaryFees({ ...base, buyerType: 'company', sellerType: 'company' }).totalFees).toBe(2599);
    expect(calculatePublicNotaryFees({ ...base, ownershipDuration: 'under3' }).saleTax).toBe(3000);
  });
  it('does not charge a mortgage when disabled and rejects invalid prices', () => {
    expect(calculatePublicNotaryFees({ ...base, mortgageValue: 500000 }).mortgageNotaryFee).toBe(0);
    for (const price of [0, -1, NaN, Infinity]) expect(() => calculatePublicNotaryFees({ ...base, price })).toThrow();
  });
});
