import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';
import { normalized, type AssistantMessage } from './contracts';

export type OwnerHistoryContinuation = { listingId: string; request: string };

// Only a phone answer resumes this read. New requests and cancellation stay independent.
export function ownerHistoryReply(prompt: string, history: AssistantMessage[]) {
  const last = history.filter(message => message.id !== 'current-page-context').at(-1);
  const pending = last?.role === 'assistant' ? last.ownerHistoryContinuation : undefined;
  if (!pending) return;
  const page = history.filter(message => message.id === 'current-page-context').at(-1);
  if (page?.cards?.length && !page.cards.some(card => card.source === 'ownerListingFavorites' && card.rows.length === 1 && card.rows[0].id === pending.listingId)) return;
  const answer = normalized(prompt).replace(/^(?:telefonul(?: proprietarului)?|numarul(?: de telefon)?|telefon|numar)(?: este)?\s*[:=]?\s*/, '').replace(/[.!]$/, '').trim();
  if (!/^\+?[\d ()-]+$/.test(answer)) return;
  const phone = normalizeRomanianPhone(answer);
  if (!/^0[237]\d{8}$/.test(phone)) return { pending, phone: null };
  return { pending, phone };
}
