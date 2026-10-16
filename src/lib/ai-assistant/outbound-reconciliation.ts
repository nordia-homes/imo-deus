import { z } from 'zod';
import { collectionFor, getResource, type AssistantContext } from './access';
import { normalized, type AssistantAction } from './contracts';
import { canReadConversation, type Conversation } from '@/lib/communications/model';
import { reconcileOutboundMessage } from '@/lib/communications/outbound';
import { operationResult } from './operation-result';
import { MAX_PLAN_ACTIONS } from './plan-limits';

const bodySchema = z.object({ reconcileMessageIds: z.array(z.string().regex(/^[A-Za-z0-9_.:-]{1,180}$/)).min(1).max(100) }).strict();
export function reconciliationRequest(prompt: string) {
  return normalized(prompt).trim().replace(/[.!?]+$/, '') === 'reconciliaza mesajele cu rezultat necunoscut';
}
export function reconciliationAction(action: AssistantAction) {
  return action.kind === 'existing_operation' && action.operation === 'message_send' && Object.keys(action.params).length === 1 && Boolean(action.params.conversationId) && Object.keys(action.query).length === 0 && bodySchema.safeParse(action.body).success;
}
export async function prepareReconciliation(ctx: AssistantContext) {
  const jobs = await ctx.adminDb.collection('communicationOutboundJobs').where('agencyId', '==', ctx.agencyId).get();
  const grouped = new Map<string, string[]>();
  for (const job of jobs.docs) {
    const row = job.data();
    if (row.status !== 'unknown' || typeof row.conversationId !== 'string') continue;
    const ids = grouped.get(row.conversationId) || []; ids.push(job.id); grouped.set(row.conversationId, ids);
  }
  const actions: AssistantAction[] = []; let remaining = 0;
  for (const [conversationId, ids] of grouped) {
    const conversation = (await collectionFor(ctx, 'conversations').doc(conversationId).get()).data();
    if (!conversation || !canReadConversation(ctx, { ...conversation, collaboratorIds: conversation.collaboratorIds || [] } as Conversation)) continue;
    await getResource(ctx, 'conversations', conversationId);
    for (let i = 0; i < ids.length; i += 100) {
      const batch = ids.slice(i, i + 100);
      if (actions.length >= MAX_PLAN_ACTIONS) { remaining += batch.length; continue; }
      actions.push({ kind: 'existing_operation', operation: 'message_send', params: { conversationId }, query: {}, body: { reconcileMessageIds: batch } });
    }
  }
  return { actions, remaining };
}
export async function executeReconciliation(ctx: AssistantContext, action: Extract<AssistantAction, { kind: 'existing_operation' }>) {
  if (!reconciliationAction(action)) throw new Error('Selecție invalidă pentru reconciliere.');
  const { reconcileMessageIds } = bodySchema.parse(action.body);
  const rows = [];
  for (const id of new Set(reconcileMessageIds)) rows.push(await reconcileOutboundMessage(ctx.adminDb, ctx, action.params.conversationId, id));
  const unresolved = rows.filter(row => row.unresolved).length;
  return { ...operationResult('message_send', { status: unresolved ? 'partial' : 'completed' }), reconciliation: true, conversationId: action.params.conversationId, rows, reconciled: rows.filter(row => row.reconciled).length, unresolved };
}