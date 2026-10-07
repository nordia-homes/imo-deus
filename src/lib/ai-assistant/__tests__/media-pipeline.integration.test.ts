import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('../planner', () => ({ planTurn: vi.fn() }));
vi.mock('../actions', () => ({ executeAction: vi.fn() }));
vi.mock('../operations', () => ({ operations: {}, isReadOperation: () => false, invokeOperation: vi.fn() }));
import { runPlan } from '../workspace';
import { readPlanOutcomes } from '../plan-outcomes';
import { approvalEnvelope } from '../approval';
import { actionSchema } from '../contracts';
import { executeAction } from '../actions';
import { invokeOperation } from '../operations';
import type { AssistantContext } from '../access';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('durable media dependencies on real Firestore with simulated providers', () => {
  let db: Firestore;
  const ids: string[] = [];
  beforeAll(() => {
    if (!/^(localhost|127\.0\.0\.1):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
    db = new Firestore({ projectId: 'demo-imodeus-media-pipeline' });
  });
  afterAll(async () => {
    if (!db) return;
    for (const id of ids) {
      await db.recursiveDelete(db.collection('agencies').doc(id));
      await db.collection('users').doc(id).delete();
    }
    await db.terminate();
  });
  async function fixture() {
    const id = randomUUID(); ids.push(id);
    vi.mocked(executeAction).mockReset(); vi.mocked(invokeOperation).mockReset();
    const ctx = { uid: id, agencyId: id, role: 'agent', runtimeMode: 'real', adminDb: db } as unknown as AssistantContext;
    const agency = db.collection('agencies').doc(id), plan = agency.collection('assistantPlans').doc('plan');
    await db.collection('users').doc(id).set({ agencyId: id, role: 'agent' });
    await agency.collection('properties').doc('p').set({ title: 'Synthetic property' });
    await agency.collection('assistantSessions').doc('s').set({ ownerId: id });
    const actions = [
      { operation: 'video_script', params: { propertyId: 'p' } },
      { operation: 'video_create', params: { propertyId: 'p' }, body: { aiPresenterScript: '@step:1:script' } },
      { operation: 'tiktok_studio_asset_create', body: { propertyId: 'p', type: 'video', url: '@step:2:videoUrl' } },
      { operation: 'tiktok_post_draft', body: { assetId: '@step:3:assetId' } },
    ].map(action => actionSchema.parse({ kind: 'existing_operation', ...action }));
    const expiresAt = Date.now() + 3600000, url = 'https://fixture.example/video.mp4';
    await plan.set({ ownerId: id, sessionId: 's', status: 'pending', actions, goal: { schemaVersion: 1 }, expiresAt, approval: approvalEnvelope(id, id, 'plan', actions, expiresAt) });
    vi.mocked(executeAction).mockImplementation(async (_ctx, action: any) => {
      if (action.operation === 'video_script') return { script: 'Synthetic script.' };
      if (action.operation === 'video_create') return { jobId: 'job', executionState: 'queued' };
      if (action.operation === 'tiktok_studio_asset_create') {
        await agency.collection('tiktokStudioAssets').doc('asset').set({ ...action.body, ownerUid: id, agencyId: id, status: 'ready' });
        return { assetId: 'asset' };
      }
      if (action.operation === 'tiktok_post_draft') {
        expect(action.body.assetId).toBe('asset');
        await agency.collection('tiktokPostDrafts').doc('draft').set({ status: 'draft', agencyId: id, createdByUid: id });
        return { draftId: 'draft' };
      }
      throw new Error('Unexpected mutation');
    });
    const ready = () => vi.mocked(invokeOperation).mockResolvedValue({ executionState: 'succeeded', job: { id: 'job', propertyId: 'p', videoUrl: url } });
    return { ctx, agency, plan, ready, url };
  }
  it('persists the wait, resumes from receipts and passes only verified media to the draft', async () => {
    const f = await fixture();
    vi.mocked(invokeOperation).mockResolvedValue({ executionState: 'queued', job: { id: 'job', propertyId: 'p' } });
    expect(await runPlan(f.ctx, 'plan')).toMatchObject({ status: 'pending', outcome: { state: 'WAITING_PROVIDER' } });
    expect((await f.plan.get()).data()?.results).toHaveLength(2);
    expect(executeAction).toHaveBeenCalledTimes(2);
    await f.plan.update({ waitUntil: 0 }); f.ready();
    expect(await runPlan(f.ctx, 'plan')).toMatchObject({ status: 'completed' });
    const saved = (await f.plan.get()).data()!;
    expect(saved.results[1]).toMatchObject({ result: { jobId: 'job', executionState: 'queued' }, outputs: { videoUrl: f.url } });
    expect(saved.results[2].outputs).toEqual({ assetId: 'asset' });
    expect(await readPlanOutcomes(f.ctx, 'plan')).toMatchObject({ outcome: { state: 'COMPLETED' } });
    await runPlan(f.ctx, 'plan');
    expect(executeAction).toHaveBeenCalledTimes(4);
    expect(vi.mocked(invokeOperation).mock.calls.every(call => call[1].operation === 'video_job' && call[2] === true)).toBe(true);
  }, 20000);
  it.each([{ url: 'https://fixture.example/replaced.mp4' }, { status: 'error' }])('blocks changed imported media at a durable checkpoint: %j', async patch => {
    const f = await fixture(); f.ready();
    expect(await runPlan(f.ctx, 'plan', false, 3)).toMatchObject({ status: 'pending' });
    expect((await f.plan.get()).data()?.results).toHaveLength(3);
    await f.agency.collection('tiktokStudioAssets').doc('asset').update(patch);
    expect(await runPlan(f.ctx, 'plan')).toMatchObject({ status: 'unknown' });
    expect((await f.agency.collection('tiktokPostDrafts').get()).empty).toBe(true);
    expect(executeAction).toHaveBeenCalledTimes(3);
  }, 20000);
});
