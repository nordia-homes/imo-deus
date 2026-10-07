import { notificationTransactionReads } from './notification-transaction';
import { z } from 'zod';
import type { Transaction } from 'firebase-admin/firestore';
import { assertAutomationFence } from '@/lib/crm/automation-fence';
import { canReadResource, collectionFor, type AssistantContext } from './access';
import { idSchema } from './contracts';
import { matchingRevision } from './matching-revision';
import { insightQuietDeferral, type InsightQuietHours } from './insight-notification-policy';
import { readNotificationBudget } from './notification-budget';

export const matchingConditionSchema = z.object({ contactId: idSchema, propertyId: idSchema, contactRevision: z.string().regex(/^[a-f0-9]{64}$/), propertyRevision: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export async function readMatchingRelevance(ctx: AssistantContext, tx: Transaction, condition: z.infer<typeof matchingConditionSchema>) {
  const contact = await tx.get(collectionFor(ctx, 'contacts').doc(condition.contactId));
  const property = await tx.get(collectionFor(ctx, 'properties').doc(condition.propertyId));
  if (!contact.exists || !property.exists) return 'entity_deleted' as const;
  const c = contact.data()!, p = property.data()!;
  if (!canReadResource(ctx, 'contacts', c) || !canReadResource(ctx, 'properties', p)) return 'access_revoked' as const;
  if (p.status !== 'Activ' || c.archivedAt || ['Câștigat', 'Pierdut'].includes(c.status)
    || matchingRevision(c) !== condition.contactRevision || matchingRevision(p) !== condition.propertyRevision) return 'state_changed' as const;
  return null;
}

export async function createMatchingNotification(ctx: AssistantContext, automationId: string, id: string, contactId: string, row: Record<string, any>, quietHours?: InsightQuietHours) {
  const condition = matchingConditionSchema.parse({ contactId, propertyId: row.id, contactRevision: row.sourceContactRevision, propertyRevision: row.matchingRevision });
  const ref = ctx.adminDb.collection('users').doc(ctx.uid).collection('notifications').doc(id);
  return ctx.adminDb.runTransaction(async rawTx => {
    const tx = notificationTransactionReads(rawTx);
    await assertAutomationFence(ctx.adminDb, tx, ctx);
    const member = await tx.get(ctx.adminDb.collection('users').doc(ctx.uid));
    if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new Error('Permisiunile automatizării s-au schimbat.');
    if ((await tx.get(ref)).exists) return { status: 'existing', notificationId: id };
    const quiet = insightQuietDeferral(quietHours);
    if (quiet) return quiet;
    const reason = await readMatchingRelevance(ctx, tx, condition);
    if (reason) return { status: 'skipped', reasonCode: reason };
    const budget = await readNotificationBudget(ctx, tx);
    const quietAfterReads = insightQuietDeferral(quietHours, budget.now);
    if (quietAfterReads) return quietAfterReads;
    if (budget.deferred) return budget.deferred;
    budget.consume();
    tx.create(ref, { eventId: id, recipientId: ctx.uid, agencyId: ctx.agencyId, type: 'ai_assistant', category: 'propertyAssignments', priority: 'action_required', title: 'Potrivire ImoDeus peste pragul configurat', body: String(row.title), actionUrl: '/ai-assistant', entityId: row.id, isRead: false, createdAt: new Date().toISOString(), automationId, matchingCondition: condition });
    return { status: 'created', notificationId: id };
  });
}
