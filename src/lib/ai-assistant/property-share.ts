import { createHash } from 'node:crypto';
import { z } from 'zod';
import { collectionFor, getResource, type AssistantContext } from './access';
import { normalized, type AssistantAction, type AssistantMessage } from './contracts';
import { resolveMatchingRecipient } from './matching-recipient';
import { prepareMessage } from './message-preparation';
import { recipientRevision } from '@/lib/communications/recipient-revision';
import { matchingSendSchema, assertMatchingSend } from '@/lib/communications/matching-send';
import { stableId } from '@/lib/communications/crypto';
import { queueMessage } from '@/lib/communications/outbound';
import { operationResult } from './operation-result';
import { latestDraftContext } from './message-draft';
import { selectedInboxConversation } from './inbox-read';

export function propertyShareRequest(prompt: string) {
  const text = normalized(prompt).trim().replace(/[.!?]+$/, '');
  return text === 'trimite proprietatea aceasta clientului' ? 'one' : text === 'trimite primele trei potriviri clientului' ? 'three' : text === 'nu retrimite proprietati deja trimise' ? 'duplicates' : null;
}
export function propertyShareContinuation(prompt: string, history: AssistantMessage[]) {
  const pending = latestDraftContext(history, 'propertyShareInput');
  const match = prompt.match(/^\s*conversa[tțţ]ie\s*:\s*([A-Za-z0-9_.:-]+)\s*$/i);
  if (!pending || !match || !['one', 'three', 'duplicates'].includes(String(pending.mode))) return null;
  const command = pending.mode === 'one' ? 'Trimite proprietatea aceasta clientului.' : pending.mode === 'three' ? 'Trimite primele trei potriviri clientului.' : 'Nu retrimite proprietăți deja trimise.';
  return { command, conversationId: match[1] };
}
export function propertyShareExecutionPrompt(prompt: string, history: AssistantMessage[]) {
  return propertyShareContinuation(prompt, history)?.command || prompt;
}
export function propertyShareAction(action: AssistantAction) {
  return action.kind === 'existing_operation' && action.operation === 'message_send' && Object.keys(action.params).length === 1 && Boolean(action.params.conversationId) && Object.keys(action.query).length === 0 && Object.keys(action.body).length === 1 && matchingSendSchema.safeParse(action.body.matchingShare).success;
}
export async function preparePropertyShares(ctx: AssistantContext, prompt: string, history: AssistantMessage[]) {
  const mode = propertyShareRequest(propertyShareExecutionPrompt(prompt, history));
  if (!mode) return null;
  const latest = history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1);
  const lists = latest?.cards?.filter(card => ['crm', 'properties'].includes(card.source) && card.resultSetId && card.rows.length) || [];
  if (lists.length !== 1 || mode === 'one' && lists[0].rows.length !== 1) throw new Error('Selectează o proprietate sau o singură listă de matching pentru client.');
  const list = lists[0], summary = { selections: [{ messageId: latest!.id, source: list.source, resultSetId: list.resultSetId, orderedIds: list.rows.map(row => row.id) }] };
  const count = mode === 'three' ? Math.min(3, list.rows.length) : mode === 'one' ? 1 : Math.min(100, list.rows.length);
  const actions: AssistantAction[] = [], rows: Record<string, any>[] = [];
  const conversationId = propertyShareContinuation(prompt, history)?.conversationId || selectedInboxConversation(history);
  for (let position = 1; position <= count; position++) {
    const selected = await resolveMatchingRecipient(ctx, summary, { resultSetId: list.resultSetId!, position, ...(conversationId ? { conversationId } : {}) });
    if (!selected.conversationId || !selected.matchingSelection) return { actions: [] as AssistantAction[], rows: [], list, mode, needsRecipient: true, conversations: selected.conversations };
    const binding = selected.matchingSelection;
    const prior = (await collectionFor(ctx, 'communicationPropertyShares').doc(stableId(binding.contactId, binding.propertyId)).get()).data();
    rows.push({ id: binding.propertyId, conversationId: selected.conversationId, contactId: binding.contactId, alreadyQueued: Boolean(prior), messageId: prior?.messageId || null });
    if (!prior && mode !== 'duplicates') actions.push({ kind: 'existing_operation', operation: 'message_send', params: { conversationId: selected.conversationId }, query: {}, body: { matchingShare: binding } });
  }
  return { actions, rows, list, mode, needsRecipient: false, conversations: [] };
}
export async function executePropertyShare(ctx: AssistantContext, action: Extract<AssistantAction, { kind: 'existing_operation' }>, key: string): Promise<Record<string, any>> {
  if (!propertyShareAction(action)) throw new Error('Selecție invalidă.');
  const binding = matchingSendSchema.parse(action.body.matchingShare), conversationId = action.params.conversationId;
  const conversation = await getResource(ctx, 'conversations', conversationId);
  await assertMatchingSend(ctx.adminDb, ctx, conversation, binding);
  const previous = (await collectionFor(ctx, 'communicationPropertyShares').doc(stableId(binding.contactId, binding.propertyId)).get()).data();
  if (previous) {
    const job = (await ctx.adminDb.collection('communicationOutboundJobs').doc(previous.messageId).get()).data();
    return { ...operationResult('message_send', { messageId: previous.messageId, status: job?.status || 'unknown' }), conversationId, propertyId: binding.propertyId, duplicate: true };
  }
  const { executeAction } = await import('./actions');
  const recommendation = await executeAction(ctx, { kind: 'recommend_properties', contactId: binding.contactId, propertyIds: [binding.propertyId] }, key + '-portal');
  const portalId = String((recommendation as Record<string, unknown>).portalId || '');
  const portal = await getResource(ctx, 'portals', portalId);
  const contact = await getResource(ctx, 'contacts', binding.contactId), property = await getResource(ctx, 'properties', binding.propertyId);
  if (portal.contactId !== binding.contactId || contact.portalId !== portalId) throw new Error('Portalul clientului s-a schimbat.');
  const origin = z.string().url().parse(ctx.appOrigin || process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://imodeus.ro');
  const url = new URL('/portal/' + encodeURIComponent(portalId), origin);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Adresă publică invalidă.');
  const text = 'Vă propun proprietatea „' + String(property.title || 'Proprietate') + '”. Detalii și fotografii: ' + url.toString();
  const body = await prepareMessage(ctx, conversationId, { text, matchingSelection: { ...binding, portalId }, preventPropertyResend: true, expectedRecipientRevision: recipientRevision(conversation) });
  const hash = createHash('sha256').update(ctx.agencyId + ':' + key).digest('hex');
  const requestId = hash.slice(0, 8) + '-' + hash.slice(8, 12) + '-4' + hash.slice(13, 16) + '-a' + hash.slice(17, 20) + '-' + hash.slice(20, 32);
  const result = await queueMessage(ctx.adminDb, ctx, conversationId, { ...body, requestId });
  return { ...operationResult('message_send', result), conversationId, propertyId: binding.propertyId, portalId };
}