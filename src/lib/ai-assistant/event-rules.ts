import { assertAutomationFence } from '@/lib/crm/automation-fence';
import { createHash } from 'node:crypto';
import { FieldPath } from 'firebase-admin/firestore';
import { collectionFor, canReadResource, getResource, type AssistantContext } from './access';
import { automationSchema, safeData, type AssistantAction } from './contracts';
import type { z } from 'zod';

export type EventRule = Extract<z.infer<typeof automationSchema>, { type: 'event_rule' }>;
type RuleEvent = Record<string, any>;
const ids: Record<string, string> = { contacts: 'contactId', properties: 'propertyId', viewings: 'viewingId', sales: 'saleId', ownerListingFavorites: 'listingId' };
export function matchesRuleEvent(rule: EventRule, event: RuleEvent, startedAt: string) {
  if (event.source !== 'firestore_change' || event.capability !== `${rule.trigger.resource}.${rule.trigger.change}` || event.occurredAt < startedAt) return false;
  if (!event.occurredAt || !event.recordedAt || !event.entities?.[ids[rule.trigger.resource]]) return false;
  if (rule.trigger.recordId && event.entities[ids[rule.trigger.resource]] !== rule.trigger.recordId) return false;
  if (rule.trigger.changedFields && !rule.trigger.changedFields.some(field => event.changedFields?.includes(field))) return false;
  if (rule.trigger.statusFrom !== undefined && event.ruleState?.before?.status !== rule.trigger.statusFrom) return false;
  if (rule.trigger.statusTo !== undefined && event.ruleState?.after?.status !== rule.trigger.statusTo) return false;
  return true;
}

// Effects are bounded internal operations. No arbitrary handler, consent, send or publication.
// Only projections drive rules, so a native audit plus its Firestore projection cannot fire twice.
export async function runEventRule(ctx: AssistantContext, claim: Record<string, any>, rule: EventRule,
  execute: (ctx: AssistantContext, action: AssistantAction, key: string) => Promise<any>, assertLease: () => Promise<void>) {
  const startedAt = claim.ruleStartedAt || claim.createdAt;
  let query = collectionFor(ctx, 'crmEvents').where('recordedAt', '>=', startedAt).orderBy('recordedAt').orderBy(FieldPath.documentId()).limit(100);
  if (claim.eventCursor?.recordedAt && claim.eventCursor?.id) query = query.startAfter(claim.eventCursor.recordedAt, claim.eventCursor.id);
  const page = await query.get();
  let cursor = claim.eventCursor || null, eventCount = Number(claim.eventCount || 0), handled = 0, inaccessible = 0;
  for (const doc of page.docs) {
    await assertLease();
    const event: RuleEvent = { ...doc.data(), id: doc.id };
    if (matchesRuleEvent(rule, event, startedAt) && eventCount < rule.maxEvents) {
      const targetId = event.entities[ids[rule.trigger.resource]];
      let current: Record<string, any> | null = null;
      if (canReadResource(ctx, 'crmEvents', event)) {
        try { current = await getResource(ctx, rule.trigger.resource, targetId); }
        catch (error) { if ([403, 404].includes(Number((error as { status?: number; statusCode?: number }).status || (error as { statusCode?: number }).statusCode))) inaccessible++; else throw error; }
      } else inaccessible++;
      if (current) {
        // A status rule must still be relevant at execution, after delayed/out-of-order delivery.
        if (rule.trigger.statusTo === undefined || current.status === rule.trigger.statusTo) {
          const receiptId = createHash('sha256').update(`${claim.id}:${doc.id}`).digest('hex');
          const receipt = collectionFor(ctx, 'assistantAutomations').doc(claim.id).collection('events').doc(receiptId);
          if (!(await receipt.get()).exists) {
            const results: unknown[] = [];
            for (const [index, effect] of rule.effects.entries()) {
              await assertLease();
              const key = `rule-${receiptId}-${index}`;
              if (effect.kind === 'create_task') {
                const contactId = rule.trigger.resource === 'contacts' ? targetId : current.contactId;
                const propertyId = rule.trigger.resource === 'properties' ? targetId : current.propertyId;
                const dueDate = new Date(Date.parse(event.occurredAt) + effect.dueAfterMinutes * 60000).toISOString();
                results.push(await execute(ctx, { kind: 'create_task', description: effect.description, dueDate, ...(effect.agentId ? { agentId: effect.agentId } : {}), ...(contactId ? { contactId } : {}), ...(propertyId ? { propertyId } : {}) }, key));
              } else {
                const notification = ctx.adminDb.collection('users').doc(ctx.uid).collection('notifications').doc(key);
                await ctx.adminDb.runTransaction(async tx => {
                  await assertAutomationFence(ctx.adminDb, tx, ctx);
                  const member = await tx.get(ctx.adminDb.collection('users').doc(ctx.uid)), existing = await tx.get(notification), entity = await tx.get(collectionFor(ctx, rule.trigger.resource).doc(targetId));
                  if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new Error('Permisiunile automatizării au fost revocate.');
                  if (!entity.exists || !canReadResource(ctx, rule.trigger.resource, entity.data()!)) throw new Error('Accesul la entitatea regulii a fost revocat.');
                  if (!existing.exists) tx.create(notification, { eventId: key, recipientId: ctx.uid, agencyId: ctx.agencyId, type: 'ai_assistant', category: 'propertyAssignments', priority: 'action_required', title: effect.title, body: effect.body, actionUrl: '/ai-assistant', entityId: targetId, isRead: false, createdAt: new Date().toISOString(), automationId: claim.id, sourceEventId: doc.id });
                });
                results.push({ notificationId: key });
              }
            }
            await ctx.adminDb.runTransaction(async tx => { await assertAutomationFence(ctx.adminDb, tx, ctx); if (!(await tx.get(receipt)).exists) tx.create(receipt, { id: receiptId, sourceEventId: doc.id, occurredAt: event.occurredAt, completedAt: new Date().toISOString(), effects: safeData(results), actorId: ctx.uid }); });
            handled++;
          }
          // Completed receipts also count after recovery, avoiding exceeding maxEvents.
          eventCount++;
        }
      }
    }
    cursor = { recordedAt: event.recordedAt, id: doc.id };
    if (eventCount >= rule.maxEvents) break;
  }
  return { handled, inaccessible, scanned: page.size, eventCount, eventCursor: cursor, limitReached: eventCount >= rule.maxEvents, complete: page.size < 100, note: page.size === 100 ? 'Alte evenimente vor fi verificate la următoarea execuție.' : 'Evenimente verificate până la cursorul afișat; proiecțiile sosite ulterior sunt procesate la următoarea execuție.' };
}
