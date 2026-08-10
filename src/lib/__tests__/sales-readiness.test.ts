import { describe, expect, it } from 'vitest';
import { calculateContractBalance, createSaleFromProperty, DEFAULT_SALE_DOCUMENTS, getSaleReadiness, getSaleSetupState } from '@/lib/sales';
import type { Property, SaleTransaction } from '@/lib/types';

function fixture(): SaleTransaction {
  return {
    id: 'sale-1', agencyId: 'agency-1', trackingCode: 'IMD-VABC123', propertyId: 'property-1', propertyTitle: 'Apartament', propertyAddress: 'Strada 1', agentId: 'agent-1', agentName: 'Agent', stage: 'preparing', agreedPrice: 120000, financingType: 'cash',
    participants: [{ id: 'buyer', role: 'buyer', name: 'Cumpărător', email: 'buyer@gmail.com' }, { id: 'owner', role: 'owner', name: 'Proprietar', email: 'owner@gmail.com' }],
    checklist: DEFAULT_SALE_DOCUMENTS.map((item, index) => ({ id: String(index), label: item.label, participantRole: item.role, stage: item.stage, status: 'required', required: true })),
    setupStatus: 'ready', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

describe('sales dossier readiness', () => {
  it('calculează automat restul de plată pentru contract', () => {
    expect(calculateContractBalance(72_500, 5_000, 10_000)).toBe(57_500);
    expect(calculateContractBalance(72_500, null, null)).toBe(72_500);
    expect(calculateContractBalance(null, 5_000, 10_000)).toBeNull();
  });
  it('inițializează structura opțională a plăților fără valori inventate', () => {
    const sale = createSaleFromProperty(
      { id: 'property-1', title: 'Apartament', address: 'Strada 1', status: 'Rezervat', price: 120000 } as Property,
      'agency-1',
      { id: 'agent-1', name: 'Agent' }
    );

    expect(sale).toMatchObject({
      agreedPrice: 120000,
      reservationAmount: null,
      precontractAmount: null,
      contractBalanceAmount: null,
    });
  });

  it('accepts a complete dossier before Gmail preparation', () => {
    expect(getSaleReadiness(fixture())).toMatchObject({ ready: true, progress: 100 });
  });

  it('reports actionable participant and transaction gaps', () => {
    const sale = fixture();
    sale.participants[0].email = '';
    sale.agreedPrice = null;
    const result = getSaleReadiness(sale);
    expect(result.ready).toBe(false);
    expect(result.issues.map((issue) => issue.id)).toEqual(expect.arrayContaining(['buyer-email', 'agreed-price']));
  });

  it('keeps the setup warning visible until the wizard is explicitly finalized', () => {
    const sale = fixture();
    sale.setupStatus = 'incomplete';

    expect(getSaleSetupState(sale)).toMatchObject({ ready: true, complete: false, progress: 100 });

    sale.setupStatus = 'ready';
    expect(getSaleSetupState(sale).complete).toBe(true);

    sale.participants[0].email = '';
    expect(getSaleSetupState(sale).complete).toBe(false);
  });
});
