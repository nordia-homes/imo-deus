import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: (ctx: any, resource: string) => ctx.adminDb.collection(`agencies/${ctx.agencyId}/${resource}`), canReadResource: (_ctx: any, _resource: string, row: any) => row.allowed !== false }));
import { createMatchingNotification } from '../matching-notifications';
import { matchingRevision } from '../matching-revision';
import { reconcileRuleNotifications } from '../notification-relevance';
afterEach(() => vi.useRealTimers());
function fixture(onRead: (path: string) => void = () => {}) {
  const contact = { status: 'Nou', budget: 150000 }, property = { status: 'Activ', price: 120000 };
  const rows = new Map<string, any>([['users/u', { agencyId: 'a', role: 'agent' }], ['agencies/a/contacts/c', contact], ['agencies/a/properties/p', property]]);
  function ref(path: string): any { return { path, collection: (id: string) => ref(`${path}/${id}`), doc: (id: string) => ref(`${path}/${id}`) }; }
  const db = { collection: ref, runTransaction: async (fn: any) => {
    const writes: (() => void)[] = []; const result = await fn({ get: async (r: any) => { if (writes.length) throw new Error('Read after write'); onRead(r.path); return { exists: rows.has(r.path), data: () => rows.get(r.path) }; }, create: (r: any, value: any) => writes.push(() => rows.set(r.path, value)), update: (r: any, value: any) => writes.push(() => rows.set(r.path, { ...rows.get(r.path), ...value })) }); writes.forEach(fn => fn()); return result;
  } };
  const ctx = { uid: 'u', agencyId: 'a', role: 'agent', adminDb: db } as any;
  const card = { id: 'p', title: 'Match', matchScore: 90, sourceContactRevision: matchingRevision(contact), matchingRevision: matchingRevision(property) };
  return { ctx, rows, card };
}
const changes = [
  ['contacts/c', { budget: 1 }, 'state_changed'], ['properties/p', { price: 200000 }, 'state_changed'],
  ['properties/p', { status: 'Vândut' }, 'state_changed'], ['contacts/c', { status: 'Câștigat' }, 'state_changed'],
  ['contacts/c', { archivedAt: '2026-10-07' }, 'state_changed'], ['properties/p', { allowed: false }, 'access_revoked'],
  ['contacts/c', null, 'entity_deleted'], ['properties/p', null, 'entity_deleted'],
] as const;
describe('matching alert source verification', () => {
  it('creates once and leaves an unchanged alert visible', async () => {
    const { ctx, rows, card } = fixture();
    expect(await createMatchingNotification(ctx, 'r', 'n', 'c', card)).toMatchObject({ status: 'created' });
    expect(await createMatchingNotification(ctx, 'r', 'n', 'c', card)).toMatchObject({ status: 'existing' });
    expect((await reconcileRuleNotifications(ctx, { ids: ['n'] })).withdrawn).toBe(0);
    expect(rows.get('users/u/notifications/n').matchingCondition).toMatchObject({ contactId: 'c', propertyId: 'p' });
  });
  it.each(changes)('omits stale source %s %j before delivery', async (path, patch, reason) => {
    const { ctx, rows, card } = fixture(); const key = `agencies/a/${path}`;
    if (patch) rows.set(key, { ...rows.get(key), ...patch }); else rows.delete(key);
    expect(await createMatchingNotification(ctx, 'r', 'n', 'c', card)).toEqual({ status: 'skipped', reasonCode: reason });
    expect(rows.has('users/u/notifications/n')).toBe(false);
  });
  it.each(changes)('withdraws an existing alert after source %s %j changes', async (path, patch, reason) => {
    const { ctx, rows, card } = fixture(); await createMatchingNotification(ctx, 'r', 'n', 'c', card);
    const key = `agencies/a/${path}`;
    if (patch) rows.set(key, { ...rows.get(key), ...patch }); else rows.delete(key);
    expect((await reconcileRuleNotifications(ctx, { ids: ['n'] })).withdrawn).toBe(1);
    expect(rows.get('users/u/notifications/n')).toMatchObject({ isRead: true, withdrawalReason: reason });
  });
  it('does not withdraw for excluded cosmetic or history fields', async () => {
    const { ctx, rows, card } = fixture(); await createMatchingNotification(ctx, 'r', 'n', 'c', card);
    rows.set('agencies/a/contacts/c', { ...rows.get('agencies/a/contacts/c'), interactionHistory: [{}] });
    rows.set('agencies/a/properties/p', { ...rows.get('agencies/a/properties/p'), images: [], updatedAt: 'new' });
    expect((await reconcileRuleNotifications(ctx, { ids: ['n'] })).withdrawn).toBe(0);
  });
  it('rejects changed membership and missing revisions before creating an alert', async () => {
    const { ctx, rows, card } = fixture(); rows.set('users/u', { agencyId: 'b', role: 'agent' });
    await expect(createMatchingNotification(ctx, 'r', 'n', 'c', card)).rejects.toThrow('Permisiunile');
    await expect(createMatchingNotification(ctx, 'r', 'n', 'c', { ...card, matchingRevision: undefined })).rejects.toThrow();
    expect(rows.has('users/u/notifications/n')).toBe(false);
  });
});

it.each([false, true])('defers matching without writes at quiet boundary (during source read: %s)', async during => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(during ? '2026-10-07T18:59:59Z' : '2026-10-07T19:00:00Z'));
  const { ctx, rows, card } = fixture(path => { if (during && path === 'agencies/a/properties/p') vi.setSystemTime(new Date('2026-10-07T19:00:00Z')); });
  expect(await createMatchingNotification(ctx, 'r', 'n', 'c', card, { timezone: 'Europe/Bucharest', start: '22:00', end: '08:00' })).toMatchObject({ status: 'deferred', reasonCode: 'quiet_hours', deferredUntil: '2026-10-08T05:00:00.000Z' });
  expect(rows.has('users/u/notifications/n')).toBe(false);
});
