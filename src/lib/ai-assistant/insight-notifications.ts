import { createHash } from 'node:crypto';
import { assertAutomationFence } from '@/lib/crm/automation-fence';
import { collectionFor, type AssistantContext } from './access';
import { insightConditionFor, readInsightRelevance } from './insight-relevance';

export async function createInsightNotification(ctx: AssistantContext, automationId: string, id: string, row: Record<string, any>, legacyId?: string) {
  const condition = insightConditionFor(row);
  const notification = ctx.adminDb.collection('users').doc(ctx.uid).collection('notifications').doc(id);
  const receipt = collectionFor(ctx, 'assistantAutomations').doc(automationId).collection('insightEffects').doc(createHash('sha256').update(id).digest('hex'));
  return ctx.adminDb.runTransaction(async tx => {
    await assertAutomationFence(ctx.adminDb, tx, ctx);
    const member = await tx.get(ctx.adminDb.collection('users').doc(ctx.uid));
    if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new Error('Permisiunile automatizării s-au schimbat.');
    const prior = await tx.get(receipt), existing = await tx.get(notification);
    if (prior.exists) return prior.data()!;
    if (existing.exists) return { status: 'existing', notificationId: id };
    // A resumed pre-migration run may already have delivered under its former deterministic ID.
    if (legacyId && legacyId !== id) {
      const legacy = await tx.get(ctx.adminDb.collection('users').doc(ctx.uid).collection('notifications').doc(legacyId));
      if (legacy.exists) return { status: 'existing', notificationId: legacyId };
    }
    const reason = await readInsightRelevance(ctx, tx, condition);
    const result = reason ? { status: 'skipped', reasonCode: reason } : { status: 'created', notificationId: id };
    if (!reason) tx.create(notification, { eventId: id, recipientId: ctx.uid, agencyId: ctx.agencyId, type: 'ai_assistant', category: 'propertyAssignments', priority: 'action_required', title: String(row.title), body: 'Verifică insight-ul în AI Assistant.', actionUrl: '/ai-assistant', entityId: row.id, isRead: false, createdAt: new Date().toISOString(), automationId, insightCondition: condition });
    tx.create(receipt, result);
    return result;
  });
}
