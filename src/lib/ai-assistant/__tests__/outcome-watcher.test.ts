import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ read: vi.fn(), fence: vi.fn(), getPlan: vi.fn() }));
vi.mock('../access', () => ({ collectionFor: (ctx: any, name: string) => ctx.adminDb.collection(name) }));
vi.mock('../workspace', () => ({ getPlan: mocks.getPlan }));
vi.mock('../plan-outcomes', () => ({ readPlanOutcomes: mocks.read }));
vi.mock('@/lib/crm/automation-fence', () => ({ assertAutomationFence: mocks.fence }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status: number) { super(message); } } }));
import { verifyPlanOutcome } from '../outcome-watcher';
import { summarizeOutcome } from '../outcome';
function context(status = 'completed', agencyId = 'a', nanoseconds = 1) {
  const update = vi.fn();
  const db: any = { collection: (name: string) => ({ doc: () => ({ name }) }), runTransaction: async (fn: any) => fn({
    get: async (ref: any) => ({ updateTime: { seconds: 100, nanoseconds }, data: () => ref.name === 'users' ? { agencyId, role: 'agent' } : { ownerId: 'u', status } }), update,
  }) };
  return { ctx: { uid: 'u', agencyId: 'a', role: 'agent', adminDb: db } as any, update };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.read.mockResolvedValue({ planRevision: '100:1', pollAfterMs: 15000, executionStatus: 'completed', outcome: { state: 'WAITING_PROVIDER', note: 'pending' } });
});
it('reschedules verification without replaying domain effects', async () => {
  const { ctx, update } = context();
  expect(await verifyPlanOutcome(ctx, 'p', Date.now() + 60000)).toMatchObject({ status: 'pending', planStatus: 'WAITING_PROVIDER' });
  expect(update).toHaveBeenCalledOnce(); expect(mocks.fence).toHaveBeenCalledOnce();
});
it('persists mixed pending results then settles them without hiding the failed step', async () => {
  const { ctx, update } = context();
  const failed = { step: 1, executionState: 'failed' };
  const pending = summarizeOutcome('completed', 2, [failed, { step: 2, executionState: 'queued', watchable: true }]);
  mocks.read.mockResolvedValue({ planRevision: '100:1', pollAfterMs: 15000, executionStatus: 'completed', outcome: pending });
  expect(await verifyPlanOutcome(ctx, 'p', Date.now() + 60000)).toMatchObject({ status: 'pending', planStatus: 'WAITING_PROVIDER', outcome: { failed: 1, pending: 1 } });
  expect(update).toHaveBeenLastCalledWith(expect.anything(), { outcome: pending });
  const settled = summarizeOutcome('completed', 2, [failed, { step: 2, executionState: 'succeeded', completionSatisfied: true }]);
  mocks.read.mockResolvedValue({ planRevision: '100:1', pollAfterMs: null, executionStatus: 'completed', outcome: settled });
  expect(await verifyPlanOutcome(ctx, 'p', Date.now() + 60000)).toMatchObject({ status: 'completed', planStatus: 'PARTIALLY_COMPLETED', outcome: { failed: 1, confirmed: 1, pending: 0 } });
  expect(update).toHaveBeenLastCalledWith(expect.anything(), { outcome: settled });
});
it('ends at the deadline with an explicit unresolved outcome', async () => {
  const { ctx, update } = context();
  expect(await verifyPlanOutcome(ctx, 'p', Date.now() - 1)).toMatchObject({ status: 'completed', planStatus: 'BLOCKED', notBefore: 0 });
  expect(update.mock.calls[0][1].outcome.note).toContain('nu se repetă');
});
it('does not overwrite a concurrently cancelled plan', async () => {
  const { ctx, update } = context('cancelled');
  expect(await verifyPlanOutcome(ctx, 'p', Date.now() + 60000)).toMatchObject({ status: 'completed', planStatus: 'CANCELLED', notBefore: 0 }); expect(update).not.toHaveBeenCalled();
});
it('rechecks the revision even when a concurrent modification leaves status unchanged', async () => {
  const { ctx, update } = context('completed', 'a', 2);
  expect(await verifyPlanOutcome(ctx, 'p', Date.now() + 60000)).toMatchObject({ status: 'pending', planStatus: 'RUNNING' });
  expect(update).not.toHaveBeenCalled();
});
it('rechecks membership before persisting verification', async () => {
  const { ctx, update } = context('completed', 'other');
  await expect(verifyPlanOutcome(ctx, 'p', Date.now() + 60000)).rejects.toMatchObject({ status: 403 });
  expect(update).not.toHaveBeenCalled();
});
it('does not extend the deadline when the plan revision keeps changing', async () => {
  const { ctx, update } = context('completed', 'a', 2);
  expect(await verifyPlanOutcome(ctx, 'p', Date.now() - 1)).toMatchObject({ status: 'completed', planStatus: 'BLOCKED', notBefore: 0 });
  expect(update).not.toHaveBeenCalled();
});
it.each([NaN, Infinity, -Infinity])('ends an invalid deadline %s even during concurrent plan changes', async deadline => {
  const { ctx, update } = context('completed', 'a', 2);
  expect(await verifyPlanOutcome(ctx, 'p', deadline)).toMatchObject({ status: 'completed', planStatus: 'BLOCKED', notBefore: 0 });
  expect(update).not.toHaveBeenCalled();
});
it.each(['paused', 'cancelled'].flatMap(status => ['future', 'expired', 'invalid'].map(deadline => ({ status, deadline }))))('preserves $status with a $deadline deadline instead of polling or declaring BLOCKED', async ({ status, deadline }) => {
  const { ctx, update } = context(status);
  const outcome = { state: status.toUpperCase(), note: 'Existing stop state', pending: 1 };
  mocks.read.mockResolvedValue({ planRevision: '100:1', executionStatus: status, outcome, pollAfterMs: 15000 });
  expect(await verifyPlanOutcome(ctx, 'p', deadline === 'future' ? Date.now() + 60000 : deadline === 'expired' ? 0 : NaN)).toMatchObject({ status: 'completed', planStatus: status.toUpperCase(), notBefore: 0, outcome });
  expect(update).toHaveBeenCalledWith(expect.anything(), { outcome });
});
it('does not save a paused snapshot after the user has resumed the plan', async () => {
  const { ctx, update } = context('pending', 'a', 2);
  mocks.read.mockResolvedValue({ planRevision: '100:1', executionStatus: 'paused', outcome: { state: 'PAUSED' }, pollAfterMs: null });
  expect(await verifyPlanOutcome(ctx, 'p', Date.now() + 60000)).toMatchObject({ status: 'pending', planStatus: 'RUNNING' });
  expect(update).not.toHaveBeenCalled();
});
