import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ access: vi.fn(), principal: vi.fn(), message: {} as any, sale: {} as any, member: {} as any, writes: [] as any[] }));
vi.mock('@/lib/sales-server', () => ({ requireSaleAccess: mocks.access, appendSalesAudit: () => ({ ref: { path: 'audit' }, data: { summary: 'Handoff' } }), SalesApiError: class extends Error { constructor(message: string, public status: number) { super(message); } }, salesApiErrorResponse: (error: any) => ({ status: error.status || 500, message: error.message }) }));
vi.mock('@/lib/ai-assistant/principal', () => ({ assistantPrincipal: mocks.principal }));
import { PATCH } from '@/app/api/sales/[saleId]/messages/[messageId]/gmail-session/route';
beforeEach(() => {
  vi.clearAllMocks(); mocks.principal.mockResolvedValue(null); mocks.writes = [];
  mocks.member = { agencyId: 'a', role: 'agent' }; mocks.sale = { agentId: 'u' };
  mocks.message = { direction: 'outbound', status: 'prepared', handoffJobId: 'job' };
  const saleRef = { path: 'sale', collection: () => ({ doc: () => ({ path: 'message' }) }) };
  mocks.access.mockResolvedValue({ uid: 'u', agencyId: 'a', role: 'agent', saleRef, adminDb: {
    collection: () => ({ doc: () => ({ path: 'member' }) }),
    runTransaction: async (work: any) => {
      const writes: any[] = [];
      const result = await work({ get: async (ref: any) => { if (writes.length) throw new Error('Read after write'); return { data: () => ref.path === 'member' ? mocks.member : ref.path === 'sale' ? mocks.sale : mocks.message }; }, update: (ref: any, data: any) => writes.push({ path: ref.path, data }), set: (ref: any, data: any) => writes.push({ path: ref.path, data }) });
      mocks.writes.push(...writes); return result;
    },
  } });
});
const call = (state = 'opened_in_gmail', jobId = 'job') => PATCH(new NextRequest('https://crm.example/gmail', { method: 'PATCH', body: JSON.stringify({ state, jobId }) }), { params: Promise.resolve({ saleId: 's', messageId: 'm' }) });
it('records opening as no evidence and audits atomically', async () => {
  expect((await call()).status).toBe(200);
  expect(mocks.writes).toHaveLength(2);
  expect(mocks.writes[0].data).toMatchObject({ status: 'opened_in_gmail', sendEvidence: { level: 'none', source: 'web_fallback' } });
});
it('rejects model/device impersonation, unrelated jobs and revoked membership without writes', async () => {
  mocks.principal.mockResolvedValue({ uid: 'u' }); expect((await call()).status).toBe(403);
  mocks.principal.mockResolvedValue(null); expect((await call('runner_error', 'other')).status).toBe(409);
  mocks.member.agencyId = 'other'; expect((await call()).status).toBe(403);
  expect(mocks.writes).toEqual([]);
});
it('does not downgrade a send confirmation or duplicate opening notifications', async () => {
  mocks.message.status = 'sent_ui_confirmed';
  expect(await (await call('runner_error')).json()).toMatchObject({ status: 'sent_ui_confirmed', changed: false });
  mocks.message.status = 'opened_in_gmail'; expect((await call()).status).toBe(200);
  expect(mocks.writes).toEqual([]);
});
it('records runner failure without claiming the email was unsent or delivered', async () => {
  expect((await call('runner_error')).status).toBe(200);
  expect(mocks.writes[0].data).toMatchObject({ status: 'failed' });
  expect(mocks.writes[0].data).not.toHaveProperty('sentAt');
  expect(mocks.writes[0].data).not.toHaveProperty('sendEvidence');
});
