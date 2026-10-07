import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: (ctx: any, resource: string) => ctx.adminDb.collection(`agencies/${ctx.agencyId}/${resource}`), canReadResource: () => true }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error {} }));
import { createInsightNotification } from '../insight-notifications';
import { createMatchingNotification } from '../matching-notifications';
import { createOwnerWatchNotification } from '../owner-watch-notifications';
import { matchingRevision } from '../matching-revision';
import { searchSchema } from '../contracts';
import { createHash } from 'node:crypto';
const now = Date.parse('2026-10-07T12:00:00Z');
const budgetPath = (agency = 'a', uid = 'u') => `agencies/${agency}/assistantNotificationState/budget-${createHash('sha256').update(uid).digest('hex')}`;
afterEach(() => vi.useRealTimers());
function fixture() {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now);
  const contact = { status: 'Nou', budget: 150000 }, property = { status: 'Activ', price: 120000 };
  const rows = new Map<string, any>([['users/u', { agencyId: 'a', role: 'agent' }], ['agencies/a/contacts/c', contact], ['agencies/a/properties/p', property], ['agencies/a/tasks/t', { status: 'open', agentId: 'u', dueDate: '2026-10-01' }], ['ownerListings/p', { title: 'Owner', scopeKey: 'brasov', publicationStatus: 'ready', isCanonical: true, transactionType: 'sale' }]]);
  function ref(path: string): any { return { path, collection: (id: string) => ref(`${path}/${id}`), doc: (id: string) => ref(`${path}/${id}`) }; }
  const db = { collection: ref, runTransaction: async (fn: any) => {
    const writes: (() => void)[] = []; const result = await fn({ get: async (r: any) => { if (writes.length) throw new Error('Read after write'); return { exists: rows.has(r.path), data: () => rows.get(r.path) }; }, create: (r: any, value: any) => writes.push(() => rows.set(r.path, value)), update: (r: any, value: any) => writes.push(() => rows.set(r.path, { ...rows.get(r.path), ...value })) }); writes.forEach(fn => fn()); return result;
  } };
  const ctx = { uid: 'u', agencyId: 'a', role: 'agent', adminDb: db } as any;
  const deliver = (kind: 'owner' | 'matching' | 'report', id: string, actor = ctx, quiet?: { timezone: string; start: string; end: string }) => kind === 'owner'
    ? createOwnerWatchNotification(actor, 'r', id, 'p', searchSchema.parse({ scopeKey: 'brasov' }), quiet)
    : kind === 'matching' ? createMatchingNotification(actor, 'r', id, 'c', { id: 'p', title: 'Match', sourceContactRevision: matchingRevision(contact), matchingRevision: matchingRevision(property) }, quiet)
      : createInsightNotification(actor, 'r', id, { id: 'task-t', taskId: 't', title: 'Task' });
  return { ctx, rows, deliver };
}
describe('shared report and watch budget', () => {
  it.each(['owner', 'matching'] as const)('shares the %s cooldown without extending it on omissions or consuming capacity', async kind => {
    const { rows, deliver } = fixture();
    expect(await deliver(kind, 'first')).toMatchObject({ status: 'created' });
    vi.setSystemTime(now + 3600000);
    expect(await deliver(kind, 'second')).toMatchObject({ status: 'skipped', reasonCode: 'cooldown', nextEligibleAt: new Date(now + 86400000).toISOString() });
    expect(rows.get(budgetPath()).deliveries).toHaveLength(1);
    expect(rows.has('users/u/notifications/second')).toBe(false);
    vi.setSystemTime(now + 86400000);
    expect(await deliver(kind, 'second')).toMatchObject({ status: 'created' });
    expect(await deliver(kind, 'first')).toMatchObject({ status: 'existing' });
    expect(rows.get(budgetPath()).deliveries).toHaveLength(1);
  });
  it('keeps owner and matching cooldowns separate and isolates users and agencies', async () => {
    const { rows, deliver, ctx } = fixture();
    expect(await deliver('owner', 'owner')).toMatchObject({ status: 'created' });
    expect(await deliver('matching', 'matching')).toMatchObject({ status: 'created' });
    rows.set('users/v', { agencyId: 'a', role: 'agent' });
    expect(await deliver('owner', 'other-user', { ...ctx, uid: 'v' })).toMatchObject({ status: 'created' });
    rows.set('users/u', { agencyId: 'b', role: 'agent' });
    expect(await deliver('owner', 'other-agency', { ...ctx, agencyId: 'b' })).toMatchObject({ status: 'created' });
  });
  it.each(['owner', 'matching'] as const)('fails closed for corrupted %s cooldown state', async kind => {
    const { rows, deliver } = fixture();
    await deliver(kind, 'first');
    const path = [...rows.keys()].find(key => key.includes('/watch-cooldown-'))!;
    for (const value of [null, -1, now + 1, 'today']) {
      rows.set(path, { actorId: 'u', lastDeliveredAt: value });
      await expect(deliver(kind, 'second')).rejects.toThrow('Pauza dintre alerte');
      expect(rows.has('users/u/notifications/second')).toBe(false);
    }
  });
  it.each(['owner', 'matching'] as const)('defers %s at the report limit, permits expiry and does not charge a retry', async kind => {
    const { rows, deliver } = fixture(); rows.set(budgetPath(), { actorId: 'u', deliveries: Array(9).fill(now - 3600000) });
    expect(await deliver('report', 'report')).toMatchObject({ status: 'created' });
    expect(await deliver(kind, 'watch')).toMatchObject({ status: 'deferred', reasonCode: 'notification_cap', deferredUntil: new Date(now + 23 * 3600000).toISOString() });
    expect(rows.has('users/u/notifications/watch')).toBe(false); expect(rows.get(budgetPath()).deliveries).toHaveLength(10);
    vi.setSystemTime(now + 23 * 3600000);
    expect(await deliver(kind, 'watch')).toMatchObject({ status: 'created' });
    expect(rows.get(budgetPath()).deliveries).toHaveLength(2);
    expect(await deliver(kind, 'watch')).toMatchObject({ status: 'existing' }); expect(rows.get(budgetPath()).deliveries).toHaveLength(2);
  });
  it.each(['owner', 'matching'] as const)('charges %s against report capacity without changing report skip receipts', async kind => {
    const { rows, deliver } = fixture(); rows.set(budgetPath(), { actorId: 'u', deliveries: Array(9).fill(now) });
    expect(await deliver(kind, 'watch')).toMatchObject({ status: 'created' });
    expect(await deliver('report', 'report')).toMatchObject({ status: 'skipped', reasonCode: 'notification_cap' });
    rows.set(budgetPath(), { actorId: 'u', deliveries: [] });
    expect(await deliver('report', 'report')).toMatchObject({ status: 'skipped', reasonCode: 'notification_cap' });
  });
  it.each(['owner', 'matching'] as const)('does not charge %s for stale data or quiet hours', async kind => {
    const { rows, deliver } = fixture();
    expect(await deliver(kind, 'quiet', undefined, { timezone: 'UTC', start: '11:00', end: '13:00' })).toMatchObject({ status: 'deferred', reasonCode: 'quiet_hours' });
    expect(rows.has(budgetPath())).toBe(false);
    rows.delete(kind === 'owner' ? 'ownerListings/p' : 'agencies/a/properties/p');
    expect(await deliver(kind, 'stale')).toMatchObject({ status: 'skipped', reasonCode: 'entity_deleted' }); expect(rows.has(budgetPath())).toBe(false);
  });
  it.each(['owner', 'matching'] as const)('fails closed for corrupt %s capacity', async kind => {
    const { rows, deliver } = fixture();
    for (const deliveries of [null, Array(11).fill(now), [now + 1]]) {
      rows.set(budgetPath(), { actorId: 'u', deliveries });
      await expect(deliver(kind, 'invalid')).rejects.toThrow('Istoricul plafonului');
      expect(rows.has('users/u/notifications/invalid')).toBe(false);
    }
  });
  it('isolates budgets by user and agency', async () => {
    const { rows, deliver, ctx } = fixture(); rows.set(budgetPath(), { actorId: 'u', deliveries: Array(10).fill(now) });
    rows.set('users/v', { agencyId: 'a', role: 'agent' });
    expect(await deliver('owner', 'v-watch', { ...ctx, uid: 'v' })).toMatchObject({ status: 'created' });
    rows.set('users/u', { agencyId: 'b', role: 'agent' });
    expect(await deliver('owner', 'b-watch', { ...ctx, agencyId: 'b' })).toMatchObject({ status: 'created' });
    expect(rows.get(budgetPath()).deliveries).toHaveLength(10);
    expect(rows.get(budgetPath('a', 'v')).deliveries).toHaveLength(1); expect(rows.get(budgetPath('b')).deliveries).toHaveLength(1);
  });
});
