import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ plan: vi.fn(), invoke: vi.fn(), resource: vi.fn(), allowed: vi.fn() }));
vi.mock('../workspace', () => ({ getPlan: mocks.plan }));
vi.mock('../operations', () => ({ invokeOperation: mocks.invoke }));
vi.mock('../access', () => ({ getResource: mocks.resource, referencesAllowed: mocks.allowed }));
import { readPlanOutcomes } from '../plan-outcomes';
const ctx: any = { uid: 'u', role: 'agent', agencyId: 'a', adminDb: { collection: () => ({ doc: () => ({ get: async () => ({ data: () => ({ role: 'agent', agencyId: 'a' }) }) }) }) } };
const action = { kind: 'existing_operation', operation: 'video_create', params: { propertyId: 'p' }, query: {}, body: {} };
beforeEach(() => { vi.clearAllMocks(); mocks.allowed.mockResolvedValue(true); mocks.plan.mockResolvedValue({ data: { actions: [action], status: 'completed', results: [{ step: 1, result: { jobId: 'j', executionState: 'queued' } }] } }); });
it('reads current video status without rerunning a completed plan or replacing its original receipt', async () => {
  mocks.invoke.mockResolvedValue({ executionState: 'failed', businessStatus: 'failed', verifiedAt: 'now' });
  expect(await readPlanOutcomes(ctx, 'plan')).toMatchObject({ executionStatus: 'completed', rows: [{ step: 1, executionState: 'failed', evidenceSource: 'current_domain_state' }] });
  expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith(ctx, { operation: 'video_job', params: { propertyId: 'p', jobId: 'j' }, query: {}, body: {} }, true);
});
it('uses current evidence for an uncertain stopped step and never republishes it', async () => {
  mocks.plan.mockResolvedValue({ data: { actions: [{ ...action, operation: 'tiktok_post_publish', params: { draftId: 'd' } }], status: 'unknown', results: [], stoppedStep: { step: 1, result: { executionState: 'unknown' } } } });
  mocks.invoke.mockResolvedValue({ executionState: 'succeeded', businessStatus: 'published' });
  expect(await readPlanOutcomes(ctx, 'plan')).toMatchObject({ executionStatus: 'unknown', rows: [{ executionState: 'succeeded', businessStatus: 'published' }] });
  expect(mocks.invoke.mock.calls[0][1].operation).toBe('tiktok_post_status');
});
it('distinguishes unsupported provider refresh, unreadable and failed status reads', async () => {
  mocks.plan.mockResolvedValue({ data: { actions: [{ ...action, operation: 'message_send' }], status: 'completed', results: [{ step: 1, result: { executionState: 'queued' } }] } });
  expect((await readPlanOutcomes(ctx, 'plan')).rows[0]).toMatchObject({ executionState: 'queued', evidenceSource: 'execution_receipt' });
  expect(mocks.invoke).not.toHaveBeenCalled();
  mocks.plan.mockResolvedValue({ data: { actions: [action], results: [{ step: 1, result: { jobId: 'j' } }] } });
  mocks.invoke.mockRejectedValueOnce(Object.assign(new Error('private details'), { status: 403 }));
  expect((await readPlanOutcomes(ctx, 'plan')).rows[0]).toMatchObject({ executionState: 'unavailable' });
  mocks.invoke.mockRejectedValueOnce(new Error('provider secret'));
  expect(JSON.stringify(await readPlanOutcomes(ctx, 'plan'))).not.toContain('provider secret');
  mocks.allowed.mockResolvedValue(false);
  await expect(readPlanOutcomes(ctx, 'plan')).rejects.toMatchObject({ status: 403 });
});
