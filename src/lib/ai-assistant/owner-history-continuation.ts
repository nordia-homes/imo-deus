import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';
import { normalized, type AssistantMessage } from './contracts';

export type OwnerAssociationAnswer = { propertyId: string; referenceHash: string; related: boolean };
export type OwnerHistoryContinuation = { listingId: string; request: string; phone?: string; associations?: OwnerAssociationAnswer[]; association?: { propertyId: string; title: string; referenceHash: string } };

export function ownerHistoryQuestion(pending: OwnerHistoryContinuation) {
  return pending.association ? `Proprietatea «${pending.association.title}» (ID: ${pending.association.propertyId}) are o sursă de import ambiguă. Aparține proprietarului selectat? Răspunde da sau nu; voi folosi răspunsul pentru această citire a istoricului.` : 'Prospectul nu are un telefon complet pentru asocierea înregistrărilor. Care este numărul de telefon al proprietarului? Voi relua citirea pentru același prospect.';
}

// Only the requested identity answer resumes this read. New requests and cancellation stay independent.
export function ownerHistoryReply(prompt: string, history: AssistantMessage[]) {
  const last = history.filter(message => message.id !== 'current-page-context').at(-1);
  const pending = last?.role === 'assistant' ? last.ownerHistoryContinuation : undefined;
  if (!pending) return;
  const page = history.filter(message => message.id === 'current-page-context').at(-1);
  if (page?.cards?.length && !page.cards.some(card => card.source === 'ownerListingFavorites' && card.rows.length === 1 && card.rows[0].id === pending.listingId)) return;
  if (pending.association) {
    const answer = normalized(prompt).replace(/[.!?]+$/, '').trim();
    if (/^(da|da, apartine|apartine|nu|nu apartine)$/.test(answer)) {
      const associations = [...(pending.associations || []).filter(row => row.propertyId !== pending.association!.propertyId), { propertyId: pending.association.propertyId, referenceHash: pending.association.referenceHash, related: !answer.startsWith('nu') }];
      return { pending, phone: pending.phone, associations, associationAnswered: true };
    }
    if (/^(nu stiu|poate|nu sunt sigur)$/.test(answer)) return { pending, phone: pending.phone, associationAnswered: false };
    return;
  }
  const answer = normalized(prompt).replace(/^(?:telefonul(?: proprietarului)?|numarul(?: de telefon)?|telefon|numar)(?: este)?\s*[:=]?\s*/, '').replace(/[.!]$/, '').trim();
  if (!/^\+?[\d ()-]+$/.test(answer)) return;
  const phone = normalizeRomanianPhone(answer);
  if (!/^0[237]\d{8}$/.test(phone)) return { pending, phone: null };
  return { pending, phone };
}
