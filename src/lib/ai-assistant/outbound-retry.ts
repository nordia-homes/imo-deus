import { z } from 'zod';
import { collectionFor, getResource, type AssistantContext } from './access';
import { normalized, type AssistantAction } from './contracts';
import { canReadConversation, type Conversation } from '@/lib/communications/model';
import { retryOutboundMessage, safeToRetryOutbound } from '@/lib/communications/outbound';
import { operationResult } from './operation-result';
import { MAX_PLAN_ACTIONS } from './plan-limits';
const bodySchema = z.object({ retryMessageId: z.string().regex(/^[A-Za-z0-9_.:-]{1,180}$/), failureId: z.string().uuid() }).strict();
export function outboundRetryRequest(prompt: string) {
  return normalized(prompt).trim().replace(/[.!?]+$/, '') === 'reincearca doar cele safe-to-retry';
}
export function outboundRetryAction(action: AssistantAction) {
  return action.kind === 'existing_operation' && action.operation === 'message_send' && Object.keys(action.params).length === 1 && Boolean(action.params.conversationId) && Object.keys(action.query).length === 0 && bodySchema.safeParse(action.body).success;
}
export async function prepareOutboundRetry(ctx: AssistantContext) {
  const jobs = await ctx.adminDb.collection('communicationOutboundJobs').where('agencyId', '==', ctx.agencyId).get();
  const actions: AssistantAction[] = []; let excluded = 0, remaining = 0;
  for (const job of jobs.docs) {
    const row = job.data();
    if (!['failed', 'unknown'].includes(row.status) || typeof row.conversationId !== 'string') continue;
    const conversation = (await collectionFor(ctx, 'conversations').doc(row.conversationId).get()).data();
    if (!conversation || !canReadConversation(ctx, { ...conversation, collaboratorIds: conversation.collaboratorIds || [] } as Conversation)) continue;
    await getResource(ctx, 'conversations', row.conversationId);
    if (!safeToRetryOutbound(row)) { excluded++; continue; }
    if (actions.length >= MAX_PLAN_ACTIONS) { remaining++; continue; }
    actions.push({ kind: 'existing_operation', operation: 'message_send', params: { conversationId: row.conversationId }, query: {}, body: { retryMessageId: job.id, failureId: row.failureId } });
  }
  return { actions, excluded, remaining };
}
export async function executeOutboundRetry(ctx: AssistantContext, action: Extract<AssistantAction, { kind: 'existing_operation' }>) {
  if (!outboundRetryAction(action)) throw new Error('Selecție invalidă pentru reluare.');
  const body = bodySchema.parse(action.body);
  try {
    const result = await retryOutboundMessage(ctx.adminDb, ctx, action.params.conversationId, body.retryMessageId, body.failureId);
    return { ...operationResult('message_send', result), retry: true, conversationId: action.params.conversationId };
  } catch {
    // One unavailable recipient must not prevent independent eligible retries.
    return { ...operationResult('message_send', { status: 'failed', messageId: body.retryMessageId }), retry: true, requeued: false, retryBlocked: true, conversationId: action.params.conversationId };
  }
}