import crypto from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/firebase/admin';

export const runtime = 'nodejs';

const feedbackSchema = z.object({
  recommendationId: z.string().trim().min(1).max(200),
  clientEventId: z.string().trim().min(8).max(200),
  clientFeedback: z.enum(['liked', 'disliked', 'none']).optional(),
  clientComment: z.string().max(2000).optional(),
}).refine((value) => value.clientFeedback !== undefined || value.clientComment !== undefined, {
  message: 'Este necesara cel putin o modificare.',
});

class PortalFeedbackError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function hashId(...parts: string[]) {
  return crypto.createHash('sha256').update(parts.join('\u001f')).digest('base64url').slice(0, 44);
}

export async function POST(request: NextRequest, context: { params: Promise<{ portalId: string }> }) {
  try {
    const { portalId } = await context.params;
    if (!portalId || portalId.length > 200) {
      return NextResponse.json({ message: 'Portal invalid.' }, { status: 400 });
    }
    const input = feedbackSchema.parse(await request.json());
    const portalRef = adminDb.collection('portals').doc(portalId);
    const recommendationRef = portalRef.collection('recommendations').doc(input.recommendationId);
    const eventRef = adminDb.collection('notificationEvents').doc(
      `evt_${hashId('client_portal.feedback_updated', portalId, input.recommendationId, input.clientEventId)}`,
    );
    const rateRef = adminDb.collection('portalFeedbackRateLimits').doc(portalId);

    const result = await adminDb.runTransaction(async (transaction) => {
      const [portalSnapshot, recommendationSnapshot, existingEvent, rateSnapshot] = await Promise.all([
        transaction.get(portalRef),
        transaction.get(recommendationRef),
        transaction.get(eventRef),
        transaction.get(rateRef),
      ]);
      if (!portalSnapshot.exists) throw new PortalFeedbackError('Portalul nu exista.', 404);
      if (!recommendationSnapshot.exists) throw new PortalFeedbackError('Recomandarea nu exista.', 404);
      if (existingEvent.exists) return { duplicate: true, changed: true };

      const portal = portalSnapshot.data() || {};
      const recommendation = recommendationSnapshot.data() || {};
      const agencyId = typeof portal.agencyId === 'string' ? portal.agencyId : '';
      const contactId = typeof portal.contactId === 'string' ? portal.contactId : '';
      const propertyId = typeof recommendation.propertyId === 'string' ? recommendation.propertyId : '';
      if (!agencyId || !contactId || !propertyId) throw new PortalFeedbackError('Portalul este configurat incomplet.', 409);
      if (agencyId.startsWith('demo-')) throw new PortalFeedbackError('Feedbackul extern este dezactivat in modul demo.', 403);

      const now = Timestamp.now();
      const rate = rateSnapshot.data() || {};
      const windowStartedAt = rate.windowStartedAt instanceof Timestamp ? rate.windowStartedAt : null;
      const insideWindow = Boolean(windowStartedAt && now.toMillis() - windowStartedAt.toMillis() < 5 * 60_000);
      const requestCount = insideWindow ? Number(rate.requestCount || 0) : 0;
      if (requestCount >= 30) throw new PortalFeedbackError('Prea multe actualizari. Incearca din nou peste cateva minute.', 429);

      const contactRef = adminDb.collection('agencies').doc(agencyId).collection('contacts').doc(contactId);
      const propertyRef = adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId);
      const [contactSnapshot, propertySnapshot] = await Promise.all([
        transaction.get(contactRef),
        transaction.get(propertyRef),
      ]);
      if (!contactSnapshot.exists || !propertySnapshot.exists) {
        throw new PortalFeedbackError('Datele asociate portalului nu mai sunt disponibile.', 404);
      }

      const oldFeedback = typeof recommendation.clientFeedback === 'string' ? recommendation.clientFeedback : 'none';
      const oldComment = typeof recommendation.clientComment === 'string' ? recommendation.clientComment : '';
      const nextFeedback = input.clientFeedback ?? oldFeedback;
      const nextComment = input.clientComment !== undefined ? input.clientComment.trim() : oldComment;
      const feedbackChanged = input.clientFeedback !== undefined && nextFeedback !== oldFeedback;
      const commentChanged = input.clientComment !== undefined && nextComment !== oldComment;
      if (!feedbackChanged && !commentChanged) return { duplicate: false, changed: false };

      const recommendationUpdate: Record<string, unknown> = {};
      const historyEntry: Record<string, unknown> = {};
      if (input.clientFeedback !== undefined) {
        recommendationUpdate.clientFeedback = nextFeedback;
        historyEntry.clientFeedback = nextFeedback;
      }
      if (input.clientComment !== undefined) {
        recommendationUpdate.clientComment = nextComment;
        historyEntry.clientComment = nextComment;
      }

      const property = propertySnapshot.data() || {};
      const contact = contactSnapshot.data() || {};
      const changeKind = feedbackChanged && commentChanged ? 'feedback_and_comment' : commentChanged ? 'comment' : 'feedback';
      const commentAction = !commentChanged ? null : !nextComment ? 'deleted' : oldComment ? 'edited' : 'added';

      transaction.update(recommendationRef, recommendationUpdate);
      transaction.set(contactRef, {
        recommendationHistory: { [input.recommendationId]: historyEntry },
      }, { merge: true });
      transaction.set(rateRef, {
        windowStartedAt: insideWindow ? windowStartedAt : now,
        requestCount: requestCount + 1,
        updatedAt: now,
        expiresAt: Timestamp.fromMillis(now.toMillis() + 24 * 60 * 60_000),
      }, { merge: true });
      transaction.create(eventRef, {
        type: 'client_portal.feedback_updated', schemaVersion: 1, agencyId,
        entityType: 'portalRecommendation', entityId: input.recommendationId,
        sourceEventId: `portal-feedback:${input.clientEventId}`, sourceUpdateTime: null,
        occurredAt: now, priority: 'info',
        payload: {
          portalId, recommendationId: input.recommendationId, contactId,
          contactName: typeof contact.name === 'string' ? contact.name : portal.contactName || 'Client',
          propertyId, propertyTitle: typeof property.title === 'string' ? property.title : 'Proprietate',
          feedback: nextFeedback, previousFeedback: oldFeedback,
          comment: nextComment, previousComment: oldComment, changeKind, commentAction,
        },
        status: 'pending', attemptCount: 0, nextAttemptAt: now,
        leaseOwner: null, leaseUntil: null, lastError: null, completedAt: null,
        expiresAt: Timestamp.fromMillis(now.toMillis() + 90 * 24 * 60 * 60_000),
      });
      return { duplicate: false, changed: true };
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Feedback invalid.' }, { status: 400 });
    const status = error instanceof PortalFeedbackError ? error.status : 500;
    console.error('Client portal feedback update failed:', error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Feedbackul nu a putut fi salvat.' },
      { status },
    );
  }
}
