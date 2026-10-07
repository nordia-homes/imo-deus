import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } }, getConversation: vi.fn(), agencyCollection: (db: Firestore, agencyId: string, name: string) => db.collection('agencies').doc(agencyId).collection(name) }));
vi.mock('../operations', () => ({ operations: {}, isReadOperation: () => false, invokeOperation: vi.fn() }));
vi.mock('../legal-source', () => ({ readOfficialSource: vi.fn() }));
vi.mock('../plan-outcomes', () => ({ readPlanOutcomes: vi.fn() }));
import { assertCalendarSlot } from '@/lib/crm/calendar';
import { executeAction } from '../actions';
import { continuePlanRevision } from '../plan-revisions';
import type { AssistantContext } from '../access';
import { automationSchema } from '../contracts';
import { runEventRule, type EventRule } from '../event-rules';
import { deliverDailyBrief } from '../daily-brief';
import { briefSettingsSchema } from '../daily-brief-contract';
import { watchOfficialSources } from '../legal-source-watch';
import { readOfficialSource } from '../legal-source';
import { searchProperties } from '../search';
import { searchSchema } from '../contracts';
import { readPlanOutcomes } from '../plan-outcomes';
import { verifyPlanOutcome, enqueueOutcomeWatch } from '../outcome-watcher';

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
  it('rejects a stale outcome on real Firestore updateTime and uses tenant-bound watch identities', async () => {
    const ctx = context(), second = context();
    const profiles = [ctx, second].map(c => db.collection('users').doc(c.uid));
    const plans = [ctx, second].map(c => db.collection('agencies').doc(c.agencyId).collection('assistantPlans').doc('same-plan-id'));
    const watchIds: string[] = [];
    try {
      for (const [i, c] of [ctx, second].entries()) {
        await profiles[i].set({ agencyId: c.agencyId, role: 'agent' });
        await plans[i].set({ ownerId: c.uid, sessionId: 'session', status: 'completed', actions: [], results: [], outcome: { state: 'WAITING_PROVIDER' } });
        await enqueueOutcomeWatch(c, 'same-plan-id');
        const jobs = await db.collection('assistantAgentJobs').where('agencyId', '==', c.agencyId).get();
        expect(jobs.size).toBe(1); watchIds.push(jobs.docs[0].id);
      }
      expect(new Set(watchIds).size).toBe(2);
      const old = await plans[0].get();
      await plans[0].update({ sameStatusConcurrentChange: true });
      const outcome = { schemaVersion: 1 as const, state: 'COMPLETED' as const, confirmed: 1, total: 1, pending: 0, uncertain: 0, failed: 0, checkedAt: new Date().toISOString(), note: 'Synthetic provider evidence' };
      vi.mocked(readPlanOutcomes).mockResolvedValue({ planId: 'same-plan-id', planRevision: `${old.updateTime!.seconds}:${old.updateTime!.nanoseconds}`, executionStatus: 'completed', pollAfterMs: null, outcome, rows: [], checkedAt: outcome.checkedAt, note: '' });
      expect(await verifyPlanOutcome(ctx, 'same-plan-id', Date.now() + 60000)).toMatchObject({ status: 'pending' });
      expect((await plans[0].get()).data()?.outcome.state).toBe('WAITING_PROVIDER');
      const fresh = await plans[0].get();
      vi.mocked(readPlanOutcomes).mockResolvedValue({ planId: 'same-plan-id', planRevision: `${fresh.updateTime!.seconds}:${fresh.updateTime!.nanoseconds}`, executionStatus: 'completed', pollAfterMs: null, outcome, rows: [], checkedAt: outcome.checkedAt, note: '' });
      expect(await verifyPlanOutcome(ctx, 'same-plan-id', Date.now() + 60000)).toMatchObject({ status: 'completed', planStatus: 'COMPLETED' });
      expect((await plans[0].get()).data()?.outcome.state).toBe('COMPLETED');
    } finally {
      await Promise.all(profiles.map(profile => profile.delete()));
      await Promise.all(watchIds.map(id => db.collection('assistantAgentJobs').doc(id).delete()));
    }
  }, 30000);
  it('excludes exact CRM imports across query chunks and pages without leaking another agency', async () => {
    const ctx = context(), other = context(), agency = db.collection('agencies').doc(ctx.agencyId);
    await agency.set({ city: 'Bucuresti' });
    const ids = Array.from({ length: 35 }, (_, i) => `${ctx.uid}-${String(i).padStart(3, '0')}`);
    const batch = db.batch();
    for (const [i, id] of ids.entries()) {
      batch.set(db.collection('ownerListings').doc(id), { scopeKey: 'bucuresti-ilfov', publicationStatus: 'ready', isCanonical: true, location: 'Titan', transactionType: 'sale', propertyType: 'apartment', roomsValue: 2, constructionYear: 1988, price: '120000 EUR', link: `https://source.example/${id}` });
      if (i < 31) batch.set(agency.collection('properties').doc(`import-${i}`), { ownerListingId: id, status: 'Inactiv' });
    }
    batch.set(agency.collection('properties').doc('url-import'), { ownerListingUrl: `https://source.example/${ids[31]}` });
    batch.set(db.collection('agencies').doc(other.agencyId).collection('properties').doc('foreign'), { ownerListingId: ids[33] });
    await batch.commit();
    try {
      const query = searchSchema.parse({ source: 'owners', zone: 'Titan', rooms: 2, yearMin: 1978, excludeImported: true, limit: 2 });
      const first = await searchProperties(ctx, query);
      expect(first.rows.map(row => row.id)).toEqual(ids.slice(32, 34));
      expect(first.crmComparison).toMatchObject({ mode: 'exact_references', excludedOnThisPage: 32, semanticDuplicateDetection: false });
      expect(first.complete).toBe(false);
      const second = await searchProperties(ctx, { ...query, cursor: first.nextCursor! });
      expect(second.rows.map(row => row.id)).toEqual(ids.slice(34)); expect(second.complete).toBe(true);
      await expect(searchProperties(ctx, { ...query, excludeImported: false, cursor: first.nextCursor! })).rejects.toThrow('Cursorul');
      await agency.collection('properties').doc('new-import').set({ ownerListingId: ids[32] });
      expect((await searchProperties(ctx, query)).rows.map(row => row.id)).toEqual(ids.slice(33));
    } finally { await Promise.all(ids.map(id => db.collection('ownerListings').doc(id).delete())); }
  }, 30000);
  it('delivers one daily brief under simultaneous real transactions', async () => {
    const ctx = context(), profile = db.collection('users').doc(ctx.uid), agency = db.collection('agencies').doc(ctx.agencyId);
    await profile.set({ agencyId: ctx.agencyId, role: 'agent' });
    await agency.collection('tasks').doc('overdue').set({ description: 'Sarcină de test', agentId: ctx.uid, status: 'open', dueDate: '2020-01-01' });
    const settings = briefSettingsSchema.parse({ timezone: 'Europe/Bucharest', deliveryTime: '08:30', daysOfWeek: [1, 2, 3, 4, 5] });
    try {
      const results = await Promise.all([1, 2].map(() => deliverDailyBrief(ctx, settings, new Date('2026-10-06T06:00:00Z'))));
      expect(results.filter(row => 'status' in row && row.status === 'delivered')).toHaveLength(1);
      expect((await profile.collection('notifications').get()).size).toBe(1);
      expect((await agency.collection('assistantArtifacts').get()).size).toBe(1);
      await deliverDailyBrief(ctx, settings, new Date('2026-10-06T07:00:00Z'));
      expect((await profile.collection('notifications').get()).size).toBe(1);
    } finally { await db.recursiveDelete(profile); }
  }, 20000);
  it('notifies once for a changed official source and blocks a stale automation lease', async () => {
    const ctx = context(), profile = db.collection('users').doc(ctx.uid), job = db.collection('assistantAutomationJobs').doc(ctx.uid);
    ctx.automationFence = { jobId: ctx.uid, claimId: 'claim' };
    await profile.set({ agencyId: ctx.agencyId, role: 'agent' });
    await job.set({ agencyId: ctx.agencyId, actorId: ctx.uid, actorRole: 'agent', claimId: 'claim', status: 'running', leaseUntil: Date.now() + 60000 });
    const urls = ['https://www.ancpi.ro/fixture.pdf'];
    try {
      vi.mocked(readOfficialSource).mockResolvedValue({ snapshotId: 'version-1', authority: 'Fixture authority' });
      const baseline = await watchOfficialSources(ctx, ctx.uid, urls);
      expect((await profile.collection('notifications').get()).size).toBe(0);
      vi.mocked(readOfficialSource).mockResolvedValue({ snapshotId: 'version-2', authority: 'Fixture authority' });
      await Promise.all([1, 2].map(() => watchOfficialSources(ctx, ctx.uid, urls, baseline.versions)));
      expect((await profile.collection('notifications').get()).size).toBe(1);
      await job.update({ status: 'paused' });
      vi.mocked(readOfficialSource).mockResolvedValue({ snapshotId: 'version-3', authority: 'Fixture authority' });
      await expect(watchOfficialSources(ctx, ctx.uid, urls, baseline.versions)).rejects.toThrow('oprită');
      expect((await profile.collection('notifications').get()).size).toBe(1);
    } finally { await db.recursiveDelete(profile); await job.delete(); }
  }, 20000);
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
    for (let round = 0; round < 3; round++) {
      const ctx = context(), date = '2030-01-12T10:00:00.000Z';
      const shared = await Promise.allSettled(['one', 'two'].map(id => reserve(ctx, 'viewings', id, { status: 'scheduled', viewingDate: date, duration: 60, agentId: id, contactId: 'shared-client' })));
      expect(shared.filter(result => result.status === 'fulfilled'), JSON.stringify(shared.map(result => result.status === 'rejected' ? result.reason.message : result.status))).toHaveLength(1);
      const free = await Promise.allSettled(['three', 'four'].map(id => reserve(ctx, 'viewings', id, { status: 'scheduled', viewingDate: date, duration: 60, agentId: id, contactId: id })));
      expect(free.filter(result => result.status === 'fulfilled'), JSON.stringify(free.map(result => result.status === 'rejected' ? result.reason.message : result.status))).toHaveLength(2);
    }
  }, 60000);
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
