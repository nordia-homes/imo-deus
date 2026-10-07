import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ plan: vi.fn(), invoke: vi.fn(), resource: vi.fn(), allowed: vi.fn() }));
vi.mock('../workspace', () => ({ getPlan: mocks.plan }));
vi.mock('../operations', () => ({ invokeOperation: mocks.invoke }));
vi.mock('../access', () => ({ getResource: mocks.resource, referencesAllowed: mocks.allowed, collectionFor: (ctx: any, name: string) => ctx.adminDb.collection(name) }));
import { readPlanOutcomes } from '../plan-outcomes';
import { tikTokScheduleRevision } from '@/lib/tiktok-schedule-revision';
const ctx: any = { uid: 'u', role: 'agent', agencyId: 'a', adminDb: { collection: () => ({ doc: () => ({ get: async () => ({ data: () => ({ role: 'agent', agencyId: 'a' }) }) }) }) } };
const action = { kind: 'existing_operation', operation: 'video_create', params: { propertyId: 'p' }, query: {}, body: {} };
beforeEach(() => { vi.clearAllMocks(); mocks.allowed.mockResolvedValue(true); mocks.plan.mockResolvedValue({ data: { actions: [action], status: 'completed', results: [{ step: 1, result: { jobId: 'j', executionState: 'queued' } }] } }); });
it('reads current video status without rerunning a completed plan or replacing its original receipt', async () => {
  mocks.invoke.mockResolvedValue({ executionState: 'failed', businessStatus: 'failed', verifiedAt: 'now' });
  expect(await readPlanOutcomes(ctx, 'plan')).toMatchObject({ executionStatus: 'completed', rows: [{ step: 1, executionState: 'failed', evidenceSource: 'current_domain_state' }] });
  expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith(ctx, { operation: 'video_job', params: { propertyId: 'p', jobId: 'j' }, query: {}, body: {} }, true);
});
it('keeps polling after a transient provider read failure without repeating the mutation', async () => {
  mocks.invoke.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ executionState: 'succeeded', businessStatus: 'completed', job: { id: 'j', propertyId: 'p', videoUrl: 'https://storage.example/video.mp4' } });
  expect(await readPlanOutcomes(ctx, 'plan')).toMatchObject({ pollAfterMs: 15000, rows: [{ executionState: 'unknown', watchable: true }] });
  expect(await readPlanOutcomes(ctx, 'plan')).toMatchObject({ pollAfterMs: null, outcome: { state: 'COMPLETED' } });
  expect(mocks.invoke.mock.calls.every(args => args[1].operation === 'video_job' && args[2] === true)).toBe(true);
});
it('accepts a concrete generated script as a preparation step, without regenerating it', async () => {
  const result = { script: 'Scenariu existent pentru proprietate.' };
  mocks.plan.mockResolvedValue({ data: { status: 'completed', actions: [{ ...action, operation: 'video_script' }], results: [{ step: 1, result }] } });
  mocks.resource.mockResolvedValue({ id: 'p' });
  expect((await readPlanOutcomes(ctx, 'plan')).outcome.state).toBe('COMPLETED');
  result.script = '';
  expect((await readPlanOutcomes(ctx, 'plan')).outcome.state).toBe('BLOCKED');
  expect(mocks.invoke).not.toHaveBeenCalled();
});
it('tracks pending results but stops polling terminal evidence and unsupported refreshes', async () => {
  mocks.invoke.mockResolvedValueOnce({ executionState: 'queued', businessStatus: 'queued' }).mockResolvedValueOnce({ executionState: 'succeeded', businessStatus: 'completed', job: { id: 'j', propertyId: 'p', videoUrl: 'https://storage.example/video.mp4' } });
  expect((await readPlanOutcomes(ctx, 'plan')).pollAfterMs).toBe(15000);
  expect((await readPlanOutcomes(ctx, 'plan')).pollAfterMs).toBeNull();
  mocks.plan.mockResolvedValue({ data: { actions: [{ ...action, operation: 'message_send' }], results: [{ step: 1, result: { executionState: 'queued' } }] } });
  expect((await readPlanOutcomes(ctx, 'plan')).pollAfterMs).toBeNull();
});
it.each(['paused', 'cancelled'])('stops automatic polling for a %s plan while retaining provider evidence', async status => {
  mocks.plan.mockResolvedValue({ data: { status, actions: [action], results: [{ step: 1, result: { jobId: 'j' } }] } });
  mocks.invoke.mockResolvedValue({ executionState: 'queued', businessStatus: 'queued' });
  expect(await readPlanOutcomes(ctx, 'plan')).toMatchObject({ executionStatus: status, outcome: { state: status.toUpperCase(), pending: 1 }, pollAfterMs: null, rows: [{ executionState: 'queued' }] });
  expect(mocks.invoke.mock.calls.every(args => args[1].operation === 'video_job' && args[2] === true)).toBe(true);
});
it('reads the exact authorized Studio render job and refuses another owner or project', async () => {
  mocks.plan.mockResolvedValue({ data: { actions: [{ ...action, operation: 'tiktok_studio_render', params: { projectId: 'project' } }], results: [{ step: 1, result: { jobId: 'job' } }] } });
  mocks.resource.mockImplementation(async (_ctx, resource) => resource === 'tiktokStudioProjects' ? { ownerUid: 'u', outputAssetId: 'asset', version: 1, status: 'ready' } : { ownerUid: 'u', agencyId: 'a', studioProjectId: 'project', version: 1, type: 'video', status: 'ready', url: 'https://storage.example/video.mp4' });
  const job: any = { kind: 'render', uid: 'u', agencyId: 'a', projectId: 'project', version: 1, status: 'completed' };
  const studioCtx = { ...ctx, adminDb: { collection: (name: string) => name === 'users' ? ctx.adminDb.collection(name) : { doc: () => ({ get: async () => ({ data: () => job }) }) } } };
  expect(await readPlanOutcomes(studioCtx, 'plan')).toMatchObject({ pollAfterMs: null, rows: [{ executionState: 'succeeded', businessStatus: 'completed' }] });
  job.version = 2;
  expect(await readPlanOutcomes(studioCtx, 'plan')).toMatchObject({ rows: [{ executionState: 'unknown', completionSatisfied: false }] });
  job.version = 1;
  job.uid = 'other';
  expect((await readPlanOutcomes(studioCtx, 'plan')).rows[0].executionState).toBe('unavailable');
  job.uid = 'u'; job.projectId = 'other';
  expect((await readPlanOutcomes(studioCtx, 'plan')).rows[0].executionState).toBe('unavailable');
  expect(mocks.invoke).not.toHaveBeenCalled();
});
it('verifies a saved Studio project before allowing the render dependency to advance', async () => {
  const project = { id: 'project', ownerUid: 'u', agencyId: 'a', propertyId: 'p', version: 1, sourceAssetIds: [], script: '', status: 'draft' };
  mocks.plan.mockResolvedValue({ data: { status: 'completed', actions: [{ ...action, operation: 'tiktok_studio_project_create', body: { propertyId: 'p' } }], results: [{ step: 1, result: { projectId: 'project', project } }] } });
  mocks.resource.mockResolvedValue(project);
  expect(await readPlanOutcomes(ctx, 'plan')).toMatchObject({ outcome: { state: 'COMPLETED' } });
  expect(mocks.resource).toHaveBeenCalledWith(ctx, 'tiktokStudioProjects', 'project');
  mocks.resource.mockResolvedValue({ ownerUid: 'u', agencyId: 'a', propertyId: 'different' });
  expect((await readPlanOutcomes(ctx, 'plan')).outcome.state).not.toBe('COMPLETED');
  mocks.resource.mockResolvedValue({ ownerUid: 'other', agencyId: 'a', propertyId: 'p' });
  expect((await readPlanOutcomes(ctx, 'plan')).rows[0].executionState).toBe('unavailable');
  expect(mocks.invoke).not.toHaveBeenCalled();
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
it('confirms Facebook scheduling only for the requested time and exact groups', async () => {
  const body = { propertyId: 'p', connectionId: 'c', scheduledAt: '2030-01-01T10:00:00Z', groupUrls: ['https://facebook.com/groups/one'] };
  mocks.plan.mockResolvedValue({ data: { status: 'completed', actions: [{ ...action, operation: 'facebook_job_create', body }], results: [{ step: 1, result: { jobId: 'j' } }] } });
  mocks.resource.mockResolvedValue({ id: 'p' });
  const row: any = { id: 'j', agencyId: 'a', ownerUid: 'u', propertyId: 'p', connectionId: 'c', status: 'scheduled', scheduledAt: body.scheduledAt, groups: [{ url: body.groupUrls[0] }] };
  const scoped = { ...ctx, adminDb: { collection: (name: string) => name === 'users' ? ctx.adminDb.collection(name) : { doc: () => ({ get: async () => ({ data: () => row }) }) } } };
  expect(await readPlanOutcomes(scoped, 'plan')).toMatchObject({ outcome: { state: 'COMPLETED' }, pollAfterMs: null });
  row.groups = [{ url: 'https://facebook.com/groups/other' }];
  expect((await readPlanOutcomes(scoped, 'plan')).outcome.state).not.toBe('COMPLETED');
  row.ownerUid = 'other';
  expect((await readPlanOutcomes(scoped, 'plan')).rows[0].executionState).toBe('unavailable');
  expect(mocks.invoke).not.toHaveBeenCalled();
});
it('does not equate a finished Facebook submission job with published posts', async () => {
  mocks.plan.mockResolvedValue({ data: { status: 'completed', actions: [{ ...action, operation: 'facebook_job_create', body: { propertyId: 'p', connectionId: 'c', groupUrls: ['https://facebook.com/groups/one'] } }], results: [{ step: 1, result: { jobId: 'j' } }] } });
  mocks.resource.mockResolvedValue({ id: 'p' });
  const row = { id: 'j', agencyId: 'a', ownerUid: 'u', propertyId: 'p', connectionId: 'c', status: 'completed', groups: [{ url: 'https://facebook.com/groups/one', status: 'submitted' }] };
  const scoped = { ...ctx, adminDb: { collection: (name: string) => name === 'users' ? ctx.adminDb.collection(name) : { doc: () => ({ get: async () => ({ data: () => row }) }) } } };
  expect(await readPlanOutcomes(scoped, 'plan')).toMatchObject({ outcome: { state: 'BLOCKED' }, rows: [{ executionState: 'accepted_unverified' }] });
});
it('verifies TikTok scheduling against both draft and owned queue record', async () => {
  const runAt = '2030-01-01T10:00:00.000Z';
  mocks.plan.mockResolvedValue({ data: { status: 'completed', actions: [{ ...action, operation: 'tiktok_post_schedule', params: { draftId: 'd' }, body: { runAt } }], results: [{ step: 1, result: {} }] } });
  const draft = { agencyId: 'a', createdByUid: 'u', scheduledAt: runAt, scheduleStatus: 'scheduled' };
  mocks.resource.mockResolvedValue(draft);
  const row = { kind: 'publish', draftRevision: tikTokScheduleRevision(draft), uid: 'u', agencyId: 'a', draftId: 'd', runAt, status: 'queued' };
  const scoped = { ...ctx, adminDb: { collection: (name: string) => name === 'users' ? ctx.adminDb.collection(name) : { doc: () => ({ get: async () => ({ data: () => row }) }) } } };
  expect((await readPlanOutcomes(scoped, 'plan')).outcome.state).toBe('COMPLETED');
  row.status = 'running';
  expect(await readPlanOutcomes(scoped, 'plan')).toMatchObject({ outcome: { state: 'COMPLETED' }, pollAfterMs: null, rows: [{ publicationConfirmed: false }] });
  row.status = 'completed'; draft.scheduleStatus = 'sent';
  expect(await readPlanOutcomes(scoped, 'plan')).toMatchObject({ outcome: { state: 'COMPLETED' }, pollAfterMs: null, rows: [{ publicationConfirmed: false }] });
  row.runAt = '2030-01-01T12:00:00.000Z';
  expect((await readPlanOutcomes(scoped, 'plan')).outcome.state).not.toBe('COMPLETED');
  row.agencyId = 'other';
  expect((await readPlanOutcomes(scoped, 'plan')).rows[0].executionState).toBe('unavailable');
  expect(mocks.invoke).not.toHaveBeenCalled();
});
it.each(['video', 'image'])('verifies an imported %s against the requested source before exposing its ID', async type => {
  const body = { type, propertyId: 'p', url: 'https://storage.example/media' };
  mocks.plan.mockResolvedValue({ data: { status: 'completed', actions: [{ ...action, operation: 'tiktok_studio_asset_create', body }], results: [{ step: 1, result: { assetId: 'asset' } }] } });
  mocks.resource.mockResolvedValue({ ...body, ownerUid: 'u', agencyId: 'a', status: 'ready' });
  expect(await readPlanOutcomes(ctx, 'plan')).toMatchObject({ outcome: { state: 'COMPLETED' }, pollAfterMs: null, rows: [{ completionSatisfied: true, outputs: { assetId: 'asset' } }] });
  expect(mocks.invoke).not.toHaveBeenCalled();
});
it.each(['http://storage.example/video.mp4', 'https://user:password@storage.example/video.mp4', 'file:///video.mp4', 'not-a-url', ''])('rejects unsafe or missing import URL %s even if it matches the request', async url => {
  const body = { type: 'video', url };
  mocks.plan.mockResolvedValue({ data: { status: 'completed', actions: [{ ...action, operation: 'tiktok_studio_asset_create', body }], results: [{ step: 1, result: { assetId: 'asset' } }] } });
  mocks.resource.mockResolvedValue({ ...body, ownerUid: 'u', agencyId: 'a', status: 'ready' });
  const result = await readPlanOutcomes(ctx, 'plan');
  expect(result).toMatchObject({ outcome: { state: 'BLOCKED' }, pollAfterMs: null, rows: [{ completionSatisfied: false, watchable: false }] });
  expect(result.rows[0]).not.toHaveProperty('outputs');
  expect(mocks.invoke).not.toHaveBeenCalled();
});
