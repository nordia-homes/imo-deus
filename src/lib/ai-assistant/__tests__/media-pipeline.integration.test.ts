import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('../planner', () => ({ planTurn: vi.fn() }));
vi.mock('../actions', () => ({ executeAction: vi.fn() }));
vi.mock('../operations', () => ({ operations: {}, isReadOperation: () => false, invokeOperation: vi.fn() }));
import { controlPlan, inspectPlan, runPlan } from '../workspace';
import { verifyPlanOutcome } from '../outcome-watcher';
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
        const draft = { id: 'draft', status: 'draft', agencyId: id, createdByUid: id, studioAssetId: 'asset', videoOwnerUid: id, propertyId: 'p', videoTourUrl: url, description: 'Synthetic draft.', targetOpenId: 'profile' };
        await agency.collection('tiktokPostDrafts').doc('draft').set(draft);
        return { draftId: 'draft', draft };
      }
      throw new Error('Unexpected mutation');
    });
    const ready = () => vi.mocked(invokeOperation).mockResolvedValue({ executionState: 'succeeded', job: { id: 'job', propertyId: 'p', agencyId: id, requestedByUid: id, status: 'completed', videoUrl: url } });
    return { ctx, agency, plan, ready, url };
  }
  it.each(['running', 'pending', 'failed', 'paused', 'unknown', 'completed', 'cancelled', 'revoked'])('persists or resolves cancellation after a concurrent %s transition', async status => {
    const f = await fixture();
    await f.plan.update({ status: 'running' });
    const results = [{ step: 1, kind: 'existing_operation', result: { script: 'Preserved receipt' } }];
    const racedDb = new Proxy(db, { get(target, property) {
      if (property === 'runTransaction') return async (work: any) => {
        if (status === 'revoked') await db.collection('users').doc(f.ctx.uid).update({ role: 'admin' });
        else await f.plan.update({ status, results, waitUntil: Date.now() + 60000 });
        return db.runTransaction(work);
      };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    if (status === 'revoked') {
      await expect(runPlan({ ...f.ctx, adminDb: racedDb as any }, 'plan', true)).rejects.toMatchObject({ status: 403 });
      expect((await f.plan.get()).data()?.cancelRequestedAt).toBeUndefined();
    } else {
      const expected = ['pending', 'failed', 'paused'].includes(status) ? 'cancelled' : status;
      const response = await runPlan({ ...f.ctx, adminDb: racedDb as any }, 'plan', true);
      const saved = (await f.plan.get()).data()!;
      expect(response).toMatchObject({ status: expected, results });
      expect(saved).toMatchObject({ status: expected, results });
      if (['completed', 'cancelled'].includes(status)) expect(saved.cancelRequestedAt).toBeUndefined();
      else expect(saved.cancelRequestedAt).toEqual(expect.any(String));
      if (['pending', 'failed', 'paused'].includes(status)) expect(saved.waitUntil).toBe(0);
      if (status === 'unknown') await expect(controlPlan(f.ctx, 'plan', 'resume')).rejects.toMatchObject({ status: 409 });
    }
    expect(executeAction).not.toHaveBeenCalled();
    expect((await f.agency.collection('tiktokPostDrafts').get()).empty).toBe(true);
  }, 20000);
  it.each(['checkpoint', 'wait', 'approval', 'cancel'])('rejects a stale claim after a concurrent %s before any new effect', async change => {
    const f = await fixture(); f.ready();
    let raced = false;
    const racedDb = new Proxy(db, { get(target, property) {
      if (property === 'runTransaction') return async (work: any) => {
        if (!raced) {
          raced = true;
          if (change === 'checkpoint' || change === 'cancel') await runPlan(f.ctx, 'plan', false, 1);
          else if (change === 'wait') await f.plan.update({ waitUntil: Date.now() + 60000 });
          else {
            const actions = [actionSchema.parse({ kind: 'create_task', description: 'New approved task', dueDate: '2027-01-01' })];
            const expiresAt = Date.now() + 3600000;
            await f.plan.update({ actions, approval: approvalEnvelope(f.ctx.uid, f.ctx.agencyId, 'plan', actions, expiresAt), expiresAt });
          }
        }
        return db.runTransaction(work);
      };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    await expect(runPlan({ ...f.ctx, adminDb: racedDb as any }, 'plan', change === 'cancel')).rejects.toMatchObject({ status: 409 });
    expect((await f.plan.get()).data()?.status).toBe('pending');
    expect(executeAction).toHaveBeenCalledTimes(['checkpoint', 'cancel'].includes(change) ? 1 : 0);
    expect((await f.agency.collection('tiktokStudioAssets').get()).empty).toBe(true);
    if (change === 'checkpoint') {
      expect((await f.plan.get()).data()?.results).toHaveLength(1);
      expect(await runPlan(f.ctx, 'plan')).toMatchObject({ status: 'completed' });
      expect(executeAction).toHaveBeenCalledTimes(4);
      expect((await f.agency.collection('tiktokPostDrafts').get()).size).toBe(1);
    } else if (change === 'cancel') {
      expect(await runPlan(f.ctx, 'plan', true)).toMatchObject({ status: 'cancelled' });
      expect((await f.plan.get()).data()?.results).toHaveLength(1);
      expect(executeAction).toHaveBeenCalledTimes(1);
    }
  }, 20000);
  it.each([false, true])('fences an old execution after recovery and actual resumption (lateFailure=%s)', async lateFailure => {
    const f = await fixture(); f.ready();
    const execute = vi.mocked(executeAction).getMockImplementation()!;
    let releaseOld!: () => void, releaseNew!: () => void, oldEntered!: () => void, newEntered!: () => void;
    const oldGate = new Promise<void>(resolve => { releaseOld = resolve; });
    const newGate = new Promise<void>(resolve => { releaseNew = resolve; });
    const oldReady = new Promise<void>(resolve => { oldEntered = resolve; });
    const newReady = new Promise<void>(resolve => { newEntered = resolve; });
    vi.mocked(executeAction).mockImplementation(async (...args) => {
      const action = args[1];
      if (action.kind === 'existing_operation' && action.operation === 'video_script') {
        const result = await execute(...args);
        await f.agency.collection('assistantExecutions').doc('plan-0').set({ status: 'completed', result });
        oldEntered(); await oldGate;
        if (lateFailure) throw new Error('Late response failure');
        return result;
      }
      if (action.kind === 'existing_operation' && action.operation === 'video_create') { newEntered(); await newGate; }
      return execute(...args);
    });
    const oldRun = runPlan(f.ctx, 'plan');
    await oldReady;
    const oldId = (await f.plan.get()).data()?.executionId;
    await f.plan.update({ startedAt: new Date(Date.now() - 20 * 60000).toISOString() });
    expect(await inspectPlan(f.ctx, 'plan')).toMatchObject({ status: 'failed' });
    const newRun = runPlan(f.ctx, 'plan');
    await newReady;
    const current = (await f.plan.get()).data()!;
    expect(current.executionId).not.toBe(oldId);
    releaseOld();
    expect(await oldRun).toMatchObject({ status: 'running', executionId: current.executionId, results: current.results });
    expect((await f.plan.get()).data()).toEqual(current);
    releaseNew();
    expect(await newRun).toMatchObject({ status: 'completed', outcome: { state: 'COMPLETED' } });
    expect(executeAction).toHaveBeenCalledTimes(4);
    expect((await f.agency.collection('tiktokPostDrafts').get()).size).toBe(1);
  }, 20000);
  it.each(['pause', 'cancel', 'both'].flatMap(command => [false, true].map(external => ({ command, external }))))('preserves $command through a failed action (external=$external)', async ({ command, external }) => {
    const f = await fixture(); f.ready();
    if (!external) {
      const actions = [actionSchema.parse({ kind: 'create_task', description: 'Synthetic task', dueDate: '2027-01-01' })];
      const expiresAt = Date.now() + 3600000;
      await f.plan.update({ actions, approval: approvalEnvelope(f.ctx.uid, f.ctx.agencyId, 'plan', actions, expiresAt), expiresAt });
    }
    const execute = vi.mocked(executeAction).getMockImplementation()!;
    vi.mocked(executeAction).mockImplementation(async (...args) => {
      const action = args[1];
      if (external && action.kind === 'existing_operation' && action.operation !== 'video_create') return execute(...args);
      if (command !== 'cancel') await controlPlan(f.ctx, 'plan', 'pause');
      if (command !== 'pause') await runPlan(f.ctx, 'plan', true);
      throw new Error('Synthetic interrupted response');
    });
    const status = external ? 'unknown' : command === 'pause' ? 'paused' : 'cancelled';
    expect(await runPlan(f.ctx, 'plan')).toMatchObject({ status, error: 'Synthetic interrupted response' });
    expect((await f.plan.get()).data()?.status).toBe(status);
    expect((await f.plan.get()).data()?.results).toHaveLength(external ? 1 : 0);
    if (external) {
      await expect(controlPlan(f.ctx, 'plan', 'resume')).rejects.toMatchObject({ status: 409 });
      await expect(runPlan(f.ctx, 'plan')).rejects.toMatchObject({ status: 409 });
    } else expect(await runPlan(f.ctx, 'plan')).toMatchObject({ status });
    expect(executeAction).toHaveBeenCalledTimes(external ? 2 : 1);
    expect((await f.agency.collection('tiktokStudioAssets').get()).empty).toBe(true);
    expect((await f.agency.collection('tiktokPostDrafts').get()).empty).toBe(true);
  }, 20000);
  it.each(['pause', 'cancel', 'both'].flatMap(command => ['ready', 'waiting', 'unknown'].map(outcome => ({ command, outcome }))))('stops before import when $command arrives during $outcome video verification', async ({ command, outcome }) => {
    const f = await fixture(); f.ready();
    const read = vi.mocked(invokeOperation).getMockImplementation()!;
    vi.mocked(invokeOperation).mockImplementation(async (...args) => {
      if (command !== 'cancel') await controlPlan(f.ctx, 'plan', 'pause');
      if (command !== 'pause') await runPlan(f.ctx, 'plan', true);
      if (outcome === 'ready') return read(...args);
      return { executionState: outcome === 'waiting' ? 'queued' : 'unknown', job: { id: 'job', propertyId: 'p' } };
    });
    const status = command === 'pause' ? 'paused' : 'cancelled';
    expect(await runPlan(f.ctx, 'plan')).toMatchObject({ status });
    expect((await f.plan.get()).data()).toMatchObject({ status, waitUntil: 0 });
    expect((await f.plan.get()).data()?.results).toHaveLength(2);
    expect((await f.agency.collection('tiktokStudioAssets').get()).empty).toBe(true);
    expect((await f.agency.collection('tiktokPostDrafts').get()).empty).toBe(true);
    expect(executeAction).toHaveBeenCalledTimes(2);
    if (command === 'pause') {
      f.ready();
      await controlPlan(f.ctx, 'plan', 'resume');
      expect(await runPlan(f.ctx, 'plan')).toMatchObject({ status: 'completed' });
      expect(executeAction).toHaveBeenCalledTimes(4);
    }
  }, 20000);
  it.each(['pause', 'cancel', 'both'] as const)('keeps last-step receipts and honors %s without announcing completion', async command => {
    const f = await fixture(); f.ready();
    const execute = vi.mocked(executeAction).getMockImplementation()!;
    vi.mocked(executeAction).mockImplementation(async (...args) => {
      const result = await execute(...args);
      const action = args[1];
      if (action.kind === 'existing_operation' && action.operation === 'tiktok_post_draft') {
        if (command !== 'cancel') await controlPlan(f.ctx, 'plan', 'pause');
        if (command !== 'pause') await runPlan(f.ctx, 'plan', true);
      }
      return result;
    });
    const status = command === 'pause' ? 'paused' : 'cancelled';
    expect(await runPlan(f.ctx, 'plan')).toMatchObject({ status });
    const saved = (await f.plan.get()).data()!;
    expect(saved.status).toBe(status);
    expect(saved.results).toHaveLength(4);
    expect(saved.results[3].result.draftId).toBe('draft');
    const message = f.agency.collection('assistantSessions').doc('s').collection('messages').doc('plan-result');
    expect((await message.get()).exists).toBe(false);
    expect((await f.agency.collection('tiktokPostDrafts').get()).size).toBe(1);
    expect(await runPlan(f.ctx, 'plan')).toMatchObject({ status });
    if (command === 'pause') {
      await controlPlan(f.ctx, 'plan', 'resume');
      expect(await runPlan(f.ctx, 'plan')).toMatchObject({ status: 'completed', outcome: { state: 'COMPLETED' } });
      expect((await message.get()).exists).toBe(true);
    }
    expect(executeAction).toHaveBeenCalledTimes(4);
  }, 20000);
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
  it.each([{ videoUrl: 'https://' }, { videoUrl: 'https://user:secret@fixture.example/video.mp4' }, { requestedByUid: 'other' }, { propertyId: 'other' }])('blocks unverified completed video before importing or creating a draft: %j', async patch => {
    const f = await fixture();
    vi.mocked(invokeOperation).mockResolvedValue({ executionState: 'succeeded', job: { id: 'job', propertyId: 'p', agencyId: f.ctx.agencyId, requestedByUid: f.ctx.uid, status: 'completed', videoUrl: f.url, ...patch } });
    expect(await runPlan(f.ctx, 'plan')).toMatchObject({ status: 'unknown' });
    expect((await f.plan.get()).data()?.results).toHaveLength(2);
    expect((await f.agency.collection('tiktokStudioAssets').get()).empty).toBe(true);
    expect((await f.agency.collection('tiktokPostDrafts').get()).empty).toBe(true);
    expect(executeAction).toHaveBeenCalledTimes(2);
    expect((await readPlanOutcomes(f.ctx, 'plan')).pollAfterMs).toBeNull();
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
  it.each([{ description: 'Changed after creation' }, { studioAssetId: 'different' }, { videoTourUrl: 'https://fixture.example/different.mp4' }])('does not confirm a replaced draft after execution completed: %j', async patch => {
    const f = await fixture(); f.ready();
    expect(await runPlan(f.ctx, 'plan')).toMatchObject({ status: 'completed', outcome: { state: 'COMPLETED' } });
    await f.agency.collection('tiktokPostDrafts').doc('draft').update(patch);
    expect(await readPlanOutcomes(f.ctx, 'plan')).toMatchObject({ executionStatus: 'completed', outcome: { state: 'BLOCKED' }, pollAfterMs: null });
    expect(executeAction).toHaveBeenCalledTimes(4);
  }, 20000);
  it.each([null, { sourceAssetIds: ['photo2', 'photo1'] }, { script: 'Changed script' }, { version: 2 }])('checks saved Studio content before starting render: %j', patch => {
    return (async () => {
      const f = await fixture();
      const body = { propertyId: 'p', sourceAssetIds: ['photo1', 'photo2'], script: 'Synthetic script.' };
      const project = { id: 'project', ...body, agencyId: f.ctx.agencyId, ownerUid: f.ctx.uid, version: 1, status: 'draft' };
      const actions = [
        { operation: 'tiktok_studio_project_create', body },
        { operation: 'tiktok_studio_render', params: { projectId: '@step:1:projectId' }, body: { expectedVersion: 1 } },
      ].map(action => actionSchema.parse({ kind: 'existing_operation', ...action }));
      const expiresAt = Date.now() + 3600000;
      await f.plan.update({ actions, expiresAt, approval: approvalEnvelope(f.ctx.uid, f.ctx.agencyId, 'plan', actions, expiresAt) });
      vi.mocked(executeAction).mockImplementation(async (_ctx, action: any) => {
        if (action.operation === 'tiktok_studio_project_create') {
          await f.agency.collection('tiktokStudioProjects').doc('project').set(project);
          return { projectId: 'project', project };
        }
        expect(action.operation).toBe('tiktok_studio_render');
        expect(action.params.projectId).toBe('project');
        return { executionState: 'queued' };
      });
      expect(await runPlan(f.ctx, 'plan', false, 1)).toMatchObject({ status: 'pending' });
      if (patch) await f.agency.collection('tiktokStudioProjects').doc('project').update(patch);
      const result = await runPlan(f.ctx, 'plan');
      expect(result.status).toBe(patch ? 'unknown' : 'completed');
      expect(executeAction).toHaveBeenCalledTimes(patch ? 1 : 2);
      expect(invokeOperation).not.toHaveBeenCalled();
    })();
  }, 20000);
  async function interruptedFixture() {
    const f = await fixture(); f.ready();
    await runPlan(f.ctx, 'plan');
    const results = (await f.plan.get()).data()!.results;
    for (const [index, step] of results.entries()) await f.agency.collection('assistantExecutions').doc(`plan-${index}`).set({ status: 'completed', result: step.result });
    await f.plan.update({ status: 'unknown' });
    return { ...f, results };
  }
  it.each(['pause', 'cancel', 'both'].flatMap(command => [false, true].map(uncertain => ({ command, uncertain }))))('recovers $command without replaying media effects (uncertain=$uncertain)', async ({ command, uncertain }) => {
    const f = await interruptedFixture();
    const flags = { ...(command !== 'cancel' ? { pauseRequestedAt: new Date().toISOString() } : {}), ...(command !== 'pause' ? { cancelRequestedAt: new Date().toISOString() } : {}) };
    await f.plan.update(flags);
    if (uncertain) await f.agency.collection('assistantExecutions').doc('plan-3').update({ status: 'unknown' });
    const status = uncertain ? 'unknown' : command === 'pause' ? 'paused' : 'cancelled';
    expect(await inspectPlan(f.ctx, 'plan')).toMatchObject({ status });
    expect((await f.plan.get()).data()).toMatchObject({ status, ...flags });
    expect((await f.plan.get()).data()?.results).toEqual(uncertain ? f.results.slice(0, 3) : f.results);
    if (uncertain) {
      await expect(controlPlan(f.ctx, 'plan', 'resume')).rejects.toMatchObject({ status: 409 });
      await expect(runPlan(f.ctx, 'plan')).rejects.toMatchObject({ status: 409 });
    } else if (command === 'pause') {
      await controlPlan(f.ctx, 'plan', 'resume');
      expect(await runPlan(f.ctx, 'plan')).toMatchObject({ status: 'completed' });
    }
    expect(executeAction).toHaveBeenCalledTimes(4);
    expect((await f.agency.collection('tiktokPostDrafts').get()).size).toBe(1);
  }, 20000);
  it.each(['pause', 'cancel', 'both'])('preserves a concurrent %s request during recovery', async command => {
    const f = await interruptedFixture();
    const flags = { ...(command !== 'cancel' ? { pauseRequestedAt: new Date().toISOString() } : {}), ...(command !== 'pause' ? { cancelRequestedAt: new Date().toISOString() } : {}) };
    const racedDb = new Proxy(db, { get(target, property) {
      if (property === 'runTransaction') return async (work: any) => { await f.plan.update(flags); return db.runTransaction(work); };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    await expect(inspectPlan({ ...f.ctx, adminDb: racedDb as any }, 'plan')).rejects.toMatchObject({ status: 409 });
    expect((await f.plan.get()).data()).toMatchObject({ status: 'unknown', ...flags, results: f.results });
    expect(await inspectPlan(f.ctx, 'plan')).toMatchObject({ status: command === 'pause' ? 'paused' : 'cancelled' });
    expect(executeAction).toHaveBeenCalledTimes(4);
  }, 20000);
  it('recovers verified media bindings from matching receipts without rerunning the pipeline', async () => {
    const f = await interruptedFixture();
    expect(await inspectPlan(f.ctx, 'plan')).toMatchObject({ status: 'completed', results: f.results });
    expect((await f.plan.get()).data()!.results).toEqual(f.results);
    expect(await readPlanOutcomes(f.ctx, 'plan')).toMatchObject({ outcome: { state: 'COMPLETED' } });
    expect(executeAction).toHaveBeenCalledTimes(4);
  }, 20000);
  it('does not bind old verified media to a different ledger receipt', async () => {
    const f = await interruptedFixture();
    await f.agency.collection('assistantExecutions').doc('plan-1').update({ result: { jobId: 'replacement', executionState: 'queued' } });
    await expect(inspectPlan(f.ctx, 'plan')).rejects.toThrow('reconciliere');
    expect((await f.plan.get()).data()).toMatchObject({ status: 'unknown', results: f.results });
    expect(executeAction).toHaveBeenCalledTimes(4);
  }, 20000);
  it.each(['agency', 'role', 'deleted', 'profile'])('checks membership atomically when recovery races with a %s change', async change => {
    const f = await interruptedFixture();
    const before = (await f.plan.get()).data();
    const racedDb = new Proxy(db, { get(target, property) {
      if (property === 'runTransaction') return async (work: any) => {
        const member = db.collection('users').doc(f.ctx.uid);
        if (change === 'deleted') await member.delete();
        else await member.update(change === 'agency' ? { agencyId: 'other' } : change === 'role' ? { role: 'admin' } : { displayName: 'Updated name' });
        return db.runTransaction(work);
      };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    const recovery = inspectPlan({ ...f.ctx, adminDb: racedDb as any }, 'plan');
    if (change === 'profile') {
      expect(await recovery).toMatchObject({ status: 'completed', results: f.results });
    } else {
      await expect(recovery).rejects.toMatchObject({ status: 403 });
      expect((await f.plan.get()).data()).toEqual(before);
    }
    expect(executeAction).toHaveBeenCalledTimes(4);
  }, 20000);
  it('refuses to overwrite an intervening same-status plan update during recovery', async () => {
    const f = await interruptedFixture();
    const racedDb = new Proxy(db, { get(target, property) {
      if (property === 'runTransaction') return async (work: any) => {
        await f.plan.update({ recoveryNote: 'new evidence', results: [...f.results.slice(0, -1), { ...f.results.at(-1), annotation: 'preserve' }] });
        return db.runTransaction(work);
      };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    await expect(inspectPlan({ ...f.ctx, adminDb: racedDb as any }, 'plan')).rejects.toMatchObject({ status: 409 });
    const saved = (await f.plan.get()).data()!;
    expect(saved).toMatchObject({ status: 'unknown', recoveryNote: 'new evidence' });
    expect(saved.results.at(-1).annotation).toBe('preserve');
    expect(executeAction).toHaveBeenCalledTimes(4);
  }, 20000);
  it.each(['paused', 'cancelled'].flatMap(status => [false, true].map(expired => ({ status, expired }))))('preserves $status while video remains queued (expired=$expired)', async ({ status, expired }) => {
    const f = await fixture();
    vi.mocked(invokeOperation).mockResolvedValue({ executionState: 'queued', job: { id: 'job', propertyId: 'p' } });
    expect(await runPlan(f.ctx, 'plan')).toMatchObject({ status: 'pending' });
    if (status === 'paused') await controlPlan(f.ctx, 'plan', 'pause');
    else await runPlan(f.ctx, 'plan', true);
    expect(await verifyPlanOutcome(f.ctx, 'plan', expired ? 0 : Date.now() + 60000)).toMatchObject({ status: 'completed', planStatus: status.toUpperCase(), notBefore: 0 });
    expect((await f.plan.get()).data()).toMatchObject({ status, outcome: { state: status.toUpperCase(), pending: 1 } });
    expect(executeAction).toHaveBeenCalledTimes(2);
    expect((await f.agency.collection('tiktokStudioAssets').get()).empty).toBe(true);
  }, 20000);
  it('resumes a paused video pipeline through explicit control without redoing committed steps', async () => {
    const f = await fixture();
    vi.mocked(invokeOperation).mockResolvedValue({ executionState: 'queued', job: { id: 'job', propertyId: 'p' } });
    await runPlan(f.ctx, 'plan');
    await controlPlan(f.ctx, 'plan', 'pause');
    await verifyPlanOutcome(f.ctx, 'plan', Date.now() + 60000);
    await controlPlan(f.ctx, 'plan', 'resume');
    await f.plan.update({ waitUntil: 0 }); f.ready();
    expect(await runPlan(f.ctx, 'plan')).toMatchObject({ status: 'completed', outcome: { state: 'COMPLETED' } });
    expect(executeAction).toHaveBeenCalledTimes(4);
  }, 20000);
});
