import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getStorage } from 'firebase-admin/storage';
import { assistantContext, collectionFor } from '@/lib/ai-assistant/access';
import { CommunicationError } from '@/lib/communications/server';
import { assistantError } from '@/lib/ai-assistant/http-error';
import { boundedUploadRequest, validateUploadBytes } from '@/lib/ai-assistant/upload-validation';

export const runtime = 'nodejs';
const allowed = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/csv']);
export async function POST(request: Request) {
  try {
    const ctx = await assistantContext(request);
    const form = await (await boundedUploadRequest(request)).formData(), file = form.get('file');
    if (!(file instanceof File) || !file.size || file.size > 15 * 1024 * 1024 || !allowed.has(file.type)) throw new CommunicationError('Selectează PDF, DOCX, CSV sau imagine, maximum 15 MB.', 415);
    const id = randomUUID(), name = file.name.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 120);
    const path = `agencies/${ctx.agencyId}/privateCommunications/assistant-uploads/${ctx.uid}/${id}`;
    const bytes = Buffer.from(await file.arrayBuffer()); validateUploadBytes(bytes, file.type);
    const storageFile = getStorage(ctx.adminAuth.app).bucket().file(path);
    await storageFile.save(bytes, { contentType: file.type, resumable: false, metadata: { cacheControl: 'private, no-store' } });
    try { await collectionFor(ctx, 'assistantUploads').doc(id).create({ id, ownerId: ctx.uid, name, mimeType: file.type, size: file.size, storagePath: path, createdAt: new Date().toISOString(), expiresAt: Date.now() + 7 * 86400000 }); }
    catch (error) { await storageFile.delete({ ignoreNotFound: true }); throw error; }
    return NextResponse.json({ uploadId: id, name, size: file.size, mimeType: file.type, status: 'uploaded', note: 'Fișier încărcat privat. Aplicarea la un dosar/conversație și analiza sunt pași separați.' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return assistantError(error); }
}
