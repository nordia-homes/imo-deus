import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ token: '', resource: vi.fn(), download: vi.fn(), save: vi.fn(), metadata: vi.fn(), copy: vi.fn(), prepare: vi.fn() }));
vi.mock('../access', () => ({ getResource: mocks.resource, collectionFor: (ctx: any, name: string) => ctx.adminDb.collection('agencies/a/' + name) }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status = 400) { super(message); } } }));
vi.mock('firebase-admin/storage', () => ({ getStorage: () => ({ bucket: () => ({ name: 'bucket', file: () => ({ download: mocks.download, save: mocks.save, copy: mocks.copy, getMetadata: mocks.metadata }) }) }) }));
vi.mock('sharp', () => ({ default: (bytes: Buffer) => { const chain: any = { rotate: () => chain, resize: () => chain, webp: () => chain, toBuffer: async () => bytes }; return chain; } }));
import { initializeLargeUpload, prepareMediaUpload, validateVideoHeader, largeUploadSchema } from '@/lib/crm/media-uploads';
import { readLegacyRunner, updateLegacyRunner } from '@/lib/crm/facebook-runner';
import { pendingAuthProfile, syncAuthProfile, deleteAuthAccount } from '@/lib/crm/profile-auth';
import { assertAutomationFence } from '@/lib/crm/automation-fence';
import type { AssistantContext } from '../access';

