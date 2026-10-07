import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ db: null as any, publish: vi.fn() }));
vi.mock('@/firebase/admin', () => ({ get adminDb() { return state.db; }, adminAuth: {} }));
vi.mock('@/lib/tiktok-marketing', () => ({ publishTikTokPostDraft: state.publish, renderTikTokStudioProject: vi.fn(), refreshTikTokPostDraftStatus: vi.fn() }));
import { scheduleTikTokPost, cancelScheduledTikTokPost, drainStudioRenders } from '@/lib/tiktok-studio-jobs';
import { bindBusinessRevisions } from '../business-revisions';
import { approvalEnvelope, validateApproval } from '../approval';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('TikTok approval and scheduling on actual Firestore', () => {
  let db: Firestore;
  const agencies: string[] = [], users: string[] = [];
  beforeAll(() => {
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
    db = new Firestore({ projectId: 'demo-imodeus-tiktok-schedule' }); state.db = db;
  });
  beforeEach(() => { state.publish.mockReset(); state.publish.mockResolvedValue({}); });
  afterAll(async () => {
    if (!db) return;
    for (const id of agencies) await db.recursiveDelete(db.collection('agencies').doc(id));
    for (const id of users) await db.collection('users').doc(id).delete();
    for (const row of (await db.collection('tiktokStudioJobs').get()).docs) await row.ref.delete();
    await db.terminate();
  });
  async function fixture() {
    const agencyId = randomUUID(), uid = randomUUID(); agencies.push(agencyId); users.push(uid);
    await db.collection('users').doc(uid).set({ agencyId, role: 'agent' });
    const ref = db.collection('agencies').doc(agencyId).collection('tiktokPostDrafts').doc('draft');
    await ref.set({ agencyId, createdByUid: uid, status: 'draft', consentedAt: new Date().toISOString(), description: 'Text aprobat', videoTourUrl: 'https://example.test/video.mp4', targetOpenId: 'synthetic-profile', privacyLevel: 'SELF_ONLY' });
    const runAt = new Date(Date.now() + 3600000).toISOString();
    const actions = await bindBusinessRevisions({ agencyId, uid, role: 'agent', adminDb: db } as any, [{ kind: 'existing_operation', operation: 'tiktok_post_schedule', params: { draftId: ref.id }, query: {}, body: { confirm: true, runAt } }]);
    validateApproval(approvalEnvelope(uid, agencyId, 'plan', actions, Date.now() + 60000), uid, agencyId, 'plan', actions);
    const action = actions[0]; if (action.kind !== 'existing_operation') throw new Error('Wrong action');
    const revision = action.body.expectedDraftRevision;
    const job = db.collection('tiktokStudioJobs').doc(`publish_${agencyId}_${ref.id}`);
    const schedule = () => scheduleTikTokPost(agencyId, uid, ref.id, runAt, revision);
    const due = async () => { const batch = db.batch(); batch.update(job, { runAt: '2020-01-01T00:00:00Z' }); batch.update(ref, { scheduledAt: '2020-01-01T00:00:00Z' }); await batch.commit(); };
    return { agencyId, uid, ref, job, revision, schedule, due };
  }
  it('prepares and approves a concrete draft, schedules once under concurrency and invokes the simulated publisher once', async () => {
    const f = await fixture();
    await Promise.all([f.schedule(), f.schedule()]);
    expect((await f.job.get()).data()).toMatchObject({ status: 'queued', draftRevision: f.revision });
    await drainStudioRenders(); expect(state.publish).not.toHaveBeenCalled();
    await f.due(); await Promise.all([drainStudioRenders(), drainStudioRenders()]); await drainStudioRenders();
    expect(state.publish).toHaveBeenCalledTimes(1);
    expect((await f.job.get()).data()?.status).toBe('completed');
    expect((await f.ref.get()).data()?.scheduleStatus).toBe('sent');
  }, 30000);
  it.each(['description', 'videoTourUrl', 'targetOpenId'])('refuses a changed %s between approval and scheduling without writes', async field => {
    const f = await fixture(); await f.ref.update({ [field]: 'changed' });
    await expect(f.schedule()).rejects.toThrow('după aprobare');
    expect((await f.job.get()).exists).toBe(false); expect(state.publish).not.toHaveBeenCalled();
  });
  it('refuses changed content after scheduling and never retries the failed job', async () => {
    const f = await fixture(); await f.schedule(); await f.due(); await f.ref.update({ description: 'Changed' });
    await drainStudioRenders(); await drainStudioRenders();
    expect(state.publish).not.toHaveBeenCalled(); expect((await f.job.get()).data()?.status).toBe('failed');
    expect((await f.ref.get()).data()?.scheduleStatus).toBe('error');
  });
  it('cancels durably before claiming and rejects another author', async () => {
    const f = await fixture(); await f.schedule(); await f.due();
    await expect(cancelScheduledTikTokPost(f.agencyId, 'other', f.ref.id)).rejects.toThrow();
    await cancelScheduledTikTokPost(f.agencyId, f.uid, f.ref.id); await drainStudioRenders();
    expect(state.publish).not.toHaveBeenCalled(); expect((await f.job.get()).data()?.status).toBe('canceled');
    expect((await f.ref.get()).data()?.scheduleStatus).toBe('none');
  });
  it('blocks revoked membership before invoking the publisher', async () => {
    const f = await fixture(); await f.schedule(); await f.due();
    await db.collection('users').doc(f.uid).update({ agencyId: 'other' }); await drainStudioRenders();
    expect(state.publish).not.toHaveBeenCalled(); expect((await f.job.get()).data()?.status).toBe('failed');
  });
  it.each([false, true])('preserves a replaced claim after simulated provider completion (failure=%s)', async fails => {
    const f = await fixture(); await f.schedule(); await f.due();
    state.publish.mockImplementationOnce(async () => {
      await f.job.update({ owner: 'replacement', status: 'completed' });
      await f.ref.update({ scheduleStatus: 'replacement-state' });
      if (fails) throw new Error('simulated timeout');
      return {};
    });
    await drainStudioRenders();
    expect((await f.ref.get()).data()?.scheduleStatus).toBe('replacement-state');
    expect((await f.job.get()).data()).toMatchObject({ status: 'completed', owner: 'replacement' });
  });
});
