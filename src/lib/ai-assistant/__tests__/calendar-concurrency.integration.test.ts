import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } }, getConversation: vi.fn(), agencyCollection: (db: Firestore, agencyId: string, name: string) => db.collection('agencies').doc(agencyId).collection(name) }));
vi.mock('../operations', () => ({ operations: {}, isReadOperation: () => false, invokeOperation: vi.fn() }));
import { assertCalendarSlot } from '@/lib/crm/calendar';
import { executeAction } from '../actions';
import { continuePlanRevision } from '../plan-revisions';
import type { AssistantContext } from '../access';
import { automationSchema } from '../contracts';
import { runEventRule, type EventRule } from '../event-rules';

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
      const winner = results.find(result => result.status === 'fulfilled') as PromiseFulfilledResult<any>;
      const deletion = continuePlanRevision({ kind: 'delete_task', taskId: 't', expectedUpdatedAt: revision }, [{ step: 1, result: winner.value }]);
      const deleted = await executeAction(ctx, deletion, 'delete-after-edit');
      expect(deleted).toMatchObject({ deleted: true });
      expect(deleted).not.toHaveProperty('mutationRevision');
      expect((await agency.collection('tasks').doc('t').get()).exists).toBe(false);
      expect((await agency.collection('assistantExecutions').get()).size).toBe(2);
    } finally { await profile.delete(); }
  }, 20000);
  it('commits only one concurrent contact/preferences edit from the same approved snapshot', async () => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId), profile = db.collection('users').doc(ctx.uid);
    const revision = '2020-01-01T10:00:00Z';
    await profile.set({ agencyId: ctx.agencyId, role: 'agent', name: 'Emulator agent' });
    await agency.collection('contacts').doc('c').set({ name: 'Original', updatedAt: revision, preferences: { desiredRooms: 2, desiredPriceRangeMin: 100000, desiredPriceRangeMax: 120000 } });
    try {
      const results = await Promise.allSettled([
        executeAction(ctx, { kind: 'update_contact', contactId: 'c', expectedUpdatedAt: revision, patch: { name: 'Actualizat', preferences: { desiredPriceRangeMax: 130000 } } }, 'contact-edit'),
        executeAction(ctx, { kind: 'update_preferences', contactId: 'c', expectedUpdatedAt: revision, preferences: { desiredRooms: 3 } }, 'requirements-edit'),
      ]);
      expect(results.filter(result => result.status === 'fulfilled'), JSON.stringify(results.map(result => result.status === 'rejected' ? result.reason.message : result.status))).toHaveLength(1);
      expect((results.find(result => result.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
      expect((await agency.collection('assistantExecutions').get()).size).toBe(1);
      const saved = (await agency.collection('contacts').doc('c').get()).data()!;
      if (saved.name === 'Actualizat') expect(saved.preferences).toMatchObject({ desiredRooms: 2, desiredPriceRangeMax: 130000 });
      else expect(saved).toMatchObject({ name: 'Original', preferences: { desiredRooms: 3, desiredPriceRangeMax: 120000 } });
    } finally { await profile.delete(); }
  }, 20000);
  it('chains committed contact edits, preserves idempotency and refuses an intervening manual edit', async () => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId), profile = db.collection('users').doc(ctx.uid);
    const revision = '2020-01-01T10:00:00Z';
    await profile.set({ agencyId: ctx.agencyId, role: 'agent', name: 'Emulator agent' });
    const contact = agency.collection('contacts').doc('c');
    await contact.set({ name: 'Original', updatedAt: revision, preferences: { desiredRooms: 2 } });
    try {
      const first = await executeAction(ctx, { kind: 'update_contact', contactId: 'c', expectedUpdatedAt: revision, patch: { name: 'Plan edit' } }, 'plan-first');
      const previous = [{ step: 1, result: first }];
      const second = continuePlanRevision({ kind: 'update_preferences', contactId: 'c', expectedUpdatedAt: revision, preferences: { desiredRooms: 3 } }, previous);
      const result = await executeAction(ctx, second, 'plan-second');
      expect(await executeAction(ctx, second, 'plan-second')).toEqual(result);
      expect((await contact.get()).data()).toMatchObject({ name: 'Plan edit', preferences: { desiredRooms: 3 } });
      expect((await agency.collection('assistantExecutions').get()).size).toBe(2);
      const third = continuePlanRevision({ kind: 'archive_contact', contactId: 'c', expectedUpdatedAt: revision, archived: true }, [...previous, { step: 2, result }]);
      await contact.update({ name: 'Manual intervening edit', updatedAt: '2030-01-01T10:00:00Z' });
      await expect(executeAction(ctx, third, 'plan-third')).rejects.toMatchObject({ status: 409 });
      expect((await agency.collection('assistantExecutions').get()).size).toBe(2);
      expect((await contact.get()).data()?.archivedAt).toBeUndefined();
      expect((await contact.get()).data()?.name).toBe('Manual intervening edit');
    } finally { await profile.delete(); }
  }, 20000);
  it('deduplicates concurrent event-rule task and notification effects on real transactions', async () => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId), profile = db.collection('users').doc(ctx.uid);
    const startedAt = '2030-01-01T10:00:00.000Z';
    await profile.set({ agencyId: ctx.agencyId, role: 'agent' });
    await agency.collection('contacts').doc('c').set({ name: 'Emulator client', status: 'Contactat' });
    await agency.collection('crmEvents').doc('e').set({ source: 'firestore_change', actorId: ctx.uid, capability: 'contacts.updated', occurredAt: '2030-01-01T10:10:00.000Z', recordedAt: '2030-01-01T10:11:00.000Z', entities: { contactId: 'c' } });
    const rule = automationSchema.parse({ type: 'event_rule', nextRunAt: startedAt, intervalMinutes: 30, maxRuns: 10, trigger: { resource: 'contacts', change: 'updated' }, effects: [{ kind: 'create_task', description: 'Follow-up emulator', dueAfterMinutes: 60 }, { kind: 'notify', title: 'Client actualizat' }] }) as EventRule;
    const claim = { id: 'r', createdAt: startedAt };
    try {
      const results = await Promise.allSettled([1, 2].map(() => runEventRule(ctx, claim, rule, executeAction, async () => {})));
      expect(results.every(result => result.status === 'fulfilled'), JSON.stringify(results.map(result => result.status === 'rejected' ? result.reason.message : result.value))).toBe(true);
      await runEventRule(ctx, claim, rule, executeAction, async () => {});
      expect((await agency.collection('tasks').get()).size).toBe(1);
      expect((await agency.collection('assistantExecutions').get()).size).toBe(1);
      expect((await profile.collection('notifications').get()).size).toBe(1);
      expect((await agency.collection('assistantAutomations').doc('r').collection('events').get()).size).toBe(1);
    } finally { await db.recursiveDelete(profile); }
  }, 20000);
  it('recovers an interrupted rule without repeating its committed task', async () => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId), profile = db.collection('users').doc(ctx.uid);
    const startedAt = '2030-01-02T10:00:00.000Z';
    await profile.set({ agencyId: ctx.agencyId, role: 'agent' });
    await agency.collection('contacts').doc('c').set({ name: 'Emulator client', status: 'Contactat' });
    await agency.collection('crmEvents').doc('e').set({ source: 'firestore_change', actorId: ctx.uid, capability: 'contacts.updated', occurredAt: '2030-01-02T10:10:00.000Z', recordedAt: '2030-01-02T10:11:00.000Z', entities: { contactId: 'c' } });
    const rule = automationSchema.parse({ type: 'event_rule', nextRunAt: startedAt, intervalMinutes: 30, maxRuns: 10, trigger: { resource: 'contacts', change: 'updated' }, effects: [{ kind: 'create_task', description: 'Follow-up emulator', dueAfterMinutes: 60 }, { kind: 'notify', title: 'Client actualizat' }] }) as EventRule;
    const claim = { id: 'r', createdAt: startedAt };
    let checks = 0;
    try {
      await expect(runEventRule(ctx, claim, rule, executeAction, async () => { if (++checks === 3) throw new Error('Simulated lease loss'); })).rejects.toThrow('Simulated lease loss');
      expect((await agency.collection('tasks').get()).size).toBe(1);
      expect((await profile.collection('notifications').get()).size).toBe(0);
      await runEventRule(ctx, claim, rule, executeAction, async () => {});
      expect((await agency.collection('tasks').get()).size).toBe(1);
      expect((await profile.collection('notifications').get()).size).toBe(1);
      expect((await agency.collection('assistantAutomations').doc('r').collection('events').get()).size).toBe(1);
    } finally { await db.recursiveDelete(profile); }
  }, 20000);
});
