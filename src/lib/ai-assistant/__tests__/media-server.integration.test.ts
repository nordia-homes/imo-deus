import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { initializeApp, deleteApp, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import ffmpeg from 'ffmpeg-static';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
import { initializeLargeUpload, finalizeLargeUpload, prepareMediaUpload } from '@/lib/crm/media-uploads';
import { saveBrowserVideo } from '@/lib/crm/browser-video';
import type { AssistantContext } from '../access';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST)('actual video decoding and browser result transactions', () => {
  const id = randomUUID(), revision = '2020-01-01T10:00:00Z', projectId = 'demo-imodeus-ai-assistant';
  let app: App, db: Firestore, ctx: AssistantContext, bytes: Buffer, uploadId: string;
  beforeAll(async () => {
    if (![process.env.FIRESTORE_EMULATOR_HOST, process.env.FIREBASE_STORAGE_EMULATOR_HOST].every(host => /^(127\.0\.0\.1|localhost):\d+$/.test(host || ''))) throw new Error('Local emulators required');
    app = initializeApp({ projectId, storageBucket: projectId + '.appspot.com' }, 'media-test-' + id); db = getFirestore(app);
    ctx = { uid: id, agencyId: id, role: 'agent', adminDb: db, adminAuth: { app } } as unknown as AssistantContext;
    await db.collection('users').doc(id).set({ agencyId: id, role: 'agent' });
    await db.collection('agencies').doc(id).collection('properties').doc('p').set({ title: 'Home', updatedAt: revision });
    const directory = path.resolve('.tmp/media-test-' + id); await mkdir(directory, { recursive: true });
    const target = path.join(directory, 'video.mp4');
    if (!ffmpeg) throw new Error('ffmpeg required');
    await promisify(execFile)(ffmpeg, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=32x32:d=0.3', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', target], { timeout: 20000, windowsHide: true });
    bytes = await readFile(target);
  }, 30000);
  afterAll(async () => {
    if (!db) return;
    await getStorage(app).bucket().deleteFiles({ prefix: `agencies/${id}/` });
    await db.collection('users').doc(id).delete(); await db.recursiveDelete(db.collection('agencies').doc(id)); await deleteApp(app);
  });
  it('validates an actual MP4 on the server, prepares it once and rejects a truncated container', async () => {
    const upload = await initializeLargeUpload(ctx, { name: 'video.mp4', mimeType: 'video/mp4', size: bytes.length }); uploadId = upload.uploadId;
    await getStorage(app).bucket().file(upload.storagePath).save(bytes, { resumable: false, contentType: 'video/mp4' });
    expect(await finalizeLargeUpload(ctx, uploadId)).toMatchObject({ status: 'uploaded' });
    const prepared = await prepareMediaUpload(ctx, uploadId, { purpose: 'video_tour', targetId: 'p', createTarget: false });
    expect(prepared).toMatchObject({ type: 'video', sizeBytes: bytes.length });
    expect((await prepareMediaUpload(ctx, uploadId, { purpose: 'video_tour', targetId: 'p', createTarget: false })).url).toBe(prepared.url);
    const bad = bytes.subarray(0, 32), invalid = await initializeLargeUpload(ctx, { name: 'bad.mp4', mimeType: 'video/mp4', size: bad.length });
    await getStorage(app).bucket().file(invalid.storagePath).save(bad, { resumable: false, contentType: 'video/mp4' });
    await expect(finalizeLargeUpload(ctx, invalid.uploadId)).rejects.toMatchObject({ status: 415 });
    expect((await db.collection('agencies').doc(id).collection('assistantUploads').doc(invalid.uploadId).get()).data()?.status).toBe('uploading');
  }, 30000);
  it('commits one browser render for concurrent starts, then refuses stale/foreign results', async () => {
    const input = { status: 'processing' as const, expectedUpdatedAt: revision, format: 'portrait' as const, style: 'cinematic' as const, imageCount: 2 };
    const runIds = [randomUUID(), randomUUID()];
    const results = await Promise.allSettled(runIds.map(runId => saveBrowserVideo(ctx, 'p', { ...input, runId })));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect((results.find(result => result.status === 'rejected') as PromiseRejectedResult).reason).toMatchObject({ status: 409 });
    const winner = (results.find(result => result.status === 'fulfilled') as PromiseFulfilledResult<any>).value;
    const base = { runId: winner.runId, format: 'portrait' as const, style: 'cinematic' as const, imageCount: 2 };
    await expect(saveBrowserVideo(ctx, 'p', { ...base, runId: randomUUID(), status: 'error' })).rejects.toMatchObject({ status: 409 });
    // A cloud renderer may replace the device run; late browser reports cannot overwrite it.
    const property = db.collection('agencies').doc(id).collection('properties').doc('p');
    await property.update({ videoTour: { engine: 'cloud-renderer', status: 'ready', url: 'cloud-result' } });
    await expect(saveBrowserVideo(ctx, 'p', { ...base, status: 'error' })).rejects.toMatchObject({ status: 409 });
    expect((await property.get()).data()?.videoTour.url).toBe('cloud-result');
  }, 20000);
});
