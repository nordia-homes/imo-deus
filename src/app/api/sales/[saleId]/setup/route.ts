import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { calculateContractBalance, getSaleReadiness } from '@/lib/sales';
import { appendSalesAudit, requireSaleAccess, salesApiErrorResponse, SalesApiError } from '@/lib/sales-server';
import { normalizeSaleForWorkspace } from '@/lib/sales-workspace';
import { mergeSetupChecklist, saleSetupSchema } from '@/lib/crm/sale-setup';
import type { SaleTransaction, SaleChecklistItem, SaleParticipant } from '@/lib/types';
export const runtime = 'nodejs';
export async function PATCH(request: NextRequest, context: { params: Promise<{ saleId: string }> }) {
  try {
    const { saleId } = await context.params;
    const access = await requireSaleAccess(request, saleId);
    const input = saleSetupSchema.parse(await request.json());
    const result = await access.adminDb.runTransaction(async tx => {
      const [snapshot, member] = await Promise.all([tx.get(access.saleRef), tx.get(access.adminDb.collection('users').doc(access.uid))]);
      const sale = snapshot.exists ? normalizeSaleForWorkspace({ id: snapshot.id, ...snapshot.data() } as SaleTransaction) : null;
      if (!sale) throw new SalesApiError('Dosarul nu mai există.', 404);
      if (member.data()?.agencyId !== access.agencyId || member.data()?.role !== access.role || !(access.role === 'admin' || sale.agentId === access.uid || sale.collaboratorIds?.includes(access.uid))) throw new SalesApiError('Accesul la dosar a fost revocat.', 403);
      if ((sale.updatedAt || null) !== (input.expectedUpdatedAt === undefined ? access.sale.updatedAt || null : input.expectedUpdatedAt)) throw new SalesApiError('Dosarul a fost modificat între timp. Reîncarcă datele înainte de salvare.', 409);
      const contacts = await Promise.all(input.participants.filter(p => p.contactId).map(p => tx.get(access.adminDb.collection('agencies').doc(access.agencyId).collection('contacts').doc(p.contactId!))));
      if (contacts.some(doc => !doc.exists)) throw new SalesApiError('Un participant face referire la un contact inaccesibil.', 400);
      if (input.checklist.some(item => item.participantId && !input.participants.some(p => p.id === item.participantId && p.role === item.participantRole))) throw new SalesApiError('Documentul trebuie asociat unui participant de același tip.', 400);
      const now = new Date().toISOString();
      let checklist: SaleChecklistItem[];
      try { checklist = mergeSetupChecklist(sale.checklist || [], input.checklist, now) as SaleChecklistItem[]; }
      catch (error) { throw new SalesApiError(error instanceof Error ? error.message : 'Checklist invalid.', 400); }
      const candidate = { ...sale, participants: input.participants as SaleParticipant[], checklist, agreedPrice: input.agreedPrice, reservationAmount: input.reservationAmount, precontractAmount: input.precontractAmount, contractBalanceAmount: calculateContractBalance(input.agreedPrice, input.reservationAmount, input.precontractAmount), financingType: input.financingType, notary: input.notary, ...(input.nextAction !== undefined ? { nextAction: input.nextAction } : {}), ...(input.nextActionAt !== undefined ? { nextActionAt: input.nextActionAt } : {}) } satisfies SaleTransaction;
      const readiness = getSaleReadiness(candidate);
      const update = { participants: candidate.participants, checklist, agreedPrice: candidate.agreedPrice, reservationAmount: candidate.reservationAmount, precontractAmount: candidate.precontractAmount, contractBalanceAmount: candidate.contractBalanceAmount, financingType: candidate.financingType, notary: candidate.notary, ...(input.nextAction !== undefined ? { nextAction: input.nextAction } : {}), ...(input.nextActionAt !== undefined ? { nextActionAt: input.nextActionAt } : {}), setupStatus: readiness.ready ? 'ready' : 'incomplete', setupCompletedAt: readiness.ready ? sale.setupCompletedAt || now : null, setupCompletedByUid: readiness.ready ? sale.setupCompletedByUid || access.uid : null, requiredDocumentCount: checklist.filter(item => item.required).length, receivedDocumentCount: checklist.filter(item => ['received_needs_review', 'verified'].includes(item.status)).length, updatedAt: now };
      const audit = appendSalesAudit(access.adminDb, access.saleRef, { agencyId: access.agencyId, saleId, actorUid: access.uid, actorType: 'agent', action: readiness.ready ? 'sale.setup_completed' : 'sale.setup_progress_saved', entityType: 'sale', entityId: saleId, summary: 'Configurarea dosarului a fost salvată.', metadata: { participantCount: input.participants.length, documentCount: checklist.length, readinessProgress: readiness.progress } });
      tx.set(access.saleRef, update, { merge: true }); tx.set(audit.ref, audit.data);
      return { sale: { ...candidate, ...update }, readiness };
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Datele dosarului nu sunt valide.', issues: error.issues.map(issue => ({ path: issue.path, message: issue.message })) }, { status: 400 });
    const formatted = salesApiErrorResponse(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
