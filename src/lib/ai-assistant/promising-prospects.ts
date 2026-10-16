import { prospectOwner } from '@/lib/crm/prospect';
import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';

export const PROSPECT_PRIORITY_CRITERIA = 'Prioritate operațională, nu probabilitate de vânzare: +40 pentru follow-up înregistrat, +20 pentru telefon românesc valid. Egalitățile sunt ordonate după ID. Sunt excluse prospectele inactive, refuzurile și atribuirile altor agenți.';

export function promisingProspects(rows: Record<string, unknown>[], uid: string, at: number) {
  return rows.filter(row => {
    const owner = prospectOwner(row, at);
    return row.isFavoriteActive === true && (!owner || owner === uid) && row.contactOutcome !== 'negative' && row.aiDoNotCall !== true;
  }).map(row => {
    const phone = normalizeRomanianPhone(typeof row.ownerPhone === 'string' ? row.ownerPhone : '');
    const followup = row.contactOutcome === 'follow_up';
    const callable = /^0[237]\d{8}$/.test(phone);
    return { ...row, id: row.id, priorityScore: (followup ? 40 : 0) + (callable ? 20 : 0),
      priorityReasons: [...(followup ? ['Follow-up înregistrat: +40'] : []), ...(callable ? ['Telefon românesc valid: +20'] : ['Telefon lipsă sau invalid: necesită completare înainte de apel'])] };
  }).sort((a, b) => b.priorityScore - a.priorityScore || String(a.id).localeCompare(String(b.id), 'en')).slice(0, 10);
}
