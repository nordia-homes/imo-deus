import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { prospectOwner } from '@/lib/crm/prospect';
import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';
import type { Actor, Conversation } from './model';
import { agencyCollection, CommunicationError } from './server';

// Keep the prospect binding through quote, queue and dispatch. Conversation
// assignment alone does not reflect a later reassignment of the source prospect.
export async function assertProspectingRecipient(db: Firestore, actor: Actor, conversation: Conversation, listingId?: string, tx?: Transaction) {
  if (conversation.channel !== 'whatsapp') return;
  const ids = [...new Set([listingId, conversation.ownerListingId].filter((id): id is string => Boolean(id)))];
  for (const id of ids) {
    if (!/^[a-zA-Z0-9_.:-]+$/.test(id)) throw new CommunicationError('Referința prospectului este invalidă.', 400);
    const ref = agencyCollection(db, actor.agencyId, 'ownerListingFavorites').doc(id);
    const sourceRef = db.collection('ownerListings').doc(id);
    const [favorite, source] = await Promise.all([tx ? tx.get(ref) : ref.get(), tx ? tx.get(sourceRef) : sourceRef.get()]);
    const row = favorite.data();
    const canonical = source.data()?.publicationStatus === 'ready' && source.data()?.isCanonical === true ? source.data() : undefined;
    if (row?.isFavoriteActive === false || (!favorite.exists && !canonical)) throw new CommunicationError('Prospectul nu mai este disponibil pentru contactare.', 409);
    const owner = prospectOwner(row || {}, Date.now());
    if (!['agent', 'admin'].includes(actor.role || '') || (actor.role !== 'admin' && owner && owner !== actor.uid)) throw new CommunicationError('Prospectul este atribuit altui agent.', 403);
    const savedPhone = row?.ownerPhone;
    const phone = normalizeRomanianPhone(typeof savedPhone === 'string' && savedPhone.trim() ? savedPhone : canonical?.ownerPhone);
    if (!/^0[237]\d{8}$/.test(phone) || phone !== normalizeRomanianPhone(conversation.externalParticipantId)) throw new CommunicationError('Telefonul prospectului s-a schimbat sau nu corespunde destinatarului WhatsApp.', 409);
  }
}
