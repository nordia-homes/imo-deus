import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } } }));
vi.mock('../access', () => ({ collectionFor: (ctx: any, name: string) => ctx.adminDb.collection('agencies').doc(ctx.agencyId).collection(name), referencesAllowed: async () => true }));
vi.mock('../workspace', () => ({ chatTurn: vi.fn(), runPlan: vi.fn(), getPlan: vi.fn() }));
vi.mock('../outcome-watcher', () => ({ verifyPlanOutcome: vi.fn() }));
import { verifyPlanOutcome } from '../outcome-watcher';
import { chatTurn, runPlan } from '../workspace';
import { drainAgentJobs, enqueueTurn, renewAgentJobLease, recoverAgentJob } from '../jobs';
import type { AssistantContext } from '../access';

const host = process.env.FIRESTORE_EMULATOR_HOST;
describe.skipIf(!host)('worker claims on actual Firestore transactions', () => {
  let db: Firestore;
  const fixtures: { uid: string; agencyId: string; requestId: string }[] = [];
  beforeAll(() => {
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host || '')) throw new Error('Local emulator required');
    db = new Firestore({ projectId: 'demo-imodeus-worker-concurrency' });
  });
  afterAll(async () => {
    if (!db) return;
    for (const row of fixtures) {
      await db.collection('assistantAgentJobs').doc(row.requestId).delete();
      await db.collection('users').doc(row.uid).delete();
      await db.recursiveDelete(db.collection('agencies').doc(row.agencyId));
    }
    await db.terminate();
  });
  async function fixture() {
    const id = randomUUID(), row = { uid: id, agencyId: id, requestId: id }; fixtures.push(row);
    await db.collection('users').doc(id).set({ agencyId: id, role: 'agent' });
    const ctx = { ...row, role: 'agent', runtimeMode: 'real', adminDb: db } as unknown as AssistantContext;
    await enqueueTurn(ctx, { sessionId: id, requestId: id, prompt: 'Citire de test' });
    return row;
  }
  it('allows only one of two workers to invoke the turn', async () => {
    vi.mocked(chatTurn).mockReset();
    const row = await fixture();
    vi.mocked(chatTurn).mockResolvedValue({ message: { id: 'reply', text: 'confirmed', accessRefs: [] } } as any);
    await Promise.all([drainAgentJobs(db as any), drainAgentJobs(db as any)]);
    expect(chatTurn).toHaveBeenCalledTimes(1);
    expect((await db.collection('assistantAgentJobs').doc(row.requestId).get()).data()?.status).toBe('completed');
  }, 20000);
  it('recovers a late polling crash once under two workers without replaying a turn or plan', async () => {
    vi.mocked(chatTurn).mockClear(); vi.mocked(runPlan).mockClear(); vi.mocked(verifyPlanOutcome).mockReset();
    const row = await fixture(), ref = db.collection('assistantAgentJobs').doc(row.requestId);
    const deadline = Date.now() + 60000;
    await ref.update({ jobType: 'verification', planId: 'plan', status: 'running', attempts: 80, leaseUntil: 0, deadline });
    vi.mocked(verifyPlanOutcome).mockResolvedValue({ status: 'completed', planStatus: 'COMPLETED', notBefore: 0 } as any);
    await Promise.all([drainAgentJobs(db as any), drainAgentJobs(db as any)]);
    expect(verifyPlanOutcome).toHaveBeenCalledTimes(1);
    expect(verifyPlanOutcome).toHaveBeenCalledWith(expect.objectContaining({ uid: row.uid, agencyId: row.agencyId }), 'plan', deadline);
    expect((await ref.get()).data()).toMatchObject({ status: 'completed', attempts: 81, recoveryAttempts: 1, deadline });
    expect(chatTurn).not.toHaveBeenCalled(); expect(runPlan).not.toHaveBeenCalled();
  }, 30000);
  it('limits repeated interrupted checks without extending the original deadline', async () => {
    const row = await fixture(), ref = db.collection('assistantAgentJobs').doc(row.requestId);
    const deadline = Date.now() + 60000;
    await ref.update({ jobType: 'verification', status: 'running', attempts: 80, leaseUntil: 0, deadline });
    for (let count = 1; count <= 2; count++) {
      await Promise.all([recoverAgentJob(db as any, ref as any), recoverAgentJob(db as any, ref as any)]);
      expect((await ref.get()).data()).toMatchObject({ status: 'pending', recoveryAttempts: count, deadline });
      await ref.update({ status: 'running', leaseUntil: 0 });
    }
    await recoverAgentJob(db as any, ref as any);
    expect((await ref.get()).data()).toMatchObject({ status: 'failed', planStatus: 'BLOCKED', recoveryAttempts: 2, deadline });
  }, 30000);
  it('rechecks revoked membership after recovering verification', async () => {
    vi.mocked(verifyPlanOutcome).mockClear();
    const row = await fixture(), ref = db.collection('assistantAgentJobs').doc(row.requestId);
    await ref.update({ jobType: 'verification', status: 'running', attempts: 80, leaseUntil: 0, deadline: Date.now() + 60000 });
    await db.collection('users').doc(row.uid).update({ agencyId: 'other' });
    await drainAgentJobs(db as any);
    expect(verifyPlanOutcome).not.toHaveBeenCalled();
    expect((await ref.get()).data()).toMatchObject({ status: 'failed', error: 'Acces revocat.' });
  }, 20000);
  it('renews a silent operation without changing progress and refuses a replacement claim', async () => {
    const row = await fixture(), ref = db.collection('assistantAgentJobs').doc(row.requestId);
    await ref.update({ status: 'running', claimId: 'active', leaseUntil: Date.now() + 5000, events: [{ text: 'preserve' }] });
    const ctx = { uid: row.uid, role: 'agent', agencyId: row.agencyId, agentJobFence: { jobId: row.requestId, claimId: 'active' } } as AssistantContext;
    await renewAgentJobLease(db as any, ctx);
    const updated = (await ref.get()).data()!;
    expect(updated.leaseUntil).toBeGreaterThan(Date.now() + 250000); expect(updated.events).toEqual([{ text: 'preserve' }]);
    await ref.update({ claimId: 'replacement', leaseUntil: Date.now() + 60000 });
    await expect(renewAgentJobLease(db as any, ctx)).rejects.toMatchObject({ status: 409 });
    expect((await ref.get()).data()?.claimId).toBe('replacement');
  }, 20000);
  it('rejects old progress after lease takeover without changing the new result', async () => {
    vi.mocked(chatTurn).mockReset();
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const row = await fixture(), ref = db.collection('assistantAgentJobs').doc(row.requestId);
      let started!: () => void, resume!: () => void;
      const entered = new Promise<void>(resolve => { started = resolve; });
      const gate = new Promise<void>(resolve => { resume = resolve; });
      vi.mocked(chatTurn).mockImplementationOnce(async (_ctx, _input, progress) => {
        started(); await gate;
        await progress!({ type: 'PROGRESS_EVENT', stage: 'planning', text: 'old claim' } as any);
        throw new Error('must not continue');
      }).mockResolvedValueOnce({ message: { id: 'new-reply', text: 'new claim', accessRefs: [] } } as any);
      const first = drainAgentJobs(db as any);
      await entered;
      try {
        await ref.update({ leaseUntil: 0 });
        await drainAgentJobs(db as any);
      } finally { resume(); }
      await first;
      expect(chatTurn).toHaveBeenCalledTimes(2);
      const final = (await ref.get()).data()!;
      expect(final).toMatchObject({ status: 'completed', message: { id: 'new-reply', text: 'new claim' }, attempts: 2 });
      expect(final.events).not.toContainEqual(expect.objectContaining({ text: 'old claim' }));
    } finally { log.mockRestore(); }
  }, 20000);
});
