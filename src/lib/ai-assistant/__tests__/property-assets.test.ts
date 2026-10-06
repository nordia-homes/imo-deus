import { afterEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ save: vi.fn(), metadata: vi.fn(), download: vi.fn(), resource: vi.fn(), encode: vi.fn(async (bytes: Buffer) => bytes) }));
vi.mock('firebase-admin/storage', () => ({ getStorage: () => ({ bucket: () => ({ name: 'bucket', file: () => ({ save: mocks.save, getMetadata: mocks.metadata, download: mocks.download }) }) }) }));
vi.mock('sharp', () => ({ default: (bytes: Buffer) => { const chain: any = { rotate: () => chain, resize: () => chain, webp: () => chain, toBuffer: () => mocks.encode(bytes) }; return chain; } }));
vi.mock('../access', () => ({ getResource: mocks.resource, collectionFor: (ctx: any, name: string) => ctx.adminDb.collection('agencies/a/' + name) }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } } }));
import { applyPropertyAsset } from '@/lib/crm/property-assets';
import { applyBrandAsset } from '@/lib/crm/brand-assets';
import { prepareAgentPhoto } from '@/lib/crm/agent-photo';
import type { AssistantContext } from '../access';

function fixture() {
  const rows = new Map<string, any>([['users/u', { agencyId: 'a', role: 'agent' }], ['agencies/a/properties/p', { images: [] }]]);
  const reference = (path: string): any => ({ path, doc: (id: string) => reference(path + '/' + id), get: async () => ({ ref: reference(path), exists: rows.has(path), data: () => rows.get(path) }), update: async (patch: any) => rows.set(path, { ...rows.get(path), ...patch }) });
  const db = { collection: reference, runTransaction: async (work: any) => {
    const writes: (() => void)[] = [];
    const result = await work({ get: (ref: any) => { if (writes.length) throw new Error('Read after write'); return ref.get(); }, set: (ref: any, patch: any) => writes.push(() => rows.set(ref.path, { ...rows.get(ref.path), ...patch })), update: (ref: any, patch: any) => writes.push(() => rows.set(ref.path, { ...rows.get(ref.path), ...patch })), create: (ref: any, data: any) => writes.push(() => rows.set(ref.path, data)) });
    writes.forEach(write => write()); return result;
  } };
  return { rows, ctx: { uid: 'u', agencyId: 'a', role: 'agent', adminAuth: { app: {} }, adminDb: db } as unknown as AssistantContext };
}
const upload = { name: 'plan.png', mimeType: 'image/png' }, bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
afterEach(() => vi.clearAllMocks());
describe('property assets attached by the common server service', () => {
  it('rejects a stale displayed floor-plan revision before storing the replacement', async () => {
    const { ctx, rows } = fixture();
    rows.set('agencies/a/properties/p', { updatedAt: '2026-10-06T12:00:00Z', rlvUrl: 'newer-plan', images: [] });
    mocks.resource.mockResolvedValueOnce({ updatedAt: '2026-10-06T12:00:00Z' });
    await expect(applyPropertyAsset(ctx, 'upload', 'p', 'property_rlv', upload, bytes, '2020-01-01T10:00:00Z')).rejects.toMatchObject({ status: 409 });
    expect(rows.get('agencies/a/properties/p').rlvUrl).toBe('newer-plan');
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('rejects a floor-plan edit during recoding without a ledger or partial property write', async () => {
    const { ctx, rows } = fixture();
    const revision = '2026-10-06T10:00:00Z';
    rows.set('agencies/a/properties/p', { updatedAt: revision, rlvUrl: 'original', images: [] });
    mocks.resource.mockResolvedValueOnce({ updatedAt: revision });
    mocks.encode.mockImplementationOnce(async input => { rows.set('agencies/a/properties/p', { updatedAt: '2026-10-06T12:00:00Z', rlvUrl: 'concurrent', images: [] }); return input; });
    await expect(applyPropertyAsset(ctx, 'upload', 'p', 'property_rlv', upload, bytes, revision)).rejects.toMatchObject({ status: 409 });
    expect(rows.get('agencies/a/properties/p').rlvUrl).toBe('concurrent');
    expect([...rows.keys()].some(key => key.startsWith('agencies/a/assistantExecutions/'))).toBe(false);
    expect(rows.get('agencies/a/assistantUploads/upload')).toBeDefined();
  });
  it('prepares a private agent photo without applying it before dialog confirmation', async () => {
    const { ctx, rows } = fixture(); ctx.role = 'admin';
    rows.set('users/u', { agencyId: 'a', role: 'admin', photoUrl: 'admin-original' });
    rows.set('users/agent', { agencyId: 'a', role: 'agent', photoUrl: 'agent-original' });
    rows.set('agencies/a/assistantUploads/upload', { ownerId: 'u', expiresAt: Date.now() + 60000, mimeType: 'image/png', storagePath: 'agencies/a/privateCommunications/assistant-uploads/u/upload' });
    mocks.download.mockResolvedValue([bytes]);
    const photo = await prepareAgentPhoto(ctx, 'upload', 'agent');
    expect(photo.imageUrl).toContain('alt=media');
    expect(rows.get('users/agent').photoUrl).toBe('agent-original');
    expect(rows.get('users/u').photoUrl).toBe('admin-original');
    expect(rows.has(photo.ledger.path)).toBe(false);
    expect(rows.get('agencies/a/assistantUploads/upload')[`assetTargets.${photo.key}`].storagePath).toContain('/profile_photo/asset-');
    rows.set(photo.ledger.path, { actorId: 'u', status: 'completed', result: { agentId: 'agent', imageUrl: photo.imageUrl } });
    expect((await prepareAgentPhoto(ctx, 'upload', 'agent')).imageUrl).toBe(photo.imageUrl);
    expect(mocks.save).toHaveBeenCalledTimes(1);
    rows.get(photo.ledger.path).status = 'unknown';
    await expect(prepareAgentPhoto(ctx, 'upload', 'agent')).rejects.toMatchObject({ status: 409 });
  });
  it('rejects foreign agents, revoked administrators and uploads owned by another actor before saving a file', async () => {
    const { ctx, rows } = fixture(); ctx.role = 'admin';
    rows.set('users/u', { agencyId: 'a', role: 'admin' }); rows.set('users/agent', { agencyId: 'b', role: 'agent' });
    await expect(prepareAgentPhoto(ctx, 'upload', 'agent')).rejects.toMatchObject({ status: 403 });
    rows.set('users/agent', { agencyId: 'a', role: 'agent' });
    rows.set('agencies/a/assistantUploads/upload', { ownerId: 'other', expiresAt: Date.now() + 60000, mimeType: 'image/png', storagePath: 'agencies/a/privateCommunications/assistant-uploads/other/upload' });
    await expect(prepareAgentPhoto(ctx, 'upload', 'agent')).rejects.toMatchObject({ status: 404 });
    rows.set('users/u', { agencyId: 'a', role: 'agent' });
    await expect(prepareAgentPhoto(ctx, 'upload', 'agent')).rejects.toMatchObject({ status: 403 });
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.download).not.toHaveBeenCalled();
  });
  it('updates the own profile and public avatar once, denying agency logos to agents', async () => {
    const { ctx, rows } = fixture();
    const result = await applyBrandAsset(ctx, 'upload', 'profile_photo', upload, bytes);
    expect(rows.get('users/u').photoUrl).toBe(result.imageUrl);
    expect(rows.get('publicAgentProfiles/u').photoUrl).toBe(result.imageUrl);
    expect(await applyBrandAsset(ctx, 'upload', 'profile_photo', upload, bytes)).toEqual(result);
    await expect(applyBrandAsset(ctx, 'upload', 'agency_logo', upload, bytes)).rejects.toThrow('administratorul');
    rows.set('users/u', { agencyId: 'other', role: 'agent' });
    await expect(applyBrandAsset(ctx, 'upload', 'profile_photo', upload, bytes)).rejects.toThrow('revocat');
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
  it('applies an agency logo only for the current administrator', async () => {
    const { ctx, rows } = fixture(); ctx.role = 'admin';
    rows.set('users/u', { agencyId: 'a', role: 'admin' }); rows.set('agencies/a', { name: 'Agency' });
    const result = await applyBrandAsset(ctx, 'upload', 'agency_logo', upload, bytes);
    expect(rows.get('agencies/a')).toMatchObject({ name: 'Agency', logoUrl: result.imageUrl });
    expect(rows.has('publicAgentProfiles/u')).toBe(false);
  });
  it('applies a website share image without replacing the agency logo or any agent photo', async () => {
    const { ctx, rows } = fixture();
    await expect(applyBrandAsset(ctx, 'upload', 'agency_share_image', upload, bytes)).rejects.toMatchObject({ status: 403 });
    expect(mocks.save).not.toHaveBeenCalled();
    ctx.role = 'admin'; rows.set('users/u', { agencyId: 'a', role: 'admin', photoUrl: 'original-avatar' }); rows.set('agencies/a', { name: 'Agency', logoUrl: 'original-logo' });
    const result = await applyBrandAsset(ctx, 'upload', 'agency_share_image', upload, bytes);
    expect(result).toMatchObject({ status: 'attached', link: '/custom-domain', destination: 'agency_share_image' });
    expect(rows.get('agencies/a')).toMatchObject({ logoUrl: 'original-logo', shareImageUrl: result.imageUrl });
    expect(rows.get('users/u').photoUrl).toBe('original-avatar');
    expect(rows.has('publicAgentProfiles/u')).toBe(false);
    expect(await applyBrandAsset(ctx, 'upload', 'agency_share_image', upload, bytes)).toEqual(result);
    expect(mocks.save).toHaveBeenCalledTimes(1);
    rows.set('users/u', { agencyId: 'other', role: 'admin' });
    await expect(applyBrandAsset(ctx, 'upload', 'agency_share_image', upload, bytes)).rejects.toMatchObject({ status: 403 });
  });
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
