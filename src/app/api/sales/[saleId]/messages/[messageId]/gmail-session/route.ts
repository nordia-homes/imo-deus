import { NextRequest, NextResponse } from 'next/server';
import { requireSaleAccess, salesApiErrorResponse, SalesApiError } from '@/lib/sales-server';
import { saleEmailContentHash } from '@/lib/crm/sale-email-hash';
export const runtime = 'nodejs';
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
