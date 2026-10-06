import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ row: {} as any, membership: { agencyId: 'a', role: 'agent' } }));
vi.mock('../access', () => ({ collectionFor: () => ({ doc: () => ({ get: async () => ({ data: () => state.row }) }) }) }));
import { readOfficialSource } from '../legal-source';
const id = `legal-${'a'.repeat(64)}-${'b'.repeat(64)}`, url = 'https://legislatie.just.ro/Public/DetaliiDocument/1';
const ctx = { uid: 'u', agencyId: 'a', role: 'agent', adminDb: { collection: () => ({ doc: () => ({ get: async () => ({ data: () => state.membership }) }) }) } } as any;
beforeEach(() => {
  state.row = { kind: 'official_source', sourceUrl: url, text: 'x'.repeat(15000), retrievedAt: '2026-01-01', contentHash: 'b'.repeat(64), truncated: false };
  state.membership = { agencyId: 'a', role: 'agent' };
});
it('paginates the exact archived version without fetching a changed live page', async () => {
  const first = await readOfficialSource(ctx, url, 0, id);
  expect(first).toMatchObject({ snapshotId: id, nextOffset: 10000, complete: false, temporalValidityVerified: false });
  expect(first).not.toHaveProperty('text');
  expect(await readOfficialSource(ctx, url, first.nextOffset, id)).toMatchObject({ nextOffset: null, complete: true, contentHash: first.contentHash });
});
it('requires a version for continuation and preserves truncation uncertainty', async () => {
  await expect(readOfficialSource(ctx, url, 10000)).rejects.toThrow('snapshotId');
  state.row.truncated = true;
  expect(await readOfficialSource(ctx, url, 10000, id)).toMatchObject({ nextOffset: null, complete: false });
});
it('refuses revoked membership and mismatched source/version pairs', async () => {
  await expect(readOfficialSource(ctx, 'https://www.ancpi.ro/other', 0, id)).rejects.toThrow('nu este disponibilă');
  state.membership.agencyId = 'other';
  await expect(readOfficialSource(ctx, url, 0, id)).rejects.toThrow('Acces revocat');
});
