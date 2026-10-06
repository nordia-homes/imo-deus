import { randomUUID, createHash } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import type { File as StorageFile } from '@google-cloud/storage';
import { z } from 'zod';
import sharp from 'sharp';
import { mkdtemp, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpeg from 'ffmpeg-static';
import { collectionFor, getResource, type AssistantContext } from '@/lib/ai-assistant/access';
import { CommunicationError } from '@/lib/communications/server';
import { validateUploadBytes } from '@/lib/ai-assistant/upload-validation';

export const largeUploadSchema = z.object({ name: z.string().min(1).max(120), mimeType: z.enum(['video/mp4', 'video/webm', 'video/quicktime']), size: z.number().int().min(1).max(500 * 1024 * 1024) }).strict();
export const mediaPreparationSchema = z.object({ purpose: z.enum(['property_media', 'meta_media', 'tiktok_media', 'video_tour']), targetId: z.string().min(1).max(180).regex(/^[^/]+$/).optional(), createTarget: z.boolean().default(false) }).strict();
const prefix = (ctx: AssistantContext) => `agencies/${ctx.agencyId}/privateCommunications/assistant-uploads/${ctx.uid}/`;
async function currentMember(ctx: AssistantContext) {
  const member = (await ctx.adminDb.collection('users').doc(ctx.uid).get()).data();
  if (member?.agencyId !== ctx.agencyId || member?.role !== ctx.role || !['agent', 'admin'].includes(ctx.role || '')) throw new CommunicationError('Acces revocat.', 403);
}
export async function initializeLargeUpload(ctx: AssistantContext, input: z.infer<typeof largeUploadSchema>) {
  const id = randomUUID(), now = Date.now(), ref = collectionFor(ctx, 'assistantUploads').doc(id);
  const budget = collectionFor(ctx, 'assistantUploadBudgets').doc(`${ctx.uid}-${new Date(now).toISOString().slice(0, 10)}`);
  await ctx.adminDb.runTransaction(async tx => {
    const [member, usage] = await Promise.all([tx.get(ctx.adminDb.collection('users').doc(ctx.uid)), tx.get(budget)]);
    if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role || !['agent', 'admin'].includes(ctx.role || '')) throw new CommunicationError('Acces revocat.', 403);
    const bytes = Number(usage.data()?.bytes || 0), count = Number(usage.data()?.count || 0);
    if (bytes + input.size > 2 * 1024 ** 3 || count >= 20) throw new CommunicationError('Limita zilnică de upload video este 2 GB și 20 de fișiere.', 429);
    tx.set(budget, { ownerId: ctx.uid, bytes: bytes + input.size, count: count + 1, updatedAt: new Date(now).toISOString() });
    tx.create(ref, { id, ownerId: ctx.uid, actorRole: ctx.role, name: input.name.replace(/[^\p{L}\p{N}._ -]/gu, '_'), mimeType: input.mimeType, size: input.size, storagePath: prefix(ctx) + id, status: 'uploading', createdAt: new Date(now).toISOString(), expiresAt: now + 3600000 });
  });
  return { uploadId: id, storagePath: prefix(ctx) + id, expiresAt: now + 3600000, status: 'uploading', maxSize: 500 * 1024 * 1024 };
}
export function validateVideoHeader(bytes: Buffer, mime: string) {
  const valid = ['video/mp4', 'video/quicktime'].includes(mime) ? bytes.length >= 12 && (mime === 'video/mp4' ? bytes.toString('ascii', 4, 8) === 'ftyp' : ['ftyp', 'moov', 'mdat', 'wide', 'free'].includes(bytes.toString('ascii', 4, 8))) : mime === 'video/webm' && bytes.length >= 4 && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (!valid) throw new CommunicationError('Conținutul fișierului nu corespunde formatului video.', 415);
}
async function verifyVideo(file: StorageFile) {
  if (!ffmpeg) throw new CommunicationError('Validarea video nu este disponibilă pe server.', 503);
  const directory = await mkdtemp(path.join(tmpdir(), 'jarvis-media-'));
  try {
    const target = path.join(directory, 'video');
    await pipeline(file.createReadStream(), createWriteStream(target, { flags: 'wx' }));
    await promisify(execFile)(ffmpeg, ['-nostdin', '-v', 'error', '-protocol_whitelist', 'file,pipe', '-i', target, '-map', '0:v:0', '-frames:v', '1', '-f', 'null', '-'], { timeout: 45000, maxBuffer: 65536, windowsHide: true });
  } catch { throw new CommunicationError('Videoclipul nu a trecut validarea serverului. Verifică fișierul MP4/WebM/MOV.', 415); }
  finally {
    const resolved = path.resolve(directory), root = path.resolve(tmpdir()) + path.sep;
    if (resolved.startsWith(root) && path.basename(resolved).startsWith('jarvis-media-')) await rm(resolved, { recursive: true, force: true });
  }
}
export async function finalizeLargeUpload(ctx: AssistantContext, uploadId: string) {
  await currentMember(ctx);
  const ref = collectionFor(ctx, 'assistantUploads').doc(uploadId), upload = (await ref.get()).data();
  if (!upload || upload.ownerId !== ctx.uid || upload.storagePath !== prefix(ctx) + uploadId || upload.expiresAt <= Date.now()) throw new CommunicationError('Upload inaccesibil sau expirat.', 404);
  if (upload.status === 'uploaded') return { uploadId, name: upload.name, mimeType: upload.mimeType, size: upload.size, status: 'uploaded' };
  if (upload.status !== 'uploading') throw new CommunicationError('Uploadul nu poate fi finalizat.', 409);
  const bucket = getStorage(ctx.adminAuth.app).bucket(), current = bucket.file(upload.storagePath), [metadata] = await current.getMetadata();
  const file = bucket.file(upload.storagePath, { generation: metadata.generation });
  if (Number(metadata.size) !== upload.size || metadata.contentType !== upload.mimeType || upload.size > 500 * 1024 * 1024) throw new CommunicationError('Dimensiunea sau formatul uploadului nu corespunde.', 415);
  const [header] = await file.download({ start: 0, end: 63 }); validateVideoHeader(header, upload.mimeType);
  await verifyVideo(file);
  await ctx.adminDb.runTransaction(async tx => {
    const [member, fresh] = await Promise.all([tx.get(ctx.adminDb.collection('users').doc(ctx.uid)), tx.get(ref)]);
    if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role || fresh.data()?.ownerId !== ctx.uid || fresh.data()?.expiresAt <= Date.now()) throw new CommunicationError('Acces revocat sau upload expirat.', 403);
    if (!['uploading', 'uploaded'].includes(fresh.data()?.status)) throw new CommunicationError('Upload modificat.', 409);
    tx.update(ref, { status: 'uploaded', generation: String(metadata.generation), validation: 'ffmpeg_first_frame', validatedAt: new Date().toISOString(), expiresAt: Date.now() + 7 * 86400000 });
  });
  return { uploadId, name: upload.name, mimeType: upload.mimeType, size: upload.size, status: 'uploaded' };
}
export async function prepareMediaUpload(ctx: AssistantContext, uploadId: string, input: z.infer<typeof mediaPreparationSchema>) {
  await currentMember(ctx);
  const ref = collectionFor(ctx, 'assistantUploads').doc(uploadId), upload = (await ref.get()).data();
  if (!upload || upload.ownerId !== ctx.uid || upload.storagePath !== prefix(ctx) + uploadId || upload.expiresAt <= Date.now()) throw new CommunicationError('Fișier inaccesibil sau expirat.', 404);
  const image = ['image/png', 'image/jpeg', 'image/webp'].includes(upload.mimeType), video = ['video/mp4', 'video/webm', 'video/quicktime'].includes(upload.mimeType);
  if (!image && !video || video && (upload.status !== 'uploaded' || upload.validation !== 'ffmpeg_first_frame' || !upload.generation)) throw new CommunicationError('Selectează o imagine sau un videoclip validat.', 415);
  let targetId = input.targetId;
  if (input.purpose === 'meta_media') {
    if (ctx.role !== 'admin' || !targetId) throw new CommunicationError('Materialele Meta necesită administrator și campanie.', 403);
    await getResource(ctx, 'metaCampaignDrafts', targetId);
  } else if (input.createTarget) {
    if (input.purpose !== 'property_media') throw new CommunicationError('Numai crearea proprietății poate pregăti un target nou.', 400);
    targetId ||= 'uploaded-property-' + uploadId;
  } else if (targetId) await getResource(ctx, 'properties', targetId);
  else if (input.purpose !== 'tiktok_media') throw new CommunicationError('Selectează proprietatea.', 400);
  const key = 'asset-' + createHash('sha256').update(JSON.stringify([ctx.uid, uploadId, input.purpose, targetId || null])).digest('hex');
  const bucket = getStorage(ctx.adminAuth.app).bucket(), source = bucket.file(upload.storagePath, video ? { generation: upload.generation } : {});
  const storagePath = `agencies/${ctx.agencyId}/preparedMedia/${ctx.uid}/${key}.${image ? 'webp' : upload.mimeType === 'video/mp4' ? 'mp4' : upload.mimeType === 'video/quicktime' ? 'mov' : 'webm'}`;
  const file = bucket.file(storagePath);
  const token = await ctx.adminDb.runTransaction(async tx => {
    const [member, fresh] = await Promise.all([tx.get(ctx.adminDb.collection('users').doc(ctx.uid)), tx.get(ref)]);
    if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role || fresh.data()?.ownerId !== ctx.uid || fresh.data()?.expiresAt <= Date.now()) throw new CommunicationError('Acces revocat sau upload expirat.', 403);
    const prior = fresh.data()?.assetTargets?.[key];
    const token = typeof prior?.downloadToken === 'string' ? prior.downloadToken : randomUUID();
    tx.update(ref, { [`assetTargets.${key}`]: { ...prior, storagePath, executionKey: key, kind: 'prepared_media', purpose: input.purpose, targetId: targetId || null, downloadToken: token } });
    return token;
  });
  let exists = false;
  try { await file.getMetadata(); exists = true; } catch (error) { if (Number((error as { code?: number }).code) !== 404) throw error; }
  if (!exists) try {
    if (image) {
      if (upload.size > 15 * 1024 * 1024) throw new CommunicationError('Imaginea depășește 15 MB.', 413);
      const [bytes] = await source.download(); validateUploadBytes(bytes, upload.mimeType);
      const encoded = await sharp(bytes, { limitInputPixels: 40000000 }).rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
      await file.save(encoded, { contentType: 'image/webp', resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { metadata: { firebaseStorageDownloadTokens: token } } });
    } else await source.copy(file, { preconditionOpts: { ifGenerationMatch: 0 }, metadata: { firebaseStorageDownloadTokens: token } });
  } catch (error) { if (Number((error as { code?: number }).code) !== 412) throw error; }
  const [metadata] = await file.getMetadata();
  if (metadata.metadata?.firebaseStorageDownloadTokens !== token) throw new CommunicationError('Materialul pregătit necesită verificare; tokenul nu corespunde rezervării.', 409);
  await currentMember(ctx);
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
  await ref.update({ [`assetTargets.${key}.url`]: url });
  return { uploadId, targetId: targetId || null, purpose: input.purpose, name: upload.name, type: image ? 'image' : 'video', mimeType: image ? 'image/webp' : upload.mimeType, sizeBytes: Number(metadata.size), storagePath, url, status: 'prepared', note: 'Material pregătit. Salvarea în proprietate/campanie/bibliotecă este un pas separat.' };
}
