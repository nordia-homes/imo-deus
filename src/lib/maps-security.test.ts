import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { NextRequest } from 'next/server';

const { auth } = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: auth }));
import { consumeMapsRequest } from './maps-request-guard';
import { GET as geocode } from '@/app/api/geocode/route';
import { GET as search } from '@/app/api/geocode-search/route';
import { GET as browserKey } from '@/app/api/maps/browser-key/route';
import { GET as nearby } from '@/app/api/properties/[propertyId]/nearby-objectives/route';

function database() {
  const rows = new Map<string, any>();
  let queue = Promise.resolve();
  return {
    doc: (path: string) => ({ path }),
    runTransaction: (work: any) => {
      const result = queue.then(() => work({
        get: async (ref: any) => ({ data: () => rows.get(ref.path) }),
        set: (ref: any, value: any) => rows.set(ref.path, value),
      }));
      queue = result.then(() => undefined, () => undefined);
      return result;
    },
  } as unknown as Firestore;
}

beforeEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); vi.stubGlobal('fetch', vi.fn()); });

describe('Maps cost protection', () => {
  it.each([geocode, search])('rejects unauthenticated address requests before any paid call', async handler => {
    auth.mockRejectedValue(Object.assign(new Error('Missing token'), { status: 401 }));
    const response = await handler(new NextRequest('https://example.test/api/geocode?address=Bucuresti'));
    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('never returns the server secret if the browser key is missing', async () => {
    vi.stubEnv('GOOGLE_MAPS_BROWSER_API_KEY', '');
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', '');
    vi.stubEnv('GOOGLE_MAPS_API_KEY', 'server-secret');
    const response = await browserKey();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('server-secret');
  });

  it('enforces a shared atomic limit under concurrent requests', async () => {
    const db = database();
    const results = await Promise.allSettled(Array.from({ length: 30 }, () => consumeMapsRequest(db, 'user', 60000)));
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(20);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(10);
    await expect(consumeMapsRequest(db, 'another-user', 60000)).resolves.toBeUndefined();
    await expect(consumeMapsRequest(db, 'user', 120000)).resolves.toBeUndefined();
  });

  it('enforces the daily limit across minute windows and resets the next day', async () => {
    const db = database();
    for (let i = 0; i < 150; i++) await consumeMapsRequest(db, 'user', Math.floor(i / 20) * 60000);
    await expect(consumeMapsRequest(db, 'user', 600000)).rejects.toMatchObject({ status: 429 });
    await expect(consumeMapsRequest(db, 'user', 86400000)).resolves.toBeUndefined();
  });

  it('returns saved nearby data in admin without Google requests', async () => {
    const saved = { status: 'ready', calculatedAt: '2026-10-28', objectives: [{ kind: 'metro', name: 'Izvor' }] };
    const ref: any = { collection: () => ref, doc: () => ref, get: async () => ({ exists: true, id: 'p', data: () => ({ publicNearby: saved }) }) };
    auth.mockResolvedValue({ agencyId: 'agency', adminDb: ref });
    const response = await nearby(new NextRequest('https://example.test/api/properties/p/nearby-objectives'), { params: Promise.resolve({ propertyId: 'p' }) });
    expect((await response.json()).objectives).toEqual(saved.objectives);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not start paid calculations for properties without a saved snapshot', async () => {
    const ref: any = { collection: () => ref, doc: () => ref, get: async () => ({ exists: true, id: 'p', data: () => ({}) }) };
    auth.mockResolvedValue({ agencyId: 'agency', adminDb: ref });
    const response = await nearby(new NextRequest('https://example.test/api/properties/p/nearby-objectives'), { params: Promise.resolve({ propertyId: 'p' }) });
    expect(await response.json()).toMatchObject({ objectives: [], status: 'not-calculated' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
