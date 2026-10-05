import { createHash, randomUUID } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';
import { collectionFor, type AssistantContext } from '@/lib/ai-assistant/access';
import { CommunicationError } from '@/lib/communications/server';
import { validateUploadBytes } from '@/lib/ai-assistant/upload-validation';

export async function applyBrandAsset(ctx: AssistantContext, uploadId: string, destination: 'profile_photo' | 'agency_logo', upload: Record<string, any>, bytes: Buffer) {
  const memberRef = ctx.adminDb.collection('users').doc(ctx.uid);
  const assertMembership = (member: Record<string, any> | undefined) => {
    if (member?.agencyId !== ctx.agencyId || member?.role !== ctx.role) throw new CommunicationError('Acces revocat.', 403);
    if (destination === 'agency_logo' && ctx.role !== 'admin') throw new CommunicationError('Modificarea siglei necesită administratorul.', 403);
  };
  assertMembership((await memberRef.get()).data());
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(upload.mimeType)) throw new CommunicationError('Selectează o imagine PNG, JPEG sau WebP.', 415);
  validateUploadBytes(bytes, upload.mimeType);
  const key = 'asset-' + createHash('sha256').update(JSON.stringify([ctx.uid, uploadId, destination])).digest('hex');
  const ledger = collectionFor(ctx, 'assistantExecutions').doc(key);
  const prior = await ledger.get();
  if (prior.exists) return prior.data()?.result;
  const encoded = await sharp(bytes, { limitInputPixels: 40000000 }).rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
  const path = `agencies/${ctx.agencyId}/branding/${ctx.uid}/${destination}/${key}.webp`;
  await collectionFor(ctx, 'assistantUploads').doc(uploadId).update({ [`assetTargets.${key}`]: { storagePath: path, executionKey: key } });
  const bucket = getStorage(ctx.adminAuth.app).bucket(), file = bucket.file(path);
  let token: string = randomUUID();
  try {
    await file.save(encoded, { contentType: 'image/webp', resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { metadata: { firebaseStorageDownloadTokens: token } } });
  } catch (error) {
    if (Number((error as { code?: number }).code) !== 412) throw error;
    const [metadata] = await file.getMetadata();
    const existing = metadata.metadata?.firebaseStorageDownloadTokens;
    if (typeof existing !== 'string' || !existing) throw new CommunicationError('Fișierul existent nu are un link valid.', 409);
    token = existing;
  }
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  return ctx.adminDb.runTransaction(async tx => {
    const agencyRef = ctx.adminDb.collection('agencies').doc(ctx.agencyId);
    const [member, previous, agency] = await Promise.all([tx.get(memberRef), tx.get(ledger), destination === 'agency_logo' ? tx.get(agencyRef) : Promise.resolve(null)]);
    assertMembership(member.data());
    if (agency && !agency.exists) throw new CommunicationError('Agenția nu mai există.', 404);
    if (previous.exists) return previous.data()?.result;
    const now = new Date().toISOString();
    if (destination === 'agency_logo') tx.update(agencyRef, { logoUrl: url, updatedAt: now });
    else {
      tx.update(memberRef, { photoUrl: url, updatedAt: now });
      tx.set(ctx.adminDb.collection('publicAgentProfiles').doc(ctx.uid), { agencyId: ctx.agencyId, name: member.data()?.name || '', email: member.data()?.email || '', phone: member.data()?.phone || '', photoUrl: url, updatedAt: now }, { merge: true });
    }
    const result = { uploadId, destination, status: 'attached', imageUrl: url, link: '/settings', note: destination === 'agency_logo' ? 'Sigla agenției a fost actualizată.' : 'Fotografia profilului CRM a fost actualizată.' };
    tx.create(ledger, { actorId: ctx.uid, operation: destination, status: 'completed', result, completedAt: now });
    tx.create(collectionFor(ctx, 'crmEvents').doc(key), { id: key, actorId: ctx.uid, agencyId: ctx.agencyId, source: 'file_apply', capability: destination, occurredAt: now, recordedAt: now, entities: destination === 'profile_photo' ? { userId: ctx.uid } : { agencyId: ctx.agencyId }, result: { uploadId, status: 'attached' } });
    return result;
  });
}
