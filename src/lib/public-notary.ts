// Matches notar-bucuresti.ro/calculator-taxe-notariale-vanzare (28 October 2026).
// Keep the source's thresholds, bases, 19% VAT and upward rounding intact.
export type NotaryInputs = {
  price: number;
  currency: 'eur' | 'ron';
  exchangeRate: number;
  ownershipDuration: 'under3' | 'over3';
  buyerType: 'individual' | 'company';
  sellerType: 'individual' | 'company';
  mortgage: boolean;
  mortgageValue: number;
  mortgageCurrency: 'eur' | 'ron';
};

export function splitNotaryCosts(fees: ReturnType<typeof calculatePublicNotaryFees>) {
  return { buyerTotal: fees.notaryFee + fees.ancpiFee + fees.mortgageNotaryFee + fees.mortgageAncpiFee, sellerTotal: fees.saleTax + fees.authenticationFee };
}

export function calculatePublicNotaryFees(input: NotaryInputs) {
  if (!Number.isFinite(input.price) || input.price <= 0 || !Number.isFinite(input.exchangeRate) || input.exchangeRate <= 0) {
    throw new Error('Introduceți un preț și un curs valutar valide.');
  }
  const price = input.price * (input.currency === 'eur' ? input.exchangeRate : 1);
  const mortgageValue = input.mortgageValue * (input.mortgageCurrency === 'eur' ? input.exchangeRate : 1);
  let notaryFee: number;
  if (price <= 20000) notaryFee = Math.max(price * 0.022, 230);
  else if (price <= 35000) notaryFee = 440 + (price - 20000) * 0.019;
  else if (price <= 65000) notaryFee = 725 + (price - 35000) * 0.016;
  else if (price <= 100000) notaryFee = 1205 + (price - 65000) * 0.015;
  else if (price <= 200000) notaryFee = 1705 + (price - 100000) * 0.011;
  else if (price <= 600000) notaryFee = 2805 + (price - 200000) * 0.009;
  else notaryFee = 6405 + (price - 600000) * 0.006;
  notaryFee = Math.ceil(notaryFee * 1.19);
  const ancpiFee = Math.max(Math.ceil(price * (input.buyerType === 'individual' ? 0.0015 : 0.005)), 60);
  let mortgageNotaryFee = 0;
  let mortgageAncpiFee = 0;
  if (input.mortgage && Number.isFinite(mortgageValue) && mortgageValue > 0) {
    if (mortgageValue <= 50000) mortgageNotaryFee = Math.max(mortgageValue * 0.0085, 150);
    else if (mortgageValue <= 100000) mortgageNotaryFee = 425 + (mortgageValue - 50000) * 0.005;
    else if (mortgageValue <= 200000) mortgageNotaryFee = 750 + (mortgageValue - 100000) * 0.0046;
    else if (mortgageValue <= 500000) mortgageNotaryFee = 1209 + (mortgageValue - 200000) * 0.0019;
    else mortgageNotaryFee = 1778 + (mortgageValue - 500000) * 0.001;
    mortgageNotaryFee = Math.ceil(mortgageNotaryFee * 1.19);
    mortgageAncpiFee = Math.ceil(mortgageValue * 0.001) + 100;
  }
  const saleTax = input.sellerType === 'individual' ? Math.ceil(price * (input.ownershipDuration === 'under3' ? 0.03 : 0.01)) : 0;
  const authenticationFee = 40;
  return { notaryFee, ancpiFee, mortgageNotaryFee, mortgageAncpiFee, saleTax, authenticationFee,
    totalFees: notaryFee + ancpiFee + mortgageNotaryFee + mortgageAncpiFee + saleTax + authenticationFee };
}
