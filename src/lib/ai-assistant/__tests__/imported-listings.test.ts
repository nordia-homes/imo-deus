import { expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ collection: vi.fn() }));
vi.mock('../access', () => ({ collectionFor: mocks.collection }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error {} }));
import { importedListingIds } from '../imported-listings';

function setup(rows: Record<string, unknown>[], failure = false) {
  const calls: { field: string; values: string[] }[] = [];
  mocks.collection.mockImplementation((ctx, resource) => {
    expect(ctx.agencyId).toBe('own'); expect(resource).toBe('properties');
    return { where: (field: string, operator: string, values: string[]) => {
      expect(operator).toBe('in'); expect(values.length).toBeLessThanOrEqual(30);
      calls.push({ field, values });
      return { select: () => ({ limit: () => ({ get: async () => {
        if (failure) throw new Error('database unavailable');
        const found = rows.filter(row => values.includes(row[field] as string));
        return { size: found.length, docs: found.map(row => ({ data: () => row })) };
      } }) }) };
    } };
  });
  return calls;
}
const ctx: any = { agencyId: 'own' };
it('excludes imports by ID and original source URL, without returning CRM data', async () => {
  setup([{ ownerListingId: 'a', private: 'not returned' }, { ownerListingUrl: 'https://source.example/b' }]);
  expect([...await importedListingIds(ctx, [{ id: 'a', row: {} }, { id: 'b', row: { originSourceUrl: 'https://source.example/b' } }, { id: 'c', row: {} }])]).toEqual(['a','b']);
});
it('does not infer a duplicate from similar text, phone or a URL prefix', async () => {
  setup([{ ownerListingUrl: 'https://source.example/1', ownerPhone: 'same', title: 'same' }]);
  expect(await importedListingIds(ctx, [{ id: 'new', row: { link: 'https://source.example/12', ownerPhone: 'same', title: 'same' } }])).toEqual(new Set());
});
it('chunks more than thirty identifiers without omitting later matches', async () => {
  const calls = setup([{ ownerListingId: 'c34' }]);
  const result = await importedListingIds(ctx, Array.from({ length: 35 }, (_, i) => ({ id: `c${i}`, row: {} })));
  expect([...result]).toEqual(['c34']); expect(calls).toHaveLength(2);
});
it('never treats an interrupted CRM lookup as an empty successful result', async () => {
  setup([], true);
  await expect(importedListingIds(ctx, [{ id: 'a', row: {} }])).rejects.toThrow('unavailable');
});
it('refuses a capped lookup rather than claiming remaining candidates are new', async () => {
  setup(Array.from({ length: 1001 }, () => ({ ownerListingId: 'a' })));
  await expect(importedListingIds(ctx, [{ id: 'a', row: {} }])).rejects.toThrow('incompletă');
});
it('does not query Firestore for an empty candidate page', async () => {
  const calls = setup([]);
  expect(await importedListingIds(ctx, [])).toEqual(new Set()); expect(calls).toHaveLength(0);
});
