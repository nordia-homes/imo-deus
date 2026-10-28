import { describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { populatePublicNearbyOnce } from './public-nearby-server';

function database(property: Record<string, unknown> | null = { address: 'București', latitude: 44.4, longitude: 26.1 }) {
  const rows = new Map<string, any>();
  if (property) rows.set('agencies/agency/properties/property', property);
  let queue = Promise.resolve();
  const db = {
    doc: (path: string) => ({ path, update: async (value: any) => rows.set(path, { ...rows.get(path), ...value }) }),
    runTransaction: (callback: any) => {
      const result = queue.then(() => callback({
        get: async (ref: any) => ({ exists: rows.has(ref.path), data: () => rows.get(ref.path) }),
        create: (ref: any, value: any) => { if (rows.has(ref.path)) throw Error('Duplicate'); rows.set(ref.path, value); },
        update: (ref: any, value: any) => rows.set(ref.path, { ...rows.get(ref.path), ...value }),
      }));
      queue = result.then(() => undefined, () => undefined);
      return result;
    },
  } as unknown as Firestore;
  return { db, rows };
}

describe('one-time public nearby calculation', () => {
  it('concurrent and repeated creation deliveries make only one paid calculation', async () => {
    const { db, rows } = database();
    const calculate = vi.fn(async () => []);
    await Promise.all(Array.from({ length: 8 }, () => populatePublicNearbyOnce(db, 'agency', 'property', calculate)));
    await populatePublicNearbyOnce(db, 'agency', 'property', calculate);
    expect(calculate).toHaveBeenCalledTimes(1);
    expect(rows.get('agencies/agency/properties/property').publicNearby).toMatchObject({ status: 'ready', objectives: [] });
  });
  it('does not re-bill after a calculation failure', async () => {
    const { db } = database();
    const calculate = vi.fn(async () => { throw Error('Google timeout'); });
    await expect(populatePublicNearbyOnce(db, 'agency', 'property', calculate)).rejects.toThrow();
    await expect(populatePublicNearbyOnce(db, 'agency', 'property', calculate)).resolves.toEqual({ status: 'skipped' });
    expect(calculate).toHaveBeenCalledTimes(1);
  });
  it.each([null, {}, { publicNearby: { status: 'ready', objectives: [] } }])('does not calculate for missing location, missing property or saved results', async property => {
    const { db } = database(property);
    const calculate = vi.fn(async () => []);
    await populatePublicNearbyOnce(db, 'agency', 'property', calculate);
    expect(calculate).not.toHaveBeenCalled();
  });
  it('does not recreate a property deleted during calculation', async () => {
    const { db, rows } = database();
    await populatePublicNearbyOnce(db, 'agency', 'property', async () => {
      rows.delete('agencies/agency/properties/property');
      return [];
    });
    expect(rows.has('agencies/agency/properties/property')).toBe(false);
  });
});
