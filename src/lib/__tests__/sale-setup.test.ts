import { describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ access: vi.fn() }));
vi.mock('@/lib/sales-server', () => ({
  requireSaleAccess: mocks.access,
  appendSalesAudit: () => ({ ref: { path: 'audit' }, data: { action: 'setup' } }),
  SalesApiError: class extends Error { constructor(message: string, public status: number) { super(message); } },
  salesApiErrorResponse: (e: any) => ({ status: e.status || 500, message: e.message }),
}));
import { PATCH } from '@/app/api/sales/[saleId]/setup/route';
import { mergeSetupChecklist, saleSetupSchema } from '@/lib/crm/sale-setup';
const participants = [{ id: 'buyer', role: 'buyer', name: 'Buyer', email: 'buyer@example.com' }, { id: 'owner', role: 'owner', name: 'Owner', email: 'owner@example.com' }];
const input = { participants, agreedPrice: 120000, financingType: 'cash', checklist: [], notary: null, expectedUpdatedAt: '2026-10-05T12:00:00.000Z' };
function fixture(patch: any = {}, memberPatch: any = {}) {
  const sale: any = { id: 's', agencyId: 'a', agentId: 'u', stage: 'preparing', participants, checklist: [], updatedAt: input.expectedUpdatedAt, ...patch };
  const saleRef = { id: 's' };
  const set = vi.fn();
  const db: any = { collection: () => ({ doc: () => ({}) }), runTransaction: async (callback: any) => callback({ get: async (ref: any) => ref === saleRef ? { id: 's', exists: true, data: () => sale } : { data: () => ({ agencyId: 'a', role: 'agent', ...memberPatch }) }, set }) };
  mocks.access.mockResolvedValue({ uid: 'u', agencyId: 'a', role: 'agent', sale: { ...sale, updatedAt: input.expectedUpdatedAt }, saleRef, adminDb: db });
  return { set };
}
async function request(body: any = input) { return PATCH(new Request('https://example.com', { method: 'PATCH', body: JSON.stringify(body) }) as any, { params: Promise.resolve({ saleId: 's' }) }); }
describe('shared sales setup validation', () => {
  it('rejects stale setup edits atomically', async () => { const { set } = fixture({ updatedAt: '2026-10-05T13:00:00.000Z' }); expect((await request()).status).toBe(409); expect(set).not.toHaveBeenCalled(); });
  it('rechecks membership before writing', async () => { const { set } = fixture({}, { agencyId: 'other' }); expect((await request()).status).toBe(403); expect(set).not.toHaveBeenCalled(); });
  it('saves metadata and next action with the domain audit', async () => { const { set } = fixture(); const response = await request({ ...input, nextAction: 'Verifică dosarul' }); expect(response.status).toBe(200); expect(set).toHaveBeenCalledTimes(2); expect(set.mock.calls[0][1]).toMatchObject({ nextAction: 'Verifică dosarul', contractBalanceAmount: 120000 }); });
  it('does not let stale client file metadata or review status replace server state', () => {
    const previous = [{ id: 'd', label: 'Act', participantRole: 'owner', required: true, status: 'received_needs_review', storagePath: 'safe/path', scanStatus: 'clean', versions: [{ id: 'v' }] }];
    const parsed = saleSetupSchema.parse({ ...input, checklist: [{ ...previous[0], status: 'verified', storagePath: 'forged/path', scanStatus: 'infected' }] });
    expect(mergeSetupChecklist(previous, parsed.checklist, 'now')[0]).toMatchObject({ status: 'received_needs_review', storagePath: 'safe/path', scanStatus: 'clean', versions: [{ id: 'v' }] });
    expect(mergeSetupChecklist(previous, [], 'now')).toEqual(previous);
  });
  it('rejects fabricated received documents and duplicate IDs', () => {
    expect(() => mergeSetupChecklist([], [{ id: 'd', label: 'Act', participantRole: 'owner', required: true, status: 'verified' }], 'now')).toThrow('document nou');
    expect(saleSetupSchema.safeParse({ ...input, participants: [participants[0], participants[0]] }).success).toBe(false);
  });
});
