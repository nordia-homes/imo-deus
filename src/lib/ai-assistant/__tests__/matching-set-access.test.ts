import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ collection: vi.fn(), allowed: vi.fn() }));
vi.mock('../access', () => ({ collectionFor: mocks.collection, referencesAllowed: mocks.allowed, getResource: vi.fn() }));
import { readMatchingResultSet } from '../context';
let record: any;
beforeEach(() => {
  record = { ownerId: 'u', kind: 'existing_matches', expiresAt: Date.now() + 60000, rows: [{ id: 'p' }], accessRefs: [] };
  mocks.collection.mockReturnValue({ doc: () => ({ get: async () => ({ data: () => record }) }) });
  mocks.allowed.mockResolvedValue(true);
});
it('reads the original owned matching set without reranking', async () => {
  expect(await readMatchingResultSet({ uid: 'u' } as any, 'r')).toBe(record);
});
it.each([{ ownerId: 'other' }, { expiresAt: 0 }, { expiresAt: undefined }, { expiresAt: '2999999999999' }, { expiresAt: Infinity }, { kind: 'other' }, { rows: null }])('refuses invalid contextual provenance %j', async patch => {
  Object.assign(record, patch);
  await expect(readMatchingResultSet({ uid: 'u' } as any, 'r')).rejects.toThrow('expirat');
});
it('refuses revoked references even for an unexpired set', async () => {
  mocks.allowed.mockResolvedValue(false);
  await expect(readMatchingResultSet({ uid: 'u' } as any, 'r')).rejects.toThrow('accesibil');
});
