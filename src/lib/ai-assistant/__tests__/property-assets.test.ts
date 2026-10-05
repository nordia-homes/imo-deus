import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ save: vi.fn(), metadata: vi.fn(), resource: vi.fn(), encode: vi.fn(async (bytes: Buffer) => bytes) }));
vi.mock('firebase-admin/storage', () => ({ getStorage: () => ({ bucket: () => ({ name: 'bucket', file: () => ({ save: mocks.save, getMetadata: mocks.metadata }) }) }) }));
vi.mock('sharp', () => ({ default: (bytes: Buffer) => { const chain: any = { rotate: () => chain, resize: () => chain, webp: () => chain, toBuffer: () => mocks.encode(bytes) }; return chain; } }));
vi.mock('../access', () => ({ getResource: mocks.resource, collectionFor: (ctx: any, name: string) => ctx.adminDb.collection('agencies/a/' + name) }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } } }));
import { applyPropertyAsset } from '@/lib/crm/property-assets';
import type { AssistantContext } from '../access';

function fixture() {
  const rows = new Map<string, any>([['users/u', { agencyId: 'a', role: 'agent' }], ['agencies/a/properties/p', { images: [] }]]);
  const reference = (path: string): any => ({ path, doc: (id: string) => reference(path + '/' + id), get: async () => ({ exists: rows.has(path), data: () => rows.get(path) }), update: async (patch: any) => rows.set(path, { ...rows.get(path), ...patch }) });
  const db = { collection: reference, runTransaction: async (work: any) => {
    const writes: (() => void)[] = [];
    const result = await work({ get: (ref: any) => { if (writes.length) throw new Error('Read after write'); return ref.get(); }, update: (ref: any, patch: any) => writes.push(() => rows.set(ref.path, { ...rows.get(ref.path), ...patch })), create: (ref: any, data: any) => writes.push(() => rows.set(ref.path, data)) });
    writes.forEach(write => write()); return result;
  } };
  return { rows, ctx: { uid: 'u', agencyId: 'a', role: 'agent', adminAuth: { app: {} }, adminDb: db } as unknown as AssistantContext };
}
const upload = { name: 'plan.png', mimeType: 'image/png' }, bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
afterEach(() => vi.clearAllMocks());
describe('property assets attached by the common server service', () => {
  it('attaches once and returns the same result on an idempotent replay', async () => {
    const { ctx, rows } = fixture();
    const first = await applyPropertyAsset(ctx, 'upload', 'p', 'property_image', upload, bytes);
    expect(await applyPropertyAsset(ctx, 'upload', 'p', 'property_image', upload, bytes)).toEqual(first);
    expect(rows.get('agencies/a/properties/p').images).toHaveLength(1);
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(mocks.save.mock.calls[0][1].preconditionOpts).toEqual({ ifGenerationMatch: 0 });
  });
  it('reuses the winning storage token after a concurrent upload precondition failure', async () => {
    const { ctx, rows } = fixture();
    mocks.save.mockRejectedValueOnce({ code: 412 });
    mocks.metadata.mockResolvedValueOnce([{ metadata: { firebaseStorageDownloadTokens: 'original-token' } }]);
    await applyPropertyAsset(ctx, 'upload', 'p', 'property_rlv', upload, bytes);
    expect(rows.get('agencies/a/properties/p').rlvUrl).toContain('token=original-token');
    expect(rows.get('agencies/a/properties/p').rlvFileType).toBe('image/webp');
  });
  it('rejects a revoked member even when a completed attachment exists', async () => {
    const { ctx, rows } = fixture();
    await applyPropertyAsset(ctx, 'upload', 'p', 'property_image', upload, bytes);
    rows.set('users/u', { agencyId: 'other', role: 'agent' });
    await expect(applyPropertyAsset(ctx, 'upload', 'p', 'property_image', upload, bytes)).rejects.toThrow('revocat');
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
});
