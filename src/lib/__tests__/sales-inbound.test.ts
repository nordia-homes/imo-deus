import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { SaleTransaction } from '@/lib/types';

vi.mock('server-only', () => ({}));

let helpers: typeof import('@/lib/sales-inbound');

beforeAll(async () => {
  helpers = await import('@/lib/sales-inbound');
});

function saleFixture(): SaleTransaction {
  return {
    id: 'sale-1',
    agencyId: 'agency-1',
    trackingCode: 'IMD-VABC1234',
    propertyId: 'property-1',
    propertyTitle: 'Apartament test',
    propertyAddress: 'Strada Test 1',
    agentId: 'agent-1',
    agentName: 'Agent Test',
    stage: 'documents',
    participants: [],
    checklist: [{ id: 'fiscal', label: 'Certificat fiscal', participantRole: 'owner', status: 'requested', required: true }],
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-01T10:00:00.000Z',
  };
}

describe('sales inbound email helpers', () => {
  it('extracts the private forwarding token and transaction code', () => {
    expect(helpers.extractInboundToken('Imodeus <inbox+abcDEF_123456789@reply.imodeus.ro>')).toBe('abcDEF_123456789');
    expect(helpers.extractSaleTrackingCode('Re: Acte [imd-vabc1234]')).toBe('IMD-VABC1234');
  });

  it('keeps only the new reply and removes quoted Gmail content', () => {
    const result = helpers.stripQuotedReply('Da, confirm data.\n\nOn Tue, Agent wrote:\n> Mesajul anterior');
    expect(result).toBe('Da, confirm data.');
  });

  it('maps numbered replies to tracked questions', () => {
    const questions = [
      { id: 'q1', text: 'Cash sau credit?', required: true, status: 'pending' as const },
      { id: 'q2', text: 'Confirmați data?', required: true, status: 'pending' as const },
    ];
    const result = helpers.mapAnswersToQuestions(questions, '1. Credit\n2) Da, confirm');
    expect(result.map((item) => item.status)).toEqual(['answered', 'answered']);
    expect(result.map((item) => item.answer)).toEqual(['Credit', 'Da, confirm']);
  });

  it('classifies common Romanian real-estate documents', () => {
    expect(helpers.classifyDocumentName('certificat_fiscal_2026.pdf')).toBe('Certificat fiscal');
    expect(helpers.classifyDocumentName('extras-cf-actualizat.pdf')).toBe('Extras de carte funciară');
  });

  it('updates an expected checklist item and preserves the sender role', () => {
    const result = helpers.mergeReceivedDocuments(saleFixture(), [{ fileName: 'certificat-fiscal.pdf', downloadUrl: 'https://files.test/fiscal', receivedAt: '2026-08-02T10:00:00.000Z' }], 'owner');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ status: 'received_needs_review', participantRole: 'owner', fileName: 'certificat-fiscal.pdf' });
  });

  it('adds an unexpected document to the correct participant', () => {
    const result = helpers.mergeReceivedDocuments(saleFixture(), [{ fileName: 'preaprobare-banca.pdf', downloadUrl: 'https://files.test/bank', receivedAt: '2026-08-02T10:00:00.000Z' }], 'buyer');
    expect(result.at(-1)).toMatchObject({ label: 'Document bancar', participantRole: 'buyer', required: false, status: 'received_needs_review' });
  });
});
