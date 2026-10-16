import { createHash } from 'node:crypto';
import { collectionFor, getResource, type AssistantContext } from './access';
import { normalized, type AssistantAction, type AssistantMessage } from './contracts';
import { canReadConversation, type Conversation } from '@/lib/communications/model';
import { recipientRevision, assertRecipientRevision } from '@/lib/communications/recipient-revision';
import { prepareMessage } from './message-preparation';
import { queueMessage } from '@/lib/communications/outbound';
import { operationResult } from './operation-result';
import { assertAutomationFence } from '@/lib/crm/automation-fence';

export function messageDraftCommand(prompt: string) {
  const text = normalized(prompt).trim().replace(/[.!?]+$/, '');
  if (text === 'arata-mi preview-ul mesajului inainte') return 'preview';
  if (text === 'trimite mesajul aprobat') return 'send';
  if (text === 'nu trimite raspunsurile inca') return 'hold';
  return null;
}
export function draftPreparationRequest(prompt: string) {
  const colon = prompt.indexOf(':');
  const head = (colon < 0 ? prompt : prompt.slice(0, colon)).trim().replace(/[.!?]+$/, '');
  const match = normalized(head).match(/^pregateste mesajul pentru (.+)$/);
  return match ? { name: match[1], text: colon < 0 ? '' : prompt.slice(colon + 1).trim() } : null;
}
export function latestDraftContext(history: AssistantMessage[], source: string) {
  const latest = history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1);
  const rows = latest?.cards?.filter(card => card.source === source).flatMap(card => card.rows) || [];
  return rows.length === 1 ? rows[0] : null;
}
const validId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 180 && !value.includes('/');
export function draftSendAction(action: AssistantAction) {
  return action.kind === 'existing_operation' && action.operation === 'message_send' && Object.keys(action.query).length === 0 && Object.keys(action.params).length === 1 && validId(action.params.conversationId) && Object.keys(action.body).length === 2 && validId(action.body.assistantDraftId) && validId(action.body.assistantSessionId);
}
export async function getMessageDraft(ctx: AssistantContext, sessionId: string, draftId: string) {
  if (!validId(sessionId) || !validId(draftId)) throw new Error('Ciornă invalidă.');
  const session = collectionFor(ctx, 'assistantSessions').doc(sessionId);
  if ((await session.get()).data()?.ownerId !== ctx.uid) throw new Error('Ciorna nu îți aparține.');
  const ref = session.collection('outboundDrafts').doc(draftId), snap = await ref.get(), row = snap.data();
  if (!row || row.ownerId !== ctx.uid) throw new Error('Ciorna nu este disponibilă.');
  const conversation = await getResource(ctx, 'conversations', row.conversationId);
  assertRecipientRevision(conversation, row.body.expectedRecipientRevision);
  return { ref, row, conversation };
}
export async function createMessageDraft(ctx: AssistantContext, conversationId: string, text: string) {
  if (!text.trim() || text.trim().length > 4000) throw new Error('Textul trebuie să conțină între 1 și 4000 de caractere.');
  const request = ctx.prospectingRequest;
  if (!request) throw new Error('Pregătirea necesită o cerere de chat persistentă.');
  const session = collectionFor(ctx, 'assistantSessions').doc(request.sessionId);
  const draftId = createHash('sha256').update(`${ctx.uid}:${request.requestId}`).digest('hex');
  const ref = session.collection('outboundDrafts').doc(draftId);
  const conversation = await getResource(ctx, 'conversations', conversationId);
  const expectedRecipientRevision = recipientRevision(conversation);
  const body = await prepareMessage(ctx, conversationId, { text: text.trim(), expectedRecipientRevision });
  const row = { ownerId: ctx.uid, conversationId, body, status: 'prepared', createdAt: new Date().toISOString() };
  await ctx.adminDb.runTransaction(async tx => {
    await assertAutomationFence(ctx.adminDb, tx, ctx);
    const [parent, member, fresh, prior] = await Promise.all([tx.get(session), tx.get(ctx.adminDb.collection('users').doc(ctx.uid)), tx.get(collectionFor(ctx, 'conversations').doc(conversationId)), tx.get(ref)]);
    if (!['agent', 'admin'].includes(ctx.role || '') || parent.data()?.ownerId !== ctx.uid || member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role || !fresh.exists || !canReadConversation(ctx, { ...fresh.data(), collaboratorIds: fresh.data()?.collaboratorIds || [] } as Conversation)) throw new Error('Acces revocat.');
    assertRecipientRevision({ ...fresh.data(), id: conversationId }, expectedRecipientRevision);
    if (prior.exists) { if (prior.data()?.conversationId !== conversationId || prior.data()?.body.text !== text.trim()) throw new Error('Cererea a fost folosită pentru altă ciornă.'); return; }
    tx.create(ref, row);
  });
  return { draftId, sessionId: request.sessionId, ...(await getMessageDraft(ctx, request.sessionId, draftId)) };
}
export async function executeDraftSend(ctx: AssistantContext, action: Extract<AssistantAction, { kind: 'existing_operation' }>) {
  if (!draftSendAction(action)) throw new Error('Trimiterea ciornei este invalidă.');
  const { ref, row } = await getMessageDraft(ctx, String(action.body.assistantSessionId), String(action.body.assistantDraftId));
  const member = (await ctx.adminDb.collection('users').doc(ctx.uid).get()).data();
  if (!['agent', 'admin'].includes(ctx.role || '') || member?.agencyId !== ctx.agencyId || member?.role !== ctx.role || row.conversationId !== action.params.conversationId) throw new Error('Acces revocat sau destinatar schimbat.');
  // One stable domain request per saved draft, even across distinct chat requests or interrupted replies.
  const hash = createHash('sha256').update(ref.path).digest('hex');
  const requestId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  const result = await queueMessage(ctx.adminDb, ctx, row.conversationId, { ...row.body, requestId });
  if (!('messageId' in result) || !result.messageId) throw new Error('Mesajul nu a fost confirmat în coadă.');
  await ref.update({ status: 'queued', messageId: result.messageId });
  return { ...operationResult('message_send', result), conversationId: row.conversationId };
}