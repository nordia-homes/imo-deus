import { CommunicationError } from '@/lib/communications/server';
import type { AssistantCard } from './contracts';

export function selectedMessageReference(cards: AssistantCard[] = []) {
  const candidates = cards.flatMap(card => card.source === 'conversation_messages' ? card.rows : card.source === 'autonomy' ? card.rows.flatMap(row => {
    const result = row.result as Record<string, unknown> | undefined;
    return result?.operation === 'message_send' ? [{ id: result.messageId, conversationId: result.conversationId }] : [];
  }) : []).filter(row => typeof row.id === 'string' && typeof row.conversationId === 'string');
  const unique = new Map(candidates.map(row => [JSON.stringify([row.conversationId, row.id]), { id: String(row.id), conversationId: String(row.conversationId) }]));
  return unique.size === 1 ? [...unique.values()][0] : undefined;
}

export function selectedMessageStatus(data: Record<string, any>, messageId: string) {
  const message = Array.isArray(data.messages) ? data.messages.find((row: Record<string, unknown>) => row.id === messageId) : undefined;
  if (!message) throw new CommunicationError('Mesajul selectat nu mai este disponibil. Nu atribui starea altui mesaj.', 404);
  return { conversation: data.conversation, messages: [message], complete: true, note: 'Stare citită acum: queued = în coadă; accepted = acceptat de furnizor, fără confirmare de livrare; delivered = livrare confirmată; read = citire confirmată. failed/unknown nu înseamnă livrat. Verificarea nu retrimite mesajul.' };
}
