import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStorage } from 'firebase-admin/storage';
import { assistantContext, collectionFor } from '@/lib/ai-assistant/access';
import { assistantError } from '@/lib/ai-assistant/http-error';
import { CommunicationError } from '@/lib/communications/server';
import { importContractDocx } from '@/lib/crm/docx-import';

export const runtime = 'nodejs';
export async function GET(request: Request, route: { params: Promise<{ uploadId: string }> }) {
  try {
    const ctx = await assistantContext(request);
    if (ctx.role !== 'admin') throw new CommunicationError('Administrarea șabloanelor necesită administratorul.', 403);
    const uploadId = z.string().uuid().parse((await route.params).uploadId);
    const upload = (await collectionFor(ctx, 'assistantUploads').doc(uploadId).get()).data();
    const path = `agencies/${ctx.agencyId}/privateCommunications/assistant-uploads/${ctx.uid}/${uploadId}`;
    if (!upload || upload.ownerId !== ctx.uid || upload.storagePath !== path || upload.expiresAt <= Date.now()) throw new CommunicationError('Documentul nu este accesibil sau a expirat.', 404);
    if (upload.mimeType !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') throw new CommunicationError('Selectează documentul DOCX.', 415);
    const [bytes] = await getStorage(ctx.adminAuth.app).bucket().file(path).download();
    if (bytes.length > 15 * 1024 * 1024) throw new CommunicationError('Documentul depășește limita de 15 MB.', 413);
    return NextResponse.json(await importContractDocx(bytes), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return assistantError(error); }
}
