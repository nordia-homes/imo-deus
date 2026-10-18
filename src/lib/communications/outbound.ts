import { portalBatchSchema, validatePortalBatch } from './portal-batch';
import { randomUUID } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { previousPropertyShare } from './property-share-history';
import { assertProspectingRecipient } from './prospecting-recipient';
import { bindViewingConfirmation, assertViewingTemplate } from './viewing-confirmation';
import { viewingConfirmationLinkSchema } from '@/lib/crm/viewing-attendance';
import { assertAutomationFence } from '@/lib/crm/automation-fence';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { z } from 'zod';
import { advanceStatus, budgetReservation, canReadConversation, withinResponseWindow, type Actor, type Conversation, type Message } from './model';
import { agencyCollection, CommunicationError, getConversation, nowIso } from './server';
import { connectionToken, graph, MetaGraphError } from './meta';
import { stableId } from './crypto';
import { attachmentForSend } from './media';
import { bodyParameterCount, listWhatsAppTemplates, renderTemplateBody, templateSendComponents } from './templates';
import { isDeepStrictEqual } from 'node:util';
import { assertWhatsAppAccess, whatsappAppId } from './whatsapp-config';
import { receiptCorrelation } from './receipt-correlation';
import { recipientRevision, assertRecipientRevision } from './recipient-revision';
import { sendApprovalSchema, assertSendApproval } from './send-approval';
import { matchingSendSchema, assertMatchingSend } from './matching-send';
import { assertNoReplySince } from '@/lib/ai-assistant/reply-stop';
import { personalRecipientSchema, assertPersonalRecipient } from './personal-recipient';

