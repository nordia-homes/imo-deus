import { NextRequest, NextResponse } from 'next/server';
import { appendSalesAudit, requireSaleAccess, salesApiErrorResponse, SalesApiError } from '@/lib/sales-server';
import type { SaleEmailSendEvidence } from '@/lib/types';
import { assistantPrincipal } from '@/lib/ai-assistant/principal';
import { z } from 'zod';

export const runtime = 'nodejs';
const evidenceSchema = z.object({ level: z.enum(['ui_observed', 'agent_confirmed']), diagnostics: z.object({ jobId: z.string().min(1).max(180).optional(), completedFields: z.array(z.string().max(100)).max(30).optional(), missingFields: z.array(z.string().max(100)).max(30).optional(), attempt: z.number().int().min(1).max(100).optional(), selectorProfile: z.string().max(100).nullable().optional(), canRetry: z.boolean().optional() }).strict().optional() }).strict();

export async function PATCH(request: NextRequest, context: { params: Promise<{ saleId: string; messageId: string }> }) {
  try {
    const { saleId, messageId } = await context.params;
    const access = await requireSaleAccess(request, saleId);
    const input = evidenceSchema.parse(await request.json());
    if (input.level === 'ui_observed' && await assistantPrincipal(request.headers.get('authorization'))) throw new SalesApiError('Observarea interfeței Gmail se înregistrează numai de runner-ul dispozitivului, nu de model.', 403);
    const messageRef = access.saleRef.collection('emailMessages').doc(messageId);
    const now = new Date().toISOString();
    const evidence: SaleEmailSendEvidence = {
      level: input.level,
      source: input.level === 'ui_observed' ? 'gmail_runner' : 'agent',
      observedAt: now,
      observedByUid: access.uid,
      details: input.level === 'ui_observed' ? 'Interfața Gmail a afișat confirmarea după acțiunea agentului.' : 'Agentul a confirmat manual că a trimis mesajul din Gmail.',
    };
    const audit = appendSalesAudit(access.adminDb, access.saleRef, {
      agencyId: access.agencyId, saleId, actorUid: access.uid, actorType: 'agent', action: `message.send_evidence.${input.level}`,
      entityType: 'message', entityId: messageId, summary: evidence.details || 'Dovadă de trimitere actualizată',
    });
    const result = await access.adminDb.runTransaction(async tx => {
      const [member, sale, snapshot] = await Promise.all([tx.get(access.adminDb.collection('users').doc(access.uid)), tx.get(access.saleRef), tx.get(messageRef)]);
      const current = sale.data(), message = snapshot.data();
      if (member.data()?.agencyId !== access.agencyId || member.data()?.role !== access.role || !current || (access.role !== 'admin' && current.agentId !== access.uid && !current.collaboratorIds?.includes(access.uid))) throw new SalesApiError('Acces revocat.', 403);
      if (!message || message.direction !== 'outbound') throw new SalesApiError('Mesajul outbound nu există.', 404);
      if (input.level === 'ui_observed' && (!message.handoffJobId || input.diagnostics?.jobId !== message.handoffJobId)) throw new SalesApiError('Confirmarea Gmail aparține altei execuții.', 409);
      const rank: Record<string, number> = { none: 0, agent_confirmed: 1, ui_observed: 2, reply_confirmed: 3 };
      const priorRank = Math.max(rank[message.sendEvidence?.level] || 0, message.status === 'replied' ? 3 : message.status === 'sent_ui_confirmed' ? 2 : message.status === 'sent_unconfirmed' ? 1 : 0);
      if (priorRank >= rank[input.level]) return { evidence: message.sendEvidence || null, changed: false };
      tx.set(messageRef, { status: input.level === 'ui_observed' ? 'sent_ui_confirmed' : 'sent_unconfirmed', sendEvidence: evidence, runnerDiagnostics: input.diagnostics || null, sentAt: message.sentAt || now, updatedAt: now }, { merge: true });
      // A delayed confirmation cannot move lastCommunicationAt backwards.
      tx.set(access.saleRef, { lastCommunicationAt: current.lastCommunicationAt && current.lastCommunicationAt > now ? current.lastCommunicationAt : now, updatedAt: now }, { merge: true });
      tx.set(audit.ref, audit.data);
      return { evidence, changed: true };
    });
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const formatted = error instanceof z.ZodError ? { status: 400, message: 'Dovada de trimitere este invalidă.' } : salesApiErrorResponse(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
