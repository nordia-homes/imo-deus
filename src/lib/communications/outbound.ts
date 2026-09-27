import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { budgetReservation, canReadConversation, withinResponseWindow, type Actor, type Conversation, type Message } from './model';
import { agencyCollection, CommunicationError, getConversation, nowIso } from './server';
import { connectionToken, graph } from './meta';
import { stableId } from './crypto';
import { attachmentForSend } from './media';
import { isDeepStrictEqual } from 'node:util';

const inputSchema = z.object({ text: z.string().trim().max(4000).default(''), requestId: z.string().uuid(), attachmentId: z.string().uuid().optional(), template: z.object({ name: z.string(), language: z.string(), parameters: z.array(z.string().max(1000)).max(20).default([]) }).optional() }).refine(d => Boolean(d.text || d.template || d.attachmentId), 'Scrie un mesaj.').refine(d => !(d.template && d.attachmentId), 'Atașamentele în șabloane nu sunt acceptate de acest editor.');
type SendInput = z.infer<typeof inputSchema>;
export async function estimateSend(db: Firestore, actor: Actor, conversation: Conversation, input: SendInput) {
  const { connection, token } = await connectionToken(db, actor, conversation.connectionId, 'send');
  if (conversation.channel === 'storia') throw new CommunicationError('Continuă răspunsul pe Storia.');
  const inWindow = withinResponseWindow(conversation.lastInboundAt);
  let category = 'service';
  if (!inWindow && !input.template) throw new CommunicationError('Fereastra de răspuns a expirat. Pentru WhatsApp selectează un șablon aprobat.');
  if (input.template) {
    if (conversation.channel !== 'whatsapp') throw new CommunicationError('Șabloanele sunt disponibile pentru WhatsApp.');
    const templates = await graph<{ data: Array<{ name: string; language: string; status: string; category: string }> }>(`/${connection.parentId}/message_templates?name=${encodeURIComponent(input.template.name)}&limit=100`, token);
    const template = templates.data.find(t => t.name === input.template!.name && t.language === input.template!.language && t.status === 'APPROVED');
    if (!template) throw new CommunicationError('Șablonul nu este aprobat pentru limba aleasă.');
    category = template.category.toLowerCase();
    const consent = await agencyCollection(db, actor.agencyId, 'communicationConsents').doc(stableId(conversation.connectionId, conversation.externalParticipantId, category === 'marketing' ? 'marketing' : 'service')).get();
    if (consent.data()?.status !== 'granted') throw new CommunicationError('Nu există consimțământ înregistrat pentru această comunicare.');
  }
  const attachment = input.attachmentId ? await attachmentForSend(db, actor, conversation.id, input.attachmentId) : null;
  if (attachment && conversation.channel !== 'whatsapp' && input.text) throw new CommunicationError('Trimite textul și fișierul ca mesaje separate pe acest canal.');
  if (conversation.channel !== 'whatsapp') return { amount: 0, currency: 'EUR', category, rateId: 'meta-messaging', body: { recipient: { id: conversation.externalParticipantId }, message: attachment ? { attachment: { type: attachment.type === 'document' ? 'file' : attachment.type, payload: { url: attachment.url } } } : { text: input.text }, messaging_type: 'RESPONSE' } };
  // Rates are server-managed, versioned data. Never assume a free service window from stale code.
  const rateRows = await db.collection('communicationRates').where('category', '==', category).get();
  const now = nowIso();
  const rate = rateRows.docs.map(d => ({ ...d.data(), id: d.id })).filter((r: any) => typeof r.prefix === 'string' && conversation.externalParticipantId.startsWith(r.prefix) && r.validFrom <= now && r.validUntil > now && (!r.inWindowOnly || inWindow)).sort((a: any, b: any) => b.prefix.length - a.prefix.length)[0] as any;
  if (!rate || !Number.isSafeInteger(rate.amountMicros) || rate.amountMicros < 0) throw new CommunicationError('Tariful WhatsApp nu este configurat sau a expirat. Trimiterea este blocată; primirea rămâne activă.', 409);
  const body = input.template ? { messaging_product: 'whatsapp', to: conversation.externalParticipantId, type: 'template', template: { name: input.template.name, language: { code: input.template.language }, ...(input.template.parameters.length ? { components: [{ type: 'body', parameters: input.template.parameters.map(text => ({ type: 'text', text })) }] } : {}) } } : { messaging_product: 'whatsapp', to: conversation.externalParticipantId, type: 'text', text: { body: input.text } };
  const mediaBody = attachment ? { messaging_product: 'whatsapp', to: conversation.externalParticipantId, type: attachment.type, [attachment.type]: { link: attachment.url, ...(input.text ? { caption: input.text } : {}), ...(attachment.type === 'document' ? { filename: attachment.name } : {}) } } : null;
  return { amount: rate.amountMicros as number, currency: rate.currency as string, category, rateId: rate.id as string, body: mediaBody || body };
}
export async function queueMessage(db: Firestore, actor: Actor, id: string, body: unknown, preview = false) {
  const input = inputSchema.parse(body);
  const conversation = await getConversation(db, actor, id);
  const previousJobId = stableId(actor.agencyId, input.requestId);
  if (!preview) {
    const existing = await db.collection('communicationOutboundJobs').doc(previousJobId).get();
    if (existing.exists) {
      if (existing.data()?.conversationId !== id || !isDeepStrictEqual(existing.data()?.input, input)) throw new CommunicationError('Cheia de trimitere a fost deja utilizată pentru alt mesaj.', 409);
      return { messageId: previousJobId, status: existing.data()!.status };
    }
  }
  const estimate = await estimateSend(db, actor, conversation, input);
  const attachment = input.attachmentId ? (await agencyCollection(db, actor.agencyId, 'communicationMedia').doc(input.attachmentId).get()).data() : null;
  if (preview) return { estimate: { amountMicros: estimate.amount, currency: estimate.currency, category: estimate.category }, withinWindow: withinResponseWindow(conversation.lastInboundAt) };
  const jobId = stableId(actor.agencyId, input.requestId);
  const job = db.collection('communicationOutboundJobs').doc(jobId);
  const conversationRef = agencyCollection(db, actor.agencyId, 'conversations').doc(id);
  const budgetRef = agencyCollection(db, actor.agencyId, 'communicationBudgets').doc(`${nowIso().slice(0, 7)}-${estimate.currency}`);
  await db.runTransaction(async tx => {
    const [existing, fresh, budget] = await Promise.all([tx.get(job), tx.get(conversationRef), tx.get(budgetRef)]);
    if (existing.exists) {
      if (existing.data()?.conversationId !== id || !isDeepStrictEqual(existing.data()?.input, input)) throw new CommunicationError('Cheia de trimitere a fost deja utilizată pentru alt mesaj.', 409);
      return;
    }
    if (!canReadConversation(actor, fresh.data() as Conversation)) throw new CommunicationError('Acces revocat.', 403);
    if (estimate.amount > 0) tx.set(budgetRef, { currency: estimate.currency, limitMicros: budget.data()?.limitMicros || 0, spentMicros: budget.data()?.spentMicros || 0,
      reservedMicros: budgetReservation(budget.data()?.limitMicros || 0, budget.data()?.spentMicros || 0, budget.data()?.reservedMicros || 0, estimate.amount) }, { merge: true });
    const message: Message = { id: jobId, agencyId: actor.agencyId, conversationId: id, externalId: null, direction: 'sent', origin: 'imodeus', text: input.template ? `[${input.template.name}] ${input.template.parameters.join(' · ')}` : input.text, createdAt: nowIso(), authorId: actor.uid, status: 'queued', attachments: [] };
    if (input.attachmentId && attachment) message.attachments = [{ localId: input.attachmentId, name: attachment.name, type: attachment.mime }];
    tx.create(conversationRef.collection('messages').doc(jobId), message);
    tx.create(job, { agencyId: actor.agencyId, uid: actor.uid, conversationId: id, connectionId: conversation.connectionId, input,
      estimate: { amount: estimate.amount, currency: estimate.currency, rateId: estimate.rateId }, budgetId: budgetRef.id, budgetSettled: false, status: 'queued', createdAt: nowIso() });
  });
  return { messageId: jobId, status: 'queued' };
}
async function settleBudget(db: Firestore, jobId: string, accepted: boolean) {
  const ref = db.collection('communicationOutboundJobs').doc(jobId);
  await db.runTransaction(async tx => {
    const row = await tx.get(ref); const job = row.data()!;
    if (job.budgetSettled) return;
    if (!job.estimate.amount) { tx.update(ref, { budgetSettled: true }); return; }
    const budgetRef = agencyCollection(db, job.agencyId, 'communicationBudgets').doc(job.budgetId);
    const budget = await tx.get(budgetRef);
    tx.update(budgetRef, { reservedMicros: Math.max(0, (budget.data()?.reservedMicros || 0) - job.estimate.amount), spentMicros: (budget.data()?.spentMicros || 0) + (accepted ? job.estimate.amount : 0) });
    tx.update(ref, { budgetSettled: true });
  });
}
export async function drainOutbound(db: Firestore) {
  const accounting = await db.collection('communicationOutboundJobs').where('budgetSettled', '==', false).where('status', 'in', ['accepted', 'failed']).limit(50).get();
  for (const row of accounting.docs) await settleBudget(db, row.id, row.data().status === 'accepted');
  const stuck = await db.collection('communicationOutboundJobs').where('status', '==', 'sending').limit(50).get();
  for (const doc of stuck.docs) if (doc.data().leaseUntil < Date.now()) {
    await doc.ref.update({ status: 'unknown', error: 'Confirmarea trimiterii nu a sosit. Verifică înainte de retrimitere.' });
    await agencyCollection(db, doc.data().agencyId, 'conversations').doc(doc.data().conversationId).collection('messages').doc(doc.id).update({ status: 'unknown' });
  }
  const jobs = await db.collection('communicationOutboundJobs').where('status', '==', 'queued').limit(3).get();
  for (const row of jobs.docs) {
    const claimed = await db.runTransaction(async tx => { const fresh = await tx.get(row.ref); if (fresh.data()?.status !== 'queued') return false; tx.update(row.ref, { status: 'sending', leaseUntil: Date.now() + 90000 }); return true; });
    if (!claimed) continue;
    const job = row.data(); const messageRef = agencyCollection(db, job.agencyId, 'conversations').doc(job.conversationId).collection('messages').doc(row.id);
    let attempted = false;
    try {
      const user = await db.collection('users').doc(job.uid).get();
      if (user.data()?.agencyId !== job.agencyId) throw new CommunicationError('Agentul nu mai aparține agenției.');
      const actor = { uid: job.uid, agencyId: job.agencyId, role: user.data()?.role };
      const conversation = await getConversation(db, actor, job.conversationId);
      const estimate = await estimateSend(db, actor, conversation, job.input);
      if (estimate.currency !== job.estimate.currency || estimate.amount > job.estimate.amount) throw new CommunicationError('Tariful s-a modificat. Pregătește din nou trimiterea.');
      const { connection, token } = await connectionToken(db, actor, job.connectionId, 'send');
      await messageRef.update({ status: 'sending' });
      attempted = true;
      const response = await graph(`/${connection.externalId}/messages`, token, estimate.body);
      const externalId = response.messages?.[0]?.id || response.message_id;
      if (!externalId) throw new Error('Platforma nu a returnat identificatorul mesajului.');
      const mapping = db.collection('communicationMessageMappings').doc(stableId(job.connectionId, externalId));
      await db.runTransaction(async tx => {
        const existing = await tx.get(mapping);
        const echoId = existing.data()?.messageId;
        const conversationRef = messageRef.parent.parent!;
        const conversationDoc = await tx.get(conversationRef);
        const current = conversationDoc.data() as Conversation;
        const echo = echoId && echoId !== row.id ? await tx.get(conversationRef.collection('messages').doc(echoId)) : null;
        tx.set(mapping, { connectionId: job.connectionId, conversationId: job.conversationId, messageId: row.id });
        tx.update(messageRef, { externalId, status: echo?.data()?.status || existing.data()?.pendingStatus || 'accepted' });
        if (echo?.exists) tx.delete(echo.ref);
        const sentAt = nowIso();
        tx.update(conversationRef, { lastOutboundAt: sentAt, lastMessageAt: sentAt, latestMessage: job.input.text || `[${job.input.template?.name}]`, needsReply: Boolean(current.lastInboundAt && current.lastInboundAt > sentAt), status: current.status === 'spam' ? 'spam' : 'waiting', version: current.version + 1 });
        tx.update(row.ref, { status: 'accepted', externalId, acceptedAt: sentAt });
        tx.set(db.collection('communicationSearchJobs').doc(stableId(job.conversationId, row.id)), { agencyId: job.agencyId, conversationId: job.conversationId, messageId: row.id, status: 'queued', updatedAt: sentAt });
      });
      // A bookkeeping retry must not downgrade a confirmed send to an unknown result.
      await settleBudget(db, row.id, true).catch(() => undefined);
    } catch (error) {
      // Once a request may have reached Meta, preserve the reservation and never automatically resend.
      const status = attempted ? 'unknown' : 'failed';
      const message = error instanceof Error ? error.message : 'Trimiterea a eșuat.';
      await row.ref.update({ status, error: message }); await messageRef.update({ status, error: message });
      if (!attempted) await settleBudget(db, row.id, false);
    }
  }
  return jobs.size;
}
