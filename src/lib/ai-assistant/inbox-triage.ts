import { collectionFor, getResource, type AssistantContext } from './access';
import { canReadConversation, normalizeSearch, type Conversation } from '@/lib/communications/model';

type Row = Record<string, any>;
export type InboxTriageRequest = 'connections' | 'overdue' | 'attention' | 'top';
export function inboxTriageRequest(prompt: string): InboxTriageRequest | null {
  const text = normalizeSearch(prompt).replace(/[.!?]+$/, '');
  if (text === 'arata-mi starea conexiunilor de comunicare') return 'connections';
  if (text === 'care conversatii nu au raspuns de peste 24 de ore') return 'overdue';
  if (text === 'arata-mi conversatiile care necesita interventia mea') return 'attention';
  if (text === 'spune-mi cele trei conversatii unde trebuie sa intervin acum') return 'top';
  return null;
}
const successful = new Set(['accepted', 'delivered', 'read']);
export function conversationAttention(conversation: Row, messages: Row[], at: number) {
  if (['resolved', 'spam', 'snoozed'].includes(conversation.status)) return null;
  const valid = messages.filter(row => Number.isFinite(Date.parse(row.createdAt)) && Date.parse(row.createdAt) <= at);
  const sent = valid.filter(row => row.direction === 'sent' && successful.has(row.status));
  const lastSent = Math.max(-Infinity, ...sent.map(row => Date.parse(row.createdAt)));
  // Start waiting at the first incoming message after the last accepted send, not at the latest reminder.
  const awaiting = valid.filter(row => row.direction === 'received' && Date.parse(row.createdAt) > lastSent).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || String(a.id).localeCompare(String(b.id), 'en'));
  const problems = valid.filter(row => row.direction === 'sent' && ['failed', 'unknown'].includes(row.status) && Date.parse(row.createdAt) > lastSent);
  const waitingSince = awaiting[0]?.createdAt || null;
  const overdue = waitingSince !== null && at - Date.parse(waitingSince) > 86400000;
  const reasons: string[] = [];
  if (overdue) reasons.push('Clientul așteaptă un răspuns de peste 24 de ore');
  else if (waitingSince) reasons.push('Mesaj primit fără răspuns acceptat de furnizor');
  if (problems.some(row => row.status === 'unknown')) reasons.push('Rezultat de trimitere necunoscut; verifică înainte de retrimitere');
  if (problems.some(row => row.status === 'failed')) reasons.push('Trimitere eșuată fără răspuns ulterior acceptat');
  if (!reasons.length && conversation.needsReply === true) reasons.push('CRM cere răspuns, dar istoricul disponibil nu confirmă durata așteptării');
  if (!reasons.length) return null;
  return { id: String(conversation.id), name: String(conversation.name || ''), channel: String(conversation.channel || ''), waitingSince, overdue,
    priority: overdue ? 0 : problems.length ? 1 : 2, reasons, evidenceMessageIds: [...awaiting.map(row => String(row.id)), ...problems.map(row => String(row.id))] };
}
export function connectionState(row: Row) {
  const capabilities = Object.fromEntries(['publish', 'receive', 'send', 'comments', 'insights', 'templates', 'nativeSync'].map(key => {
    const value = row.capabilities?.[key];
    return [key, ['active', 'configuration_required', 'reconnect_required', 'unavailable'].includes(value?.status) ? value.status : 'unknown'];
  }));
  // Explicit projection: tokens, raw provider errors and credential metadata never enter the chat.
  return { id: String(row.id), name: String(row.name || ''), channel: String(row.channel || ''), status: ['connected', 'disconnected'].includes(row.status) ? row.status : 'unknown', capabilities,
    lastSyncAt: Number.isFinite(Date.parse(row.lastSyncAt)) ? row.lastSyncAt : null };
}
export async function readInboxTriage(ctx: AssistantContext, mode: InboxTriageRequest, at = Date.now()) {
  if (mode === 'connections') {
    const docs = await collectionFor(ctx, 'channelConnections').get();
    return docs.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter((row: Row) => row.agencyId === ctx.agencyId).map(connectionState).sort((a, b) => a.id.localeCompare(b.id, 'en'));
  }
  const docs = await collectionFor(ctx, 'conversations').get();
  const rows: NonNullable<ReturnType<typeof conversationAttention>>[] = [];
  for (const doc of docs.docs) {
    const row = { ...doc.data(), id: doc.id } as Row;
    if (!canReadConversation(ctx, { ...row, collaboratorIds: Array.isArray(row.collaboratorIds) ? row.collaboratorIds : [] } as Conversation)) continue;
    if (['resolved', 'spam', 'snoozed'].includes(row.status)) continue;
    const messages = await doc.ref.collection('messages').get();
    const current = await getResource(ctx, 'conversations', row.id);
    const result = conversationAttention(current, messages.docs.map(message => ({ ...message.data(), id: message.id })), at);
    if (result && (mode !== 'overdue' || result.overdue)) rows.push(result);
  }
  rows.sort((a, b) => a.priority - b.priority || (a.waitingSince ? Date.parse(a.waitingSince) : Infinity) - (b.waitingSince ? Date.parse(b.waitingSince) : Infinity) || a.id.localeCompare(b.id, 'en'));
  const selected = mode === 'top' ? rows.slice(0, 3) : rows;
  for (const row of selected) await getResource(ctx, 'conversations', row.id);
  return selected;
}