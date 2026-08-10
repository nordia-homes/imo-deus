import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminStorage } from '@/firebase/admin';
import { mergeSaleDocumentVersionHistory } from '@/lib/sales-documents';
import { processSalesDocument } from '@/lib/sales-document-processing';
import { appendSalesAudit, requireSaleAccess, salesApiErrorResponse, SalesApiError } from '@/lib/sales-server';
import type { SaleChecklistItem, SaleDocumentVersion } from '@/lib/types';

export const runtime = 'nodejs';

type DocumentAction =
  | 'analyze'
  | 'approve'
  | 'reject'
  | 'rotate_link'
  | 'mark_requested'
  | 'not_required'
  | 'require'
  | 'restore_version';

const patchDocumentSchema = z.object({
  label: z.string().trim().min(1).max(240).optional(),
  participantRole: z.enum(['buyer', 'owner']).optional(),
  participantId: z.string().trim().max(200).nullable().optional(),
  scope: z.enum(['property', 'participant', 'transaction']).optional(),
  stages: z.array(z.enum(['reservation', 'precontract', 'contract'])).min(1).max(3).optional(),
  required: z.boolean().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

const documentActionSchema = z.object({
  action: z.enum(['analyze', 'approve', 'reject', 'rotate_link', 'mark_requested', 'not_required', 'require', 'restore_version']).default('analyze'),
  note: z.string().trim().max(1000).optional(),
  versionId: z.string().trim().max(200).optional(),
});

function downloadUrl(bucket: string, objectPath: string, token: string) {
  return 'https://firebasestorage.googleapis.com/v0/b/' + bucket + '/o/' + encodeURIComponent(objectPath) + '?alt=media&token=' + token;
}

function safeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'document';
}

function saleCounters(checklist: SaleChecklistItem[]) {
  return {
    requiredDocumentCount: checklist.filter((item) => item.required && item.status !== 'not_required').length,
    receivedDocumentCount: checklist.filter((item) => ['received_needs_review', 'verified'].includes(item.status)).length,
    pendingReviewCount: checklist.filter((item) => item.status === 'received_needs_review').length,
  };
}

async function agencyDocumentSettings(access: Awaited<ReturnType<typeof requireSaleAccess>>) {
  const snapshot = await access.adminDb.collection('agencies').doc(access.agencyId).collection('salesSettings').doc('default').get();
  return snapshot.data() || {};
}

async function persistDocument(
  access: Awaited<ReturnType<typeof requireSaleAccess>>,
  checklist: SaleChecklistItem[],
  document: SaleChecklistItem,
  action: string,
  summary: string,
  metadata?: Record<string, unknown>
) {
  const now = new Date().toISOString();
  const audit = appendSalesAudit(access.adminDb, access.saleRef, {
    agencyId: access.agencyId,
    saleId: access.sale.id,
    actorUid: access.uid,
    actorType: 'agent',
    action,
    entityType: 'document',
    entityId: document.id,
    summary,
    metadata,
  });
  const batch = access.adminDb.batch();
  batch.set(access.saleRef, { checklist, ...saleCounters(checklist), updatedAt: now }, { merge: true });
  batch.set(audit.ref, audit.data);
  await batch.commit();
}

export async function PUT(request: NextRequest, context: { params: Promise<{ saleId: string; documentId: string }> }) {
  try {
    const { saleId, documentId } = await context.params;
    const access = await requireSaleAccess(request, saleId);
    const checklist = [...(access.sale.checklist || [])];
    const index = checklist.findIndex((item) => item.id === documentId);
    if (index < 0) throw new SalesApiError('Cerința documentară nu există.', 404);
    const item = checklist[index];
    const form = await request.formData();
    const upload = form.get('file');
    if (!(upload instanceof File)) throw new SalesApiError('Selectează un fișier pentru încărcare.', 400);
    if (upload.size > 15 * 1024 * 1024) throw new SalesApiError('Fișierul depășește limita de 15 MB.', 413);

    const bytes = Buffer.from(await upload.arrayBuffer());
    const settings = await agencyDocumentSettings(access);
    const analysis = await processSalesDocument({
      bytes,
      fileName: upload.name,
      contentType: upload.type || null,
      forceOcr: settings.ocrEnabled === true,
      requireMalwareScanner: settings.malwareScanRequired === true,
    });
    if (!analysis.allowed) throw new SalesApiError(analysis.scanMessage || 'Fișierul nu este acceptat.', 415);

    const now = new Date().toISOString();
    const version = Math.max(item.version || 0, ...(item.versions || []).map((entry) => entry.version)) + 1;
    const versionId = crypto.randomUUID();
    const objectPath = [
      'agencies',
      access.agencyId,
      'sales',
      saleId,
      'documents',
      documentId,
      'v' + version,
      versionId + '-' + safeFileName(upload.name),
    ].join('/');
    const token = crypto.randomUUID();
    const bucket = adminStorage.bucket();
    await bucket.file(objectPath).save(bytes, {
      resumable: false,
      contentType: analysis.detectedContentType,
      metadata: {
        cacheControl: 'private, no-store',
        metadata: {
          firebaseStorageDownloadTokens: token,
          agencyId: access.agencyId,
          saleId,
          documentId,
          version: String(version),
          uploadedByUid: access.uid,
        },
      },
    });
    const url = downloadUrl(bucket.name, objectPath, token);
    const duplicate = checklist.find((entry) => entry.id !== item.id && entry.checksumSha256 === analysis.checksumSha256 && entry.storagePath);
    const versionRecord: SaleDocumentVersion = {
      id: versionId,
      version,
      fileName: upload.name,
      storagePath: objectPath,
      downloadUrl: url,
      contentType: analysis.detectedContentType,
      sizeBytes: upload.size,
      checksumSha256: analysis.checksumSha256,
      uploadedAt: now,
      uploadedByUid: access.uid,
      scanStatus: analysis.scanStatus,
      ocrStatus: analysis.ocrStatus,
      qualityScore: analysis.qualityScore,
    };
    const next: SaleChecklistItem = {
      ...item,
      status: 'received_needs_review',
      receivedAt: now,
      verifiedAt: null,
      fileName: upload.name,
      downloadUrl: url,
      storagePath: objectPath,
      contentType: analysis.detectedContentType,
      sizeBytes: upload.size,
      checksumSha256: analysis.checksumSha256,
      scanStatus: analysis.scanStatus,
      scanProvider: analysis.scanProvider,
      scanMessage: analysis.scanMessage,
      ocrStatus: analysis.ocrStatus,
      extractedTextPreview: analysis.extractedTextPreview,
      classification: analysis.classification,
      classificationConfidence: analysis.classificationConfidence,
      qualityScore: analysis.qualityScore,
      reviewStatus: analysis.qualityScore >= 50 ? 'unreviewed' : 'needs_attention',
      reviewedByUid: null,
      reviewedAt: null,
      uploadedByUid: access.uid,
      uploadedAt: now,
      expiresAt: analysis.expiresAt,
      revokedAt: null,
      archivedAt: null,
      fileState: 'active',
      version,
      activeVersionId: versionId,
      versions: mergeSaleDocumentVersionHistory(item, versionRecord),
      duplicateOfDocumentId: duplicate?.id || null,
    };
    checklist[index] = next;
    await persistDocument(
      access,
      checklist,
      next,
      'document.uploaded',
      'Document încărcat: ' + next.label + ' · versiunea ' + version,
      { version, sizeBytes: upload.size, duplicateOfDocumentId: duplicate?.id || null }
    );
    return NextResponse.json({ document: next, checklist });
  } catch (error) {
    const formatted = salesApiErrorResponse(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ saleId: string; documentId: string }> }) {
  try {
    const { saleId, documentId } = await context.params;
    const access = await requireSaleAccess(request, saleId);
    const checklist = [...(access.sale.checklist || [])];
    const index = checklist.findIndex((item) => item.id === documentId);
    if (index < 0) throw new SalesApiError('Cerința documentară nu există.', 404);
    const input = patchDocumentSchema.parse(await request.json());

    const item = checklist[index];
    const next: SaleChecklistItem = {
      ...item,
      label: input.label?.trim() || item.label,
      participantRole: input.participantRole || item.participantRole,
      participantId: input.participantId === undefined ? item.participantId : input.participantId,
      scope: input.scope || item.scope,
      stage: input.stages?.[0] || item.stage,
      appliesToStages: input.stages?.length ? [...new Set(input.stages)] : item.appliesToStages,
      required: input.required ?? item.required,
      notes: input.notes === undefined ? item.notes : input.notes?.trim().slice(0, 1000) || null,
    };
    if (!next.required && next.status === 'required') next.status = 'not_required';
    if (next.required && next.status === 'not_required') next.status = next.storagePath ? 'received_needs_review' : 'required';
    checklist[index] = next;
    await persistDocument(access, checklist, next, 'document.requirement_updated', 'Cerință documentară actualizată: ' + next.label);
    return NextResponse.json({ document: next, checklist });
  } catch (error) {
    const formatted = salesApiErrorResponse(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ saleId: string; documentId: string }> }) {
  try {
    const { saleId, documentId } = await context.params;
    const access = await requireSaleAccess(request, saleId);
    const input = documentActionSchema.parse(await request.json()) as { action: DocumentAction; note?: string; versionId?: string };
    const checklist = [...(access.sale.checklist || [])];
    const index = checklist.findIndex((item) => item.id === documentId);
    if (index < 0) throw new SalesApiError('Documentul nu există în checklist.', 404);
    const item = checklist[index];
    const now = new Date().toISOString();
    const action = input.action;
    let next: SaleChecklistItem = { ...item };

    if (action === 'approve') {
      if (!item.storagePath) throw new SalesApiError('Încarcă documentul înainte de verificare.', 409);
      next = { ...next, reviewStatus: 'approved', status: 'verified', reviewedByUid: access.uid, reviewedAt: now, verifiedAt: now, notes: input.note?.slice(0, 1000) || next.notes || null };
    } else if (action === 'reject') {
      next = { ...next, reviewStatus: 'rejected', status: 'rejected', reviewedByUid: access.uid, reviewedAt: now, notes: input.note?.slice(0, 1000) || next.notes || null };
    } else if (action === 'mark_requested') {
      next = { ...next, status: 'requested', requestedAt: now, required: true, notRequiredReason: null };
    } else if (action === 'not_required') {
      next = { ...next, status: 'not_required', required: false, notRequiredReason: input.note?.slice(0, 1000) || 'Marcat manual de agent' };
    } else if (action === 'require') {
      next = {
        ...next,
        status: item.storagePath ? 'received_needs_review' : 'required',
        required: true,
        notRequiredReason: null,
      };
    } else if (action === 'restore_version') {
      const version = item.versions?.find((entry) => entry.id === input.versionId);
      if (!version) throw new SalesApiError('Versiunea selectată nu există.', 404);
      const token = crypto.randomUUID();
      const file = adminStorage.bucket().file(version.storagePath);
      await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
      const url = downloadUrl(adminStorage.bucket().name, version.storagePath, token);
      next = {
        ...next,
        status: 'received_needs_review',
        reviewStatus: 'unreviewed',
        fileState: 'active',
        activeVersionId: version.id,
        version: version.version,
        fileName: version.fileName,
        storagePath: version.storagePath,
        downloadUrl: url,
        contentType: version.contentType || null,
        sizeBytes: version.sizeBytes || null,
        checksumSha256: version.checksumSha256 || null,
        uploadedAt: version.uploadedAt,
        uploadedByUid: version.uploadedByUid || null,
        archivedAt: null,
        revokedAt: null,
        versions: (item.versions || []).map((entry) => entry.id === version.id ? { ...entry, downloadUrl: url, archivedAt: null } : entry),
      };
    } else {
      if (!item.storagePath) throw new SalesApiError('Fișierul asociat nu mai este disponibil.', 409);
      const file = adminStorage.bucket().file(item.storagePath);
      if (action === 'rotate_link') {
        const token = crypto.randomUUID();
        await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
        const url = downloadUrl(adminStorage.bucket().name, item.storagePath, token);
        next = {
          ...next,
          downloadUrl: url,
          revokedAt: null,
          versions: (item.versions || []).map((entry) => entry.id === item.activeVersionId ? { ...entry, downloadUrl: url } : entry),
        };
      } else {
        const [bytes] = await file.download();
        const settings = await agencyDocumentSettings(access);
        const analysis = await processSalesDocument({ bytes, fileName: item.fileName || item.label, contentType: item.contentType, forceOcr: settings.ocrEnabled === true, requireMalwareScanner: settings.malwareScanRequired === true });
        next = {
          ...next,
          contentType: analysis.detectedContentType,
          checksumSha256: analysis.checksumSha256,
          scanStatus: analysis.scanStatus,
          scanProvider: analysis.scanProvider,
          scanMessage: analysis.scanMessage,
          ocrStatus: analysis.ocrStatus,
          extractedTextPreview: analysis.extractedTextPreview,
          classification: analysis.classification,
          classificationConfidence: analysis.classificationConfidence,
          qualityScore: analysis.qualityScore,
          expiresAt: analysis.expiresAt,
          reviewStatus: analysis.allowed && analysis.qualityScore >= 50 ? 'unreviewed' : 'needs_attention',
        };
        if (!analysis.allowed) {
          await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: crypto.randomUUID() } });
          next.downloadUrl = null;
          next.revokedAt = now;
          next.status = 'rejected';
        }
      }
    }

    checklist[index] = next;
    await persistDocument(access, checklist, next, 'document.' + action, 'Document ' + action + ': ' + item.label, { scanStatus: next.scanStatus || null, reviewStatus: next.reviewStatus || null });
    return NextResponse.json({ document: next, checklist });
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
    const now = new Date().toISOString();
    let activeVersionId = item.activeVersionId || null;
    let versions = item.versions || [];
    if (item.storagePath && !versions.some((entry) => entry.storagePath === item.storagePath)) {
      const legacyVersion: SaleDocumentVersion = {
        id: activeVersionId || crypto.randomUUID(),
        version: item.version || 1,
        fileName: item.fileName || item.label,
        storagePath: item.storagePath,
        downloadUrl: item.downloadUrl || null,
        contentType: item.contentType || null,
        sizeBytes: item.sizeBytes || null,
        checksumSha256: item.checksumSha256 || null,
        uploadedAt: item.uploadedAt || item.receivedAt || now,
        uploadedByUid: item.uploadedByUid || null,
        ...(item.scanStatus ? { scanStatus: item.scanStatus } : {}),
        ...(item.ocrStatus ? { ocrStatus: item.ocrStatus } : {}),
        ...(typeof item.qualityScore === 'number' ? { qualityScore: item.qualityScore } : {}),
      };
      activeVersionId = legacyVersion.id;
      versions = mergeSaleDocumentVersionHistory(item, legacyVersion);
    }
    if (item.storagePath) {
      await adminStorage.bucket().file(item.storagePath).setMetadata({ metadata: { firebaseStorageDownloadTokens: crypto.randomUUID() } });
    }
    const next: SaleChecklistItem = {
      ...item,
      downloadUrl: null,
      storagePath: null,
      fileState: 'archived',
      archivedAt: now,
      revokedAt: now,
      status: item.required ? 'required' : 'not_required',
      reviewStatus: 'unreviewed',
      activeVersionId,
      versions: versions.map((entry) => entry.id === activeVersionId ? { ...entry, downloadUrl: null, archivedAt: now } : entry),
    };
    checklist[index] = next;
    await persistDocument(access, checklist, next, 'document.archived', 'Fișier arhivat: ' + item.label);
    return NextResponse.json({ ok: true, document: next, checklist });
  } catch (error) {
    const formatted = salesApiErrorResponse(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}