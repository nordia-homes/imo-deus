import type { AssistantAction } from './contracts';
import { normalized } from './contracts';
import { collectionFor, type AssistantContext } from './access';
import { canReadConversation, type Conversation } from '@/lib/communications/model';
import { CommunicationError } from '@/lib/communications/server';
import { assertAutomationFence } from '@/lib/crm/automation-fence';
import { payloadHash } from './approval';
export function conversationStateRequest(prompt: string): 'read' | 'resolved' | 'open' | null {
  const text = normalized(prompt).trim().replace(/[.!?]+$/, '');
  return text === 'marcheaza conversatia citita' ? 'read' : text === 'marcheaza conversatia inchisa' ? 'resolved' : text === 'redeschide conversatia' ? 'open' : null;
}
export function simpleConversationUpdate(action: AssistantAction) {
  if (action.kind !== 'existing_operation' || action.operation !== 'conversation_update' || Object.keys(action.query).length || Object.keys(action.params).some(key => key !== 'conversationId') || !action.params.conversationId) return false;
  const body = action.body;
  return Number.isSafeInteger(body.version) && Number(body.version) >= 0 && Object.keys(body).length === 2 && (body.read === true && Object.keys(body).every(key => ['version', 'read'].includes(key)) || ['open', 'resolved'].includes(String(body.status)) && Object.keys(body).every(key => ['version', 'status'].includes(key)));
}
export function requestedConversationUpdate(action: AssistantAction, prompt: string) {
  if (!simpleConversationUpdate(action) || action.kind !== 'existing_operation') return false;
  const state = conversationStateRequest(prompt);
  return state === 'read' ? action.body.read === true : state !== null && action.body.status === state;
}
export async function executeConversationState(ctx: AssistantContext, action: Extract<AssistantAction, { kind: 'existing_operation' }>, key: string) {
  if (!simpleConversationUpdate(action)) throw new CommunicationError('Actualizare conversație invalidă.');
  const ref = collectionFor(ctx, 'conversations').doc(action.params.conversationId), ledger = collectionFor(ctx, 'assistantExecutions').doc(key);
  return ctx.adminDb.runTransaction(async tx => {
    await assertAutomationFence(ctx.adminDb, tx, ctx);
    const [conversation, previous, profile] = await Promise.all([tx.get(ref), tx.get(ledger), tx.get(ctx.adminDb.collection('users').doc(ctx.uid))]);
    if (profile.data()?.agencyId !== ctx.agencyId || profile.data()?.role !== ctx.role || !['agent', 'admin'].includes(ctx.role || '') || !conversation.exists || !canReadConversation(ctx, conversation.data() as Conversation)) throw new CommunicationError('Acces revocat.', 403);
    if (previous.exists) {
      if (previous.data()?.actorId !== ctx.uid || payloadHash([previous.data()?.action]) !== payloadHash([action]) || previous.data()?.status !== 'completed') throw new CommunicationError('Identificator de execuție incompatibil.', 409);
      return previous.data()!.result;
    }
    const row = conversation.data()!;
    if (row.version !== action.body.version) throw new CommunicationError('Conversația s-a schimbat. Reia cererea pe datele actuale.', 409);
    const at = new Date().toISOString();
    const patch = action.body.read === true ? { readBy: { ...row.readBy, [ctx.uid]: at }, version: row.version + 1 } : { status: action.body.status, version: row.version + 1 };
    const result = { operation: 'conversation_update', conversationId: ref.id, executionState: 'succeeded', state: action.body.read === true ? 'read' : action.body.status, version: row.version + 1, verifiedAt: at };
    tx.update(ref, patch); tx.create(ledger, { actorId: ctx.uid, action, status: 'completed', result, completedAt: at });
    return result;
  });
}
