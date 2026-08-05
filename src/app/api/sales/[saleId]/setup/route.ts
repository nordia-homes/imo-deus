import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSaleReadiness } from '@/lib/sales';
import { appendSalesAudit, requireSaleAccess, salesApiErrorResponse } from '@/lib/sales-server';
import type { SaleChecklistItem, SaleParticipant, SaleTransaction } from '@/lib/types';

export const runtime = 'nodejs';

const participantSchema = z.object({
  id: z.string().min(1).max(200),
  role: z.enum(['buyer', 'owner', 'notary', 'collaborator']),
  contactId: z.string().nullable().optional(),
  name: z.string().trim().max(200),
  email: z.string().trim().email().or(z.literal('')),
  phone: z.string().trim().max(50).nullable().optional(),
  preferredChannel: z.enum(['email', 'phone', 'whatsapp']).optional(),
});

const checklistSchema = z.object({
  id: z.string().min(1).max(200),
  label: z.string().trim().min(1).max(240),
  participantRole: z.enum(['buyer', 'owner']),
  status: z.enum(['required', 'requested', 'received_needs_review', 'verified', 'rejected', 'expired']),
  required: z.boolean(),
}).passthrough();

const setupSchema = z.object({
  participants: z.array(participantSchema).min(2).max(20),
  agreedPrice: z.number().positive().max(1_000_000_000),
  financingType: z.enum(['cash', 'credit', 'unknown']),
  checklist: z.array(checklistSchema).max(100),
  notary: z.object({
    name: z.string().trim().max(200).nullable().optional(),
    email: z.string().trim().email().or(z.literal('')).nullable().optional(),
    phone: z.string().trim().max(50).nullable().optional(),
    address: z.string().trim().max(400).nullable().optional(),
    appointmentAt: z.string().datetime().nullable().optional(),
  }).nullable(),
});

export async function PATCH(request: NextRequest, context: { params: Promise<{ saleId: string }> }) {
  try {
    const { saleId } = await context.params;
    const access = await requireSaleAccess(request, saleId);
    const input = setupSchema.parse(await request.json());
    const candidate = {
      ...access.sale,
      participants: input.participants as SaleParticipant[],
      agreedPrice: input.agreedPrice,
      financingType: input.financingType,
      checklist: input.checklist as SaleChecklistItem[],
      notary: input.notary,
    } satisfies SaleTransaction;
    const readiness = getSaleReadiness(candidate);
    if (!readiness.ready) {
      return NextResponse.json({ message: 'Dosarul este încă incomplet.', issues: readiness.issues }, { status: 422 });
    }
    const now = new Date().toISOString();
    const audit = appendSalesAudit(access.adminDb, access.saleRef, {
      agencyId: access.agencyId,
      saleId,
      actorUid: access.uid,
      actorType: 'agent',
      action: 'sale.setup_completed',
      entityType: 'sale',
      entityId: saleId,
      summary: 'Configurarea inițială a dosarului a fost finalizată.',
      metadata: { participantCount: input.participants.length, documentCount: input.checklist.length },
    });
    const update = {
      participants: input.participants,
      agreedPrice: input.agreedPrice,
      financingType: input.financingType,
      checklist: input.checklist,
      notary: input.notary,
      setupStatus: 'ready',
      setupCompletedAt: now,
      setupCompletedByUid: access.uid,
      requiredDocumentCount: input.checklist.filter((item) => item.required).length,
      updatedAt: now,
    };
    const batch = access.adminDb.batch();
    batch.set(access.saleRef, update, { merge: true });
    batch.set(audit.ref, audit.data);
    await batch.commit();
    return NextResponse.json({ sale: { ...candidate, ...update }, readiness });
  } catch (error) {
    const formatted = salesApiErrorResponse(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
