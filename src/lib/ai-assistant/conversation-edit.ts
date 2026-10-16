import type { AssistantAction, AssistantMessage } from './contracts';
import { normalized } from './contracts';
import { collectionFor, type AssistantContext } from './access';
import { canReadConversation, type Conversation } from '@/lib/communications/model';
import { CommunicationError } from '@/lib/communications/server';
import { assertAutomationFence } from '@/lib/crm/automation-fence';
import { payloadHash } from './approval';
export const EDIT_COMMANDS = { note: 'Adaugă o notă internă conversației', assign: 'Atribuie conversația unui agent dacă am permisiune', property: 'Leagă conversația de proprietatea corectă' };
export type ConversationEdit = keyof typeof EDIT_COMMANDS;
export function conversationEditRequest(prompt: string): { mode: ConversationEdit; value: string } | null {
  for (const [mode, command] of Object.entries(EDIT_COMMANDS)) {
    const colon = prompt.indexOf(':');
    const head = (colon < 0 ? prompt : prompt.slice(0, colon)).trim().replace(/[.!?]+$/, '');
    if (normalized(head) === normalized(command)) return { mode: mode as ConversationEdit, value: colon < 0 ? '' : prompt.slice(colon + 1).trim() };
  }
  return null;
}
export function conversationEditPrompt(prompt: string, history: AssistantMessage[]) {
  if (conversationEditRequest(prompt)) return prompt;
  const latest = history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1);
  const pending = latest?.cards?.find(card => card.source === 'conversationEditRequest')?.rows;
  const mode = pending?.length === 1 ? pending[0].mode : null;
  if (typeof mode !== 'string' || !Object.hasOwn(EDIT_COMMANDS, mode) || !prompt.trim() || /^(anuleaza|renunta|stop|nu|continua)[.!?\s]*$/.test(normalized(prompt))) return prompt;
  // Only the immediately pending edit accepts a value. The value remains literal data.
  return `${EDIT_COMMANDS[mode as ConversationEdit]}: ${prompt}`;
}
export function simpleConversationEdit(action: AssistantAction) {
  if (action.kind !== 'existing_operation' || !['conversation_update', 'conversation_note'].includes(action.operation) || !action.params.conversationId || Object.keys(action.params).length !== 1 || Object.keys(action.query).length) return false;
  const b = action.body;
  if (!Number.isSafeInteger(b.version) || Number(b.version) < 0 || Object.keys(b).length !== 2) return false;
  if (action.operation === 'conversation_note') return typeof b.text === 'string' && b.text.trim().length > 0 && b.text.length <= 10000;
  return ['assigneeId', 'propertyId'].some(key => typeof b[key] === 'string' && (b[key] as string).length > 0 && (b[key] as string).length <= 180 && !(b[key] as string).includes('/'));
}
export function requestedConversationEdit(action: AssistantAction, prompt: string) {
  const request = conversationEditRequest(prompt);
  if (!request?.value || !simpleConversationEdit(action) || action.kind !== 'existing_operation') return false;
  return request.mode === 'note' ? action.operation === 'conversation_note' && action.body.text === request.value : action.operation === 'conversation_update' && typeof action.body[request.mode === 'assign' ? 'assigneeId' : 'propertyId'] === 'string';
}
export async function executeConversationEdit(ctx: AssistantContext, action: Extract<AssistantAction, { kind: 'existing_operation' }>, key: string) {
  if (!simpleConversationEdit(action)) throw new CommunicationError('Actualizare conversație invalidă.');
  const ref = collectionFor(ctx, 'conversations').doc(action.params.conversationId), ledger = collectionFor(ctx, 'assistantExecutions').doc(key);
  return ctx.adminDb.runTransaction(async tx => {
    await assertAutomationFence(ctx.adminDb, tx, ctx);
    const [conversation, previous, actor] = await Promise.all([tx.get(ref), tx.get(ledger), tx.get(ctx.adminDb.collection('users').doc(ctx.uid))]);
    if (actor.data()?.agencyId !== ctx.agencyId || actor.data()?.role !== ctx.role || !['admin', 'agent'].includes(ctx.role || '') || !conversation.exists || !canReadConversation(ctx, { ...conversation.data(), collaboratorIds: conversation.data()?.collaboratorIds || [] } as Conversation)) throw new CommunicationError('Acces revocat.', 403);
    if (previous.exists) {
      if (previous.data()?.actorId !== ctx.uid || payloadHash([previous.data()?.action]) !== payloadHash([action]) || previous.data()?.status !== 'completed') throw new CommunicationError('Identificator de execuție incompatibil.', 409);
      return previous.data()!.result;
    }
    const row = conversation.data()!, body = action.body;
    if (row.version !== body.version) throw new CommunicationError('Conversația s-a schimbat. Reia cererea.', 409);
    const patch: Record<string, unknown> = { version: row.version + 1 };
    if (typeof body.assigneeId === 'string') {
      const target = await tx.get(ctx.adminDb.collection('users').doc(body.assigneeId));
      if (target.data()?.agencyId !== ctx.agencyId || !['agent', 'admin'].includes(target.data()?.role)) throw new CommunicationError('Agentul nu este disponibil în agenție.', 403);
      if (ctx.role !== 'admin' && !(row.assigneeId === null && body.assigneeId === ctx.uid)) throw new CommunicationError('Poți prelua doar pentru tine o conversație neatribuită.', 403);
      patch.assigneeId = body.assigneeId; patch.accessUids = [...new Set([body.assigneeId, ...(row.collaboratorIds || [])])];
    }
    if (typeof body.propertyId === 'string') {
      const property = await tx.get(collectionFor(ctx, 'properties').doc(body.propertyId));
      if (!property.exists) throw new CommunicationError('Proprietatea nu mai există.', 404);
      patch.propertyIds = [...new Set([...(row.propertyIds || []), body.propertyId])];
    }
    const at = new Date().toISOString(), state = action.operation === 'conversation_note' ? 'note' : body.assigneeId ? 'assigned' : 'property_linked';
    const result = { operation: action.operation, conversationId: ref.id, executionState: 'succeeded', state, version: row.version + 1, verifiedAt: at, ...(state === 'note' ? { noteId: key } : state === 'assigned' ? { assigneeId: body.assigneeId } : { propertyId: body.propertyId }) };
    if (state === 'note') tx.create(ref.collection('notes').doc(key), { text: body.text, authorId: ctx.uid, createdAt: at });
    tx.update(ref, patch); tx.create(ledger, { actorId: ctx.uid, action, status: 'completed', result, completedAt: at });
    return result;
  });
}