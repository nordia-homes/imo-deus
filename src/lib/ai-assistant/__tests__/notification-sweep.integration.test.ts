import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error {}, agencyCollection: (db: Firestore, agency: string, name: string) => db.collection('agencies').doc(agency).collection(name) }));
import { sweepAssistantNotifications } from '../notification-sweep';

const host = process.env.FIRESTORE_EMULATOR_HOST;
describe.skipIf(!host)('background alert reconciliation on Firestore', () => {
  let db: Firestore;
  beforeAll(() => {
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host || '')) throw new Error('Local emulator required');
    db = new Firestore({ projectId: 'demo-imodeus-notification-sweep' });
  });
  async function clear() {
    for (const collection of await db.listCollections()) await db.recursiveDelete(collection);
  }
  beforeEach(clear);
  afterAll(async () => { if (db) { await clear(); await db.terminate(); } });
  const state = () => db.collection('assistantWorkerState').doc('notificationSweep');
  async function alert(id: string, patch: Record<string, unknown> = {}, uid = 'u') {
    await db.collection('users').doc(uid).set({ agencyId: 'a', role: 'agent' });
    const ref = db.collection('users').doc(uid).collection('notifications').doc(id);
    await ref.set({ type: 'ai_assistant', recipientId: uid, agencyId: 'a', automationId: 'r', insightCondition: { kind: 'task', id }, isRead: false, ...patch });
    return ref;
  }
  it('resumes across pages, includes read alerts, then wraps for newly stale sources', async () => {
    const a = await alert('a'), b = await alert('b', { isRead: true }), c = await alert('c');
    await db.doc('agencies/a/tasks/c').set({ status: 'open', agentId: 'u', dueDate: '2020-01-01' });
    expect(await sweepAssistantNotifications(db as any, 2)).toMatchObject({ status: 'completed', scanned: 2, withdrawn: 2, cycleComplete: false });
    expect((await state().get()).data()!.cursor).toBe(b.path);
    expect((await state().get()).data()!.lastCycle).toBeUndefined();
    expect(await sweepAssistantNotifications(db as any, 2)).toMatchObject({ scanned: 1, withdrawn: 0, cycleComplete: true });
    expect((await state().get()).data()!.cursor).toBeNull();
    expect((await state().get()).data()!.lastCycle).toMatchObject({ coverageKnown: true, hadFailures: false, startedAt: expect.any(String), finishedAt: expect.any(String) });
    await db.doc('agencies/a/tasks/c').update({ status: 'completed' });
    expect(await sweepAssistantNotifications(db as any, 10)).toMatchObject({ scanned: 3, withdrawn: 1, cycleComplete: true });
    for (const ref of [a, b, c]) expect((await ref.get()).data()).toMatchObject({ isRead: true, withdrawnAt: expect.any(String) });
  });
  it('handles matching, owner and event bindings without browser participation', async () => {
    const conditions = [
      { matchingCondition: { contactId: 'c', propertyId: 'p', contactRevision: 'a'.repeat(64), propertyRevision: 'b'.repeat(64) } },
      { ownerWatchCondition: { listingId: 'p', search: { source: 'owners' } } },
      { ruleCondition: { resource: 'contacts', id: 'c', status: 'Nou' }, sourceEventId: 'e' },
    ];
    for (const [i, condition] of conditions.entries()) {
      const ref = await alert(String(i));
      await ref.set({ type: 'ai_assistant', recipientId: 'u', agencyId: 'a', automationId: 'r', ...condition });
    }
    expect(await sweepAssistantNotifications(db as any)).toMatchObject({ withdrawn: 3, failed: 0 });
  });
  it('ignores foreign paths, recipients, agencies, unsupported roles and legacy alerts', async () => {
    await alert('wrong-recipient', { recipientId: 'v' });
    await alert('wrong-agency', { agencyId: 'b' });
    const legacy = await alert('legacy'); await legacy.set({ type: 'ai_assistant', recipientId: 'u', agencyId: 'a', automationId: 'r' });
    await alert('other-type', { type: 'task' });
    await alert('unsupported', {}, 'v'); await db.doc('users/v').update({ role: 'collaborator' });
    await db.doc('elsewhere/u/notifications/foreign').set({ type: 'ai_assistant', recipientId: 'u', agencyId: 'a', automationId: 'r', insightCondition: { kind: 'task', id: 'missing' } });
    expect(await sweepAssistantNotifications(db as any)).toMatchObject({ scanned: 6, withdrawn: 0, failed: 0 });
    for (const doc of (await db.collectionGroup('notifications').get()).docs) expect(doc.data().withdrawnAt).toBeUndefined();
  });
  it('only allows one concurrent scanner to advance the checkpoint', async () => {
    await alert('a');
    // Hold the lease explicitly to deterministically represent an in-flight scan.
    await state().set({ token: 'other', leaseUntil: Date.now() + 60000, cursor: null });
    expect(await sweepAssistantNotifications(db as any)).toMatchObject({ status: 'busy', scanned: 0 });
    expect((await db.doc('users/u/notifications/a').get()).data()!.withdrawnAt).toBeUndefined();
    await state().update({ leaseUntil: 0 });
    expect(await sweepAssistantNotifications(db as any)).toMatchObject({ withdrawn: 1 });
  });
  it('keeps the cursor on query failure and releases its lease for retry', async () => {
    const a = await alert('a'); await alert('b');
    await sweepAssistantNotifications(db as any, 1);
    const broken = new Proxy(db, { get(target, key) {
      if (key === 'collectionGroup') return () => { throw new Error('Synthetic query failure'); };
      const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
    } });
    await expect(sweepAssistantNotifications(broken as any)).rejects.toThrow('Synthetic query failure');
    expect((await state().get()).data()).toMatchObject({ cursor: a.path, leaseUntil: 0, lastFailedAt: expect.any(String) });
    expect(await sweepAssistantNotifications(db as any)).toMatchObject({ scanned: 1, withdrawn: 1 });
    expect((await state().get()).data()!.lastCycle).toMatchObject({ coverageKnown: true, hadFailures: true });
  });
  it('advances past a failing alert and retries it in the next cycle', async () => {
    const a = await alert('a');
    await alert('b', { insightCondition: { kind: 'unsupported', id: 'bad' } });
    await alert('c');
    const broken = new Proxy(db, { get(target, key) {
      if (key === 'runTransaction') return (callback: any) => target.runTransaction(tx => callback(new Proxy(tx, { get(transaction, method) {
        if (method === 'get') return (ref: any) => { if (ref.path === a.path) throw new Error('Synthetic read failure'); return transaction.get(ref); };
        const value = Reflect.get(transaction, method, transaction); return typeof value === 'function' ? value.bind(transaction) : value;
      } })));
      const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
    } });
    expect(await sweepAssistantNotifications(broken as any, 1)).toMatchObject({ scanned: 1, failed: 1, cycleComplete: false });
    expect(await sweepAssistantNotifications(db as any)).toMatchObject({ scanned: 2, failed: 0, cycleComplete: true });
    expect((await state().get()).data()).toMatchObject({ failed: 0, lastCycle: { coverageKnown: true, hadFailures: true } });
    expect((await a.get()).data()!.withdrawnAt).toBeUndefined();
    expect(await sweepAssistantNotifications(db as any)).toMatchObject({ withdrawn: 1, failed: 0 });
    expect((await state().get()).data()!.lastCycle).toMatchObject({ coverageKnown: true, hadFailures: false });
  });
  it('does not certify a legacy cursor until a new complete traversal', async () => {
    const a = await alert('a'); await alert('b');
    await state().set({ cursor: a.path, leaseUntil: 0 });
    await sweepAssistantNotifications(db as any);
    expect((await state().get()).data()!.lastCycle).toMatchObject({ coverageKnown: false });
    await sweepAssistantNotifications(db as any);
    expect((await state().get()).data()!.lastCycle).toMatchObject({ coverageKnown: true, hadFailures: false });
  });
  it('records an empty traversal without inventing checked inboxes', async () => {
    expect(await sweepAssistantNotifications(db as any)).toMatchObject({ scanned: 0, checked: 0, cycleComplete: true });
    expect((await state().get()).data()!.lastCycle).toMatchObject({ coverageKnown: true, hadFailures: false });
  });
  it.each([0, 101, 1.5])('rejects an invalid batch budget %s before database access', async limit => {
    await expect(sweepAssistantNotifications(db as any, limit)).rejects.toThrow('Invalid notification scan budget');
    expect((await state().get()).exists).toBe(false);
  });
  it('cannot overwrite a newer scan checkpoint after losing its lease', async () => {
    await alert('a');
    let calls = 0;
    const interrupted = new Proxy(db, { get(target, key) {
      if (key === 'runTransaction') return async (callback: any) => {
        if (++calls === 3) await state().set({ token: 'replacement', cursor: 'users/u/notifications/z', leaseUntil: Date.now() + 60000 });
        return target.runTransaction(callback);
      };
      const value = Reflect.get(target, key, target); return typeof value === 'function' ? value.bind(target) : value;
    } });
    expect(await sweepAssistantNotifications(interrupted as any)).toMatchObject({ status: 'lease_lost', withdrawn: 1 });
    expect((await state().get()).data()).toMatchObject({ token: 'replacement', cursor: 'users/u/notifications/z' });
    expect((await state().get()).data()!.lastCycle).toBeUndefined();
  });
});
