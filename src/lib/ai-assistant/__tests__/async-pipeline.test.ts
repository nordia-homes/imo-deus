import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../planner', () => ({ planTurn: vi.fn() }));
vi.mock('../actions', () => ({ executeAction: vi.fn() }));
vi.mock('../operations', () => ({ operations: {}, isReadOperation: () => false, invokeOperation: vi.fn() }));
vi.mock('../access', () => ({ collectionFor: (ctx: any, name: string) => ctx.collection(name), actionReferences: () => [], referencesAllowed: async () => true, getResource: vi.fn() }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } } }));
import { runPlan } from '../workspace';
import { readPlanOutcomes } from '../plan-outcomes';
import { approvalEnvelope } from '../approval';
import { executeAction } from '../actions';
import { invokeOperation } from '../operations';
import { getResource } from '../access';

function fixture() {
  const operation = (operation: string, body: Record<string, unknown>, params: Record<string, string> = {}) => ({ kind: 'existing_operation', operation, params, query: {}, body });
  const actions = [
    operation('video_script', {}, { propertyId: 'p' }),
    operation('video_create', { aiPresenterScript: '@step:1:script' }, { propertyId: 'p' }),
    operation('tiktok_studio_asset_create', { propertyId: 'p', type: 'video', url: '@step:2:videoUrl' }),
    operation('tiktok_post_draft', { assetId: '@step:3:assetId' }),
  ];
  const plan: any = { ownerId: 'u', sessionId: 's', status: 'pending', actions, goal: { schemaVersion: 1 }, expiresAt: Date.now() + 3600000 };
  plan.approval = approvalEnvelope('u', 'a', 'plan', actions as any, plan.expiresAt);
  const ref: any = { id: 'plan', get: async () => ({ exists: true, id: 'plan', data: () => structuredClone(plan) }), update: async (patch: any) => Object.assign(plan, patch) };
  const session = { get: async () => ({ exists: true, data: () => ({ ownerId: 'u' }) }), collection: () => ({ doc: () => ({}) }) };
  const ctx: any = { uid: 'u', agencyId: 'a', role: 'agent', collection: (name: string) => ({ doc: () => name === 'assistantPlans' ? ref : session }), adminDb: {
    collection: () => ({ doc: () => ({ get: async () => ({ data: () => ({ agencyId: 'a', role: 'agent' }) }) }) }),
    runTransaction: async (work: any) => work({ get: (target: any) => target.get(), update: (_ref: any, patch: any) => Object.assign(plan, patch), set: vi.fn() }),
    batch: () => ({ update: (_ref: any, patch: any) => Object.assign(plan, patch), set: vi.fn(), commit: async () => undefined }),
  } };
  return { ctx, plan };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getResource).mockImplementation(async (_ctx, resource) => resource === 'tiktokStudioAssets' ? { ownerUid: 'u', agencyId: 'a', propertyId: 'p', type: 'video', status: 'ready', url: 'https://storage.example/video.mp4' } : resource === 'tiktokPostDrafts' ? { status: 'draft' } : { id: 'p' });
  const receipts: Record<string, any> = { video_script: { script: 'Scenariu verificat.' }, video_create: { jobId: 'job', executionState: 'queued' }, tiktok_studio_asset_create: { assetId: 'asset' }, tiktok_post_draft: { draftId: 'draft' } };
  vi.mocked(executeAction).mockImplementation(async (_ctx, action: any) => receipts[action.operation]);
});
it('runs script, waits for video, resumes import and prepares a draft using verified output', async () => {
  const { ctx, plan } = fixture();
  vi.mocked(invokeOperation).mockResolvedValue({ executionState: 'queued', job: { id: 'job', propertyId: 'p' } });
  expect(await runPlan(ctx, 'plan')).toMatchObject({ status: 'pending', outcome: { state: 'WAITING_PROVIDER' } });
  expect(executeAction).toHaveBeenCalledTimes(2);
  expect(vi.mocked(executeAction).mock.calls[1][1]).toMatchObject({ body: { aiPresenterScript: 'Scenariu verificat.' } });
  plan.waitUntil = Date.now() - 1;
  vi.mocked(invokeOperation).mockResolvedValue({ executionState: 'succeeded', job: { id: 'job', propertyId: 'p', videoUrl: 'https://storage.example/video.mp4' } });
  expect(await runPlan(ctx, 'plan')).toMatchObject({ status: 'completed', outcome: { state: 'COMPLETED' } });
  expect(executeAction).toHaveBeenCalledTimes(4);
  expect(vi.mocked(executeAction).mock.calls[2][1]).toMatchObject({ body: { url: 'https://storage.example/video.mp4' } });
  expect(vi.mocked(executeAction).mock.calls[3][1]).toMatchObject({ body: { assetId: 'asset' } });
  expect(plan.results[1].result).toEqual({ jobId: 'job', executionState: 'queued' });
  expect(plan.results[2].outputs).toEqual({ assetId: 'asset' });
  expect((await readPlanOutcomes(ctx, 'plan')).outcome.state).toBe('COMPLETED');
  expect(vi.mocked(invokeOperation).mock.calls.every(call => call[1].operation === 'video_job' && call[2] === true)).toBe(true);
});
it.each([
  { url: 'https://storage.example/replaced.mp4' }, { type: 'image' },
  { status: 'error' }, { status: 'processing' }, { propertyId: 'other' },
  { ownerUid: 'other' }, { agencyId: 'other' },
])('stops before draft creation when imported media changes: %j', async patch => {
  const { ctx } = fixture();
  vi.mocked(invokeOperation).mockResolvedValue({ executionState: 'succeeded', job: { id: 'job', propertyId: 'p', videoUrl: 'https://storage.example/video.mp4' } });
  vi.mocked(getResource).mockImplementation(async (_ctx, resource) => resource === 'tiktokStudioAssets'
    ? { ownerUid: 'u', agencyId: 'a', propertyId: 'p', type: 'video', status: 'ready', url: 'https://storage.example/video.mp4', ...patch }
    : { id: 'p' });
  expect(await runPlan(ctx, 'plan')).toMatchObject({ status: 'unknown' });
  expect(vi.mocked(executeAction).mock.calls.map(call => (call[1] as any).operation)).toEqual(['video_script', 'video_create', 'tiktok_studio_asset_create']);
});
it('does not import or prepare a draft after a failed render', async () => {
  const { ctx } = fixture();
  vi.mocked(invokeOperation).mockResolvedValue({ executionState: 'failed', businessStatus: 'failed' });
  expect(await runPlan(ctx, 'plan')).toMatchObject({ status: 'unknown', outcome: { state: 'PARTIALLY_COMPLETED' } });
  expect(executeAction).toHaveBeenCalledTimes(2);
});
