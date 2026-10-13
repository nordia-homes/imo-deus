import { prospectOwner } from '@/lib/crm/prospect';
import { assertAutomationFence } from '@/lib/crm/automation-fence';
import { stableId } from '@/lib/communications/crypto';
import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';
import { canReadResource, collectionFor, type AssistantContext } from './access';
import { requestsWhatsappProspecting } from './prospecting-consent';

// Creates only the local recipient record; the normal queue owns external delivery.
export async function prospectingConversation(ctx: AssistantContext, listingId: string, connectionId: string) {
  const request = ctx.prospectingRequest;
  if (!request || !requestsWhatsappProspecting(request.prompt)) throw new Error('Contactarea proprietarului necesită solicitarea explicită WhatsApp.');
  if (![listingId, connectionId].every(id => /^[a-zA-Z0-9_.:-]+$/.test(id) && !id.startsWith('@step:'))) throw new Error('Alege anunțul și conexiunea WhatsApp concrete.');
  const session = collectionFor(ctx, 'assistantSessions').doc(request.sessionId);
  return ctx.adminDb.runTransaction(async tx => {
    await assertAutomationFence(ctx.adminDb, tx, ctx);
    const [owner, message, member, favorite, source, connection] = await Promise.all([
      tx.get(session), tx.get(session.collection('messages').doc(`${request.requestId}-user`)),
      tx.get(ctx.adminDb.collection('users').doc(ctx.uid)), tx.get(collectionFor(ctx, 'ownerListingFavorites').doc(listingId)),
      tx.get(ctx.adminDb.collection('ownerListings').doc(listingId)), tx.get(collectionFor(ctx, 'channelConnections').doc(connectionId)),
    ]);
    if (owner.data()?.ownerId !== ctx.uid || message.data()?.role !== 'user' || message.data()?.text !== request.prompt || member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new Error('Solicitarea sau accesul agentului nu mai este valid.');
    if (connection.data()?.channel !== 'whatsapp' || connection.data()?.status !== 'connected') throw new Error('Alege o conexiune WhatsApp activă din agenție.');
    const assignedOwner = prospectOwner(favorite.data() || {}, Date.now());
    if (ctx.role !== 'admin' && assignedOwner && assignedOwner !== ctx.uid) throw new Error('Prospectul este atribuit altui agent.');
    const canonical = source.data()?.publicationStatus === 'ready' && source.data()?.isCanonical === true ? source.data() : undefined;
    if (!favorite.exists && !canonical) throw new Error('Anunțul proprietarului nu este disponibil.');
    const phone = normalizeRomanianPhone(favorite.data()?.ownerPhone || canonical?.ownerPhone);
    if (!/^0[237]\d{8}$/.test(phone)) throw new Error('Anunțul nu are un telefon complet al proprietarului.');
    const recipient = `40${phone.slice(1)}`, id = stableId(connectionId, recipient);
    const ref = collectionFor(ctx, 'conversations').doc(id);
    const [existing, global, marketing] = await Promise.all([
      tx.get(ref), ...['all', 'marketing'].map(scope => tx.get(collectionFor(ctx, 'communicationConsents').doc(stableId(connectionId, recipient, scope)))),
    ]);
    if (global.data()?.status === 'revoked' || marketing.data()?.status === 'revoked') throw new Error('Proprietarul a retras acordul WhatsApp.');
    if (existing.exists) {
      if (!canReadResource(ctx, 'conversations', existing.data()!)) throw new Error('Conversația este atribuită altui agent.');
      if (existing.data()?.channel !== 'whatsapp' || existing.data()?.connectionId !== connectionId || existing.data()?.externalParticipantId !== recipient) throw new Error('Identitatea conversației nu corespunde proprietarului.');
      return id;
    }
    const now = new Date().toISOString();
    tx.create(ref, { id, agencyId: ctx.agencyId, channel: 'whatsapp', connectionId, externalParticipantId: recipient,
      name: favorite.data()?.ownerName || canonical?.ownerName || recipient, phone: recipient, email: '', contactId: null,
      ownerListingId: listingId, propertyIds: [], assigneeId: ctx.uid, collaboratorIds: [], accessUids: [ctx.uid],
      status: 'new', lastMessageAt: now, latestMessage: '', lastInboundAt: null, lastOutboundAt: null, needsReply: false,
      readBy: {}, version: 1, createdAt: now, createdBy: ctx.uid, sourceRequestId: request.requestId });
    return id;
  });
}
