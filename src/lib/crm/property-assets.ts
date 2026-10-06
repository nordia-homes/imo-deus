import { createHash, randomUUID } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';
import { collectionFor, getResource, type AssistantContext } from '@/lib/ai-assistant/access';
import { CommunicationError } from '@/lib/communications/server';
import { validateUploadBytes } from '@/lib/ai-assistant/upload-validation';

export async function applyPropertyAsset(ctx: AssistantContext, uploadId: string, propertyId: string, destination: 'property_image' | 'property_rlv', upload: Record<string, any>, bytes: Buffer, expectedUpdatedAt?: string | null) {
  const displayed = await getResource(ctx, 'properties', propertyId);
  const membership = await ctx.adminDb.collection('users').doc(ctx.uid).get();
  if (membership.data()?.agencyId !== ctx.agencyId || membership.data()?.role !== ctx.role) throw new CommunicationError('Acces revocat.', 403);
  const image = ['image/png', 'image/jpeg', 'image/webp'].includes(upload.mimeType);
  if (!image && !(destination === 'property_rlv' && upload.mimeType === 'application/pdf')) throw new CommunicationError('Formatul nu este potrivit pentru această destinație.', 415);
  validateUploadBytes(bytes, upload.mimeType);
  const key = 'asset-' + createHash('sha256').update(JSON.stringify([ctx.uid, uploadId, propertyId, destination])).digest('hex');
  const ledger = collectionFor(ctx, 'assistantExecutions').doc(key);
  const prior = await ledger.get();
  if (prior.exists) return prior.data()?.result;
  const revision = expectedUpdatedAt === undefined ? displayed?.updatedAt || null : expectedUpdatedAt;
  if (destination === 'property_rlv' && (displayed?.updatedAt || null) !== revision) throw new CommunicationError('Proprietatea s-a modificat. Reîncarcă înainte de înlocuirea releveului.', 409);
  const encoded = image ? await sharp(bytes, { limitInputPixels: 40000000 }).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toBuffer() : bytes;
  const mime = image ? 'image/webp' : 'application/pdf';
  const bucket = getStorage(ctx.adminAuth.app).bucket(), path = `agencies/${ctx.agencyId}/properties/${propertyId}/${destination}/${key}.${image ? 'webp' : 'pdf'}`;
  // Retention removes uncommitted assets after staging expires; committed assets
  // remain linked to their domain record. This also covers revoked/failed writes.
  await collectionFor(ctx, 'assistantUploads').doc(uploadId).update({ [`assetTargets.${key}`]: { storagePath: path, executionKey: key } });
  const file = bucket.file(path);
  let downloadToken: string = randomUUID();
  try {
    await file.save(encoded, { contentType: mime, resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { metadata: { firebaseStorageDownloadTokens: downloadToken } } });
  } catch (error) {
    // A concurrent retry must reuse the original token instead of invalidating its URL.
    if (Number((error as { code?: number }).code) !== 412) throw error;
    const [metadata] = await file.getMetadata();
    const token = metadata.metadata?.firebaseStorageDownloadTokens;
    if (typeof token !== 'string' || !token) throw new CommunicationError('Fișierul existent nu are un link valid.', 409);
    downloadToken = token;
  }
  const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${downloadToken}`;
  return ctx.adminDb.runTransaction(async tx => {
    const propertyRef = collectionFor(ctx, 'properties').doc(propertyId);
    const [member, property, previous] = await Promise.all([tx.get(ctx.adminDb.collection('users').doc(ctx.uid)), tx.get(propertyRef), tx.get(ledger)]);
    if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new CommunicationError('Acces revocat.', 403);
    if (!property.exists) throw new CommunicationError('Proprietatea nu mai există.', 404);
    if (previous.exists) return previous.data()?.result;
    if (destination === 'property_rlv' && (property.data()?.updatedAt || null) !== revision) throw new CommunicationError('Proprietatea s-a modificat. Reîncarcă înainte de înlocuirea releveului.', 409);
    const before = property.data()?.updatedAt || null;
    const clock = new Date().toISOString();
    const now = clock === before ? new Date(Date.parse(clock) + 1).toISOString() : clock;
    const images = Array.isArray(property.data()?.images) ? property.data()!.images : [];
    if (destination === 'property_image' && images.length >= 40) throw new CommunicationError('Proprietatea are deja 40 de imagini.');
    tx.update(propertyRef, destination === 'property_image' ? { images: [...images, { url, alt: upload.name }], updatedAt: now } : { rlvUrl: url, rlvFileType: mime, updatedAt: now });
    const result = { propertyId, uploadId, status: 'attached', mutationRevision: { resource: 'properties', id: propertyId, before, after: now }, imageUrl: image ? url : null, link: `/properties/${propertyId}`, note: destination === 'property_image' ? 'Imagine salvată în galeria proprietății.' : 'Releveu salvat pe proprietate.' };
    tx.create(ledger, { actorId: ctx.uid, operation: destination, status: 'completed', result, completedAt: now });
    tx.create(collectionFor(ctx, 'crmEvents').doc(key), { id: key, actorId: ctx.uid, agencyId: ctx.agencyId, source: 'file_apply', capability: destination, occurredAt: now, recordedAt: now, entities: { propertyId }, result: { propertyId, uploadId, status: 'attached' } });
    return result;
  });
}
