import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
import { reconcileCrmHistory } from '../reconciliation';
import { executeAction } from '../actions';
import type { AssistantContext } from '../access';
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('reconciliation and automation fences on actual transactions', () => {
  let db: Firestore, ctx: AssistantContext;
  const id = randomUUID();
  beforeAll(async () => {
    if (!/^(localhost|127\.0\.0\.1):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
    db = new Firestore({ projectId: 'demo-imodeus-reconciliation' });
    ctx = { uid: id, agencyId: id, role: 'agent', adminDb: db } as unknown as AssistantContext;
    await db.collection('users').doc(id).set({ role: 'agent', agencyId: id });
    const sales = db.collection('agencies').doc(id).collection('sales');
    await sales.doc('a').set({ stage: 'negotiation', agentId: id });
    await sales.doc('b').set({ stage: 'reservation', agentId: 'other', collaboratorIds: [id] });
    await sales.doc('c').set({ stage: 'closed', agentId: 'other' });
  });
  afterAll(async () => { if (!db) return; await db.recursiveDelete(db.collection('agencies').doc(id)); await db.collection('users').doc(id).delete(); await db.collection('assistantAutomationJobs').doc(id).delete(); await db.terminate(); });
  it('paginates the entire source, excludes inaccessible dossiers and reuses the same checkpoint', async () => {
    const first = await reconcileCrmHistory(ctx, { resource: 'sales', limit: 1 });
    expect(first).toMatchObject({ reconciled: 1, complete: false });
    const second = await reconcileCrmHistory(ctx, { resource: 'sales', limit: 2, cursor: first.nextCursor! });
    expect(second).toMatchObject({ reconciled: 1, inaccessible: 1, complete: true });
    const retry = await reconcileCrmHistory(ctx, { resource: 'sales', limit: 50 });
    expect(retry).toMatchObject({ reconciled: 0, current: 2, inaccessible: 1 });
    const events = await db.collection('agencies').doc(id).collection('crmEvents').get();
    expect(events.size).toBe(2); expect(events.docs.every(doc => doc.data().source === 'reconciled_snapshot')).toBe(true);
    expect(events.docs.every(doc => doc.data().actorEvidence === 'reconciler_not_original_actor')).toBe(true);
    await db.collection('users').doc(id).update({ role: 'admin' });
    await expect(reconcileCrmHistory(ctx, { resource: 'sales', limit: 2, cursor: first.nextCursor! })).rejects.toMatchObject({ status: 403 });
    await db.collection('users').doc(id).update({ role: 'agent' });
  });
  it('refuses an old automation worker before it commits an internal action or ledger', async () => {
    const job = db.collection('assistantAutomationJobs').doc(id);
    await job.set({ agencyId: id, actorId: id, actorRole: 'agent', status: 'paused', claimId: 'old', leaseUntil: Date.now() + 60000 });
    ctx.automationFence = { jobId: id, claimId: 'old' };
    await expect(executeAction(ctx, { kind: 'create_task', description: 'Must not be created', dueDate: '2027-01-01' }, 'stale-worker')).rejects.toMatchObject({ status: 409 });
    const agency = db.collection('agencies').doc(id);
    expect((await agency.collection('tasks').get()).empty).toBe(true);
    expect((await agency.collection('assistantExecutions').doc('stale-worker').get()).exists).toBe(false);
  });
});
