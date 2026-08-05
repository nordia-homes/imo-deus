import { NextRequest, NextResponse } from 'next/server';
import { appendSalesAudit, requireSaleAccess, salesApiErrorResponse, SalesApiError } from '@/lib/sales-server';
import type { SaleEmailQuestion, SaleReplyReview } from '@/lib/types';

export const runtime = 'nodejs';

const ALLOWED_STATUSES = new Set<SaleReplyReview['status']>(['confirmed', 'corrected', 'needs_clarification']);

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ saleId: string; messageId: string }> }
) {
  try {
    const { saleId, messageId } = await context.params;
    const access = await requireSaleAccess(request, saleId);
    const input = await request.json() as {
      status?: SaleReplyReview['status'];
      note?: string;
      questions?: SaleEmailQuestion[];
    };
    if (!input.status || !ALLOWED_STATUSES.has(input.status)) {
      throw new SalesApiError('Starea validării este invalidă.', 400);
    }
    const reviewStatus = input.status;

    const messageRef = access.saleRef.collection('emailMessages').doc(messageId);
    await access.adminDb.runTransaction(async (transaction) => {
      const [freshSale, messageSnapshot] = await Promise.all([
        transaction.get(access.saleRef),
        transaction.get(messageRef),
      ]);
      if (!messageSnapshot.exists) throw new SalesApiError('Mesajul nu există.', 404);
      const message = messageSnapshot.data() || {};
      if (message.direction !== 'inbound') throw new SalesApiError('Doar răspunsurile primite pot fi validate.', 409);

      const now = new Date().toISOString();
      const wasPending = message.replyReview?.status === 'pending' || !message.replyReview;
      const review: SaleReplyReview = {
        status: reviewStatus,
        reviewedByUid: access.uid,
        reviewedAt: now,
        note: input.note?.trim().slice(0, 2000) || null,
      };
      const questions = (input.questions || message.questions || []).map((question: SaleEmailQuestion) => ({
        ...question,
        reviewStatus: reviewStatus === 'needs_clarification' ? 'needs_clarification' as const : 'confirmed' as const,
        reviewedByUid: access.uid,
        reviewedAt: now,
      }));
      transaction.set(messageRef, { replyReview: review, questions, updatedAt: now }, { merge: true });
      const currentPending = Number(freshSale.data()?.pendingReviewCount || 0);
      transaction.set(access.saleRef, {
        pendingReviewCount: wasPending ? Math.max(0, currentPending - 1) : currentPending,
        updatedAt: now,
      }, { merge: true });

      const audit = appendSalesAudit(access.adminDb, access.saleRef, {
        agencyId: access.agencyId,
        saleId,
        actorUid: access.uid,
        actorType: 'agent',
        action: `reply.${reviewStatus}`,
        entityType: 'message',
        entityId: messageId,
        summary: reviewStatus === 'needs_clarification' ? 'Răspuns marcat pentru clarificare' : 'Răspuns validat de agent',
        metadata: { questionCount: questions.length },
      });
      transaction.set(audit.ref, audit.data);
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const formatted = salesApiErrorResponse(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
