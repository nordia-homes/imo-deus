import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ access: vi.fn(), principal: vi.fn(), commit: vi.fn(), set: vi.fn(), message: {} as any, member: {} as any, sale: {} as any }));
vi.mock('@/lib/sales-server', () => ({ requireSaleAccess: mocks.access, appendSalesAudit: () => ({ ref: {}, data: {} }), SalesApiError: class extends Error { constructor(message: string, public status: number) { super(message); } }, salesApiErrorResponse: (error: any) => ({ status: error.status || 500, message: error.message }) }));
vi.mock('@/lib/ai-assistant/principal', () => ({ assistantPrincipal: mocks.principal }));
import { PATCH } from '@/app/api/sales/[saleId]/messages/[messageId]/send-evidence/route';
const call = (level = 'ui_observed', jobId = 'job') => PATCH(new NextRequest('https://crm.example/evidence', { method: 'PATCH', body: JSON.stringify({ level, diagnostics: { jobId } }) }), { params: Promise.resolve({ saleId: 's', messageId: 'm' }) });
beforeEach(() => {
  vi.clearAllMocks(); mocks.principal.mockResolvedValue(null);
  mocks.message = { direction: 'outbound', handoffJobId: 'job' };
  mocks.member = { agencyId: 'a', role: 'agent' }; mocks.sale = { agentId: 'u' };
  const messageRef = { path: 'message' }, saleRef = { path: 'sale', collection: () => ({ doc: () => messageRef }) };
  mocks.access.mockResolvedValue({ uid: 'u', agencyId: 'a', role: 'agent', saleRef, adminDb: {
    collection: () => ({ doc: () => ({ path: 'member' }) }),
    runTransaction: async (work: any) => {
      const writes: any[] = [];
      const result = await work({ get: async (ref: any) => { if (writes.length) throw new Error('Read after write'); return { data: () => ref.path === 'member' ? mocks.member : ref.path === 'sale' ? mocks.sale : mocks.message }; }, set: (...args: any[]) => writes.push(args) });
      writes.forEach(args => mocks.set(...args)); if (writes.length) mocks.commit(); return result;
    },
  } });
});
describe('Gmail evidence origin and correlation', () => {
  it('rejects a model claiming it observed the Gmail UI', async () => {
    mocks.principal.mockResolvedValue({ uid: 'u' });
    expect((await call()).status).toBe(403); expect(mocks.commit).not.toHaveBeenCalled();
  });
  it('rejects a callback from another handoff job', async () => {
    expect((await call('ui_observed', 'other')).status).toBe(409); expect(mocks.commit).not.toHaveBeenCalled();
  });
  it('records human device evidence and keeps manual declaration distinct', async () => {
    expect((await call()).status).toBe(200);
    expect(mocks.set.mock.calls[0][1]).toMatchObject({ status: 'sent_ui_confirmed', sendEvidence: { level: 'ui_observed', source: 'gmail_runner' } });
    mocks.set.mockClear();
    expect((await call('agent_confirmed')).status).toBe(200);
    expect(mocks.set.mock.calls[0][1]).toMatchObject({ status: 'sent_unconfirmed', sendEvidence: { level: 'agent_confirmed', source: 'agent' } });
  });
  it('preserves reply confirmation and stronger device evidence on delayed or repeated requests', async () => {
    mocks.message.status = 'replied'; mocks.message.sendEvidence = { level: 'reply_confirmed', source: 'inbound_reply' };
    expect(await (await call()).json()).toMatchObject({ changed: false, evidence: { level: 'reply_confirmed' } });
    mocks.message.status = 'sent_ui_confirmed'; mocks.message.sendEvidence = { level: 'ui_observed' };
    expect(await (await call('agent_confirmed')).json()).toMatchObject({ changed: false });
    expect(await (await call()).json()).toMatchObject({ changed: false });
    expect(mocks.set).not.toHaveBeenCalled();
  });
  it('revalidates tenant membership and refuses uncorrelated device claims before any writes', async () => {
    mocks.member.agencyId = 'other'; expect((await call()).status).toBe(403);
    mocks.member.agencyId = 'a'; delete mocks.message.handoffJobId;
    expect((await call()).status).toBe(409);
    expect(mocks.set).not.toHaveBeenCalled();
  });
});
