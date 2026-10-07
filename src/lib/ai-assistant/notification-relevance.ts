import { z } from 'zod';
import { idSchema } from './contracts';
import { canReadResource, collectionFor, type AssistantContext } from './access';
import { insightConditionSchema, readInsightRelevance } from './insight-relevance';
import { matchingConditionSchema, readMatchingRelevance } from './matching-notifications';

export const ruleConditionSchema = z.object({
  resource: z.enum(['contacts', 'properties', 'viewings', 'sales', 'ownerListingFavorites']),
  id: idSchema,
  status: z.string().min(1).max(200),
}).strict();
export const reconcileNotificationsSchema = z.object({ ids: z.array(idSchema).min(1).max(100) }).strict();

// Only server-persisted bindings determine relevance. Caller-supplied IDs are confined to its own inbox.
export async function reconcileRuleNotifications(ctx: AssistantContext, input: unknown) {
  const { ids } = reconcileNotificationsSchema.parse(input);
  let withdrawn = 0;
  for (const id of new Set(ids)) {
    const ref = ctx.adminDb.collection('users').doc(ctx.uid).collection('notifications').doc(id);
    const changed = await ctx.adminDb.runTransaction(async tx => {
      const member = await tx.get(ctx.adminDb.collection('users').doc(ctx.uid));
      if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) {
        throw Object.assign(new Error('Accesul la notificări s-a schimbat.'), { status: 403 });
      }
      const snapshot = await tx.get(ref), row = snapshot.data();
      if (!row || row.type !== 'ai_assistant' || row.recipientId !== ctx.uid || row.agencyId !== ctx.agencyId || row.withdrawnAt) return false;
      if (!row.automationId) return false;
      let reason: 'entity_deleted' | 'access_revoked' | 'state_changed' | null;
      if (row.matchingCondition !== undefined) {
        const condition = matchingConditionSchema.safeParse(row.matchingCondition);
        if (!condition.success) return false;
        reason = await readMatchingRelevance(ctx, tx, condition.data);
      } else if (row.insightCondition !== undefined) {
        const condition = insightConditionSchema.safeParse(row.insightCondition);
        if (!condition.success) return false;
        reason = await readInsightRelevance(ctx, tx, condition.data);
      } else {
        const condition = ruleConditionSchema.safeParse(row.ruleCondition);
        if (!condition.success || !row.sourceEventId) return false;
        const entity = await tx.get(collectionFor(ctx, condition.data.resource).doc(condition.data.id));
        reason = !entity.exists ? 'entity_deleted'
          : !canReadResource(ctx, condition.data.resource, entity.data()!) ? 'access_revoked'
            : entity.data()!.status !== condition.data.status ? 'state_changed' : null;
      }
      if (!reason) return false;
      tx.update(ref, { withdrawnAt: new Date().toISOString(), withdrawalReason: reason, isRead: true });
      return true;
    });
    if (changed) withdrawn++;
  }
  return { checked: new Set(ids).size, withdrawn };
}
