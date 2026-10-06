import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ access: vi.fn(), sale: {} as any, member: {} as any, writes: [] as any[] }));
vi.mock('@/lib/sales-server', () => ({ requireSaleAccess: mocks.access, appendSalesAudit: () => ({ ref: { path: 'audit' }, data: { action: 'sale.replies_read' } }), SalesApiError: class extends Error { constructor(message: string, public status: number) { super(message); } }, salesApiErrorResponse: (error: any) => ({ status: error.status || 500, message: error.message }) }));
import { POST } from '@/app/api/sales/[saleId]/read/route';
const revision = '2026-10-06T10:00:00.000Z';
beforeEach(() => {
  vi.clearAllMocks(); mocks.writes = [];
  mocks.member = { agencyId: 'a', role: 'agent' };
  mocks.sale = { agentId: 'u', unreadReplyCount: 2, updatedAt: revision };
  mocks.access.mockResolvedValue({ uid: 'u', agencyId: 'a', role: 'agent', saleRef: { path: 'sale' }, adminDb: {
    collection: () => ({ doc: () => ({ path: 'member' }) }),
    runTransaction: async (work: any) => {
      const writes: any[] = [];
      const result = await work({ get: async (ref: any) => { if (writes.length) throw new Error('Read after write'); return { exists: true, data: () => ref.path === 'member' ? mocks.member : mocks.sale }; }, update: (ref: any, data: any) => writes.push({ path: ref.path, data }), set: (ref: any, data: any) => writes.push({ path: ref.path, data }) });
      mocks.writes.push(...writes); return result;
    },
  } });
});
const call = (body: any = { expectedUpdatedAt: revision, observedUnreadCount: 2 }) => POST(new NextRequest('https://crm.example/read', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ saleId: 's' }) });
it('acknowledges only the displayed snapshot and commits the audit atomically', async () => {
  expect(await (await call()).json()).toEqual({ changed: true, unreadReplyCount: 0 });
  expect(mocks.writes).toHaveLength(2);
  expect(mocks.writes[0].data).toMatchObject({ unreadReplyCount: 0 });
  expect(mocks.writes[1].data).toMatchObject({ action: 'sale.replies_read' });
});
it('preserves new inbound replies and refuses stale or fabricated counts', async () => {
  mocks.sale.updatedAt = '2026-10-06T10:01:00.000Z'; mocks.sale.unreadReplyCount = 3;
  expect((await call()).status).toBe(409);
  mocks.sale.updatedAt = revision;
  expect((await call()).status).toBe(409);
  expect(mocks.writes).toEqual([]);
});
it('revalidates membership and dossier ownership before acknowledging', async () => {
  mocks.member.agencyId = 'b'; expect((await call()).status).toBe(403);
  mocks.member.agencyId = 'a'; mocks.sale.agentId = 'other'; expect((await call()).status).toBe(403);
  expect(mocks.writes).toEqual([]);
});
it('repeated acknowledgment is a no-op without duplicate audit and accepts authorized collaborators', async () => {
  mocks.sale.unreadReplyCount = 0;
  expect(await (await call()).json()).toEqual({ changed: false, unreadReplyCount: 0 }); expect(mocks.writes).toEqual([]);
  mocks.sale.unreadReplyCount = 2; mocks.sale.agentId = 'other'; mocks.sale.collaboratorIds = ['u'];
  expect((await call()).status).toBe(200);
});
it('requires an explicit revision/count and rejects undeclared fields', async () => {
  expect((await call({})).status).toBe(400);
  expect((await call({ expectedUpdatedAt: revision, observedUnreadCount: -1 })).status).toBe(400);
  expect((await call({ expectedUpdatedAt: revision, observedUnreadCount: 2, sentAt: revision })).status).toBe(400);
  expect(mocks.writes).toEqual([]);
});
