import { collectionFor, getResource, type AssistantContext } from './access';
import { canReadConversation, normalizeSearch, type Conversation } from '@/lib/communications/model';
import { bucharestDay } from './owners-to-call-today';
import type { AssistantMessage } from './contracts';
type Row = Record<string, any>;
export type InboxRequest = { mode: 'unread' | 'today' | 'find' | 'latest' | 'summary' | 'unanswered' | 'promises' | 'search' | 'property'; query?: string };
export function inboxRequest(prompt: string): InboxRequest | null {
  const text = normalizeSearch(prompt).replace(/[.!?]+$/, '');
  if (text === 'arata-mi conversatiile necitite') return { mode: 'unread' };
  if (text === 'arata-mi conversatiile whatsapp de azi') return { mode: 'today' };
  if (text === 'arata-mi ultimele zece mesaje din conversatie') return { mode: 'latest' };
  if (text === 'ce intrebare a clientului a ramas fara raspuns') return { mode: 'unanswered' };
  if (text === 'ce i-am promis clientului') return { mode: 'promises' };
  const name = text.match(/^(gaseste|rezuma-mi) conversatia cu (.+)$/);
  if (name) return { mode: name[1] === 'gaseste' ? 'find' : 'summary', query: name[2] };
  const search = text.match(/^cauta in conversatii dupa cuvantul [„"“]?(.+?)[”"“]?$/);
  if (search) return { mode: 'search', query: search[1] };
  const property = text.match(/^cauta mesajele despre proprietatea din (.+)$/);
  return property ? { mode: 'property', query: property[1] } : null;
}
export function selectedInboxConversation(history: AssistantMessage[]) {
  const latest = history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1);
  const rows = latest?.cards?.filter(card => card.source === 'conversations').flatMap(card => card.rows) || [];
  return rows.length === 1 && typeof rows[0].id === 'string' ? rows[0].id : null;
}
export function inboxConversationMatches(row: Row, request: InboxRequest, uid: string, at: number) {
  const last = Date.parse(row.lastMessageAt), read = Date.parse(row.readBy?.[uid]);
  if (request.mode === 'unread') return Number.isFinite(last) && (!Number.isFinite(read) || read < last);
  if (request.mode === 'today') return row.channel === 'whatsapp' && Number.isFinite(last) && bucharestDay(last) === bucharestDay(at);
  if (request.mode === 'find' || request.mode === 'summary') return (' ' + normalizeSearch(String(row.name || '')).split(/[^a-z0-9]+/).join(' ') + ' ').includes(' ' + request.query + ' ');
  return true;
}
export const inboxPhraseMatches = (value: string, query: string) => (' ' + normalizeSearch(value).split(/[^a-z0-9]+/).filter(Boolean).join(' ') + ' ').includes(' ' + normalizeSearch(query).split(/[^a-z0-9]+/).filter(Boolean).join(' ') + ' ');
const projectConversation = (row: Row) => ({ id: row.id, name: String(row.name || ''), channel: row.channel || '', lastMessageAt: row.lastMessageAt || null });
export function orderedInboxMessages(rows: Row[]) {
  return rows.map(row => ({ id: String(row.id), conversationId: String(row.conversationId), direction: row.direction, text: String(row.text || ''), createdAt: String(row.createdAt || ''), status: row.status || 'unknown', attachmentsCount: Array.isArray(row.attachments) ? row.attachments.length : 0 }))
    .sort((a, b) => (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0) || a.id.localeCompare(b.id, 'en'));
}
export async function readInboxRequest(ctx: AssistantContext, request: InboxRequest, history: AssistantMessage[], at = Date.now()) {
  const snapshot = await collectionFor(ctx, 'conversations').get();
  const all = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Row)).filter(row => canReadConversation(ctx, { ...row, collaboratorIds: Array.isArray(row.collaboratorIds) ? row.collaboratorIds : [] } as Conversation));
  let selected = all.filter(row => inboxConversationMatches(row, request, ctx.uid, at));
  if (['latest', 'unanswered', 'promises'].includes(request.mode)) {
    const id = selectedInboxConversation(history);
    selected = all.filter(row => row.id === id);
  }
  selected.sort((a, b) => (Date.parse(b.lastMessageAt) || 0) - (Date.parse(a.lastMessageAt) || 0) || a.id.localeCompare(b.id, 'en'));
  const listOnly = ['unread', 'today', 'find'].includes(request.mode);
  if (listOnly || (!['search', 'property'].includes(request.mode) && selected.length !== 1)) return { conversations: selected.map(projectConversation), messages: [], selectionRequired: !listOnly, analysis: false };
  const linkedProperties = new Set<string>();
  if (request.mode === 'property') {
    const properties = await collectionFor(ctx, 'properties').get();
    for (const doc of properties.docs) { const row = doc.data(); if (inboxPhraseMatches(JSON.stringify([row.title, row.address, row.neighborhood, row.area, row.location]), request.query!)) linkedProperties.add(doc.id); }
  }
  const messages: Row[] = [];
  const included: Row[] = [];
  for (const row of selected) {
    const current = await getResource(ctx, 'conversations', row.id);
    const rows = (await collectionFor(ctx, 'conversations').doc(row.id).collection('messages').get()).docs.map(doc => ({ ...doc.data(), id: doc.id, conversationId: row.id } as Row));
    const matches = rows.filter(message => {
      if (!['search', 'property'].includes(request.mode)) return true;
      const text = normalizeSearch(String(message.text || ''));
      if (request.mode === 'search') return text.split(/[^a-z0-9]+/).includes(request.query!);
      return inboxPhraseMatches(text, request.query!) || linkedProperties.has(message.propertyId) || Array.isArray(current.propertyIds) && current.propertyIds.length === 1 && linkedProperties.has(current.propertyIds[0]);
    });
    // Recheck assignment after reading the subcollection before exposing content.
    await getResource(ctx, 'conversations', row.id);
    if (matches.length || !['search', 'property'].includes(request.mode)) included.push(projectConversation(current));
    messages.push(...matches);
  }
  const ordered = orderedInboxMessages(messages);
  return { conversations: included, messages: request.mode === 'latest' ? ordered.slice(-10) : ordered, selectionRequired: false, analysis: ['summary', 'unanswered', 'promises'].includes(request.mode) };
}
