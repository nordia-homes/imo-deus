import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { appendSalesAudit, requireSaleAccess, salesApiErrorResponse, SalesApiError } from '@/lib/sales-server';

export const runtime = 'nodejs';
const readSchema = z.object({ expectedUpdatedAt: z.string().datetime().nullable(), observedUnreadCount: z.number().int().nonnegative() }).strict();

export async function POST(request: NextRequest, context: { params: Promise<{ saleId: string }> }) {
  try {
    const { saleId } = await context.params;
    const access = await requireSaleAccess(request, saleId);
    const input = readSchema.parse(await request.json());
    const result = await access.adminDb.runTransaction(async tx => {
      const [snapshot, member] = await Promise.all([tx.get(access.saleRef), tx.get(access.adminDb.collection('users').doc(access.uid))]);
      if (!snapshot.exists) throw new SalesApiError('Dosarul nu mai există.', 404);
      const sale = snapshot.data()!;
      if (member.data()?.agencyId !== access.agencyId || member.data()?.role !== access.role || !['agent', 'admin'].includes(access.role || '') || !(access.role === 'admin' || sale.agentId === access.uid || sale.collaboratorIds?.includes(access.uid))) throw new SalesApiError('Accesul la dosar a fost revocat.', 403);
      const unreadReplyCount = Number(sale.unreadReplyCount || 0);
      if (!unreadReplyCount || !input.observedUnreadCount) return { changed: false, unreadReplyCount };
      // Do not acknowledge a newer reply which the caller has not seen.
      if ((sale.updatedAt || null) !== input.expectedUpdatedAt || unreadReplyCount !== input.observedUnreadCount) throw new SalesApiError('Dosarul a primit modificări noi. Reîncarcă răspunsurile înainte de marcarea ca citite.', 409);
      const now = new Date().toISOString();
      const audit = appendSalesAudit(access.adminDb, access.saleRef, { agencyId: access.agencyId, saleId, actorUid: access.uid, actorType: 'agent', action: 'sale.replies_read', entityType: 'sale', entityId: saleId, summary: 'Răspunsurile afișate au fost marcate ca citite.', metadata: { observedUnreadCount: input.observedUnreadCount } });
      tx.update(access.saleRef, { unreadReplyCount: 0, updatedAt: now });
      tx.set(audit.ref, audit.data);
      return { changed: true, unreadReplyCount: 0 };
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Revizia și numărul de răspunsuri afișate sunt obligatorii.' }, { status: 400 });
    const formatted = salesApiErrorResponse(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
