import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ read: vi.fn(), fence: vi.fn(), getPlan: vi.fn() }));
vi.mock('../access', () => ({ collectionFor: (ctx: any, name: string) => ctx.adminDb.collection(name) }));
vi.mock('../workspace', () => ({ getPlan: mocks.getPlan }));
vi.mock('../plan-outcomes', () => ({ readPlanOutcomes: mocks.read }));
vi.mock('@/lib/crm/automation-fence', () => ({ assertAutomationFence: mocks.fence }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status: number) { super(message); } } }));
import { verifyPlanOutcome } from '../outcome-watcher';
function context(status = 'completed', agencyId = 'a') {
  const update = vi.fn();
  const db: any = { collection: (name: string) => ({ doc: () => ({ name }) }), runTransaction: async (fn: any) => fn({
    get: async (ref: any) => ({ data: () => ref.name === 'users' ? { agencyId, role: 'agent' } : { ownerId: 'u', status } }), update,
  }) };
  return { ctx: { uid: 'u', agencyId: 'a', role: 'agent', adminDb: db } as any, update };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.read.mockResolvedValue({ pollAfterMs: 15000, executionStatus: 'completed', outcome: { state: 'WAITING_PROVIDER', note: 'pending' } });
});
it('reschedules verification without replaying domain effects', async () => {
  const { ctx, update } = context();
  expect(await verifyPlanOutcome(ctx, 'p', Date.now() + 60000)).toMatchObject({ status: 'pending', planStatus: 'WAITING_PROVIDER' });
  expect(update).toHaveBeenCalledOnce(); expect(mocks.fence).toHaveBeenCalledOnce();
});
it('ends at the deadline with an explicit unresolved outcome', async () => {
  const { ctx, update } = context();
  expect(await verifyPlanOutcome(ctx, 'p', Date.now() - 1)).toMatchObject({ status: 'completed', planStatus: 'BLOCKED', notBefore: 0 });
  expect(update.mock.calls[0][1].outcome.note).toContain('nu se repetă');
});
it('does not overwrite a concurrently cancelled plan', async () => {
  const { ctx, update } = context('cancelled');
  await verifyPlanOutcome(ctx, 'p', Date.now() + 60000); expect(update).not.toHaveBeenCalled();
});
it('rechecks membership before persisting verification', async () => {
  const { ctx, update } = context('completed', 'other');
  await expect(verifyPlanOutcome(ctx, 'p', Date.now() + 60000)).rejects.toMatchObject({ status: 403 });
  expect(update).not.toHaveBeenCalled();
});
