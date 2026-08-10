import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSaleDocumentSummary } from '@/lib/sales-documents';
import { DEFAULT_CONTRACT_OWNER_DOCUMENTS, SALE_STAGE_META, withDefaultSaleDocumentsForStage } from '@/lib/sales';
import { appendSalesAudit, requireSaleAccess, salesApiErrorResponse } from '@/lib/sales-server';

export const runtime = 'nodejs';

const stageSchema = z.object({
  stage: z.enum(['preparing', 'reservation', 'precontract', 'contract', 'completed', 'blocked', 'cancelled']),
});

export async function POST(request: NextRequest, context: { params: Promise<{ saleId: string }> }) {
  try {
    const { saleId } = await context.params;
    const access = await requireSaleAccess(request, saleId);
    const { stage } = stageSchema.parse(await request.json());
    const now = new Date().toISOString();
    const checklist = stage === 'contract'
      ? withDefaultSaleDocumentsForStage(access.sale.checklist, DEFAULT_CONTRACT_OWNER_DOCUMENTS, () => crypto.randomUUID())
      : access.sale.checklist || [];
    const summary = getSaleDocumentSummary(checklist);
    const audit = appendSalesAudit(access.adminDb, access.saleRef, {
      agencyId: access.agencyId,
      saleId,
      actorUid: access.uid,
      actorType: 'agent',
      action: 'sale.stage_changed',
      entityType: 'sale',
      entityId: saleId,
      summary: `Etapă schimbată din „${SALE_STAGE_META[access.sale.stage].label}” în „${SALE_STAGE_META[stage].label}”`,
      metadata: {
        fromStage: access.sale.stage,
        toStage: stage,
        missingDocuments: summary.missing,
        pendingReviewDocuments: summary.review,
      },
    });
    const patch = {
      stage,
      checklist,
      requiredDocumentCount: summary.required,
      receivedDocumentCount: summary.verified + summary.review,
      pendingReviewCount: summary.review,
      nextAction: SALE_STAGE_META[stage].description,
      updatedAt: now,
      completedAt: stage === 'completed' ? now : null,
    };
    const batch = access.adminDb.batch();
    batch.set(access.saleRef, patch, { merge: true });
    batch.set(audit.ref, audit.data);
    await batch.commit();
    return NextResponse.json({ ok: true, sale: { ...access.sale, ...patch }, checklist, summary });
  } catch (error) {
    const formatted = salesApiErrorResponse(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}