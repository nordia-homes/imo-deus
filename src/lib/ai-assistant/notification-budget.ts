import { createHash } from 'node:crypto';
import type { Transaction } from 'firebase-admin/firestore';
import { collectionFor, type AssistantContext } from './access';
import { insightNotificationBudget, INSIGHT_NOTIFICATION_LIMIT } from './insight-notification-policy';

// Reports and watches serialize against the same actor/agency budget document.
// Call consume only after every transaction read has completed.
export async function readNotificationBudget(ctx: AssistantContext, tx: Transaction) {
  const ref = collectionFor(ctx, 'assistantNotificationState').doc(`budget-${createHash('sha256').update(ctx.uid).digest('hex')}`);
  const snapshot = await tx.get(ref), now = Date.now();
  const budget = insightNotificationBudget(snapshot.exists ? snapshot.data()?.deliveries : [], now);
  return {
    now, nextEligibleAt: budget.nextEligibleAt,
    deferred: budget.nextEligibleAt ? { status: 'deferred' as const, reasonCode: 'notification_cap' as const, deferredUntil: budget.nextEligibleAt, limit: INSIGHT_NOTIFICATION_LIMIT, windowHours: 24 } : null,
    consume() {
      if (budget.nextEligibleAt) throw new Error('Plafonul de notificări a fost atins.');
      const patch = { actorId: ctx.uid, deliveries: [...budget.deliveries, now] };
      if (snapshot.exists) tx.update(ref, patch); else tx.create(ref, patch);
    },
  };
}
