import { canReadResource, collectionFor, getResource, type AssistantContext } from './access';
import { assertAutomationFence } from '@/lib/crm/automation-fence';
import { normalized } from './contracts';
import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';
import { stableId } from '@/lib/communications/crypto';
import { assertRecipientRevision, recipientRevision } from '@/lib/communications/recipient-revision';

// This is an agent's attestation of prior telephone consent, never a recipient reply.
export function requestsWhatsappProspecting(prompt: string) {
  const text = normalized(prompt);
  return /\bwhatsapp\b/.test(text)
    && /\b(proprietar\w*|prospect\w*)\b/.test(text)
    && /\b(contacteaza|contactati|trimite|trimiteti|scrie|scrieti)\b/.test(text)
    && !/\b(nu|fara|daca|cand|exemplu|exemplificare|ipotetic|pregateste|ciorna|preview|verifica|arata|explica|cum)\b/.test(text);
}

export async function recordProspectingConsent(ctx: AssistantContext, conversationId: string, listingId: string, expectedRevision: string) {
  const request = ctx.prospectingRequest;
  if (!request || !requestsWhatsappProspecting(request.prompt)) throw new Error('Lipsește solicitarea explicită de contactare WhatsApp a proprietarilor.');
  if (!listingId || listingId.includes('/') || listingId.startsWith('@step:')) throw new Error('Este necesar anunțul concret al proprietarului.');
  const favorite = await collectionFor(ctx, 'ownerListingFavorites').doc(listingId).get();
  const listing = favorite.exists ? await getResource(ctx, 'ownerListingFavorites', listingId) : (await ctx.adminDb.collection('ownerListings').doc(listingId).get()).data();
  if (!listing || (!favorite.exists && (listing.publicationStatus !== 'ready' || listing.isCanonical !== true))) throw new Error('Anunțul proprietarului nu este disponibil.');
  const conversation = await getResource(ctx, 'conversations', conversationId);
  assertRecipientRevision(conversation, expectedRevision);
  const phone = normalizeRomanianPhone(listing.ownerPhone);
  if (conversation.channel !== 'whatsapp' || !/^0[237]\d{8}$/.test(phone) || normalizeRomanianPhone(conversation.externalParticipantId) !== phone) throw new Error('Telefonul proprietarului nu corespunde destinatarului WhatsApp.');
  const session = collectionFor(ctx, 'assistantSessions').doc(request.sessionId);
  const consentId = stableId(conversation.connectionId, conversation.externalParticipantId, 'marketing');
  const receiptId = stableId(ctx.uid, request.sessionId, request.requestId, consentId);
  const consent = collectionFor(ctx, 'communicationConsents').doc(consentId);
  const history = consent.collection('history').doc(receiptId);
  await ctx.adminDb.runTransaction(async tx => {
    await assertAutomationFence(ctx.adminDb, tx, ctx);
    const [owner, message, member, freshConversation, global, scoped, previous, freshListing, source] = await Promise.all([
      tx.get(session), tx.get(session.collection('messages').doc(`${request.requestId}-user`)),
      tx.get(ctx.adminDb.collection('users').doc(ctx.uid)), tx.get(collectionFor(ctx, 'conversations').doc(conversationId)),
      tx.get(collectionFor(ctx, 'communicationConsents').doc(stableId(conversation.connectionId, conversation.externalParticipantId, 'all'))),
      tx.get(consent), tx.get(history), tx.get(collectionFor(ctx, 'ownerListingFavorites').doc(listingId)), tx.get(ctx.adminDb.collection('ownerListings').doc(listingId)),
    ]);
    if (owner.data()?.ownerId !== ctx.uid || message.data()?.role !== 'user' || message.data()?.text !== request.prompt || member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new Error('Solicitarea sau accesul agentului nu mai este valid.');
    if (!freshConversation.exists || !canReadResource(ctx, 'conversations', freshConversation.data()!) || recipientRevision({ ...freshConversation.data(), id: conversationId }) !== expectedRevision) throw new Error('Destinatarul sau accesul s-a schimbat.');
    const canonical = source.data();
    const currentPhone = freshListing.data()?.ownerPhone || (canonical?.publicationStatus === 'ready' && canonical.isCanonical === true ? canonical.ownerPhone : '');
    if (normalizeRomanianPhone(currentPhone) !== phone) throw new Error('Telefonul anunțului s-a schimbat.');
    if (global.data()?.status === 'revoked' || scoped.data()?.status === 'revoked') throw new Error('Proprietarul a retras acordul WhatsApp. Solicitarea agentului nu anulează refuzul.');
    if (previous.exists) return;
    const record = { conversationId, purpose: 'marketing', status: 'granted', source: 'agent_request_prior_phone_consent', recordedBy: ctx.uid,
      recordedAt: new Date().toISOString(), evidence: request.prompt, sessionId: request.sessionId, requestId: request.requestId,
      ownerListingId: listingId, connectionId: conversation.connectionId, externalParticipantId: conversation.externalParticipantId };
    if (scoped.data()?.status !== 'granted') tx.set(consent, record);
    tx.create(history, record);
  });
  return receiptId;
}
