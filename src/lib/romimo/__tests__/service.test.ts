import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import type { Property } from '@/lib/types';
import catalog from '../catalog.snapshot.json';
import { buildArticle, defaultSettings, externalIdFor, previewHashFor } from '../mapping';
import { RomimoError, getLiveCatalog, getToken, romimoRequest } from '../client';
import { checkOrUnpublish, connect, disconnect, listManagedArticles, preview, publish } from '../service';

vi.mock('../client', async importOriginal => ({
  ...await importOriginal<typeof import('../client')>(),
  getLiveCatalog: vi.fn(async () => catalog), getToken: vi.fn(async () => 'abc.def.ghi'), romimoRequest: vi.fn(),
}));

// Minimal transactional store exercises our state machine, not Firebase internals.
function memoryDb() {
  const docs = new Map<string, Record<string, unknown>>();
  let transactionTail = Promise.resolve();
  function ref(path: string): { path: string; id: string; get: () => Promise<ReturnType<typeof snapshot>>; set: (value: Record<string, unknown>) => Promise<void>; collection: (name: string) => ReturnType<typeof collection> } {
    return { path, id: path.split('/').at(-1)!, get: async () => snapshot(path), set: async value => { docs.set(path, { ...docs.get(path), ...structuredClone(value) }); }, collection: name => collection(`${path}/${name}`) };
  }
  const snapshot = (path: string) => ({ exists: docs.has(path), id: path.split('/').at(-1)!, data: () => docs.has(path) ? structuredClone(docs.get(path)) : undefined });
  type MemoryQuery = {
    doc: (id: string) => ReturnType<typeof ref>; limit: (count: number) => MemoryQuery;
    orderBy: (field: string) => MemoryQuery; startAfter: (id: string) => MemoryQuery;
    get: () => Promise<{ empty: boolean; docs: Array<ReturnType<typeof snapshot>> }>;
  };
  function collection(path: string, count = Infinity, cursor = ''): MemoryQuery {
    return {
      doc: id => ref(`${path}/${id}`), limit: n => collection(path, n, cursor),
      orderBy: () => collection(path, count, cursor), startAfter: id => collection(path, count, id),
      get: async () => {
        const entries = [...docs.keys()].filter(key => key.startsWith(`${path}/`) && key.slice(path.length + 1) > cursor).sort().slice(0, count).map(snapshot);
        return { empty: entries.length === 0, docs: entries };
      },
    };
  }
  function batch() {
    const writes: Array<() => void> = [];
    return {
      set: (reference: ReturnType<typeof ref>, value: Record<string, unknown>) => writes.push(() => { docs.set(reference.path, { ...docs.get(reference.path), ...structuredClone(value) }); }),
      update: (reference: ReturnType<typeof ref>, value: Record<string, unknown>) => {
        if (!docs.has(reference.path)) throw new Error('Missing property');
        writes.push(() => { docs.set(reference.path, { ...docs.get(reference.path), ...structuredClone(value) }); });
      },
      commit: async () => { writes.forEach(write => write()); },
    };
  }
  const db = {
    collection, batch,
    runTransaction: <T>(fn: (tx: { get: (reference: ReturnType<typeof ref>) => Promise<ReturnType<typeof snapshot>>; set: (reference: ReturnType<typeof ref>, data: Record<string, unknown>, options?: unknown) => void; update: (reference: ReturnType<typeof ref>, data: Record<string, unknown>) => void }) => Promise<T>) => {
      const result = transactionTail.then(async () => {
        const pending = batch();
        const value = await fn({ get: reference => reference.get(), set: pending.set, update: pending.update });
        await pending.commit(); return value;
      });
      transactionTail = result.then(() => undefined, () => undefined);
      return result;
    },
  } as unknown as Firestore;
  return { db, docs };
}
const now = new Date('2026-09-26T12:00:00Z');
function fixture() {
  const { db, docs } = memoryDb();
  const property: Property = { id: 'p1', title: 'Apartament cu două camere', description: 'Apartament renovat aproape de parc.', address: '', location: '', price: 100000, rooms: 2, bathrooms: 1, squareFootage: 55, images: [], propertyType: 'Apartament', transactionType: 'Vânzare', constructionYear: 2000, partitioning: 'Decomandat', floor: '2' };
  property.heatingSystem = 'Centrala proprie';
  const settings = { ...defaultSettings(property, catalog, { name: 'Agent', email: 'agent@example.com', phone: '0712345678' }, now), county: 'bucuresti', city: 'sector 1' };
  docs.set('agencyPrivateIntegrations/a__romimo', { connected: true, apiKey: 'PRIVATE', email: 'agency@example.com' });
  docs.set('agencies/a/properties/p1', property as unknown as Record<string, unknown>);
  const payload = buildArticle(property, settings, catalog, 'agency@example.com', externalIdFor('a', 'p1'), now);
  expect(payload.issues).toEqual([]);
  return { ctx: { db, agencyId: 'a', uid: 'agent' }, docs, property, settings, hash: previewHashFor(property, payload.payload), op: 'agencyPrivateIntegrations/a__romimo/operations/p1' };
}

beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv('ROMIMO_UPSERT_CONFIRMED', 'false');
  vi.mocked(getToken).mockResolvedValue('abc.def.ghi');
  vi.mocked(getLiveCatalog).mockResolvedValue(catalog);
  vi.mocked(romimoRequest).mockImplementation(async path => {
    if (path.endsWith('/County')) return { data: ['bucuresti'], status: 200 };
    if (path.endsWith('/City')) return { data: ['sector 1'], status: 200 };
    return { data: { success: true }, status: 200 };
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('Romimo account and submission state machine', () => {
  it('keeps API credentials and operation mappings in the private collection', async () => {
    const f = fixture();
    const result = await connect(f.ctx, 'NEW_PRIVATE', 'agency@example.com');
    expect(result.connected).toBe(true);
    expect(JSON.stringify(result)).not.toContain('NEW_PRIVATE');
    expect(f.docs.get('agencyPrivateIntegrations/a__romimo')?.apiKey).toBe('NEW_PRIVATE');
    await disconnect(f.ctx);
    expect(f.docs.get('agencyPrivateIntegrations/a__romimo')).toMatchObject({ apiKey: null, connected: false, email: 'agency@example.com' });
  });
  it('rejects stale previews and foreign properties before making a mutation', async () => {
    const f = fixture();
    f.docs.get('agencies/a/properties/p1')!.price = 150000;
    await expect(publish(f.ctx, 'p1', f.settings, f.hash)).rejects.toThrow(/s-au schimbat/);
    await expect(publish({ ...f.ctx, agencyId: 'other' }, 'p1', f.settings, f.hash)).rejects.toThrow();
    expect(romimoRequest).not.toHaveBeenCalled();
  });
  it('does not mark a successful submission as published without verification', async () => {
    const f = fixture();
    const result = await publish(f.ctx, 'p1', f.settings, f.hash);
    expect(result.state).toBe('pending');
    expect(f.docs.get(f.op)).toMatchObject({ submitted: true, lastAction: 'sent' });
    expect(JSON.stringify(f.docs.get('agencies/a/properties/p1'))).not.toContain('PRIVATE');
    await expect(publish(f.ctx, 'p1', f.settings, f.hash)).rejects.toThrow(/neconfirmat/);
    expect(vi.mocked(romimoRequest).mock.calls.filter(([path, options]) => path === '/api/Article' && options?.method === 'POST')).toHaveLength(1);
  });
  it('persists uncertain results and refuses blind retries after timeouts', async () => {
    const f = fixture();
    const original = vi.mocked(romimoRequest).getMockImplementation()!;
    vi.mocked(romimoRequest).mockImplementation(async (path, options) => {
      if (path === '/api/Article') throw new RomimoError('Timeout', 502);
      return original(path, options);
    });
    await expect(publish(f.ctx, 'p1', f.settings, f.hash)).rejects.toThrow('Timeout');
    expect(f.docs.get(f.op)).toMatchObject({ submitted: true, state: 'pending', lastAction: 'uncertain' });
    await expect(publish(f.ctx, 'p1', f.settings, f.hash)).rejects.toThrow(/neconfirmat/);
  });
  it('allows correcting an explicit rejection without assuming the ad was created', async () => {
    const f = fixture();
    const original = vi.mocked(romimoRequest).getMockImplementation()!;
    vi.mocked(romimoRequest).mockImplementation(async (path, options) => {
      if (path === '/api/Article') throw new RomimoError('Invalid', 502, 400);
      return original(path, options);
    });
    await expect(publish(f.ctx, 'p1', f.settings, f.hash)).rejects.toThrow('Invalid');
    expect(f.docs.get(f.op)).toMatchObject({ submitted: false, state: 'error' });
  });
  it('verifies only the authoritative external ID and guards updates until enabled', async () => {
    const f = fixture();
    await publish(f.ctx, 'p1', f.settings, f.hash);
    vi.mocked(romimoRequest).mockResolvedValue({ data: { externalid: externalIdFor('a', 'p1'), active: true }, status: 200 });
    expect((await checkOrUnpublish(f.ctx, 'p1', false)).state).toBe('published');
    await expect(publish(f.ctx, 'p1', f.settings, f.hash)).rejects.toThrow(/contul de test/);
    expect(romimoRequest).toHaveBeenLastCalledWith('/api/Article', expect.objectContaining({ query: { Email: 'agency@example.com', ExternalId: externalIdFor('a', 'p1') } }));
  });
  it('keeps missing-after-timeout ads pending, and confirms deletion only with 204', async () => {
    const f = fixture();
    f.docs.set(f.op, { submitted: true, state: 'pending' });
    vi.mocked(romimoRequest).mockRejectedValue(new RomimoError('Missing', 502, 404));
    expect((await checkOrUnpublish(f.ctx, 'p1', false)).state).toBe('pending');
    expect(f.docs.get(f.op)?.submitted).toBe(true);
    vi.mocked(romimoRequest).mockResolvedValue({ data: null, status: 204 });
    expect((await checkOrUnpublish(f.ctx, 'p1', true)).state).toBe('unpublished');
    vi.mocked(romimoRequest).mockRejectedValue(new RomimoError('Missing', 502, 404));
    expect((await checkOrUnpublish(f.ctx, 'p1', false)).state).toBe('unpublished');
  });
  it('honors active leases and prevents changing accounts with existing associations', async () => {
    const f = fixture();
    f.docs.get('agencyPrivateIntegrations/a__romimo')!.leaseUntil = now.getTime() + 100000;
    await expect(publish(f.ctx, 'p1', f.settings, f.hash)).rejects.toThrow(/în curs/);
    expect(getToken).not.toHaveBeenCalled();
    f.docs.get('agencyPrivateIntegrations/a__romimo')!.leaseUntil = 0;
    f.docs.set(f.op, { submitted: true });
    await expect(connect(f.ctx, 'KEY', 'other@example.com')).rejects.toThrow(/migrarea/);
  });
  it('uses the property agent only if they belong to the same agency', async () => {
    const f = fixture();
    f.docs.get('agencies/a/properties/p1')!.agentId = 'foreign';
    f.docs.set('users/foreign', { agencyId: 'other', email: 'private@example.com', phone: 'private-phone' });
    const result = await preview(f.ctx, 'p1');
    expect(result.settings.contactEmail).toBe('');
    expect(JSON.stringify(result)).not.toContain('private-phone');
  });
  it('updates with the same external ID once the provider semantics are explicitly enabled', async () => {
    const f = fixture();
    vi.stubEnv('ROMIMO_UPSERT_CONFIRMED', 'true');
    f.docs.set(f.op, { submitted: true, state: 'published', externalId: 'untrusted-old-id' });
    const changed = { ...f.property, price: 123456 };
    f.docs.set('agencies/a/properties/p1', changed as unknown as Record<string, unknown>);
    const payload = buildArticle(changed, f.settings, catalog, 'agency@example.com', externalIdFor('a', 'p1'), now).payload;
    await publish(f.ctx, 'p1', f.settings, previewHashFor(changed, payload));
    expect(romimoRequest).toHaveBeenLastCalledWith('/api/Article', expect.objectContaining({ method: 'POST', body: expect.objectContaining({ ad: expect.objectContaining({ price: 123456, externalid: externalIdFor('a', 'p1') }) }) }));
    expect(f.docs.get(f.op)?.state).toBe('pending');
  });
  it('uses snapshot data only for preview, never to bypass a failed live catalog on publication', async () => {
    const f = fixture();
    vi.mocked(getLiveCatalog).mockRejectedValue(new RomimoError('Catalog unavailable', 502));
    const result = await preview(f.ctx, 'p1', f.settings);
    expect(result.warnings.join(' ')).toMatch(/Catalogul live/);
    await expect(publish(f.ctx, 'p1', f.settings, f.hash)).rejects.toThrow('Catalog unavailable');
    expect(romimoRequest).not.toHaveBeenCalled();
  });
  it('does not overwrite working credentials when a reconnect is refused', async () => {
    const f = fixture();
    vi.mocked(getToken).mockRejectedValue(new RomimoError('Unauthorized', 502, 401));
    await expect(connect(f.ctx, 'INVALID', 'agency@example.com')).rejects.toThrow();
    expect(f.docs.get('agencyPrivateIntegrations/a__romimo')).toMatchObject({ apiKey: 'PRIVATE', connected: true, leaseUntil: 0 });
  });
  it('does not treat HTTP 200 deletion responses as confirmation', async () => {
    const f = fixture();
    f.docs.set(f.op, { submitted: true, state: 'published' });
    vi.mocked(romimoRequest).mockResolvedValue({ data: { externalid: externalIdFor('a', 'p1'), active: false }, status: 200 });
    expect((await checkOrUnpublish(f.ctx, 'p1', true)).state).toBe('pending');
  });
  it('retains the outcome and can withdraw an ad after the property is deleted during publication', async () => {
    const f = fixture();
    const original = vi.mocked(romimoRequest).getMockImplementation()!;
    vi.mocked(romimoRequest).mockImplementation(async (path, options) => {
      if (path === '/api/Article' && options?.method === 'POST') f.docs.delete('agencies/a/properties/p1');
      return original(path, options);
    });
    await publish(f.ctx, 'p1', f.settings, f.hash);
    expect(f.docs.has('agencies/a/properties/p1')).toBe(false);
    expect(f.docs.get(f.op)).toMatchObject({ submitted: true, lastAction: 'sent', propertyTitle: f.property.title });
    expect((await listManagedArticles(f.ctx)).items[0].propertyId).toBe('p1');
    vi.mocked(romimoRequest).mockResolvedValue({ data: null, status: 204 });
    expect((await checkOrUnpublish(f.ctx, 'p1', true)).state).toBe('unpublished');
    expect(f.docs.has('agencies/a/properties/p1')).toBe(false);
  });
  it('catches property edits made during remote validation before sending the ad', async () => {
    const f = fixture();
    const original = vi.mocked(romimoRequest).getMockImplementation()!;
    vi.mocked(romimoRequest).mockImplementation(async (path, options) => {
      if (path.endsWith('/City')) f.docs.get('agencies/a/properties/p1')!.status = 'Vândut';
      return original(path, options);
    });
    await expect(publish(f.ctx, 'p1', f.settings, f.hash)).rejects.toThrow(/timpul validării/);
    expect(f.docs.has(f.op)).toBe(false);
    expect(vi.mocked(romimoRequest).mock.calls.some(([path]) => path === '/api/Article')).toBe(false);
  });
  it('fences an expired worker before the external mutation', async () => {
    const f = fixture();
    vi.mocked(getToken).mockImplementation(async () => { vi.setSystemTime(now.getTime() + 241000); return 'token'; });
    await expect(publish(f.ctx, 'p1', f.settings, f.hash)).rejects.toThrow(/expirat/);
    expect(f.docs.has(f.op)).toBe(false);
    expect(vi.mocked(romimoRequest).mock.calls.some(([path]) => path === '/api/Article')).toBe(false);
  });
  it('does not overwrite a newer worker outcome or release its lease', async () => {
    const f = fixture();
    const original = vi.mocked(romimoRequest).getMockImplementation()!;
    vi.mocked(romimoRequest).mockImplementation(async (path, options) => {
      if (path === '/api/Article') {
        f.docs.get('agencyPrivateIntegrations/a__romimo')!.leaseId = 'new-worker';
        f.docs.set(f.op, { submitted: true, state: 'published', lastAction: 'newer-result' });
      }
      return original(path, options);
    });
    await expect(publish(f.ctx, 'p1', f.settings, f.hash)).rejects.toThrow(/expirat/);
    expect(f.docs.get(f.op)?.lastAction).toBe('newer-result');
    expect(f.docs.get('agencyPrivateIntegrations/a__romimo')?.leaseId).toBe('new-worker');
  });
  it('serializes simultaneous submissions, while allowing recovery after an expired lease', async () => {
    const f = fixture();
    f.docs.get('agencyPrivateIntegrations/a__romimo')!.leaseUntil = now.getTime() - 1;
    const results = await Promise.allSettled([publish(f.ctx, 'p1', f.settings, f.hash), publish(f.ctx, 'p1', f.settings, f.hash)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(vi.mocked(romimoRequest).mock.calls.filter(([path]) => path === '/api/Article')).toHaveLength(1);
  });
  it('refreshes derived CRM fields without discarding manually selected portal values', async () => {
    const f = fixture();
    f.settings.fields.storey = 'Etaj 3';
    const hash = previewHashFor(f.property, buildArticle(f.property, f.settings, catalog, 'agency@example.com', externalIdFor('a', 'p1'), now).payload);
    await publish(f.ctx, 'p1', f.settings, hash);
    Object.assign(f.docs.get('agencies/a/properties/p1')!, { constructionYear: 2008, floor: '6', transactionType: 'Închiriere' });
    const result = await preview(f.ctx, 'p1');
    expect(result.settings.fields.yearofbuilding).toBe('2008');
    expect(result.settings.fields.storey).toBe('Etaj 3');
    expect(result.settings.category).toBe(313);
  });
  it('paginates managed articles without returning saved credentials or settings', async () => {
    const f = fixture();
    for (let i = 0; i < 51; i++) f.docs.set(`agencyPrivateIntegrations/a__romimo/operations/p${String(i).padStart(3, '0')}`, { submitted: true, state: 'published', settings: { contactEmail: 'private@example.com' } });
    const first = await listManagedArticles(f.ctx);
    expect(first.items).toHaveLength(50);
    expect(first.nextCursor).toBe('p049');
    const second = await listManagedArticles(f.ctx, first.nextCursor!);
    expect(second.items.map(item => item.propertyId)).toEqual(['p050']);
    expect(second.nextCursor).toBeNull();
    expect(JSON.stringify(first)).not.toContain('private@example.com');
    expect((await listManagedArticles({ ...f.ctx, agencyId: 'other' })).items).toEqual([]);
  });
  it('invalidates a preview even when the changed CRM field is overridden in portal settings', async () => {
    const f = fixture();
    f.docs.get('agencies/a/properties/p1')!.floor = '8';
    // settings.fields.storey is still Etaj 2: hashing just the payload would miss this edit.
    await expect(publish(f.ctx, 'p1', f.settings, f.hash)).rejects.toThrow(/s-au schimbat/);
    expect(getToken).not.toHaveBeenCalled();
  });
});
