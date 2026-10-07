import { createHash, randomUUID } from 'node:crypto';
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
import { drainAssistantAutomations } from '../automation-worker';
import { nextBriefRun } from '../daily-brief-contract';
import { readBriefDelivery } from '../brief-delivery';
import { stableId } from '@/lib/communications/crypto';
import { recipientRevision } from '@/lib/communications/recipient-revision';
import { reconcileRuleNotifications } from '../notification-relevance';
import { createInsightNotification } from '../insight-notifications';
import * as insightReports from '../insights';
import { saveNotificationFeedback } from '../notification-feedback';
import { createMatchingNotification } from '../matching-notifications';
import { matchingRevision } from '../matching-revision';
import { createOwnerWatchNotification } from '../owner-watch-notifications';
import { notificationTransactionReads } from '../notification-transaction';
import { readNotificationBudget } from '../notification-budget';

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
  it.each(['owner', 'matching'] as const)('shares %s cooldown across concurrent independent automations', async kind => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId), profile = db.collection('users').doc(ctx.uid);
    const listing = db.collection('ownerListings').doc(randomUUID());
    const contact = { status: 'Nou' }, property = { status: 'Activ', price: 120000 };
    await profile.set({ agencyId: ctx.agencyId, role: 'agent' });
    await agency.collection('contacts').doc('c').set(contact); await agency.collection('properties').doc('p').set(property);
    await listing.set({ scopeKey: 'brasov', publicationStatus: 'ready', isCanonical: true, transactionType: 'sale' });
    const deliver = (id: string, minutes = 60) => kind === 'owner'
      ? createOwnerWatchNotification(ctx, id, id, listing.id, searchSchema.parse({ scopeKey: 'brasov' }), undefined, minutes)
      : createMatchingNotification(ctx, id, id, 'c', { id: 'p', title: 'Fixture', sourceContactRevision: matchingRevision(contact), matchingRevision: matchingRevision(property) }, undefined, minutes);
    try {
      const results = await Promise.all(['one', 'two'].map(id => deliver(id)));
      expect(results.map(row => row.status).sort()).toEqual(['created', 'skipped']);
      expect(results.find(row => row.status === 'skipped')).toMatchObject({ reasonCode: 'cooldown' });
      expect((await profile.collection('notifications').get()).size).toBe(1);
      const states = await agency.collection('assistantNotificationState').get();
      expect(states.docs.find(doc => doc.id.startsWith('budget-'))!.data().deliveries).toHaveLength(1);
      const cooldown = states.docs.find(doc => doc.id.startsWith('watch-cooldown-'))!;
      expect(cooldown.data().cooldownMinutes).toBe(60);
      await cooldown.ref.update({ lastDeliveredAt: Date.now() - 31 * 60000 });
      expect(await deliver('shorter', 30)).toMatchObject({ status: 'skipped', reasonCode: 'cooldown', cooldownMinutes: 60 });
      await cooldown.ref.update({ lastDeliveredAt: Date.now() - 86400001 });
      // Expiration permits a fresh evaluation, not delivery from the old result.
      if (kind === 'owner') await listing.update({ publicationStatus: 'hidden' });
      else await agency.collection('properties').doc('p').update({ status: 'Vândut' });
      expect(await deliver('three')).toMatchObject({ status: 'skipped', reasonCode: 'state_changed' });
      expect((await profile.collection('notifications').get()).size).toBe(1);
    } finally { await listing.delete(); await db.recursiveDelete(profile); }
  }, 20000);
  it('deduplicates owner alerts transactionally and withdraws after an exact CRM import', async () => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId), profile = db.collection('users').doc(ctx.uid);
    const listing = db.collection('ownerListings').doc(randomUUID());
    await profile.set({ agencyId: ctx.agencyId, role: 'agent' });
    await agency.set({ city: 'Brasov' });
    await listing.set({ title: 'Synthetic owner', scopeKey: 'brasov', publicationStatus: 'ready', isCanonical: true, transactionType: 'sale', price: '100000 EUR', link: `https://example.test/${listing.id}` });
    const search = searchSchema.parse({ excludeImported: true, priceMax: 120000 });
    try {
      const results = await Promise.all([1, 2].map(() => createOwnerWatchNotification(ctx, 'r', 'owner', listing.id, search)));
      expect(results.map(row => row.status).sort()).toEqual(['created', 'existing']);
      expect((await reconcileRuleNotifications(ctx, { ids: ['owner'] })).withdrawn).toBe(0);
      await agency.collection('properties').doc('import').set({ ownerListingUrl: `https://example.test/${listing.id}` });
      expect(await createOwnerWatchNotification(ctx, 'r', 'new', listing.id, search)).toMatchObject({ status: 'skipped', reasonCode: 'state_changed' });
      expect((await reconcileRuleNotifications(ctx, { ids: ['owner'] })).withdrawn).toBe(1);
      expect((await profile.collection('notifications').doc('owner').get()).data()).toMatchObject({ isRead: true, withdrawalReason: 'state_changed' });
    } finally { await listing.delete(); await db.recursiveDelete(profile); }
  }, 20000);
  it.each(['owner_watch', 'matching_watch'] as const)('defers %s transactionally and creates once after quiet hours end', async type => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId), profile = db.collection('users').doc(ctx.uid);
    const listing = db.collection('ownerListings').doc(randomUUID());
    const contact = { status: 'Nou', budget: 150000 }, property = { status: 'Activ', price: 120000 };
    await profile.set({ agencyId: ctx.agencyId, role: 'agent' });
    await agency.collection('contacts').doc('c').set(contact); await agency.collection('properties').doc('p').set(property);
    await listing.set({ title: 'Synthetic owner', scopeKey: 'brasov', publicationStatus: 'ready', isCanonical: true, transactionType: 'sale' });
    const quiet = { timezone: 'UTC', start: new Date(Date.now() - 3600000).toISOString().slice(11, 16), end: new Date(Date.now() + 3600000).toISOString().slice(11, 16) };
    const deliver = (hours: typeof quiet) => type === 'owner_watch'
      ? createOwnerWatchNotification(ctx, 'r', 'quiet', listing.id, searchSchema.parse({ scopeKey: 'brasov' }), hours)
      : createMatchingNotification(ctx, 'r', 'quiet', 'c', { id: 'p', title: 'Synthetic match', sourceContactRevision: matchingRevision(contact), matchingRevision: matchingRevision(property) }, hours);
    try {
      expect(await deliver(quiet)).toMatchObject({ status: 'deferred', reasonCode: 'quiet_hours' });
      expect((await profile.collection('notifications').get()).empty).toBe(true);
      const results = await Promise.all([1, 2].map(() => deliver({ ...quiet, end: quiet.start })));
      expect(results.map(row => row.status).sort()).toEqual(['created', 'existing']);
      expect((await profile.collection('notifications').get()).size).toBe(1);
    } finally { await listing.delete(); await db.recursiveDelete(profile); }
  }, 20000);
  it('serializes the last shared budget slot across reports and both watch types', async () => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId), profile = db.collection('users').doc(ctx.uid);
    const listing = db.collection('ownerListings').doc(randomUUID());
    const budget = agency.collection('assistantNotificationState').doc(`budget-${createHash('sha256').update(ctx.uid).digest('hex')}`);
    const contact = { status: 'Nou', budget: 150000 }, property = { status: 'Activ', price: 120000 };
    await profile.set({ agencyId: ctx.agencyId, role: 'agent' });
    await agency.collection('contacts').doc('c').set(contact); await agency.collection('properties').doc('p').set(property);
    await agency.collection('tasks').doc('t').set({ status: 'open', agentId: ctx.uid, dueDate: '2020-01-01' });
    await listing.set({ title: 'Synthetic owner', scopeKey: 'brasov', publicationStatus: 'ready', isCanonical: true, transactionType: 'sale' });
    await budget.set({ actorId: ctx.uid, deliveries: Array(9).fill(Date.now()) });
    try {
      const results = await Promise.all([
        createOwnerWatchNotification(ctx, 'r', 'owner-cap', listing.id, searchSchema.parse({ scopeKey: 'brasov' })),
        createMatchingNotification(ctx, 'r', 'matching-cap', 'c', { id: 'p', title: 'Synthetic match', sourceContactRevision: matchingRevision(contact), matchingRevision: matchingRevision(property) }),
        createInsightNotification(ctx, 'r', 'report-cap', { id: 'task-t', taskId: 't', title: 'Task' }),
      ]);
      expect(results.filter(row => row.status === 'created')).toHaveLength(1);
      expect(results.filter(row => row.reasonCode === 'notification_cap')).toHaveLength(2);
      expect((await profile.collection('notifications').get()).size).toBe(1);
      expect((await budget.get()).data()!.deliveries).toHaveLength(10);
      for (const result of results.slice(0, 2)) if (result.status !== 'created') expect(result).toMatchObject({ status: 'deferred', deferredUntil: expect.any(String) });
    } finally { await listing.delete(); await db.recursiveDelete(profile); }
  }, 20000);
  it('creates one matching alert under concurrency and withdraws it after a source edit', async () => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId), profile = db.collection('users').doc(ctx.uid);
    const contact = { status: 'Nou', budget: 150000 }, property = { status: 'Activ', price: 120000 };
    await profile.set({ agencyId: ctx.agencyId, role: 'agent' });
    await agency.collection('contacts').doc('c').set(contact); await agency.collection('properties').doc('p').set(property);
    const card = { id: 'p', title: 'Matching fixture', sourceContactRevision: matchingRevision(contact), matchingRevision: matchingRevision(property) };
    try {
      const results = await Promise.all([1, 2].map(() => createMatchingNotification(ctx, 'r', 'matching', 'c', card)));
      expect(results.map(row => row.status).sort()).toEqual(['created', 'existing']);
      expect((await profile.collection('notifications').get()).size).toBe(1);
      await agency.collection('properties').doc('p').update({ price: 180000 });
      expect(await createMatchingNotification(ctx, 'r', 'stale', 'c', card)).toMatchObject({ status: 'skipped', reasonCode: 'state_changed' });
      expect((await reconcileRuleNotifications(ctx, { ids: ['matching'] })).withdrawn).toBe(1);
      expect((await profile.collection('notifications').doc('matching').get()).data()).toMatchObject({ isRead: true, withdrawalReason: 'state_changed' });
    } finally { await db.recursiveDelete(profile); }
  }, 20000);
  it.each([
    { matchingCondition: { contactId: 'c', propertyId: 'p', contactRevision: 'a'.repeat(64), propertyRevision: 'b'.repeat(64) } },
    { ownerWatchCondition: { listingId: 'p', search: { source: 'owners', transactionType: 'sale' } } },
  ])('serializes watch votes without ranking projections: %j', async condition => {
    const ctx = context(), profile = db.collection('users').doc(ctx.uid), notification = profile.collection('notifications').doc('feedback');
    await profile.set({ agencyId: ctx.agencyId, role: 'agent' });
    await notification.set({ type: 'ai_assistant', recipientId: ctx.uid, agencyId: ctx.agencyId, automationId: 'r', ...condition, isRead: false });
    try {
      const results = await Promise.allSettled(['useful', 'not_useful'].map(value => saveNotificationFeedback(ctx, { notificationId: 'feedback', value, expectedRevision: 0 })));
      expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
      expect((results.find(result => result.status === 'rejected') as PromiseRejectedResult).reason.status).toBe(409);
      const prior = (await notification.get()).data()!.feedback;
      const value = prior.value === 'useful' ? 'not_useful' : 'useful';
      await Promise.all([saveNotificationFeedback(ctx, { notificationId: 'feedback', value, expectedRevision: 1 }), notification.update({ withdrawnAt: '2026-10-07T10:00:00Z', isRead: true })]);
      await saveNotificationFeedback(ctx, { notificationId: 'feedback', value, expectedRevision: 1 });
      expect((await notification.get()).data()).toMatchObject({ ...condition, feedback: { value, revision: 2 }, withdrawnAt: '2026-10-07T10:00:00Z', isRead: true });
      expect((await db.collection('agencies').doc(ctx.agencyId).collection('assistantNotificationState').get()).empty).toBe(true);
    } finally { await db.recursiveDelete(profile); }
  }, 20000);
  it('serializes feedback revisions and preserves a concurrent withdrawal', async () => {
    const ctx = context(), profile = db.collection('users').doc(ctx.uid), notification = profile.collection('notifications').doc('feedback');
    await profile.set({ agencyId: ctx.agencyId, role: 'agent' });
    await notification.set({ type: 'ai_assistant', recipientId: ctx.uid, agencyId: ctx.agencyId, automationId: 'r', insightCondition: { kind: 'task', id: 't' }, isRead: false });
    try {
      const results = await Promise.allSettled(['useful', 'not_useful'].map(value => saveNotificationFeedback(ctx, { notificationId: 'feedback', value, expectedRevision: 0 })));
      expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
      expect(rejected.reason.status).toBe(409);
      const prior = (await notification.get()).data()!.feedback;
      expect(prior.revision).toBe(1);
      const value = prior.value === 'useful' ? 'not_useful' : 'useful';
      await Promise.all([saveNotificationFeedback(ctx, { notificationId: 'feedback', value, expectedRevision: 1 }), notification.update({ withdrawnAt: '2026-10-07T10:00:00Z', isRead: true })]);
      expect((await notification.get()).data()).toMatchObject({ feedback: { value, revision: 2 }, withdrawnAt: '2026-10-07T10:00:00Z', isRead: true });
      await saveNotificationFeedback(ctx, { notificationId: 'feedback', value, expectedRevision: 1 });
      expect((await notification.get()).data()!.feedback.revision).toBe(2);
      await db.collection('agencies').doc(ctx.agencyId).collection('tasks').doc('t').set({ status: 'open', agentId: ctx.uid, dueDate: '2020-01-01' });
      const report = await insightReports.getInsights(ctx);
      expect(report.rows.find(row => row.taskId === 't')).toMatchObject({ previousFeedback: value, priority: 80, feedbackNote: expect.any(String) });
      await db.collection('agencies').doc(ctx.agencyId).collection('tasks').doc('a').set({ status: 'open', agentId: ctx.uid, dueDate: '2020-01-01' });
      const ranked = await insightReports.getInsights(ctx, 1);
      expect(ranked.rows[0].taskId).toBe(value === 'useful' ? 't' : 'a');
      expect(ranked.feedbackRankingComplete).toBe(true);
    } finally { await db.recursiveDelete(profile); }
  }, 20000);
  async function reserve(ctx: AssistantContext, kind: 'tasks' | 'viewings', id: string, record: Record<string, unknown>) {
    return db.runTransaction(async tx => {
      await assertCalendarSlot(ctx, tx as any, kind, id, record);
      tx.create(db.collection('agencies').doc(ctx.agencyId).collection(kind).doc(id), record);
      return id;
    });
  }
  function closedRead(tx: any, position: number) {
    let reads = 0;
    return new Proxy(tx, { get(target, key) {
      if (key === 'get') return async (...args: any[]) => {
        const snapshot = await target.get(...args);
        if (++reads === position) throw Object.assign(new Error('3 INVALID_ARGUMENT: Transaction is invalid or closed.'), { code: 3 });
        return snapshot;
      };
      const value = Reflect.get(target, key);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
  }
  it.each([false, true])('restarts notification reads within the SDK attempt limit (persistent: %s)', async persistent => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId);
    let attempts = 0;
    const run = db.runTransaction(async raw => {
      const tx = notificationTransactionReads(++attempts === 1 || persistent ? closedRead(raw, 2) : raw);
      await tx.get(agency);
      const budget = await readNotificationBudget(ctx, tx);
      budget.consume();
      tx.create(agency.collection('assistantAutomations').doc('retry-evidence'), { verified: true });
    }, { maxAttempts: 2 });
    if (persistent) await expect(run).rejects.toMatchObject({ code: 10 }); else await run;
    expect(attempts).toBe(2);
    expect((await agency.collection('assistantAutomations').get()).size).toBe(persistent ? 0 : 1);
    const states = await agency.collection('assistantNotificationState').get();
    expect(states.size).toBe(persistent ? 0 : 1);
    if (!persistent) expect(states.docs[0].data().deliveries).toHaveLength(1);
  }, 20000);
  it.each([1, 2, 3])('restarts all calendar reads after invalidation at read %s and commits once', async position => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId);
    const record = { status: 'scheduled', viewingDate: '2030-01-12T10:00:00.000Z', duration: 60, agentId: ctx.uid };
    let attempts = 0;
    await db.runTransaction(async tx => {
      const current = ++attempts === 1 ? closedRead(tx, position) : tx;
      await assertCalendarSlot(ctx, current, 'viewings', 'new', record);
      tx.create(agency.collection('viewings').doc('new'), record);
    }, { maxAttempts: 2 });
    expect(attempts).toBe(2);
    expect((await agency.collection('viewings').get()).size).toBe(1);
    expect((await agency.collection('assistantLocks').doc('calendar').get()).data()?.version).toBe(1);
  }, 20000);
  it('retains the transaction attempt limit on persistent invalidation without writing a reservation', async () => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId);
    let attempts = 0;
    await expect(db.runTransaction(async tx => {
      attempts++;
      await assertCalendarSlot(ctx, closedRead(tx, 2), 'viewings', 'new', { status: 'scheduled', viewingDate: '2030-01-12T10:00:00.000Z', agentId: ctx.uid });
      tx.create(agency.collection('viewings').doc('new'), { status: 'scheduled' });
    }, { maxAttempts: 2 })).rejects.toMatchObject({ code: 10 });
    expect(attempts).toBe(2);
    expect((await agency.collection('viewings').get()).empty).toBe(true);
    expect((await agency.collection('assistantLocks').get()).empty).toBe(true);
  }, 20000);
  it('rechecks overlap after invalidation and rejects the conflicting reservation', async () => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId);
    const record = { status: 'scheduled', viewingDate: '2030-01-12T10:00:00.000Z', duration: 60, agentId: ctx.uid };
    await agency.collection('viewings').doc('existing').set(record);
    let attempts = 0;
    await expect(db.runTransaction(async tx => {
      const current = ++attempts === 1 ? closedRead(tx, 3) : tx;
      await assertCalendarSlot(ctx, current, 'viewings', 'new', record);
      tx.create(agency.collection('viewings').doc('new'), record);
    }, { maxAttempts: 2 })).rejects.toMatchObject({ status: 409 });
    expect(attempts).toBe(2);
    expect((await agency.collection('viewings').get()).docs.map(doc => doc.id)).toEqual(['existing']);
    expect((await agency.collection('assistantLocks').get()).empty).toBe(true);
  }, 20000);
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
      expect(results.filter(row => 'status' in row && row.status === 'delivered' && !('deduplicated' in row && row.deduplicated))).toHaveLength(1);
      expect(results.filter(row => 'deduplicated' in row && row.deduplicated)).toHaveLength(1);
      expect((await profile.collection('notifications').get()).size).toBe(1);
      expect((await agency.collection('assistantArtifacts').get()).size).toBe(1);
      await deliverDailyBrief(ctx, settings, new Date('2026-10-06T07:00:00Z'));
      expect((await profile.collection('notifications').get()).size).toBe(1);
    } finally { await db.recursiveDelete(profile); }
  }, 20000);
  it.each(['queued', 'accepted', 'delivered', 'read', 'foreign-job', 'changed-recipient'])('verifies persisted brief delivery: %s', async state => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId), profile = db.collection('users').doc(ctx.uid);
    const receiptId = 'a'.repeat(64), requestId = randomUUID(), messageId = stableId(ctx.agencyId, requestId);
    const job = db.collection('communicationOutboundJobs').doc(messageId);
    const conversation = { id: 'own', agencyId: ctx.agencyId, channel: 'whatsapp', connectionId: 'connection', externalParticipantId: '40722123456', assigneeId: ctx.uid, collaboratorIds: [] };
    const revision = recipientRevision(conversation), template = { name: 'daily', language: 'ro', parameters: ['Priorități sintetice'] };
    const batch = db.batch();
    batch.set(profile, { agencyId: ctx.agencyId, role: 'agent' });
    batch.set(agency.collection('assistantArtifacts').doc(`brief-${receiptId}`), { actorId: ctx.uid, channel: 'whatsapp', status: 'unknown', delivery: { conversationId: 'own', requestId, messageId, recipientRevision: revision, template } });
    batch.set(agency.collection('conversations').doc('own'), { ...conversation, ...(state === 'changed-recipient' ? { externalParticipantId: 'other' } : {}) });
    batch.set(job, { agencyId: state === 'foreign-job' ? 'other' : ctx.agencyId, uid: ctx.uid, conversationId: 'own', connectionId: 'connection', recipientRevision: revision, input: { requestId, text: '', template } });
    batch.set(agency.collection('conversations').doc('own').collection('messages').doc(messageId), { agencyId: ctx.agencyId, conversationId: 'own', authorId: ctx.uid, direction: 'sent', origin: 'imodeus', externalId: 'provider-receipt', status: ['foreign-job', 'changed-recipient'].includes(state) ? 'delivered' : state });
    await batch.commit();
    try {
      expect(await readBriefDelivery(ctx, receiptId)).toMatchObject({ status: ['foreign-job', 'changed-recipient'].includes(state) ? 'unknown' : state, completionSatisfied: ['delivered', 'read'].includes(state) });
      expect((await agency.collection('assistantArtifacts').doc(`brief-${receiptId}`).get()).data()?.status).toBe('unknown');
      expect((await agency.collection('conversations').doc('own').collection('messages').get()).size).toBe(1);
    } finally { await job.delete(); await profile.delete(); }
  }, 20000);
  it.each(['app', 'whatsapp'] as const)('persists a missed %s brief run and advances the worker without delivery', async deliveryChannel => {
    const ctx = context(), profile = db.collection('users').doc(ctx.uid), agency = db.collection('agencies').doc(ctx.agencyId);
    const job = db.collection('assistantAutomationJobs').doc(ctx.uid), mirror = agency.collection('assistantAutomations').doc(ctx.uid);
    const settings = briefSettingsSchema.parse({ timezone: 'Europe/Bucharest', deliveryTime: '08:30', daysOfWeek: [1, 2, 3, 4, 5], deliveryChannel, conversationId: 'own', templateName: 'daily' });
    const due = '2026-01-01T06:30:00.000Z';
    const data = { id: ctx.uid, agencyId: ctx.agencyId, actorId: ctx.uid, actorRole: 'agent', status: 'active', nextRunAt: due, automation: { type: 'daily_sales_brief', ...settings, nextRunAt: due, maxRuns: 10 } };
    await profile.set({ agencyId: ctx.agencyId, role: 'agent' });
    await job.set(data); await mirror.set(data);
    try {
      await drainAssistantAutomations(db as any);
      const saved = (await job.get()).data()!;
      expect(saved).toMatchObject({ status: 'active', runCount: 1, nextRunAt: nextBriefRun(settings), lastResult: { deferred: true, reasonCode: 'missed_local_day', scheduledFor: due } });
      expect((await mirror.get()).data()).toMatchObject({ nextRunAt: saved.nextRunAt, lastResult: saved.lastResult });
      const audit = await mirror.collection('audit').get();
      expect(audit.size).toBe(1); expect(audit.docs[0].data()).toMatchObject({ result: { reasonCode: 'missed_local_day' } });
      await drainAssistantAutomations(db as any);
      expect((await job.get()).data()?.runCount).toBe(1);
      expect((await profile.collection('notifications').get()).empty).toBe(true);
      expect((await agency.collection('assistantArtifacts').get()).empty).toBe(true);
      expect((await db.collection('communicationOutboundJobs').where('agencyId', '==', ctx.agencyId).get()).empty).toBe(true);
    } finally { await job.delete(); await db.recursiveDelete(profile); }
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
  it.each([false, true])('suppresses a stale rule alert with real transactions (interrupted: %s)', async interrupted => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId), profile = db.collection('users').doc(ctx.uid);
    const startedAt = '2030-01-02T10:00:00.000Z', contact = agency.collection('contacts').doc('c');
    await profile.set({ agencyId: ctx.agencyId, role: 'agent' });
    await contact.set({ name: 'Emulator client', status: 'Contactat' });
    await agency.collection('crmEvents').doc('e').set({ source: 'firestore_change', actorId: ctx.uid, capability: 'contacts.updated', occurredAt: startedAt, recordedAt: startedAt, entities: { contactId: 'c' }, ruleState: { after: { status: 'Contactat' } } });
    const rule = automationSchema.parse({ type: 'event_rule', nextRunAt: startedAt, intervalMinutes: 30, maxRuns: 10, trigger: { resource: 'contacts', change: 'updated', statusTo: 'Contactat' }, effects: [{ kind: 'notify', title: 'Client contactat' }, { kind: 'create_task', description: 'Follow-up emulator', dueAfterMinutes: 60 }] }) as EventRule;
    const claim = { id: 'r', createdAt: startedAt };
    let checks = 0;
    try {
      const execution = runEventRule(ctx, claim, rule, executeAction, async () => {
        if (++checks === 2) await contact.update({ status: 'Câștigat' });
        if (interrupted && checks === 3) throw new Error('Interrupted after skipped alert');
      });
      if (interrupted) await expect(execution).rejects.toThrow('Interrupted after skipped alert');
      else await execution;
      await contact.update({ status: 'Contactat' });
      await runEventRule(ctx, claim, rule, executeAction, async () => {});
      expect((await profile.collection('notifications').get()).size).toBe(0);
      const receipts = await agency.collection('assistantAutomations').doc('r').collection('events').get();
      expect(receipts.size).toBe(1);
      expect(receipts.docs[0].data().effects[0]).toMatchObject({ status: 'skipped', reasonCode: 'state_changed', entityId: 'c' });
      expect((await agency.collection('tasks').get()).size).toBe(1);
    } finally { await db.recursiveDelete(profile); }
  }, 20000);
  it.each(['changed', 'deleted', 'revoked'])('withdraws a committed rule alert after the entity is %s', async change => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId), profile = db.collection('users').doc(ctx.uid);
    const startedAt = '2030-01-02T10:00:00.000Z';
    const resource = change === 'revoked' ? 'sales' : 'contacts';
    const entity = agency.collection(resource).doc('c');
    await profile.set({ agencyId: ctx.agencyId, role: 'agent' });
    await entity.set({ name: 'Emulator record', status: 'Contactat', agentId: ctx.uid });
    await agency.collection('crmEvents').doc('e').set({ source: 'firestore_change', actorId: ctx.uid, capability: `${resource}.updated`, occurredAt: startedAt, recordedAt: startedAt, entities: { [resource === 'sales' ? 'saleId' : 'contactId']: 'c' }, ruleState: { after: { status: 'Contactat' } } });
    const rule = automationSchema.parse({ type: 'event_rule', nextRunAt: startedAt, intervalMinutes: 30, maxRuns: 10, trigger: { resource, change: 'updated', statusTo: 'Contactat' }, effects: [{ kind: 'notify', title: 'Fixture alert' }] }) as EventRule;
    try {
      await runEventRule(ctx, { id: 'r', createdAt: startedAt }, rule, executeAction, async () => {});
      const notifications = await profile.collection('notifications').get();
      expect(notifications.size).toBe(1);
      const notification = notifications.docs[0];
      expect(notification.data().ruleCondition).toEqual({ resource, id: 'c', status: 'Contactat' });
      expect((await reconcileRuleNotifications(ctx, { ids: [notification.id] })).withdrawn).toBe(0);
      if (change === 'deleted') await entity.delete();
      else await entity.update(change === 'changed' ? { status: 'Câștigat' } : { agentId: 'other', collaboratorIds: [] });
      const results = await Promise.all([1, 2].map(() => reconcileRuleNotifications(ctx, { ids: [notification.id] })));
      expect(results.reduce((sum, result) => sum + result.withdrawn, 0)).toBe(1);
      expect((await notification.ref.get()).data()).toMatchObject({ title: 'Fixture alert', isRead: true, withdrawnAt: expect.any(String), withdrawalReason: change === 'deleted' ? 'entity_deleted' : change === 'revoked' ? 'access_revoked' : 'state_changed' });
      await entity.set({ name: 'Emulator record', status: 'Contactat', agentId: ctx.uid });
      expect((await reconcileRuleNotifications(ctx, { ids: [notification.id] })).withdrawn).toBe(0);
      expect((await notification.ref.get()).data()?.withdrawnAt).toBeTruthy();
    } finally { await db.recursiveDelete(profile); }
  }, 20000);
  it.each(['task', 'reply', 'conflict'])('creates once and withdraws a resolved %s insight with actual transactions', async kind => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId), profile = db.collection('users').doc(ctx.uid);
    const resource = kind === 'task' ? 'tasks' : kind === 'reply' ? 'conversations' : 'viewings';
    const entity = agency.collection(resource).doc('c');
    const live = kind === 'task' ? { status: 'open', agentId: ctx.uid, dueDate: '2020-01-01' }
      : kind === 'reply' ? { agencyId: ctx.agencyId, status: 'open', needsReply: true, lastInboundAt: '2020-01-01', assigneeId: ctx.uid, collaboratorIds: [] }
        : { status: 'scheduled', agentId: ctx.uid, viewingDate: new Date(Date.now() + 86400000).toISOString(), duration: 60 };
    const card = { id: 'priority', title: 'Fixture priority', ...(kind === 'task' ? { taskId: 'c' } : kind === 'reply' ? { conversationId: 'c' } : { viewingIds: ['c', 'd'] }) };
    await profile.set({ agencyId: ctx.agencyId, role: 'agent' });
    await entity.set(live);
    if (kind === 'conflict') await agency.collection(resource).doc('d').set(live);
    try {
      await Promise.all([1, 2].map(() => createInsightNotification(ctx, 'r', 'n', card)));
      expect((await profile.collection('notifications').get()).size).toBe(1);
      expect((await agency.collection('assistantAutomations').doc('r').collection('insightEffects').get()).size).toBe(1);
      expect((await reconcileRuleNotifications(ctx, { ids: ['n'] })).withdrawn).toBe(0);
      await entity.update(kind === 'reply' ? { lastOutboundAt: new Date().toISOString() } : { status: kind === 'task' ? 'completed' : 'cancelled' });
      const results = await Promise.all([1, 2].map(() => reconcileRuleNotifications(ctx, { ids: ['n'] })));
      expect(results.reduce((sum, result) => sum + result.withdrawn, 0)).toBe(1);
      expect((await profile.collection('notifications').doc('n').get()).data()).toMatchObject({ withdrawalReason: 'state_changed', isRead: true });
    } finally { await db.recursiveDelete(profile); }
  }, 20000);
  it.each([false, true])('revalidates report rows in the actual automation worker (resolved during report: %s)', async resolved => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId), profile = db.collection('users').doc(ctx.uid);
    const job = db.collection('assistantAutomationJobs').doc(ctx.uid), mirror = agency.collection('assistantAutomations').doc(ctx.uid);
    const task = agency.collection('tasks').doc('t'), due = '2020-01-01T00:00:00.000Z';
    const data = { id: ctx.uid, agencyId: ctx.agencyId, actorId: ctx.uid, actorRole: 'agent', status: 'active', nextRunAt: due, automation: { type: 'insight_report', nextRunAt: due, maxRuns: 1, limit: 5 } };
    await profile.set({ agencyId: ctx.agencyId, role: 'agent' });
    await task.set({ status: 'open', agentId: ctx.uid, dueDate: due, description: 'Fixture task' });
    await job.set(data); await mirror.set(data);
    const original = insightReports.getInsights;
    const spy = vi.spyOn(insightReports, 'getInsights').mockImplementationOnce(async (actor, limit) => {
      const report = await original(actor, limit);
      if (resolved) await task.update({ status: 'completed' });
      return report;
    });
    try {
      await drainAssistantAutomations(db as any);
      expect((await job.get()).data()).toMatchObject({ status: 'completed', lastResult: { notificationResults: [expect.objectContaining({ status: resolved ? 'skipped' : 'created' })] } });
      expect((await profile.collection('notifications').get()).size).toBe(resolved ? 0 : 1);
      expect((await mirror.collection('insightEffects').get()).size).toBe(1);
    } finally { spy.mockRestore(); await job.delete(); await db.recursiveDelete(profile); }
  }, 20000);
  it('serializes cooldowns across concurrent reports and permits a new alert at expiry', async () => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId), profile = db.collection('users').doc(ctx.uid);
    await profile.set({ agencyId: ctx.agencyId, role: 'agent' });
    await agency.collection('tasks').doc('t').set({ status: 'open', agentId: ctx.uid, dueDate: '2020-01-01' });
    const card = { id: 'task-t', title: 'Overdue task', taskId: 't' };
    try {
      const results = await Promise.all([1, 2].map(index => createInsightNotification(ctx, `report-${index}`, `notification-${index}`, card, undefined, 60)));
      expect(results.filter(result => result.status === 'created')).toHaveLength(1);
      expect(results.filter(result => result.reasonCode === 'cooldown')).toHaveLength(1);
      expect((await profile.collection('notifications').get()).size).toBe(1);
      const stateSnapshot = await agency.collection('assistantNotificationState').get();
      const states = { docs: stateSnapshot.docs.filter(doc => !doc.id.startsWith('budget-')), size: stateSnapshot.docs.filter(doc => !doc.id.startsWith('budget-')).length };
      expect(states.size).toBe(1);
      const suppressedId = results[0].status === 'skipped' ? 1 : 2;
      const expiredAt = new Date(Date.now() - 3600000).toISOString();
      await states.docs[0].ref.update({ lastNotifiedAt: expiredAt });
      expect(await createInsightNotification(ctx, `report-${suppressedId}`, `notification-${suppressedId}`, card, undefined, 60)).toMatchObject({ reasonCode: 'cooldown' });
      expect((await states.docs[0].ref.get()).data()?.lastNotifiedAt).toBe(expiredAt);
      expect(await createInsightNotification(ctx, 'report-3', 'notification-3', card, undefined, 60)).toMatchObject({ status: 'created' });
      expect((await profile.collection('notifications').get()).size).toBe(2);
    } finally { await db.recursiveDelete(profile); }
  }, 20000);
  it('serializes the last capacity slot across concurrent reports for different priorities', async () => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId), profile = db.collection('users').doc(ctx.uid);
    await profile.set({ agencyId: ctx.agencyId, role: 'agent' });
    try {
      for (let i = 0; i < 11; i++) await agency.collection('tasks').doc(`t${i}`).set({ status: 'open', agentId: ctx.uid, dueDate: '2020-01-01' });
      const send = (i: number) => createInsightNotification(ctx, `report-${i}`, `notification-${i}`, { id: `task-t${i}`, title: 'Overdue', taskId: `t${i}` });
      for (let i = 0; i < 9; i++) expect(await send(i)).toMatchObject({ status: 'created' });
      const results = await Promise.all([send(9), send(10)]);
      expect(results.filter(row => row.status === 'created')).toHaveLength(1);
      expect(results.filter(row => row.reasonCode === 'notification_cap')).toHaveLength(1);
      expect((await profile.collection('notifications').get()).size).toBe(10);
      const budget = (await agency.collection('assistantNotificationState').get()).docs.find(doc => doc.id.startsWith('budget-'))!;
      expect(budget.data().deliveries).toHaveLength(10);
      const omitted = results[0].reasonCode === 'notification_cap' ? 9 : 10;
      await budget.ref.update({ deliveries: [] });
      expect(await send(omitted)).toMatchObject({ reasonCode: 'notification_cap' });
      expect(await createInsightNotification(ctx, 'new-run', 'new-run', { id: `task-t${omitted}`, taskId: `t${omitted}`, title: 'Still overdue' })).toMatchObject({ status: 'created' });
    } finally { await db.recursiveDelete(profile); }
  }, 30000);
  it('records capacity omissions in worker audit without queuing a deferred backlog', async () => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId), profile = db.collection('users').doc(ctx.uid);
    const job = db.collection('assistantAutomationJobs').doc(ctx.uid), mirror = agency.collection('assistantAutomations').doc(ctx.uid);
    const due = '2020-01-01T00:00:00.000Z';
    const data = { id: ctx.uid, agencyId: ctx.agencyId, actorId: ctx.uid, actorRole: 'agent', status: 'active', nextRunAt: due, automation: { type: 'insight_report', nextRunAt: due, maxRuns: 1, limit: 30 } };
    await profile.set({ agencyId: ctx.agencyId, role: 'agent' });
    for (let i = 0; i < 11; i++) await agency.collection('tasks').doc(`t${i}`).set({ description: 'Overdue', status: 'open', agentId: ctx.uid, dueDate: due });
    await job.set(data); await mirror.set(data);
    try {
      await drainAssistantAutomations(db as any);
      const result = (await job.get()).data()!;
      expect(result).toMatchObject({ status: 'completed', runCount: 1, nextRunAt: null });
      expect(result.lastResult.notificationResults.filter((row: any) => row.reasonCode === 'notification_cap')).toHaveLength(1);
      expect((await profile.collection('notifications').get()).size).toBe(10);
      const audit = await mirror.collection('audit').get();
      expect(audit.docs[0].data().result.notificationResults.some((row: any) => row.reasonCode === 'notification_cap')).toBe(true);
    } finally { await job.delete(); await db.recursiveDelete(profile); }
  }, 30000);
  it('keeps repeat-report cooldown evidence in the worker audit', async () => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId), profile = db.collection('users').doc(ctx.uid);
    const job = db.collection('assistantAutomationJobs').doc(ctx.uid), mirror = agency.collection('assistantAutomations').doc(ctx.uid);
    const due = '2020-01-01T00:00:00.000Z';
    const data = { id: ctx.uid, agencyId: ctx.agencyId, actorId: ctx.uid, actorRole: 'agent', status: 'active', nextRunAt: due, automation: { type: 'insight_report', nextRunAt: due, intervalMinutes: 30, maxRuns: 3, limit: 5, cooldownMinutes: 60 } };
    await profile.set({ agencyId: ctx.agencyId, role: 'agent' });
    await agency.collection('tasks').doc('t').set({ status: 'open', agentId: ctx.uid, dueDate: due });
    await job.set(data); await mirror.set(data);
    try {
      await drainAssistantAutomations(db as any);
      await job.update({ nextRunAt: due }); await mirror.update({ nextRunAt: due });
      await drainAssistantAutomations(db as any);
      expect((await profile.collection('notifications').get()).size).toBe(1);
      expect((await job.get()).data()).toMatchObject({ runCount: 2, status: 'active', lastResult: { notificationResults: [expect.objectContaining({ reasonCode: 'cooldown', nextEligibleAt: expect.any(String) })] } });
      const audit = await mirror.collection('audit').get();
      expect(audit.size).toBe(2);
      expect(audit.docs.some(row => row.data().result?.notificationResults?.[0]?.reasonCode === 'cooldown')).toBe(true);
    } finally { await job.delete(); await db.recursiveDelete(profile); }
  }, 20000);
  it.each([false, true])('defers a one-shot report and rereads sources after quiet hours are disabled (resolved: %s)', async resolved => {
    const ctx = context(), agency = db.collection('agencies').doc(ctx.agencyId), profile = db.collection('users').doc(ctx.uid);
    const job = db.collection('assistantAutomationJobs').doc(ctx.uid), mirror = agency.collection('assistantAutomations').doc(ctx.uid);
    const quietHours = { timezone: 'UTC', start: new Date(Date.now() - 3600000).toISOString().slice(11, 16), end: new Date(Date.now() + 3600000).toISOString().slice(11, 16) };
    const due = '2020-01-01T00:00:00.000Z';
    const data = { id: ctx.uid, agencyId: ctx.agencyId, actorId: ctx.uid, actorRole: 'agent', status: 'active', nextRunAt: due, automation: { type: 'insight_report', nextRunAt: due, maxRuns: 1, limit: 5, quietHours } };
    await profile.set({ agencyId: ctx.agencyId, role: 'agent' });
    const task = agency.collection('tasks').doc('t');
    await task.set({ status: 'open', agentId: ctx.uid, dueDate: due });
    await job.set(data); await mirror.set(data);
    try {
      await drainAssistantAutomations(db as any);
      expect((await job.get()).data()).toMatchObject({ status: 'active', runCount: 0, lastResult: { reasonCode: 'quiet_hours', deferredUntil: expect.any(String) } });
      expect(await createInsightNotification(ctx, ctx.uid, 'guard', { id: 'task-t', taskId: 't', title: 'Overdue' }, undefined, 60, quietHours)).toMatchObject({ status: 'deferred' });
      expect((await profile.collection('notifications').get()).size).toBe(0);
      expect((await mirror.collection('insightEffects').get()).size).toBe(0);
      expect((await agency.collection('assistantNotificationState').get()).size).toBe(0);
      if (resolved) await task.update({ status: 'completed' });
      const patch = { nextRunAt: due, automation: { ...data.automation, quietHours: { ...quietHours, end: quietHours.start } } };
      await job.update(patch); await mirror.update(patch);
      await drainAssistantAutomations(db as any);
      expect((await job.get()).data()).toMatchObject({ status: 'completed', runCount: 1 });
      expect((await profile.collection('notifications').get()).size).toBe(resolved ? 0 : 1);
      const audit = await mirror.collection('audit').get();
      expect(audit.size).toBe(2); expect(audit.docs.some(row => row.data().result?.reasonCode === 'quiet_hours')).toBe(true);
    } finally { await job.delete(); await db.recursiveDelete(profile); }
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
