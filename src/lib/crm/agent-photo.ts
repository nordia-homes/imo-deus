import { createHash, randomUUID } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';
import { collectionFor, type AssistantContext } from '@/lib/ai-assistant/access';
import { CommunicationError } from '@/lib/communications/server';
import { validateUploadBytes } from '@/lib/ai-assistant/upload-validation';

// Prepares the image only. The agent-edit transaction applies it after the
// human saves the dialog (or the approved Jarvis operation executes).
export async function prepareAgentPhoto(ctx: AssistantContext, uploadId: string, agentId: string) {
  const [member, target, source] = await Promise.all([
    ctx.adminDb.collection('users').doc(ctx.uid).get(),
    ctx.adminDb.collection('users').doc(agentId).get(),
    collectionFor(ctx, 'assistantUploads').doc(uploadId).get(),
  ]);
  if (ctx.role !== 'admin' || member.data()?.role !== 'admin' || member.data()?.agencyId !== ctx.agencyId) throw new CommunicationError('Modificarea fotografiei agentului necesită administratorul curent.', 403);
  if (!target.exists || target.data()?.agencyId !== ctx.agencyId || target.data()?.role !== 'agent') throw new CommunicationError('Poți modifica doar agenții din agenția ta.', 403);
  const upload = source.data(), prefix = `agencies/${ctx.agencyId}/privateCommunications/assistant-uploads/${ctx.uid}/`;
  if (!upload || upload.ownerId !== ctx.uid || upload.expiresAt <= Date.now() || upload.storagePath !== prefix + uploadId) throw new CommunicationError('Imaginea privată nu este accesibilă sau a expirat.', 404);
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(upload.mimeType)) throw new CommunicationError('Selectează o imagine PNG, JPEG sau WebP.', 415);
  const key = 'asset-' + createHash('sha256').update(JSON.stringify([ctx.uid, uploadId, 'agent_photo', agentId])).digest('hex');
  const ledger = collectionFor(ctx, 'assistantExecutions').doc(key), previous = await ledger.get();
  if (previous.exists) {
    const receipt = previous.data();
    if (receipt?.status !== 'completed' || receipt.actorId !== ctx.uid || receipt.result?.agentId !== agentId || typeof receipt.result?.imageUrl !== 'string') throw new CommunicationError('Aplicarea anterioară a imaginii trebuie verificată înainte de repetare.', 409);
    return { key, ledger, imageUrl: receipt.result.imageUrl, uploadId, agentId };
  }
  const bucket = getStorage(ctx.adminAuth.app).bucket(), [bytes] = await bucket.file(upload.storagePath).download();
  if (bytes.length > 15 * 1024 * 1024) throw new CommunicationError('Imaginea depășește limita de 15 MB.', 413);
  validateUploadBytes(bytes, upload.mimeType);
  const encoded = await sharp(bytes, { limitInputPixels: 40000000 }).rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
  // profile_photo is an existing retention-supported image class; the key also
  // binds the target agent, so one upload cannot alias two different profiles.
  const path = `agencies/${ctx.agencyId}/branding/${ctx.uid}/profile_photo/${key}.webp`;
  await source.ref.update({ [`assetTargets.${key}`]: { storagePath: path, executionKey: key } });
  const file = bucket.file(path); let token: string = randomUUID();
  try { await file.save(encoded, { contentType: 'image/webp', resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { metadata: { firebaseStorageDownloadTokens: token } } }); }
  catch (error) {
    if (Number((error as { code?: number }).code) !== 412) throw error;
    const [metadata] = await file.getMetadata();
    const existing = metadata.metadata?.firebaseStorageDownloadTokens;
    if (typeof existing !== 'string' || !existing) throw new CommunicationError('Imaginea existentă nu are un link valid.', 409);
    token = existing;
  }
  return { key, ledger, imageUrl: `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`, uploadId, agentId };
}
