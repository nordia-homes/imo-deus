import { collectionFor, getResource, type AssistantContext } from './access';
import { normalized, type AssistantAction } from './contracts';
import { canReadConversation, type Conversation } from '@/lib/communications/model';
import { bucharestDay } from './owners-to-call-today';

export function communicationRecoveryRequest(prompt: string): 'sync' | 'diagnose' | 'failed' | null {
  const text = normalized(prompt).trim().replace(/[.!?]+$/, '');
  return text === 'sincronizeaza conversatia cu providerul' ? 'sync' : text === 'verifica de ce sincronizarea conversatiei a esuat' ? 'diagnose' : text === 'spune-mi ce comunicari au esuat azi' ? 'failed' : null;
}
export function conversationSyncAction(action: AssistantAction) {
  return action.kind === 'existing_operation' && action.operation === 'conversation_sync' && Object.keys(action.body).length === 0 && Object.keys(action.query).length === 0 && Object.keys(action.params).length === 1 && typeof action.params.conversationId === 'string' && Boolean(action.params.conversationId);
}
export function syncDiagnosis(row: Record<string, any>) {
  const webhook = !['messenger', 'instagram'].includes(row.channel);
  const status = webhook ? 'webhook_only' : ['running', 'completed', 'partial', 'failed'].includes(row.syncStatus) ? row.syncStatus : 'unknown';
  const reasons: Record<string, string> = {
    webhook_only: 'Istoricul acestui canal este primit prin webhook; importul manual de istoric nu este disponibil.',
    running: 'Sincronizarea este în curs sau a fost întreruptă înainte de confirmare.',
    completed: 'Ultima sincronizare a parcurs toate paginile oferite de furnizor.',
    partial: 'Există pagini rămase; următoarea sincronizare reia cursorul salvat.',
    failed: row.syncErrorCode === 'access_changed' ? 'Accesul sau atribuirea conversației s-a schimbat în timpul importului.' : 'Furnizorul sau datele primite au împiedicat finalizarea. Reluarea folosește progresul salvat.',
    unknown: 'Nu există un rezultat de sincronizare înregistrat; cauza unui eșec nu poate fi stabilită din datele disponibile.',
  };
  return { id: String(row.id), channel: row.channel, status, reason: reasons[status], lastSyncAt: row.lastSyncAt || null, lastSyncAttemptAt: row.lastSyncAttemptAt || null, resumable: Boolean(row.syncCursor) };
}
export function failedToday(row: Record<string, any>, at: number) {
  const time = Date.parse(row.failedAt);
  return row.direction === 'sent' && row.status === 'failed' && Number.isFinite(time) && time <= at && bucharestDay(time) === bucharestDay(at);
}
export async function failedCommunicationsToday(ctx: AssistantContext, at = Date.now()) {
  const docs = await collectionFor(ctx, 'conversations').get();
  const rows: Record<string, any>[] = [];
  let undated = 0;
  for (const doc of docs.docs) {
    const row = doc.data();
    if (!canReadConversation(ctx, { ...row, collaboratorIds: row.collaboratorIds || [] } as Conversation)) continue;
    const messages = await doc.ref.collection('messages').where('status', '==', 'failed').get();
    await getResource(ctx, 'conversations', doc.id);
    for (const message of messages.docs) {
      const data = message.data();
      if (data.direction !== 'sent') continue;
      if (!Number.isFinite(Date.parse(data.failedAt))) { undated++; continue; }
      if (failedToday(data, at)) rows.push({ id: message.id, conversationId: doc.id, channel: row.channel, failedAt: data.failedAt, status: 'failed', retryAuthorized: false });
    }
  }
  for (const id of new Set(rows.map(row => row.conversationId))) await getResource(ctx, 'conversations', id);
  rows.sort((a, b) => Date.parse(b.failedAt) - Date.parse(a.failedAt) || a.id.localeCompare(b.id, 'en'));
  return { rows, undated };
}