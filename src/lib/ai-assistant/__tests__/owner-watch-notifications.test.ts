import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: (ctx: any, resource: string) => ctx.adminDb.collection(`agencies/${ctx.agencyId}/${resource}`), canReadResource: () => true }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error {} }));
import { createOwnerWatchNotification } from '../owner-watch-notifications';
import { reconcileRuleNotifications } from '../notification-relevance';
import { searchSchema } from '../contracts';
afterEach(() => vi.useRealTimers());
function fixture(onRead: (path: string) => void = () => {}) {
  const rows = new Map<string, any>([['users/u', { agencyId: 'a', role: 'agent' }], ['agencies/a', { city: 'Brasov' }], ['ownerListings/p', { title: 'Fresh title', scopeKey: 'brasov', publicationStatus: 'ready', isCanonical: true, transactionType: 'sale', price: '100000 EUR', roomsValue: 2, link: 'https://example.test/listing' }]]);
  function ref(path: string, filters: any[] = []): any { return { path, filters, collection: (id: string) => ref(`${path}/${id}`), doc: (id: string) => ref(`${path}/${id}`), where: (field: string, _op: string, values: string[]) => ref(path, [...filters, [field, values]]), select: () => ref(path, filters), limit: () => ({ ...ref(path, filters), query: true }) }; }
  const db = { collection: ref, runTransaction: async (fn: any) => {
    const writes: (() => void)[] = []; const result = await fn({ get: async (r: any) => {
      if (writes.length) throw new Error('Read after write'); onRead(r.path);
      if (r.query) { const docs = [...rows].filter(([key, row]) => key.startsWith(`${r.path}/`) && r.filters.every(([field, values]: any) => values.includes(row[field]))).map(([, row]) => ({ data: () => row })); return { docs, size: docs.length }; }
      return { exists: rows.has(r.path), data: () => rows.get(r.path) };
    }, create: (r: any, value: any) => writes.push(() => rows.set(r.path, value)), update: (r: any, value: any) => writes.push(() => rows.set(r.path, { ...rows.get(r.path), ...value })) }); writes.forEach(fn => fn()); return result;
  } };
  const ctx = { uid: 'u', agencyId: 'a', role: 'agent', adminDb: db } as any;
  const search = searchSchema.parse({ priceMax: 120000, rooms: 2, excludeImported: true });
  return { ctx, rows, search };
}
const changes = [
  ['ownerListings/p', { price: '150000 EUR' }], ['ownerListings/p', { price: '100000 RON' }],
  ['ownerListings/p', { publicationStatus: 'hidden' }], ['ownerListings/p', { isCanonical: false }],
  ['ownerListings/p', { roomsValue: 3 }], ['ownerListings/p', { scopeKey: 'iasi' }],
  ['ownerListings/p', { transactionType: 'rent' }], ['agencies/a', { city: 'Iasi' }],
  ['agencies/a/properties/import', { ownerListingId: 'p' }], ['agencies/a/properties/import', { ownerListingUrl: 'https://example.test/listing' }],
] as const;
describe('owner watch notification relevance', () => {
  it('creates once with live title and stores criteria without pagination', async () => {
    const { ctx, rows, search } = fixture();
    expect(await createOwnerWatchNotification(ctx, 'r', 'n', 'p', search)).toMatchObject({ status: 'created' });
    expect(await createOwnerWatchNotification(ctx, 'r', 'n', 'p', search)).toMatchObject({ status: 'existing' });
    expect(rows.get('users/u/notifications/n')).toMatchObject({ body: 'Fresh title', ownerWatchCondition: { listingId: 'p' } });
    expect(rows.get('users/u/notifications/n').ownerWatchCondition.search.limit).toBeUndefined();
    expect((await reconcileRuleNotifications(ctx, { ids: ['n'] })).withdrawn).toBe(0);
  });
  it.each(changes)('skips changed source %s %j', async (path, patch) => {
    const { ctx, rows, search } = fixture(); rows.set(path, { ...rows.get(path), ...patch });
    expect(await createOwnerWatchNotification(ctx, 'r', 'n', 'p', search)).toEqual({ status: 'skipped', reasonCode: 'state_changed' });
    expect(rows.has('users/u/notifications/n')).toBe(false);
  });
  it.each(changes)('withdraws after source change %s %j', async (path, patch) => {
    const { ctx, rows, search } = fixture(); await createOwnerWatchNotification(ctx, 'r', 'n', 'p', search);
    rows.set(path, { ...rows.get(path), ...patch });
    expect((await reconcileRuleNotifications(ctx, { ids: ['n'] })).withdrawn).toBe(1);
    expect(rows.get('users/u/notifications/n')).toMatchObject({ isRead: true, withdrawalReason: 'state_changed' });
  });
  it('withdraws deletion and never recreates a withdrawn alert', async () => {
    const { ctx, rows, search } = fixture(); await createOwnerWatchNotification(ctx, 'r', 'n', 'p', search); rows.delete('ownerListings/p');
    expect((await reconcileRuleNotifications(ctx, { ids: ['n'] })).withdrawn).toBe(1);
    expect(rows.get('users/u/notifications/n').withdrawalReason).toBe('entity_deleted');
    expect(await createOwnerWatchNotification(ctx, 'r', 'n', 'p', search)).toMatchObject({ status: 'existing' });
  });
  it('honors explicit scope, excludes only exact agency imports, and allows imports when requested', async () => {
    const { ctx, rows, search } = fixture(); rows.set('agencies/a', { city: 'Iasi' });
    rows.set('agencies/b/properties/import', { ownerListingId: 'p' });
    rows.set('agencies/a/properties/similar', { title: 'Fresh title' });
    expect(await createOwnerWatchNotification(ctx, 'r', 'n', 'p', { ...search, scopeKey: 'brasov' })).toMatchObject({ status: 'created' });
    rows.set('agencies/a/properties/import', { ownerListingId: 'p' });
    expect(await createOwnerWatchNotification(ctx, 'r', 'n2', 'p', { ...search, scopeKey: 'brasov', excludeImported: false })).toMatchObject({ status: 'created' });
  });
  it('rejects revoked membership and does not infer a binding for legacy alerts', async () => {
    const { ctx, rows, search } = fixture(); rows.set('users/u', { agencyId: 'b', role: 'agent' });
    await expect(createOwnerWatchNotification(ctx, 'r', 'n', 'p', search)).rejects.toThrow('Permisiunile');
    rows.set('users/u', { agencyId: 'a', role: 'agent' });
    rows.set('users/u/notifications/old', { type: 'ai_assistant', agencyId: 'a', recipientId: 'u', automationId: 'r' });
    expect((await reconcileRuleNotifications(ctx, { ids: ['old'] })).withdrawn).toBe(0);
  });
});

it.each([false, true])('defers owner watch without writes at quiet boundary (during import read: %s)', async during => {
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(during ? '2026-10-07T18:59:59Z' : '2026-10-07T19:00:00Z'));
  const { ctx, rows, search } = fixture(path => { if (during && path === 'agencies/a/properties') vi.setSystemTime(new Date('2026-10-07T19:00:00Z')); });
  expect(await createOwnerWatchNotification(ctx, 'r', 'n', 'p', search, { timezone: 'Europe/Bucharest', start: '22:00', end: '08:00' })).toMatchObject({ status: 'deferred', reasonCode: 'quiet_hours', deferredUntil: '2026-10-08T05:00:00.000Z' });
  expect(rows.has('users/u/notifications/n')).toBe(false);
});
