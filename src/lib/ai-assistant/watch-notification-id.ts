import { createHash } from 'node:crypto';
import type { Transaction } from 'firebase-admin/firestore';
import type { AssistantContext } from './access';

// The worker supplies its current policy. Include withdrawn deliveries when repetition is disabled.
export async function priorWatchNotification(ctx: AssistantContext, tx: Transaction, automationId: string, entityId: string, repeatAlerts?: boolean) {
  if (repeatAlerts !== false) return null;
  const found = await tx.get(ctx.adminDb.collection('users').doc(ctx.uid).collection('notifications')
    .where('agencyId', '==', ctx.agencyId).where('automationId', '==', automationId).where('entityId', '==', entityId).limit(1));
  return found.docs[0]?.id || null;
}

// A deferred or recovered execution retains runCount, so it retains these IDs too.
export function watchNotificationId(automationId: string, entityId: string, run: number, repeatAlerts: boolean) {
  if (!Number.isSafeInteger(run) || run < 1) throw new Error('Execuția monitorizării este invalidă.');
  return repeatAlerts
    ? `watch-${createHash('sha256').update(JSON.stringify([automationId, run, entityId])).digest('hex')}`
    : `${automationId}-${entityId}`;
}
