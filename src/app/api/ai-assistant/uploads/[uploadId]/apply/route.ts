import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getStorage } from 'firebase-admin/storage';
import { assistantContext, collectionFor } from '@/lib/ai-assistant/access';
import { withAssistantPrincipal } from '@/lib/ai-assistant/principal';
import { CommunicationError } from '@/lib/communications/server';
import { assistantError } from '@/lib/ai-assistant/http-error';
import { readBoundedText } from '@/lib/romimo/transport';
import { executeAction } from '@/lib/ai-assistant/actions';

export const runtime = 'nodejs';
const id = z.string().min(1).max(180).regex(/^[^/]+$/);
const schema = z.discriminatedUnion('destination', [
  z.object({ destination: z.literal('profile_photo') }).strict(),
  z.object({ destination: z.literal('agency_logo') }).strict(),
  z.object({ destination: z.literal('sale_document'), saleId: id, documentId: id }).strict(),
  z.object({ destination: z.literal('conversation_attachment'), conversationId: id }).strict(),
  z.object({ destination: z.literal('identity_ocr') }).strict(),
  z.object({ destination: z.literal('property_image'), propertyId: id }).strict(),
  z.object({ destination: z.literal('property_rlv'), propertyId: id }).strict(),
  z.object({ destination: z.literal('contract_template'), name: z.string().trim().min(1).max(300), category: z.enum(['reservation', 'collaboration', 'exclusivity', 'custom']), description: z.string().max(10000).default('') }).strict(),
  z.object({ destination: z.literal('electronic_identity_ocr'), addressProofUploadId: z.string().uuid() }).strict(),
]);
export async function POST(request: NextRequest, route: { params: Promise<{ uploadId: string }> }) {
  try {
    const ctx = await assistantContext(request), uploadId = z.string().uuid().parse((await route.params).uploadId);
    const input = schema.parse(JSON.parse(await readBoundedText(request.body, 8000)));
    const upload = (await collectionFor(ctx, 'assistantUploads').doc(uploadId).get()).data();
    const prefix = `agencies/${ctx.agencyId}/privateCommunications/assistant-uploads/${ctx.uid}/`;
    if (!upload || upload.ownerId !== ctx.uid || upload.expiresAt <= Date.now() || upload.storagePath !== prefix + uploadId) throw new CommunicationError('Fișierul nu este accesibil sau a expirat.', 404);
    const [bytes] = await getStorage(ctx.adminAuth.app).bucket().file(upload.storagePath).download();
    if (bytes.length > 15 * 1024 * 1024) throw new CommunicationError('Fișier prea mare.', 413);
    if (input.destination === 'profile_photo' || input.destination === 'agency_logo') {
      const { applyBrandAsset } = await import('@/lib/crm/brand-assets');
      return NextResponse.json(await applyBrandAsset(ctx, uploadId, input.destination, upload, bytes), { headers: { 'Cache-Control': 'no-store' } });
    }
    if (input.destination === 'contract_template') {
      if (ctx.role !== 'admin') throw new CommunicationError('Administrarea șabloanelor necesită administratorul.', 403);
      if (upload.mimeType !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') throw new CommunicationError('Selectează documentul DOCX.', 415);
      const { validateUploadBytes } = await import('@/lib/ai-assistant/upload-validation'); validateUploadBytes(bytes, upload.mimeType);
      const mammoth = await import('mammoth');
      const document = await mammoth.extractRawText({ buffer: bytes });
      if (!document.value.trim() || document.value.length > 100000) throw new CommunicationError('Documentul trebuie să conțină text și să încapă în limita șablonului.', 413);
      const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
      const content = document.value.split(/\n\s*\n/).filter(value => value.trim()).map(value => `<p>${escape(value).replaceAll('\n', '<br>')}</p>`).join('');
      if (content.length > 120000) throw new CommunicationError('Conținutul depășește limita șablonului.', 413);
      const result = await executeAction(ctx, { kind: 'contract_template_action', action: 'create', data: { name: input.name, category: input.category, description: input.description, content, status: 'draft', sourceFormat: 'docx', fileName: upload.name } }, `docx-${uploadId}`);
      return NextResponse.json({ ...result, note: 'Textul Word a fost importat ca șablon draft. Verifică în editor formatarea și câmpurile înainte de activare.' });
    }
    if (input.destination === 'property_image' || input.destination === 'property_rlv') {
      const { applyPropertyAsset } = await import('@/lib/crm/property-assets');
      return NextResponse.json(await applyPropertyAsset(ctx, uploadId, input.propertyId, input.destination, upload, bytes), { headers: { 'Cache-Control': 'no-store' } });
    }
    const form = new FormData(); form.set('file', new File([new Uint8Array(bytes)], upload.name, { type: upload.mimeType }));
    if (input.destination === 'electronic_identity_ocr') {
      const proof = (await collectionFor(ctx, 'assistantUploads').doc(input.addressProofUploadId).get()).data();
      if (!proof || proof.ownerId !== ctx.uid || proof.expiresAt <= Date.now() || proof.storagePath !== prefix + input.addressProofUploadId) throw new CommunicationError('Dovada adresei nu este accesibilă.', 404);
      const [proofBytes] = await getStorage(ctx.adminAuth.app).bucket().file(proof.storagePath).download();
      if (proofBytes.length > 15 * 1024 * 1024) throw new CommunicationError('Dovada adresei depășește limita.', 413);
      form.set('mode', 'electronic'); form.set('addressProof', new File([new Uint8Array(proofBytes)], proof.name, { type: proof.mimeType }));
    }
    const headers = { authorization: request.headers.get('authorization') || '' };
    // Pass through original upload/OCR handlers: their ownership, scanner, limits,
    // audit and version history remain the authority. Never fetch arbitrary URLs.
    return await withAssistantPrincipal(ctx, async () => {
      if (input.destination === 'sale_document') {
        const { PUT } = await import('@/app/api/sales/[saleId]/documents/[documentId]/route');
        return PUT(new NextRequest(request.url, { method: 'PUT', headers, body: form }), { params: Promise.resolve({ saleId: input.saleId, documentId: input.documentId }) });
      }
      if (input.destination === 'conversation_attachment') {
        form.set('conversationId', input.conversationId);
        const { POST } = await import('@/app/api/communications-media/route');
        return POST(new NextRequest(request.url, { method: 'POST', headers, body: form }));
      }
      const { POST } = await import('@/app/api/contracts/ocr-id/route');
      return POST(new NextRequest(request.url, { method: 'POST', headers, body: form }));
    });
  } catch (error) { return assistantError(error); }
}
