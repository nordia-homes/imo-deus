import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { inferSaleDocumentScope } from '@/lib/sales-documents';
import { appendSalesAudit, requireSaleAccess, salesApiErrorResponse } from '@/lib/sales-server';
import type { SaleChecklistItem } from '@/lib/types';

export const runtime = 'nodejs';

const createRequirementSchema = z.object({
  label: z.string().trim().min(1).max(240),
  participantRole: z.enum(['buyer', 'owner']).default('owner'),
  participantId: z.string().trim().max(200).nullable().optional(),
  scope: z.enum(['property', 'participant', 'transaction']).optional(),
  stages: z.array(z.enum(['reservation', 'precontract', 'contract'])).min(1).max(3),
  required: z.boolean().default(true),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ saleId: string }> }) {
  try {
    const { saleId } = await context.params;
    const access = await requireSaleAccess(request, saleId);
    const input = createRequirementSchema.parse(await request.json());
    const now = new Date().toISOString();
    const documentId = crypto.randomUUID();
    const document: SaleChecklistItem = {
      id: documentId,
      label: input.label,
      participantRole: input.participantRole,
      participantId: input.participantId || null,
      scope: input.scope || inferSaleDocumentScope({ label: input.label }),
      stage: input.stages[0],
      appliesToStages: input.stages,
      status: input.required ? 'required' : 'not_required',
      required: input.required,
      notes: input.notes || null,
      reviewStatus: 'unreviewed',
      scanStatus: 'pending',
      ocrStatus: 'not_requested',
      fileState: 'missing',
      version: 0,
      versions: [],
    };
    const checklist = [...(access.sale.checklist || []), document];
    const audit = appendSalesAudit(access.adminDb, access.saleRef, {
      agencyId: access.agencyId,
      saleId,
      actorUid: access.uid,
      actorType: 'agent',
      action: 'document.requirement_created',
      entityType: 'document',
      entityId: documentId,
      summary: 'Cerință documentară adăugată: ' + document.label,
      metadata: { scope: document.scope || 'participant', required: document.required },
    });
    const batch = access.adminDb.batch();
    batch.set(access.saleRef, {
      checklist,
      requiredDocumentCount: checklist.filter((item) => item.required && item.status !== 'not_required').length,
      receivedDocumentCount: checklist.filter((item) => ['received_needs_review', 'verified'].includes(item.status)).length,
      updatedAt: now,
    }, { merge: true });
    batch.set(audit.ref, audit.data);
    await batch.commit();
    return NextResponse.json({ document, checklist }, { status: 201 });
  } catch (error) {
    const formatted = salesApiErrorResponse(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}