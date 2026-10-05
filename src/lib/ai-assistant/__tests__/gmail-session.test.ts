import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ access: vi.fn(), message: {} as any }));
vi.mock('@/lib/sales-server', () => ({ requireSaleAccess: mocks.access, SalesApiError: class extends Error { constructor(message: string, public status: number) { super(message); } }, salesApiErrorResponse: (error: any) => ({ status: error.status || 500, message: error.message }) }));
import { GET } from '@/app/api/sales/[saleId]/messages/[messageId]/gmail-session/route';
import { saleEmailContentHash } from '@/lib/crm/sale-email-hash';
const call = () => GET(new NextRequest('https://crm.example/api/sales/s/messages/m/gmail-session'), { params: Promise.resolve({ saleId: 's', messageId: 'm' }) });
beforeEach(() => {
  mocks.message = { saleId: 's', direction: 'outbound', status: 'prepared', handoffJobId: 'job', trackingCode: 'IMO', to: ['owner@example.com'], subject: 'Salut', bodyText: 'Mesaj', documentIds: ['doc'], attachmentRefs: [{ documentId: 'doc', downloadUrl: 'https://storage.example/doc.pdf', version: 1 }] };
  const contentHash = saleEmailContentHash(mocks.message);
  const ledgerRef: any = { collection: () => ledgerRef, doc: () => ledgerRef, get: async () => ({ data: () => ({ status: 'completed', action: { kind: 'prepare_sale_email', saleId: 's' }, result: { contentHash } }) }) };
  mocks.access.mockResolvedValue({ agencyId: 'a', adminDb: ledgerRef, saleRef: { collection: () => ({ doc: () => ({ get: async () => ({ data: () => mocks.message }) }) }) }, sale: { checklist: [{ id: 'doc', downloadUrl: 'https://storage.example/doc.pdf', fileName: 'doc.pdf', version: 1 }] } });
});
describe('Gmail session authorization and attachment freshness', () => {
  it('uses only the authorized stored message and dossier document references', async () => {
    const response = await call(), result = await response.json();
    expect(response.status).toBe(200);
    expect(result.session).toMatchObject({ jobId: 'job', saleId: 's', messageRecordId: 'm', attachments: [{ name: 'doc.pdf' }] });
    expect(new URL(result.composeUrl).origin).toBe('https://mail.google.com');
  });
  it('refuses replaced attachments and messages already marked as sent', async () => {
    mocks.message.attachmentRefs[0].version = 0;
    expect((await call()).status).toBe(409);
    mocks.message.status = 'sent_ui_confirmed';
    expect((await call()).status).toBe(409);
  });
  it('propagates revoked dossier access without revealing the email', async () => {
    mocks.access.mockRejectedValueOnce(Object.assign(new Error('Access denied'), { status: 403 }));
    expect((await call()).status).toBe(403);
  });
  it('refuses changed content even when the message remains prepared', async () => {
    mocks.message.to = ['unexpected@example.com'];
    expect((await call()).status).toBe(409);
  });
});