function fixture() {
  const rows = new Map<string, any>([['users/u', { agencyId: 'a', role: 'agent' }]]);
  const reference = (path: string): any => ({ path, id: path.split('/').at(-1), doc: (id: string) => reference(path + '/' + id), get: async () => ({ ref: reference(path), exists: rows.has(path), data: () => rows.get(path) }), update: async (patch: any) => rows.set(path, { ...rows.get(path), ...patch }) });
  const db = { collection: reference, runTransaction: async (work: any) => {
    const writes: (() => void)[] = [];
    const result = await work({ get: (ref: any) => { if (writes.length) throw new Error('Read after write'); return ref.get(); }, set: (ref: any, patch: any) => writes.push(() => rows.set(ref.path, { ...rows.get(ref.path), ...patch })), update: (ref: any, patch: any) => writes.push(() => { for (const value of Object.values(patch) as any[]) if (value?.downloadToken) mocks.token = value.downloadToken; rows.set(ref.path, { ...rows.get(ref.path), ...patch }); }), create: (ref: any, data: any) => writes.push(() => rows.set(ref.path, data)) });
    writes.forEach(write => write()); return result;
  } };
  return { rows, ctx: { uid: 'u', agencyId: 'a', role: 'agent', adminAuth: { app: {} }, adminDb: db } as unknown as AssistantContext };
}
beforeEach(() => { vi.clearAllMocks(); mocks.token = ''; mocks.metadata.mockImplementation(async () => [{ size: '8', metadata: { firebaseStorageDownloadTokens: mocks.token } }]); mocks.download.mockResolvedValue([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])]); });
describe('controlled media uploads', () => {
  it('reserves a private exact-path video session without saving a property', async () => {
    const { ctx, rows } = fixture(); const result = await initializeLargeUpload(ctx, { name: 'video.mp4', mimeType: 'video/mp4', size: 100 });
    expect(result.storagePath).toBe(`agencies/a/privateCommunications/assistant-uploads/u/${result.uploadId}`);
    expect(rows.get('agencies/a/assistantUploads/' + result.uploadId)).toMatchObject({ ownerId: 'u', actorRole: 'agent', status: 'uploading', size: 100 });
    expect([...rows.keys()].some(key => key.includes('/properties/'))).toBe(false);
  });
  it('denies revoked membership and daily quota exhaustion before issuing another session', async () => {
    const { ctx, rows } = fixture(); rows.set('users/u', { agencyId: 'b', role: 'agent' });
    await expect(initializeLargeUpload(ctx, { name: 'v.mp4', mimeType: 'video/mp4', size: 10 })).rejects.toMatchObject({ status: 403 });
    rows.set('users/u', { agencyId: 'a', role: 'agent' }); rows.set(`agencies/a/assistantUploadBudgets/u-${new Date().toISOString().slice(0, 10)}`, { count: 20 });
    await expect(initializeLargeUpload(ctx, { name: 'v.mp4', mimeType: 'video/mp4', size: 10 })).rejects.toMatchObject({ status: 429 });
    expect([...rows.keys()].filter(key => key.includes('/assistantUploads/'))).toHaveLength(0);
  });
  it('rejects MIME spoofing, zero bytes and oversized declarations', () => {
    expect(() => validateVideoHeader(Buffer.from('plain text fake video'), 'video/mp4')).toThrow();
    expect(() => validateVideoHeader(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), 'video/webm')).not.toThrow();
    expect(() => validateVideoHeader(Buffer.from('0000ftyp0000'), 'video/mp4')).not.toThrow();
    expect(largeUploadSchema.safeParse({ name: 'v', mimeType: 'video/mp4', size: 0 }).success).toBe(false);
    expect(largeUploadSchema.safeParse({ name: 'v', mimeType: 'video/mp4', size: 501 * 1024 * 1024 }).success).toBe(false);
  });
  it('refuses unvalidated video, another actor upload, and agent Meta media without copying bytes', async () => {
    const { ctx, rows } = fixture(); const ref = 'agencies/a/assistantUploads/upload';
    const upload = { ownerId: 'u', storagePath: 'agencies/a/privateCommunications/assistant-uploads/u/upload', expiresAt: Date.now() + 60000, size: 8, mimeType: 'video/mp4', status: 'uploading' };
    rows.set(ref, upload);
    await expect(prepareMediaUpload(ctx, 'upload', { purpose: 'property_media', targetId: 'p', createTarget: false })).rejects.toMatchObject({ status: 415 });
    rows.set(ref, { ...upload, ownerId: 'other' });
    await expect(prepareMediaUpload(ctx, 'upload', { purpose: 'property_media', targetId: 'p', createTarget: false })).rejects.toMatchObject({ status: 404 });
    rows.set(ref, { ...upload, mimeType: 'image/png' });
    await expect(prepareMediaUpload(ctx, 'upload', { purpose: 'meta_media', targetId: 'campaign', createTarget: false })).rejects.toMatchObject({ status: 403 });
    expect(mocks.copy).not.toHaveBeenCalled(); expect(mocks.save).not.toHaveBeenCalled();
  });
  it('prepares recoded images without committing the form and returns the stored size/token', async () => {
    mocks.metadata.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 404 }));
    const { ctx, rows } = fixture(); rows.set('agencies/a/assistantUploads/upload', { ownerId: 'u', storagePath: 'agencies/a/privateCommunications/assistant-uploads/u/upload', expiresAt: Date.now() + 60000, size: 100, mimeType: 'image/png', name: 'photo.png' });
    const result = await prepareMediaUpload(ctx, 'upload', { purpose: 'property_media', targetId: 'new-property', createTarget: true });
    expect(result).toMatchObject({ status: 'prepared', sizeBytes: 8, mimeType: 'image/webp', targetId: 'new-property' });
    expect(result.url).toContain('token=' + mocks.token); expect(rows.has('agencies/a/properties/new-property')).toBe(false); expect(mocks.resource).not.toHaveBeenCalled();
    expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(Object.values(rows.get('agencies/a/assistantUploads/upload')).some((v: any) => v?.kind === 'prepared_media')).toBe(true);
  });
});
describe('legacy Facebook manual evidence', () => {
  const job = { createdBy: 'u', propertyId: 'p', status: 'pending', groups: [{ name: 'Group', url: 'https://facebook.com/groups/1', status: 'pending' }] };
  it('denies other owners and cannot fabricate posted from an assistant operation', async () => {
    const { ctx, rows } = fixture(); rows.set('agencies/a/facebookPromotionJobs/j', { ...job, createdBy: 'other' });
    await expect(readLegacyRunner(ctx, 'j')).rejects.toMatchObject({ status: 404 });
    rows.set('agencies/a/facebookPromotionJobs/j', job);
    await expect(updateLegacyRunner(ctx, 'j', { groupIndex: 0, expectedStatus: 'pending', status: 'posted' }, 'assistant_skip')).rejects.toMatchObject({ status: 400 });
    expect(rows.get('agencies/a/facebookPromotionJobs/j').status).toBe('pending');
  });
  it('marks explicit human evidence, preserves terminal states, and treats replay as idempotent', async () => {
    const { ctx, rows } = fixture(); rows.set('agencies/a/facebookPromotionJobs/j', job);
    const result = await updateLegacyRunner(ctx, 'j', { groupIndex: 0, expectedStatus: 'pending', status: 'posted' }, 'human_callback');
    expect(result.status).toBe('completed'); expect(result.evidence).toContain('not_provider_receipt');
    await expect(updateLegacyRunner(ctx, 'j', { groupIndex: 0, expectedStatus: 'pending', status: 'opened' }, 'human_callback')).rejects.toMatchObject({ status: 409 });
    await updateLegacyRunner(ctx, 'j', { groupIndex: 0, expectedStatus: 'pending', status: 'posted' }, 'human_callback');
    expect([...rows.keys()].filter(key => key.includes('/crmEvents/'))).toHaveLength(1);
  });
});
describe('cross-system profile recovery and automation fencing', () => {
  it('recovers Auth deletion and never deletes a restored CRM account or another agency job', async () => {
    const { ctx, rows } = fixture(); const remove = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    (ctx.adminAuth as any).deleteUser = remove;
    rows.set('authAccountDeletions/deleted', { agencyId: 'a', status: 'pending' });
    expect(await deleteAuthAccount(ctx, 'deleted')).toBe('pending');
    expect(await deleteAuthAccount(ctx, 'deleted')).toBe('completed');
    expect(await deleteAuthAccount(ctx, 'deleted')).toBe('completed');
    expect(remove).toHaveBeenCalledTimes(2);
    rows.set('authAccountDeletions/restored', { agencyId: 'a', status: 'pending' }); rows.set('users/restored', { agencyId: 'a', role: 'agent' });
    rows.set('authAccountDeletions/foreign', { agencyId: 'b', status: 'pending' });
    await deleteAuthAccount(ctx, 'restored'); await deleteAuthAccount(ctx, 'foreign');
    expect(remove).toHaveBeenCalledTimes(2);
  });
  it('keeps failed Auth sync pending and retries the current CRM profile', async () => {
    const { ctx, rows } = fixture(); const revision = '2026-10-06T10:00:00Z';
    rows.set('users/u', { agencyId: 'a', role: 'agent', name: 'New name' });
    rows.set('authProfileSync/u', pendingAuthProfile(ctx, 'u', revision));
    const update = vi.fn().mockRejectedValueOnce(new Error('Provider unavailable')).mockResolvedValue({});
    (ctx.adminAuth as any).updateUser = update;
    expect(await syncAuthProfile(ctx, 'u')).toBe('pending');
    expect(rows.get('authProfileSync/u')).toMatchObject({ status: 'pending', errorCategory: 'auth_profile_update_failed' });
    expect(await syncAuthProfile(ctx, 'u')).toBe('completed');
    expect(update).toHaveBeenLastCalledWith('u', { displayName: 'New name' });
  });
  it('serializes a new profile edit behind an active Auth sync and leaves it for retry', async () => {
    const { ctx, rows } = fixture(); rows.set('users/u', { agencyId: 'a', role: 'agent', name: 'First' });
    rows.set('authProfileSync/u', pendingAuthProfile(ctx, 'u', '2026-10-06T10:00:00Z'));
    const update = vi.fn(async () => {
      rows.set('users/u', { agencyId: 'a', role: 'agent', name: 'Second' });
      rows.set('authProfileSync/u', pendingAuthProfile(ctx, 'u', '2026-10-06T11:00:00Z', rows.get('authProfileSync/u')));
      expect(rows.get('authProfileSync/u').status).toBe('running');
      await syncAuthProfile(ctx, 'u');
    });
    (ctx.adminAuth as any).updateUser = update;
    await syncAuthProfile(ctx, 'u');
    expect(update).toHaveBeenCalledTimes(1);
    expect(rows.get('authProfileSync/u')).toMatchObject({ status: 'pending', revision: '2026-10-06T11:00:00Z' });
    update.mockResolvedValueOnce(undefined); await syncAuthProfile(ctx, 'u');
    expect(update).toHaveBeenLastCalledWith('u', { displayName: 'Second' });
  });
  it('rejects paused, stale, expired and revoked automation claims transactionally', async () => {
    const { ctx, rows } = fixture(); ctx.automationFence = { jobId: 'job', claimId: 'active' };
    const job = { actorId: 'u', agencyId: 'a', actorRole: 'agent', status: 'running', claimId: 'active', leaseUntil: Date.now() + 60000 };
    const assert = () => ctx.adminDb.runTransaction(tx => assertAutomationFence(ctx.adminDb, tx, ctx));
    for (const patch of [{ status: 'paused' }, { claimId: 'replacement' }, { leaseUntil: 0 }, { agencyId: 'other' }]) {
      rows.set('assistantAutomationJobs/job', { ...job, ...patch }); await expect(assert()).rejects.toMatchObject({ status: 409 });
    }
    rows.set('assistantAutomationJobs/job', job); await expect(assert()).resolves.toBeUndefined();
    rows.set('users/u', { agencyId: 'a', role: 'admin' }); await expect(assert()).rejects.toMatchObject({ status: 409 });
  });
});
