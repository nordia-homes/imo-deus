import { z } from 'zod';
import type { Transaction } from 'firebase-admin/firestore';
import { idSchema, overlaps } from './contracts';
import { canReadResource, collectionFor, type AssistantContext } from './access';

export const insightConditionSchema = z.object({
  kind: z.enum(['lead', 'task', 'sale', 'reply', 'meta', 'tiktok', 'call', 'conflict']),
  id: idSchema,
  otherId: idSchema.optional(),
}).strict().refine(value => value.kind === 'conflict' ? Boolean(value.otherId && value.otherId !== value.id) : value.otherId === undefined);
export type InsightCondition = z.infer<typeof insightConditionSchema>;
const resources = { lead: 'contacts', task: 'tasks', sale: 'sales', reply: 'conversations', meta: 'metaCampaignDrafts', tiktok: 'tiktokPostDrafts', call: 'aiOutreachCalls', conflict: 'viewings' } as const;

export function insightConditionFor(row: Record<string, any>): InsightCondition {
  const condition = row.taskId ? { kind: 'task', id: row.taskId }
    : row.contactId ? { kind: 'lead', id: row.contactId }
      : row.saleId ? { kind: 'sale', id: row.saleId }
        : row.conversationId ? { kind: 'reply', id: row.conversationId }
          : row.callId ? { kind: 'call', id: row.callId }
            : row.viewingIds ? { kind: 'conflict', id: row.viewingIds[0], otherId: row.viewingIds[1] }
              : { kind: row.source === 'metaCampaignDrafts' ? 'meta' : row.source === 'tiktokPostDrafts' ? 'tiktok' : undefined, id: row.draftId };
  return insightConditionSchema.parse(condition);
}

// Shared by report generation, notification creation and subsequent withdrawal.
export function insightStillRelevant(kind: InsightCondition['kind'], rows: Record<string, any>[], uid: string, now: number) {
  const [row, other] = rows;
  if (!row) return false;
  switch (kind) {
    case 'lead': return row.status === 'Nou' && !row.archivedAt && Date.parse(String(row.createdAt)) <= now - 48 * 3600000 && !row.interactionHistory?.length;
    case 'task': return row.status === 'open' && row.agentId === uid && Date.parse(String(row.dueDate)) < now;
    case 'sale': return !['completed', 'cancelled'].includes(row.stage) && (row.stage === 'blocked' || Date.parse(String(row.nextActionAt)) < now);
    case 'reply': {
      const inbound = Date.parse(String(row.lastInboundAt)), outbound = Date.parse(String(row.lastOutboundAt));
      return !['closed', 'resolved', 'spam', 'snoozed'].includes(row.status) && Boolean(row.needsReply) && Number.isFinite(inbound)
        && inbound <= now - 24 * 3600000 && (!row.lastOutboundAt || inbound > outbound);
    }
    case 'meta': case 'tiktok': return ['error', 'failed'].includes(row.status) || Boolean(row.publishOutcomeUnknown || row.manualReviewRequired);
    case 'call': return row.providerErrorCode === 'vapi_create_unknown';
    case 'conflict': return Boolean(other && [row, other].every(item => item.status === 'scheduled' && Date.parse(String(item.viewingDate)) > now)
      && ['agentId', 'contactId', 'propertyId'].some(field => row[field] && row[field] === other[field])
      && overlaps(String(row.viewingDate), Number(row.duration || 60), String(other.viewingDate), Number(other.duration || 60)));
  }
}

export async function readInsightRelevance(ctx: AssistantContext, tx: Transaction, condition: InsightCondition, now = Date.now()) {
  const resource = resources[condition.kind], rows: Record<string, any>[] = [];
  for (const id of [condition.id, ...(condition.otherId ? [condition.otherId] : [])]) {
    const entity = await tx.get(collectionFor(ctx, resource).doc(id));
    if (!entity.exists) return 'entity_deleted' as const;
    if (!canReadResource(ctx, resource, entity.data()!)) return 'access_revoked' as const;
    rows.push(entity.data()!);
  }
  return insightStillRelevant(condition.kind, rows, ctx.uid, now) ? null : 'state_changed' as const;
}
