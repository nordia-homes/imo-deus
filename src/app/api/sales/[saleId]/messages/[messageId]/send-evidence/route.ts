import { NextRequest, NextResponse } from 'next/server';
import { appendSalesAudit, requireSaleAccess, salesApiErrorResponse, SalesApiError } from '@/lib/sales-server';
import type { SaleEmailSendEvidence } from '@/lib/types';

export const runtime = 'nodejs';

export async function PATCH(request: NextRequest, context: { params: Promise<{ saleId: string; messageId: string }> }) {
  try {
    const { saleId, messageId } = await context.params;
    const access = await requireSaleAccess(request, saleId);
    const input = await request.json() as { level?: 'ui_observed' | 'agent_confirmed'; diagnostics?: Record<string, unknown> };
    if (!input.level || !['ui_observed', 'agent_confirmed'].includes(input.level)) throw new SalesApiError('Dovada de trimitere este invalidă.', 400);
    const messageRef = access.saleRef.collection('emailMessages').doc(messageId);
    const snapshot = await messageRef.get();
    if (!snapshot.exists || snapshot.data()?.direction !== 'outbound') throw new SalesApiError('Mesajul outbound nu există.', 404);
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
    const batch = access.adminDb.batch();
    batch.set(messageRef, {
      status: input.level === 'ui_observed' ? 'sent_ui_confirmed' : 'sent_unconfirmed',
      sendEvidence: evidence,
      runnerDiagnostics: input.diagnostics || null,
      sentAt: now,
      updatedAt: now,
    }, { merge: true });
    batch.set(access.saleRef, { lastCommunicationAt: now, updatedAt: now }, { merge: true });
    batch.set(audit.ref, audit.data);
    await batch.commit();
    return NextResponse.json({ ok: true, evidence });
  } catch (error) {
    const formatted = salesApiErrorResponse(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
