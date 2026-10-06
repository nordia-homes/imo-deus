import { NextRequest, NextResponse } from 'next/server';
import { appendSalesAudit, requireSaleAccess, salesApiErrorResponse, SalesApiError } from '@/lib/sales-server';
import { saleEmailContentHash } from '@/lib/crm/sale-email-hash';
import { assistantPrincipal } from '@/lib/ai-assistant/principal';
import { z } from 'zod';
export const runtime = 'nodejs';
const handoffStateSchema = z.object({ state: z.enum(['opened_in_gmail', 'runner_error']), jobId: z.string().min(1).max(180) }).strict();
export async function PATCH(request: NextRequest, route: { params: Promise<{ saleId: string; messageId: string }> }) {
  try {
    const { saleId, messageId } = await route.params, access = await requireSaleAccess(request, saleId);
    if (await assistantPrincipal(request.headers.get('authorization'))) throw new SalesApiError('Starea dispozitivului Gmail se înregistrează din interfața agentului, nu de model.', 403);
    const input = handoffStateSchema.parse(await request.json());
    const messageRef = access.saleRef.collection('emailMessages').doc(messageId);
    const audit = appendSalesAudit(access.adminDb, access.saleRef, { agencyId: access.agencyId, saleId, actorUid: access.uid, actorType: 'agent', action: `message.handoff.${input.state}`, entityType: 'message', entityId: messageId, summary: input.state === 'opened_in_gmail' ? 'Gmail a fost deschis; trimiterea nu este confirmată.' : 'Runner-ul a raportat o eroare; verifică Gmail înainte de orice retrimitere.' });
    const result = await access.adminDb.runTransaction(async tx => {
      const [member, sale, snapshot] = await Promise.all([tx.get(access.adminDb.collection('users').doc(access.uid)), tx.get(access.saleRef), tx.get(messageRef)]);
      const current = sale.data();
      if (member.data()?.agencyId !== access.agencyId || member.data()?.role !== access.role || !current || (access.role !== 'admin' && current.agentId !== access.uid && !current.collaboratorIds?.includes(access.uid))) throw new SalesApiError('Acces revocat.', 403);
      const message = snapshot.data();
      if (!message || message.direction !== 'outbound') throw new SalesApiError('Mesajul outbound nu există.', 404);
      if (message.handoffJobId !== input.jobId) throw new SalesApiError('Starea Gmail aparține altei execuții.', 409);
      const status = input.state === 'runner_error' ? 'failed' : 'opened_in_gmail';
      // Late callbacks cannot erase a stronger send/receipt state. Repeated
      // notifications are no-ops and therefore do not duplicate the audit.
      if (message.status === status) return { status, changed: false };
      if (!['prepared', 'opened_in_gmail'].includes(message.status)) return { status: message.status, changed: false };
      const now = new Date().toISOString();
      tx.update(messageRef, { status, updatedAt: now, ...(input.state === 'opened_in_gmail' ? { sendEvidence: { level: 'none', source: 'web_fallback', observedAt: now, observedByUid: access.uid, details: audit.data.summary } } : {}) });
      tx.set(audit.ref, audit.data);
      return { status, changed: true };
    });
    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const result = error instanceof z.ZodError ? { status: 400, message: 'Starea Gmail este invalidă.' } : salesApiErrorResponse(error);
    return NextResponse.json({ message: result.message }, { status: result.status });
  }
}
export async function GET(request: NextRequest, route: { params: Promise<{ saleId: string; messageId: string }> }) {
  try {
    const { saleId, messageId } = await route.params, access = await requireSaleAccess(request, saleId);
    const message = (await access.saleRef.collection('emailMessages').doc(messageId).get()).data();
    if (!message || message.direction !== 'outbound' || !message.handoffJobId) throw new SalesApiError('Emailul pregătit nu există.', 404);
    const ledger = (await access.adminDb.collection('agencies').doc(access.agencyId).collection('assistantExecutions').doc(messageId).get()).data();
    if (ledger?.status !== 'completed' || ledger.action?.kind !== 'prepare_sale_email' || ledger.action?.saleId !== saleId || ledger.result?.contentHash !== saleEmailContentHash(message)) throw new SalesApiError('Emailul a fost modificat după pregătire. Verifică și pregătește din nou conținutul.', 409);
    if (!['prepared', 'opened_in_gmail'].includes(message.status)) throw new SalesApiError('Emailul are deja o stare de trimitere. Verifică istoricul înainte de reluare.', 409);
    const attachments = (message.documentIds || []).map((id: string) => (access.sale.checklist || []).find(row => row.id === id));
    if (attachments.some((row: any) => !row?.downloadUrl)) throw new SalesApiError('Un document atașat nu mai este disponibil.', 409);
    if (attachments.some((row: any) => !message.attachmentRefs?.some((old: any) => old.documentId === row.id && old.downloadUrl === row.downloadUrl && old.version === (row.version || null)))) throw new SalesApiError('Un document a fost înlocuit după pregătirea emailului. Pregătește un email nou cu versiunea actuală.', 409);
    const compose = new URL('https://mail.google.com/mail/');
    compose.searchParams.set('view', 'cm'); compose.searchParams.set('fs', '1'); compose.searchParams.set('to', message.to.join(','));
    if (message.cc?.length) compose.searchParams.set('cc', message.cc.join(','));
    if (message.bcc?.length) compose.searchParams.set('bcc', message.bcc.join(','));
    compose.searchParams.set('su', message.subject); compose.searchParams.set('body', message.bodyText);
    return NextResponse.json({ session: { jobId: message.handoffJobId, saleId, messageRecordId: messageId, trackingCode: message.trackingCode, to: message.to, cc: message.cc || [], bcc: message.bcc || [], subject: message.subject, bodyText: message.bodyText, bodyHtml: message.bodyHtml, attachments: attachments.map((row: any) => ({ name: row.fileName || row.label, url: row.downloadUrl })) }, composeUrl: compose.toString(), note: 'În browser, fișierele trebuie atașate manual. Gmail Desktop le pregătește folosind runner-ul existent.' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { const result = salesApiErrorResponse(error); return NextResponse.json({ message: result.message }, { status: result.status }); }
}