const inputSchema = z.object({ portalBatch: portalBatchSchema.optional(), prospectingListingId: z.string().regex(/^[a-zA-Z0-9_.:-]+$/).optional(), viewingConfirmation: viewingConfirmationLinkSchema.optional(), text: z.string().trim().max(4000).default(''), requestId: z.string().uuid(), personalRecipient: personalRecipientSchema.optional(), stopOnReplySince: z.string().datetime({ offset: true }).optional(), matchingSelection: matchingSendSchema.optional(), preventPropertyResend: z.boolean().optional(), sendApproval: sendApprovalSchema.optional(), expectedRecipientRevision: z.string().regex(/^[a-f0-9]{64}$/).optional(), attachmentId: z.string().uuid().optional(), template: z.object({ name: z.string(), language: z.string(), parameters: z.array(z.string().max(1000)).max(20).default([]) }).optional() }).refine(d => Boolean(d.text || d.template || d.attachmentId), 'Scrie un mesaj.').refine(d => !(d.template && d.attachmentId), 'Atașamentele în șabloane nu sunt acceptate de acest editor.');
type SendInput = z.infer<typeof inputSchema>;
// Re-read mutable eligibility after preparation, including inside the queue transaction.
async function assertCurrentRecipientEligibility(db: Firestore, actor: Actor, conversation: Conversation, input: SendInput, category: string, tx?: Transaction) {
  if (!input.template && !withinResponseWindow(conversation.lastInboundAt)) throw new CommunicationError('Fereastra de răspuns a expirat. Pregătește din nou mesajul.', 409);
  if (conversation.channel !== 'whatsapp') return;
  await assertProspectingRecipient(db, actor, conversation, input.prospectingListingId, tx);
  const consents = agencyCollection(db, actor.agencyId, 'communicationConsents');
  const refs = ['all', category === 'marketing' ? 'marketing' : 'service'].map(scope => consents.doc(stableId(conversation.connectionId, conversation.externalParticipantId, scope)));
  const [global, scoped] = await Promise.all(refs.map(ref => tx ? tx.get(ref) : ref.get()));
  if (global.data()?.status === 'revoked') throw new CommunicationError('Contactul a cerut oprirea mesajelor WhatsApp.', 409);
  if (scoped.data()?.status === 'revoked') throw new CommunicationError('Contactul a retras acordul pentru această comunicare.', 409);
  if (input.template && scoped.data()?.status !== 'granted') throw new CommunicationError('Nu există consimțământ înregistrat pentru această comunicare.', 409);
}
export async function estimateSend(db: Firestore, actor: Actor, conversation: Conversation, input: SendInput) {
  const { connection, token } = await connectionToken(db, actor, conversation.connectionId, 'send');
  if (conversation.channel === 'storia') throw new CommunicationError('Continuă răspunsul pe Storia.');
  const inWindow = withinResponseWindow(conversation.lastInboundAt);
  let category = 'service';
  let renderedText = input.text;
  let templateComponents: Array<Record<string, unknown>> = [];
  if (!inWindow && !input.template) throw new CommunicationError('Fereastra de răspuns a expirat. Pentru WhatsApp selectează un șablon aprobat.');
  if (conversation.channel === 'whatsapp') {
    assertWhatsAppAccess(actor);
    if (connection.appId !== whatsappAppId()) throw new CommunicationError('Reconectează numărul la noua aplicație WhatsApp.', 409);
    if (process.env.WHATSAPP_ONBOARDING_MODE === 'test' && !(process.env.WHATSAPP_TEST_RECIPIENTS || '').split(',').map(v => v.trim().replace(/^\+/, '')).includes(conversation.externalParticipantId)) throw new CommunicationError('Trimiterea către acest destinatar nu este disponibilă. Contactează suportul ImoDeus.', 403);
    const globalConsent = await agencyCollection(db, actor.agencyId, 'communicationConsents')
      .doc(stableId(conversation.connectionId, conversation.externalParticipantId, 'all')).get();
    if (globalConsent.data()?.status === 'revoked') throw new CommunicationError('Contactul a cerut oprirea mesajelor WhatsApp.', 409);
    if (!input.template) {
      const serviceConsent = await agencyCollection(db, actor.agencyId, 'communicationConsents')
        .doc(stableId(conversation.connectionId, conversation.externalParticipantId, 'service')).get();
      if (serviceConsent.data()?.status === 'revoked') throw new CommunicationError('Contactul a retras acordul pentru această comunicare.', 409);
    }
  }
  if (input.template) {
    if (conversation.channel !== 'whatsapp') throw new CommunicationError('Șabloanele sunt disponibile pentru WhatsApp.');
    const templates = await listWhatsAppTemplates(connection.parentId || '', token, input.template.name);
    const template = templates.find(t => t.name === input.template!.name && t.language === input.template!.language && t.status === 'APPROVED');
    if (!template) throw new CommunicationError('Șablonul nu este aprobat pentru limba aleasă.');
    const expectedParameters = bodyParameterCount(template);
    if (expectedParameters === null) throw new CommunicationError('Acest șablon conține componente pe care editorul nu le poate completa.');
    if (input.template.parameters.length !== expectedParameters) throw new CommunicationError(`Șablonul necesită ${expectedParameters} parametri în corpul mesajului.`);
    renderedText = renderTemplateBody(template, input.template.parameters);
    templateComponents = templateSendComponents(template, input.template.parameters);
    category = template.category.toLowerCase();
    const consent = await agencyCollection(db, actor.agencyId, 'communicationConsents').doc(stableId(conversation.connectionId, conversation.externalParticipantId, category === 'marketing' ? 'marketing' : 'service')).get();
    if (consent.data()?.status !== 'granted') throw new CommunicationError('Nu există consimțământ înregistrat pentru această comunicare.');
  }
  const attachment = input.attachmentId ? await attachmentForSend(db, actor, conversation.id, input.attachmentId) : null;
  if (attachment && conversation.channel !== 'whatsapp' && input.text) throw new CommunicationError('Trimite textul și fișierul ca mesaje separate pe acest canal.');
  if (conversation.channel !== 'whatsapp') return { amount: 0, currency: 'EUR', category, renderedText, rateId: 'meta-messaging', body: { recipient: { id: conversation.externalParticipantId }, message: attachment ? { attachment: { type: attachment.type === 'document' ? 'file' : attachment.type, payload: { url: attachment.url } } } : { text: input.text }, messaging_type: 'RESPONSE' } };
  // Rates are server-managed, versioned data. Never assume a free service window from stale code.
  const rateRows = await db.collection('communicationRates').where('category', '==', category).get();
  const now = nowIso();
  if (!connection.currency) throw new CommunicationError('Moneda WABA nu este verificată. Reconectează numărul WhatsApp.', 409);
  const rate = rateRows.docs.map(d => ({ ...d.data(), id: d.id })).filter((r: any) => typeof r.prefix === 'string' && conversation.externalParticipantId.startsWith(r.prefix) && r.currency === connection.currency && r.validFrom <= now && r.validUntil > now && (!r.inWindowOnly || inWindow)).sort((a: any, b: any) => b.prefix.length - a.prefix.length || String(b.validFrom).localeCompare(String(a.validFrom)))[0] as any;
  if (!rate || !Number.isSafeInteger(rate.amountMicros) || rate.amountMicros < 0) throw new CommunicationError('Tariful WhatsApp nu este configurat sau a expirat. Trimiterea este blocată; primirea rămâne activă.', 409);
  const body = input.template ? { messaging_product: 'whatsapp', to: conversation.externalParticipantId, type: 'template', template: { name: input.template.name, language: { code: input.template.language }, ...(templateComponents.length ? { components: templateComponents } : {}) } } : { messaging_product: 'whatsapp', to: conversation.externalParticipantId, type: 'text', text: { body: input.text } };
  const mediaBody = attachment ? { messaging_product: 'whatsapp', to: conversation.externalParticipantId, type: attachment.type, [attachment.type]: { link: attachment.url, ...(input.text ? { caption: input.text } : {}), ...(attachment.type === 'document' ? { filename: attachment.name } : {}) } } : null;
  return { amount: rate.amountMicros as number, currency: rate.currency as string, category, renderedText, rateId: rate.id as string, body: mediaBody || body };
}
export async function queueMessage(db: Firestore, actor: Actor, id: string, body: unknown, preview = false) {
  const input = inputSchema.parse(body);
  if (input.preventPropertyResend && !input.matchingSelection) throw new CommunicationError('Selecția proprietății este necesară.', 400);
  const conversation = await getConversation(db, actor, id);
  const previousJobId = stableId(actor.agencyId, input.requestId);
  if (!preview) {
    const existing = await db.collection('communicationOutboundJobs').doc(previousJobId).get();
    if (existing.exists) {
      if (existing.data()?.conversationId !== id || !isDeepStrictEqual(existing.data()?.input, input)) throw new CommunicationError('Cheia de trimitere a fost deja utilizată pentru alt mesaj.', 409);
      return { messageId: previousJobId, status: existing.data()!.status };
    }
  }
  if (input.expectedRecipientRevision !== undefined) assertRecipientRevision(conversation, input.expectedRecipientRevision);
  await assertPersonalRecipient(db, actor, conversation, input.personalRecipient);
  const recipient = recipientRevision(conversation);
  assertNoReplySince(conversation, input.stopOnReplySince);
  await assertMatchingSend(db, actor, conversation, input.matchingSelection);
  await validatePortalBatch(db, actor, conversation, input);
  const binding = await bindViewingConfirmation(db, actor.agencyId, conversation, input.viewingConfirmation);
  const estimate = await estimateSend(db, actor, conversation, input);
  assertViewingTemplate(binding, estimate.renderedText, Boolean(input.template));
  if (input.sendApproval !== undefined || (!preview && input.expectedRecipientRevision !== undefined)) assertSendApproval(input.sendApproval, estimate);
  const attachment = input.attachmentId ? (await agencyCollection(db, actor.agencyId, 'communicationMedia').doc(input.attachmentId).get()).data() : null;
  if (preview) {
    const latest = await getConversation(db, actor, id);
    assertRecipientRevision(latest, recipient);
    await assertCurrentRecipientEligibility(db, actor, latest, input, estimate.category);
    return { estimate: { amountMicros: estimate.amount, currency: estimate.currency, category: estimate.category }, withinWindow: withinResponseWindow(latest.lastInboundAt), renderedText: estimate.renderedText };
  }
  const jobId = stableId(actor.agencyId, input.requestId);
  const job = db.collection('communicationOutboundJobs').doc(jobId);
  const conversationRef = agencyCollection(db, actor.agencyId, 'conversations').doc(id);
  const budgetRef = agencyCollection(db, actor.agencyId, 'communicationBudgets').doc(`${nowIso().slice(0, 7)}-${estimate.currency}`);
  // Legacy lookup is read-only; the ledger is reread under the transaction lock.
  const historicalShare = input.matchingSelection ? await previousPropertyShare(db, actor.agencyId, input.matchingSelection.contactId, input.matchingSelection.propertyId) : null;
  const queued = await db.runTransaction(async tx => {
    await assertAutomationFence(db, tx, actor);
    const [existing, fresh, budget] = await Promise.all([tx.get(job), tx.get(conversationRef), tx.get(budgetRef)]);
    if (existing.exists) {
      if (existing.data()?.conversationId !== id || !isDeepStrictEqual(existing.data()?.input, input)) throw new CommunicationError('Cheia de trimitere a fost deja utilizată pentru alt mesaj.', 409);
      return { messageId: jobId, status: existing.data()!.status };
    }
    if (!canReadConversation(actor, fresh.data() as Conversation)) throw new CommunicationError('Acces revocat.', 403);
    assertRecipientRevision({ ...fresh.data(), id }, recipient);
    await assertPersonalRecipient(db, actor, { ...fresh.data(), id }, input.personalRecipient, tx);
    assertNoReplySince(fresh.data()!, input.stopOnReplySince);
    await assertCurrentRecipientEligibility(db, actor, { ...fresh.data(), id } as Conversation, input, estimate.category, tx);
    await assertMatchingSend(db, actor, fresh.data()!, input.matchingSelection, tx);
    const batchClaims = await validatePortalBatch(db, actor, fresh.data()!, input, tx, jobId);
    const shareRef = input.matchingSelection ? agencyCollection(db, actor.agencyId, 'communicationPropertyShares').doc(stableId(input.matchingSelection.contactId, input.matchingSelection.propertyId)) : null;
    const ledger = shareRef ? await tx.get(shareRef) : null;
    const previousShare = ledger?.exists ? { messageId: String(ledger.data()!.messageId), conversationId: String(ledger.data()!.conversationId), historical: false } : historicalShare;
    if (previousShare) {
      const priorJob = await tx.get(db.collection('communicationOutboundJobs').doc(previousShare.messageId));
      if (previousShare.historical && shareRef) tx.create(shareRef, { contactId: input.matchingSelection!.contactId, propertyId: input.matchingSelection!.propertyId, messageId: previousShare.messageId, conversationId: previousShare.conversationId, createdAt: nowIso(), recoveredFromHistory: true });
      return { messageId: previousShare.messageId, status: priorJob.data()?.status || 'unknown', duplicate: true };
    }
    const currentBinding = await bindViewingConfirmation(db, actor.agencyId, { ...fresh.data(), id }, input.viewingConfirmation, tx);
    if (JSON.stringify(currentBinding) !== JSON.stringify(binding)) throw new CommunicationError('Programarea s-a schimbat înaintea trimiterii.', 409);
    if (estimate.amount > 0) tx.set(budgetRef, { currency: estimate.currency, limitMicros: budget.data()?.limitMicros || 0, spentMicros: budget.data()?.spentMicros || 0,
      reservedMicros: budgetReservation(budget.data()?.limitMicros || 0, budget.data()?.spentMicros || 0, budget.data()?.reservedMicros || 0, estimate.amount) }, { merge: true });
    const message: Message = { id: jobId, agencyId: actor.agencyId, conversationId: id, externalId: null, direction: 'sent', origin: 'imodeus', text: input.template ? estimate.renderedText || `[${input.template.name}] ${input.template.parameters.join(' · ')}` : input.text, createdAt: nowIso(), authorId: actor.uid, status: 'queued', attachments: [] };
    if (input.attachmentId && attachment) message.attachments = [{ localId: input.attachmentId, name: attachment.name, type: attachment.mime }];
    tx.create(conversationRef.collection('messages').doc(jobId), { ...message, ...(binding ? { viewingConfirmation: binding } : {}) });
    if (shareRef) tx.create(shareRef, { contactId: input.matchingSelection!.contactId, propertyId: input.matchingSelection!.propertyId, messageId: jobId, conversationId: id, createdAt: nowIso() });
    for (const claim of batchClaims) tx.create(claim.ref, { contactId: claim.contactId, propertyId: claim.propertyId, portalId: claim.portalId, batchId: claim.batchId, messageId: jobId, conversationId: id, createdAt: nowIso() });
    tx.create(job, { agencyId: actor.agencyId, uid: actor.uid, conversationId: id, connectionId: conversation.connectionId, input, recipientRevision: recipient,
      ...(binding ? { viewingConfirmation: binding } : {}), estimate: { amount: estimate.amount, currency: estimate.currency, rateId: estimate.rateId }, budgetId: budgetRef.id, budgetSettled: false, status: 'queued', createdAt: nowIso() });
  });
  return queued || { messageId: jobId, status: 'queued' };
}
async function settleBudget(db: Firestore, jobId: string) {
  const ref = db.collection('communicationOutboundJobs').doc(jobId);
  await db.runTransaction(async tx => {
    const row = await tx.get(ref); const job = row.data()!;
    if (!job || job.budgetSettled || !['delivered', 'read', 'failed'].includes(job.status)) return;
    if (!job.estimate.amount) { tx.update(ref, { budgetSettled: true }); return; }
    const budgetRef = agencyCollection(db, job.agencyId, 'communicationBudgets').doc(job.budgetId);
    const budget = await tx.get(budgetRef);
    const charge = ['delivered', 'read'].includes(job.status) ? job.estimate.amount : 0;
    const previousCharge = job.settledAmountMicros || 0;
    tx.update(budgetRef, { reservedMicros: Math.max(0, (budget.data()?.reservedMicros || 0) - (job.reservationReleased ? 0 : job.estimate.amount)), spentMicros: Math.max(0, (budget.data()?.spentMicros || 0) + charge - previousCharge) });
    tx.update(ref, { budgetSettled: true, reservationReleased: true, settledAmountMicros: charge });
  });
}
export function safeToRetryOutbound(job: Record<string, any>) {
  return job.status === 'failed' && job.failureStage === 'before_provider' && typeof job.failureId === 'string' && Boolean(job.failureId) && !job.externalId && !job.providerAcceptedAt;
}
export async function retryOutboundMessage(db: Firestore, actor: Actor, conversationId: string, messageId: string, failureId: string) {
  const conversation = await getConversation(db, actor, conversationId);
  const jobRef = db.collection('communicationOutboundJobs').doc(messageId);
  const job = (await jobRef.get()).data();
  if (!job || job.agencyId !== actor.agencyId || job.conversationId !== conversationId) throw new CommunicationError('Mesajul nu corespunde conversației.', 409);
  if (job.lastRetryFailureId === failureId) return { messageId, status: job.status, requeued: false };
  if (!safeToRetryOutbound(job) || job.failureId !== failureId) throw new CommunicationError('Nu există dovada unei trimiteri sigur de reluat.', 409);
  assertRecipientRevision(conversation, job.recipientRevision);
  const input = inputSchema.parse(job.input);
  if (input.expectedRecipientRevision) assertRecipientRevision(conversation, input.expectedRecipientRevision);
  const estimate = await estimateSend(db, actor, conversation, input);
  const sendApproval = sendApprovalSchema.parse({ amountMicros: estimate.amount, currency: estimate.currency, renderedText: estimate.renderedText, expiresAt: Date.now() + 3600000 });
  if (estimate.currency !== job.estimate.currency || estimate.amount > job.estimate.amount) throw new CommunicationError('Costul a crescut; mesajul trebuie pregătit din nou.', 409);
  await settleBudget(db, messageId);
  const conversationRef = agencyCollection(db, actor.agencyId, 'conversations').doc(conversationId);
  const messageRef = conversationRef.collection('messages').doc(messageId);
  const budgetRef = agencyCollection(db, actor.agencyId, 'communicationBudgets').doc(nowIso().slice(0, 7) + '-' + estimate.currency);
  return db.runTransaction(async tx => {
    await assertAutomationFence(db, tx, actor);
    const [profile, freshJob, freshMessage, freshConversation, budget] = await Promise.all([tx.get(db.collection('users').doc(actor.uid)), tx.get(jobRef), tx.get(messageRef), tx.get(conversationRef), tx.get(budgetRef)]);
    const current = freshJob.data(), message = freshMessage.data();
    if (profile.data()?.agencyId !== actor.agencyId || profile.data()?.role !== actor.role || !['agent', 'admin'].includes(actor.role || '') || !freshConversation.exists || !canReadConversation(actor, freshConversation.data() as Conversation)) throw new CommunicationError('Acces revocat.', 403);
    if (!current || current.agencyId !== actor.agencyId || current.conversationId !== conversationId) throw new CommunicationError('Mesaj invalid.', 409);
    if (current.lastRetryFailureId === failureId) return { messageId, status: current.status, requeued: false };
    if (!safeToRetryOutbound(current) || current.failureId !== failureId || !current.budgetSettled || !isDeepStrictEqual(current.input, job.input)) throw new CommunicationError('Starea mesajului s-a schimbat.', 409);
    if (!message || message.agencyId !== actor.agencyId || message.conversationId !== conversationId || message.origin !== 'imodeus' || message.direction !== 'sent' || message.status !== 'failed' || message.externalId || message.text !== estimate.renderedText) throw new CommunicationError('Conținutul sau confirmarea mesajului s-a schimbat.', 409);
    const recipient = { ...freshConversation.data(), id: conversationId } as Conversation;
    assertRecipientRevision(recipient, job.recipientRevision);
    await assertPersonalRecipient(db, actor, recipient, input.personalRecipient, tx);
    assertNoReplySince(recipient, input.stopOnReplySince);
    await assertCurrentRecipientEligibility(db, actor, recipient, input, estimate.category, tx);
    await assertMatchingSend(db, actor, recipient, input.matchingSelection, tx);
    const binding = await bindViewingConfirmation(db, actor.agencyId, recipient, input.viewingConfirmation, tx);
    if (JSON.stringify(binding) !== JSON.stringify(job.viewingConfirmation || null)) throw new CommunicationError('Programarea s-a schimbat.', 409);
    assertViewingTemplate(binding, estimate.renderedText, Boolean(input.template));
    if (estimate.amount > 0) tx.set(budgetRef, { currency: estimate.currency, limitMicros: budget.data()?.limitMicros || 0, spentMicros: budget.data()?.spentMicros || 0, reservedMicros: budgetReservation(budget.data()?.limitMicros || 0, budget.data()?.spentMicros || 0, budget.data()?.reservedMicros || 0, estimate.amount) }, { merge: true });
    tx.create(jobRef.collection('retryHistory').doc(failureId), { actorId: actor.uid, failureId, failedAt: current.failedAt || null, retriedAt: nowIso() });
    tx.update(jobRef, { status: 'queued', uid: actor.uid, retrySendApproval: sendApproval, estimate: { amount: estimate.amount, currency: estimate.currency, rateId: estimate.rateId }, budgetId: budgetRef.id, budgetSettled: false, reservationReleased: false, settledAmountMicros: 0, lastRetryFailureId: failureId, failureId: FieldValue.delete(), failureStage: FieldValue.delete(), failedAt: FieldValue.delete(), error: FieldValue.delete(), leaseUntil: FieldValue.delete(), retriedAt: nowIso() });
    tx.update(messageRef, { status: 'queued', failedAt: FieldValue.delete(), error: FieldValue.delete(), retriedAt: nowIso() });
    return { messageId, status: 'queued', requeued: true };
  });
}
export async function reconcileOutboundMessage(db: Firestore, actor: Actor, conversationId: string, messageId: string) {
  const jobRef = db.collection('communicationOutboundJobs').doc(messageId);
  const conversationRef = agencyCollection(db, actor.agencyId, 'conversations').doc(conversationId);
  const messageRef = conversationRef.collection('messages').doc(messageId);
  const result = await db.runTransaction(async tx => {
    await assertAutomationFence(db, tx, actor);
    const [profile, conversation, jobDoc, messageDoc] = await Promise.all([tx.get(db.collection('users').doc(actor.uid)), tx.get(conversationRef), tx.get(jobRef), tx.get(messageRef)]);
    if (profile.data()?.agencyId !== actor.agencyId || profile.data()?.role !== actor.role || !['agent', 'admin'].includes(actor.role || '') || !conversation.exists || !canReadConversation(actor, conversation.data() as Conversation)) throw new CommunicationError('Acces revocat.', 403);
    const job = jobDoc.data(), message = messageDoc.data();
    if (!job || job.agencyId !== actor.agencyId || job.conversationId !== conversationId || !message || message.direction !== 'sent' || message.origin !== 'imodeus' || message.agencyId !== actor.agencyId || message.conversationId !== conversationId) throw new CommunicationError('Mesajul nu corespunde conversației.', 409);
    if (job.status !== 'unknown') return { messageId, status: job.status, reconciled: false, unresolved: false };
    const externalId = job.externalId || message.externalId;
    if (!externalId || job.externalId && message.externalId && job.externalId !== message.externalId) return { messageId, status: 'unknown', reconciled: false, unresolved: true };
    const mappingRef = db.collection('communicationMessageMappings').doc(stableId(job.connectionId, externalId));
    const mapping = (await tx.get(mappingRef)).data();
    if (mapping && (mapping.connectionId !== job.connectionId || mapping.conversationId !== conversationId)) return { messageId, status: 'unknown', reconciled: false, unresolved: true };
    const echoRef = mapping?.messageId && mapping.messageId !== messageId ? conversationRef.collection('messages').doc(mapping.messageId) : null;
    const echo = echoRef ? (await tx.get(echoRef)).data() : null;
    if (echoRef && (!echo || echo.externalId !== externalId || echo.direction !== 'sent' || echo.agencyId !== actor.agencyId || echo.conversationId !== conversationId || echo.origin !== 'native')) return { messageId, status: 'unknown', reconciled: false, unresolved: true };
    const known = ['accepted', 'delivered', 'read', 'failed'];
    let status: Message['status'] = 'unknown';
    if (job.externalId === externalId && Number.isFinite(Date.parse(job.providerAcceptedAt))) status = 'accepted';
    if (message.externalId === externalId && known.includes(message.status)) status = advanceStatus(status, message.status);
    if (mapping?.messageId === messageId && known.includes(mapping.pendingStatus)) status = advanceStatus(status, mapping.pendingStatus);
    if (echo && known.includes(echo.status)) status = advanceStatus(status, echo.status);
    if (status === 'unknown') return { messageId, status, reconciled: false, unresolved: true };
    const failedAt = message.failedAt || echo?.failedAt || mapping?.pendingFailedAt || nowIso();
    const patch = { status, externalId, error: FieldValue.delete(), reconciledAt: nowIso(), ...(status === 'failed' ? { failedAt } : {}) };
    tx.update(jobRef, { ...patch, budgetSettled: false });
    tx.update(messageRef, patch);
    tx.set(mappingRef, { connectionId: job.connectionId, conversationId, messageId });
    if (echoRef) tx.delete(echoRef);
    tx.set(db.collection('communicationSearchJobs').doc(stableId(conversationId, messageId)), { agencyId: actor.agencyId, conversationId, messageId, status: 'queued', updatedAt: nowIso() });
    return { messageId, status, reconciled: true, unresolved: false };
  });
  if (result.reconciled) await settleBudget(db, messageId);
  return result;
}
export async function drainOutbound(db: Firestore) {
  const accounting = await db.collection('communicationOutboundJobs').where('budgetSettled', '==', false).where('status', 'in', ['delivered', 'read', 'failed']).limit(50).get();
  const failures: string[] = [];
  for (const row of accounting.docs) { try { await settleBudget(db, row.id); } catch { failures.push('Budget settlement failed'); } }
  const stuck = await db.collection('communicationOutboundJobs').where('status', '==', 'sending').limit(50).get();
  for (const doc of stuck.docs) if (doc.data().leaseUntil < Date.now()) {
    try { await db.runTransaction(async tx => {
      const fresh = await tx.get(doc.ref); const job = fresh.data();
      if (job?.status !== 'sending' || job.leaseUntil >= Date.now()) return;
      const ref = agencyCollection(db, job.agencyId, 'conversations').doc(job.conversationId).collection('messages').doc(doc.id);
      const message = await tx.get(ref);
      if (['delivered', 'read', 'failed'].includes(message.data()?.status)) return;
      tx.update(doc.ref, { status: 'unknown', error: 'Confirmarea trimiterii nu a sosit. Verifică înainte de retrimitere.' });
      if (message.exists) tx.update(ref, { status: 'unknown' });
    }); } catch { failures.push('Send recovery failed'); }
  }
  const inboundBacklog = await db.collection('communicationWebhookEvents').where('status', 'in', ['queued', 'failed']).limit(1).get();
  const jobs = await db.collection('communicationOutboundJobs').where('status', '==', 'queued').limit(3).get();
  for (const row of jobs.docs) {
    try {
    const queuedConversation = await agencyCollection(db, row.data().agencyId, 'conversations').doc(row.data().conversationId).get();
    if (queuedConversation.data()?.channel === 'whatsapp' && !inboundBacklog.empty) continue;
    const claimed = await db.runTransaction(async tx => { const fresh = await tx.get(row.ref); if (fresh.data()?.status !== 'queued') return null; tx.update(row.ref, { status: 'sending', leaseUntil: Date.now() + 90000 }); return fresh.data()!; });
    if (!claimed) continue;
    const job = claimed;
    if (job.retrySendApproval) job.input = { ...job.input, sendApproval: job.retrySendApproval };
    const messageRef = agencyCollection(db, job.agencyId, 'conversations').doc(job.conversationId).collection('messages').doc(row.id);
    let attempted = false;
    try {
      const user = await db.collection('users').doc(job.uid).get();
      if (user.data()?.agencyId !== job.agencyId) throw new CommunicationError('Agentul nu mai aparține agenției.');
      const actor = { uid: job.uid, agencyId: job.agencyId, role: user.data()?.role };
      const conversation = await getConversation(db, actor, job.conversationId);
      assertRecipientRevision(conversation, job.recipientRevision);
      if (job.input.expectedRecipientRevision !== undefined) assertRecipientRevision(conversation, job.input.expectedRecipientRevision);
      await assertPersonalRecipient(db, actor, conversation, job.input.personalRecipient);
      const estimate = await estimateSend(db, actor, conversation, job.input);
      if (job.input.sendApproval !== undefined || job.input.expectedRecipientRevision !== undefined) assertSendApproval(job.input.sendApproval, estimate);
      if (estimate.currency !== job.estimate.currency || estimate.amount > job.estimate.amount) throw new CommunicationError('Tariful s-a modificat. Pregătește din nou trimiterea.');
      const { connection, token } = await connectionToken(db, actor, job.connectionId, 'send');
      const latestConversation = await getConversation(db, actor, job.conversationId);
      assertRecipientRevision(latestConversation, job.recipientRevision);
      await assertPersonalRecipient(db, actor, latestConversation, job.input.personalRecipient);
      assertNoReplySince(latestConversation, job.input.stopOnReplySince);
      await assertMatchingSend(db, actor, latestConversation, job.input.matchingSelection);
      await validatePortalBatch(db, actor, latestConversation, job.input, undefined, row.id);
      const currentBinding = await bindViewingConfirmation(db, actor.agencyId, latestConversation, job.input.viewingConfirmation);
      if (JSON.stringify(currentBinding) !== JSON.stringify(job.viewingConfirmation || null)) throw new CommunicationError('Programarea sau participantul s-a schimbat.', 409);
      assertViewingTemplate(currentBinding, estimate.renderedText, Boolean(job.input.template));
      await assertCurrentRecipientEligibility(db, actor, latestConversation, job.input, estimate.category);
      await messageRef.update({ status: 'sending' });
      attempted = true;
      const response = await graph(`/${connection.externalId}/messages`, token, { ...estimate.body, ...(connection.channel === 'whatsapp' ? { biz_opaque_callback_data: receiptCorrelation(row.id, connection.id) } : {}) });
      const externalId = response.messages?.[0]?.id || response.message_id;
      if (!externalId) throw new Error('Platforma nu a returnat identificatorul mesajului.');
      // Persist provider acceptance before the larger receipt/echo transaction.
      await row.ref.update({ externalId, providerAcceptedAt: nowIso() });
      const mapping = db.collection('communicationMessageMappings').doc(stableId(job.connectionId, externalId));
      await db.runTransaction(async tx => {
        const existing = await tx.get(mapping);
        const echoId = existing.data()?.messageId;
        const conversationRef = messageRef.parent.parent!;
        const [conversationDoc, currentMessage] = await Promise.all([tx.get(conversationRef), tx.get(messageRef)]);
        const current = conversationDoc.data() as Conversation;
        const echo = echoId && echoId !== row.id ? await tx.get(conversationRef.collection('messages').doc(echoId)) : null;
        tx.set(mapping, { connectionId: job.connectionId, conversationId: job.conversationId, messageId: row.id });
        const confirmedStatus = advanceStatus(currentMessage.data()?.status || 'accepted', echo?.data()?.status || existing.data()?.pendingStatus || 'accepted');
        tx.update(messageRef, { externalId, status: confirmedStatus, ...(confirmedStatus === 'failed' ? { failedAt: currentMessage.data()?.failedAt || echo?.data()?.failedAt || existing.data()?.pendingFailedAt || nowIso() } : {}), ...(confirmedStatus === 'failed' && existing.data()?.pendingError ? { error: existing.data()?.pendingError } : {}) });
        if (echo?.exists) tx.delete(echo.ref);
        const sentAt = nowIso();
        tx.update(conversationRef, { lastOutboundAt: sentAt, lastMessageAt: sentAt, latestMessage: job.input.text || `[${job.input.template?.name}]`, needsReply: Boolean(current.lastInboundAt && current.lastInboundAt > sentAt), status: current.status === 'spam' ? 'spam' : 'waiting', version: current.version + 1 });
        tx.update(row.ref, { status: confirmedStatus, externalId, acceptedAt: sentAt, ...(confirmedStatus === 'failed' && existing.data()?.pendingError ? { error: existing.data()?.pendingError } : {}) });
        tx.set(db.collection('communicationSearchJobs').doc(stableId(job.conversationId, row.id)), { agencyId: job.agencyId, conversationId: job.conversationId, messageId: row.id, status: 'queued', updatedAt: sentAt });
      });
      // Billing is reconciled from delivery or failure receipts, never API acceptance.
    } catch (error) {
      // Once a request may have reached Meta, preserve the reservation and never automatically resend.
      const rejectedByMeta = error instanceof MetaGraphError && error.providerStatus >= 400 && error.providerStatus < 500 && error.providerStatus !== 429;
      const status = attempted && !rejectedByMeta ? 'unknown' : 'failed';
      const message = error instanceof Error ? error.message : 'Trimiterea a eșuat.';
      if (error instanceof MetaGraphError && error.providerStatus === 401) {
        await agencyCollection(db, job.agencyId, 'channelConnections').doc(job.connectionId).update({
          'capabilities.send': { status: 'reconnect_required', reason: 'Meta a revocat sau a expirat autorizarea de trimitere.' },
        }).catch(() => undefined);
      }
      await db.runTransaction(async tx => {
        const [freshJob, freshMessage] = await Promise.all([tx.get(row.ref), tx.get(messageRef)]);
        if (['delivered', 'read', 'failed'].includes(freshJob.data()?.status) || (freshJob.data()?.status === 'accepted' && freshJob.data()?.externalId)) return;
        tx.update(row.ref, { status, error: message, failureStage: attempted ? 'after_provider' : 'before_provider', failureId: randomUUID(), ...(status === 'failed' ? { failedAt: nowIso() } : {}) });
        if (freshMessage.exists) tx.update(messageRef, { status, error: message, ...(status === 'failed' ? { failedAt: nowIso() } : {}) });
      });
      if (status === 'failed') await settleBudget(db, row.id);
    }
    } catch { failures.push('Outbound job persistence failed'); }
  }
  if (failures.length) throw new Error(failures.join('; '));
  return jobs.size;
}
