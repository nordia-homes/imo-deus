import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } }, getConversation: vi.fn(), agencyCollection: (db: Firestore, agencyId: string, name: string) => db.collection('agencies').doc(agencyId).collection(name) }));
vi.mock('../operations', () => ({ operations: {}, isReadOperation: () => false, invokeOperation: vi.fn() }));
import { assertCalendarSlot } from '@/lib/crm/calendar';
import { executeAction } from '../actions';
import type { AssistantContext } from '../access';

const host = process.env.FIRESTORE_EMULATOR_HOST;
describe.skipIf(!host)('calendar concurrency on actual Firestore transactions', () => {
  let db: Firestore;
  const agencies: string[] = [];
  beforeAll(() => {
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host || '')) throw new Error('Local emulator required');
    db = new Firestore({ projectId: 'demo-imodeus-calendar-concurrency' });
  });
  afterAll(async () => { if (!db) return; for (const agencyId of agencies) await db.recursiveDelete(db.collection('agencies').doc(agencyId)); await db.terminate(); });
  function context() {
    const agencyId = randomUUID(); agencies.push(agencyId);
    return { uid: `agent-${agencyId}`, agencyId, role: 'agent', adminDb: db } as unknown as AssistantContext;
  }
  async function reserve(ctx: AssistantContext, kind: 'tasks' | 'viewings', id: string, record: Record<string, unknown>) {
    return db.runTransaction(async tx => {
      await assertCalendarSlot(ctx, tx as any, kind, id, record);
      tx.create(db.collection('agencies').doc(ctx.agencyId).collection(kind).doc(id), record);
      return id;
    });
  }
  it('commits only one simultaneous task/viewing sharing an agent', async () => {
    const ctx = context();
    const results = await Promise.allSettled([
      reserve(ctx, 'tasks', 'task', { status: 'open', dueDate: '2030-01-12', startTime: '12:00', duration: 60, agentId: ctx.uid }),
      reserve(ctx, 'viewings', 'viewing', { status: 'scheduled', viewingDate: '2030-01-12T10:15:00.000Z', duration: 60, agentId: ctx.uid }),
    ]);
    expect(results.filter(result => result.status === 'fulfilled'), JSON.stringify(results.map(result => result.status === 'rejected' ? result.reason.message : result.status))).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ status: 409 });
  }, 20000);
  it('serializes a shared client across agents but allows unrelated simultaneous appointments', async () => {
    const ctx = context(), date = '2030-01-12T10:00:00.000Z';
    const shared = await Promise.allSettled(['one', 'two'].map(id => reserve(ctx, 'viewings', id, { status: 'scheduled', viewingDate: date, duration: 60, agentId: id, contactId: 'shared-client' })));
    expect(shared.filter(result => result.status === 'fulfilled'), JSON.stringify(shared.map(result => result.status === 'rejected' ? result.reason.message : result.status))).toHaveLength(1);
    const free = await Promise.allSettled(['three', 'four'].map(id => reserve(ctx, 'viewings', id, { status: 'scheduled', viewingDate: date, duration: 60, agentId: id, contactId: id })));
    expect(free.filter(result => result.status === 'fulfilled')).toHaveLength(2);
  }, 20000);
  it('commits one edit and ledger when two commands approve the same original task revision', async () => {
    const ctx = context(), revision = '2020-01-01T10:00:00Z';
    const profile = db.collection('users').doc(ctx.uid), agency = db.collection('agencies').doc(ctx.agencyId);
    await profile.set({ agencyId: ctx.agencyId, role: 'agent', name: 'Emulator agent' });
    await agency.collection('tasks').doc('t').set({ description: 'Original', status: 'completed', agentId: ctx.uid, updatedAt: revision });
    try {
      const results = await Promise.allSettled(['first', 'second'].map(key => executeAction(ctx, { kind: 'update_task', taskId: 't', expectedUpdatedAt: revision, description: key }, key)));
      expect(results.filter(result => result.status === 'fulfilled'), JSON.stringify(results.map(result => result.status === 'rejected' ? result.reason.message : result.status))).toHaveLength(1);
      expect((results.find(result => result.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
      expect((await agency.collection('assistantExecutions').get()).size).toBe(1);
    } finally { await profile.delete(); }
  }, 20000);
});
