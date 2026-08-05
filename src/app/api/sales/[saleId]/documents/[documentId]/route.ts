import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { adminStorage } from '@/firebase/admin';
import { processSalesDocument } from '@/lib/sales-document-processing';
import { appendSalesAudit, requireSaleAccess, salesApiErrorResponse, SalesApiError } from '@/lib/sales-server';
import type { SaleChecklistItem } from '@/lib/types';

export const runtime = 'nodejs';

function downloadUrl(bucket: string, objectPath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`;
}

export async function POST(request: NextRequest, context: { params: Promise<{ saleId: string; documentId: string }> }) {
  try {
    const { saleId, documentId } = await context.params;
    const access = await requireSaleAccess(request, saleId);
    const input = await request.json() as { action?: 'analyze' | 'approve' | 'reject' | 'rotate_link'; note?: string };
    const checklist = [...(access.sale.checklist || [])];
    const index = checklist.findIndex((item) => item.id === documentId);
    if (index < 0) throw new SalesApiError('Documentul nu există în checklist.', 404);
    const item = checklist[index];
    const now = new Date().toISOString();
    let next: SaleChecklistItem = { ...item };
    if (input.action === 'approve' || input.action === 'reject') {
      next = { ...next, reviewStatus: input.action === 'approve' ? 'approved' : 'rejected', status: input.action === 'approve' ? 'verified' : 'rejected', reviewedByUid: access.uid, reviewedAt: now, verifiedAt: input.action === 'approve' ? now : next.verifiedAt || null, notes: input.note?.slice(0, 1000) || next.notes || null };
    } else {
      if (!item.storagePath) throw new SalesApiError('Fișierul asociat nu mai este disponibil.', 409);
      const file = adminStorage.bucket().file(item.storagePath);
      if (input.action === 'rotate_link') {
        const token = crypto.randomUUID();
        await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
        next = { ...next, downloadUrl: downloadUrl(adminStorage.bucket().name, item.storagePath, token), revokedAt: null };
      } else {
        const [bytes] = await file.download();
        const settings = (await access.adminDb.collection('agencies').doc(access.agencyId).collection('salesSettings').doc('default').get()).data() || {};
        const analysis = await processSalesDocument({ bytes, fileName: item.fileName || item.label, contentType: item.contentType, forceOcr: settings.ocrEnabled === true, requireMalwareScanner: settings.malwareScanRequired === true });
        next = { ...next, contentType: analysis.detectedContentType, checksumSha256: analysis.checksumSha256, scanStatus: analysis.scanStatus, scanProvider: analysis.scanProvider, scanMessage: analysis.scanMessage, ocrStatus: analysis.ocrStatus, extractedTextPreview: analysis.extractedTextPreview, classificationConfidence: analysis.classificationConfidence, qualityScore: analysis.qualityScore, expiresAt: analysis.expiresAt, reviewStatus: analysis.allowed && analysis.qualityScore >= 50 ? 'unreviewed' : 'needs_attention' };
        if (!analysis.allowed) {
          await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: crypto.randomUUID() } });
          next.downloadUrl = null;
          next.revokedAt = now;
          next.status = 'rejected';
        }
      }
    }
    checklist[index] = next;
    const audit = appendSalesAudit(access.adminDb, access.saleRef, { agencyId: access.agencyId, saleId, actorUid: access.uid, actorType: 'agent', action: `document.${input.action || 'analyze'}`, entityType: 'document', entityId: documentId, summary: `Document ${input.action || 'analyze'}: ${item.label}`, metadata: { scanStatus: next.scanStatus || null, reviewStatus: next.reviewStatus || null } });
    const batch = access.adminDb.batch();
    batch.set(access.saleRef, { checklist, receivedDocumentCount: checklist.filter((entry) => ['received_needs_review', 'verified'].includes(entry.status)).length, updatedAt: now }, { merge: true });
    batch.set(audit.ref, audit.data);
    await batch.commit();
    return NextResponse.json({ document: next });
  } catch (error) {
    const formatted = salesApiErrorResponse(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ saleId: string; documentId: string }> }) {
  try {
    const { saleId, documentId } = await context.params;
    const access = await requireSaleAccess(request, saleId);
    const checklist = [...(access.sale.checklist || [])];
    const index = checklist.findIndex((item) => item.id === documentId);
    if (index < 0) throw new SalesApiError('Documentul nu există.', 404);
    const item = checklist[index];
    if (item.storagePath) await adminStorage.bucket().file(item.storagePath).delete({ ignoreNotFound: true });
    checklist[index] = { ...item, downloadUrl: null, storagePath: null, revokedAt: new Date().toISOString(), status: item.required ? 'required' : 'rejected', reviewStatus: 'rejected' };
    const audit = appendSalesAudit(access.adminDb, access.saleRef, { agencyId: access.agencyId, saleId, actorUid: access.uid, actorType: 'agent', action: 'document.deleted', entityType: 'document', entityId: documentId, summary: `Fișier șters: ${item.label}` });
    const batch = access.adminDb.batch();
    batch.set(access.saleRef, { checklist, updatedAt: new Date().toISOString() }, { merge: true });
    batch.set(audit.ref, audit.data);
    await batch.commit();
    return NextResponse.json({ ok: true, document: checklist[index] });
  } catch (error) {
    const formatted = salesApiErrorResponse(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
