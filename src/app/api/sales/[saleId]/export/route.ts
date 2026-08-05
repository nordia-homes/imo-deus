import { NextRequest, NextResponse } from 'next/server';
import { appendSalesAudit, requireSaleAccess, salesApiErrorResponse } from '@/lib/sales-server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, context: { params: Promise<{ saleId: string }> }) {
  try {
    const { saleId } = await context.params;
    const access = await requireSaleAccess(request, saleId);
    const [messages, audit] = await Promise.all([
      access.saleRef.collection('emailMessages').orderBy('createdAt', 'asc').get(),
      access.saleRef.collection('audit').orderBy('createdAt', 'asc').get(),
    ]);
    const exportAudit = appendSalesAudit(access.adminDb, access.saleRef, { agencyId: access.agencyId, saleId, actorUid: access.uid, actorType: 'agent', action: 'sale.exported', entityType: 'sale', entityId: saleId, summary: 'Arhiva GDPR a dosarului a fost exportată' });
    await exportAudit.ref.set(exportAudit.data);
    return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), sale: access.sale, messages: messages.docs.map((entry) => ({ id: entry.id, ...entry.data() })), audit: audit.docs.map((entry) => ({ id: entry.id, ...entry.data() })) }, null, 2), {
      headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="imodeus-${access.sale.trackingCode}.json"`, 'cache-control': 'no-store' },
    });
  } catch (error) {
    const formatted = salesApiErrorResponse(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
