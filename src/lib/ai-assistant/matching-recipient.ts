import { z } from 'zod';
import { listConversations } from '@/lib/communications/server';
import { getResource, type AssistantContext } from './access';
import { selectContext } from './context-selection';
import { matchingRecipientSchema } from './matching-recipient-contract';
import { matchingRevision } from './matching-revision';

export async function resolveMatchingRecipient(ctx: AssistantContext, summary: unknown, input: z.infer<typeof matchingRecipientSchema>) {
  const selection = await selectContext(ctx, summary, { resultSetId: input.resultSetId, ...(input.messageId ? { messageId: input.messageId } : {}), positions: [input.position] });
  const contactId = selection.contactId;
  if (typeof contactId !== 'string' || !contactId) throw new Error('Lista de matching nu identifică un client. Refă matchingul pentru clientul dorit.');
  await getResource(ctx, 'contacts', contactId);
  const candidates = new Map<string, Record<string, any>>();
  let complete = true;
  if (input.conversationId) {
    const conversation = await getResource(ctx, 'conversations', input.conversationId);
    if (conversation.contactId !== contactId || (input.channel && conversation.channel !== input.channel) || !['whatsapp', 'messenger', 'instagram'].includes(conversation.channel)) throw new Error('Conversația nu corespunde clientului și canalului selectate. Nu a fost înlocuit destinatarul.');
    candidates.set(input.conversationId, conversation);
  } else {
    let cursor: string | undefined;
    const seen = new Set<string>();
    for (let page = 0; page < 5; page++) {
      const params = new URLSearchParams({ contactId, ...(input.channel ? { channel: input.channel } : {}), ...(cursor ? { cursor } : {}) });
      const result = await listConversations(ctx.adminDb, ctx, params);
      for (const conversation of result.conversations) if (conversation.contactId === contactId && ['whatsapp', 'messenger', 'instagram'].includes(conversation.channel) && (!input.channel || conversation.channel === input.channel)) candidates.set(conversation.id, conversation);
      if (!result.cursor) { cursor = undefined; break; }
      if (seen.has(result.cursor)) { complete = false; break; }
      seen.add(result.cursor); cursor = result.cursor;
      if (page === 4) complete = false;
    }
  }
  // Refresh permission and contact binding after pagination; never substitute.
  const conversations = [];
  for (const id of candidates.keys()) {
    const row = await getResource(ctx, 'conversations', id);
    if (row.contactId !== contactId || (input.channel && row.channel !== input.channel) || !['whatsapp', 'messenger', 'instagram'].includes(row.channel)) throw new Error('Conversația s-a schimbat în timpul verificării. Citește din nou destinatarii.');
    conversations.push({ id, name: String(row.name || ''), channel: row.channel, connectionId: row.connectionId });
  }
  const resolved = complete && conversations.length === 1;
  const property = await getResource(ctx, 'properties', selection.rows[0].id);
  if (property.status !== 'Activ') throw new Error('Proprietatea selectată nu mai este activă. Refă selecția înainte de pregătirea mesajului.');
  const contact = await getResource(ctx, 'contacts', contactId);
  const matchingSelection = resolved ? { resultSetId: input.resultSetId, contactId, propertyId: selection.rows[0].id, propertyRevision: matchingRevision(property), contactRevision: matchingRevision(contact) } : null;
  return { ...selection, complete, contactId, conversations, matchingSelection, conversationId: resolved ? conversations[0].id : null, recipientStatus: resolved ? 'resolved' : 'needs_clarification', recipientSearchComplete: complete, eligibilityChecked: false, note: resolved ? 'Conversația este asociată exact clientului din matching. Pregătește mesajul concret pentru verificarea eligibilității, costului și aprobare.' : !complete ? 'Căutarea conversațiilor este parțială. Alege explicit conversația; nu se presupune că rezultatul este unic.' : conversations.length ? 'Clientul are mai multe conversații. Alege conversația și canalul înainte de pregătirea mesajului.' : 'Nu există o conversație autorizată identificată pentru acest client. Creează sau asociază conversația în fluxul existent, apoi pregătește mesajul.' };
}
