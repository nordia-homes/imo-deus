import { prospectOwner } from '@/lib/crm/prospect';
import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';
import { collectionFor, readResource, type AssistantContext } from './access';

type Row = Record<string, any>;
const phoneOf = (value: unknown) => normalizeRomanianPhone(typeof value === 'string' ? value : '');
export function bucharestDay(at: number) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(at);
  return ['year', 'month', 'day'].map(key => parts.find(part => part.type === key)!.value).join('-');
}
export function ownersToCallToday(favorites: Row[], tasks: Row[], calls: Row[], statuses: Row[], uid: string, at: number) {
  const today = bucharestDay(at);
  const blockedIds = new Set<string>(), blockedPhones = new Set<string>();
  const block = (id: unknown, phone: unknown) => {
    if (typeof id === 'string') blockedIds.add(id);
    const normalized = phoneOf(phone); if (normalized) blockedPhones.add(normalized);
  };
  for (const row of favorites) if (row.contactOutcome === 'negative' || row.aiDoNotCall === true) block(row.id, row.contactOutcomePhone || row.ownerPhone);
  for (const row of statuses) if (row.aiDoNotCall === true || ['do_not_call', 'does_not_collaborate'].includes(row.aiOutreachOutcome)) block(row.id, row.ownerPhone);
  for (const row of calls) if (row.result?.doNotCall === true || ['do_not_call', 'does_not_collaborate'].includes(row.outcome) || ['do_not_call', 'does_not_collaborate'].includes(row.result?.outcome) || ['queued', 'scheduled', 'uncalled', 'calling'].includes(row.status)) block(row.ownerListingId, row.ownerPhone);
  // A status without a phone still protects every known listing of this owner.
  for (const row of favorites) if (blockedIds.has(row.id) && phoneOf(row.ownerPhone)) blockedPhones.add(phoneOf(row.ownerPhone));
  const candidates = favorites.flatMap(row => {
    const owner = prospectOwner(row, at), phone = phoneOf(row.ownerPhone);
    if (row.isFavoriteActive !== true || (owner && owner !== uid) || !/^0[237]\d{8}$/.test(phone) || blockedIds.has(row.id) || blockedPhones.has(phone)) return [];
    const samePhoneIds = new Set(favorites.filter(favorite => phoneOf(favorite.ownerPhone) === phone).map(favorite => favorite.id));
    const reminders = tasks.filter(task => samePhoneIds.has(task.ownerListingId) && task.status === 'open' && (!task.agentId || task.agentId === uid)
      && /\b(apel|suna|sunat|follow[ -]?up|revenire)\b/.test(String(task.description || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()));
    const valid = reminders.filter(task => typeof task.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) && Number.isFinite(Date.parse(task.dueDate)) && new Date(task.dueDate).toISOString().slice(0, 10) === task.dueDate);
    const due = valid.filter(task => task.dueDate <= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    // A future promise or an unreadable deadline is not a recommendation for today.
    if (!due.length && reminders.length) return [];
    const reason = due.length ? (due[0].dueDate < today ? 'Task de apel restant' : 'Task de apel scadent astăzi') : row.contactOutcome === 'follow_up' ? 'Follow-up înregistrat, fără termen de apel' : 'Prospect activ cu telefon valid, fără termen de apel';
    return [{ id: String(row.id), title: String(row.title || row.id), ownerName: typeof row.ownerName === 'string' ? row.ownerName : '', ownerPhone: phone, reason, dueDate: due[0]?.dueDate || null, priority: due.length ? 2 : row.contactOutcome === 'follow_up' ? 1 : 0 }];
  }).sort((a, b) => b.priority - a.priority || (a.dueDate || '').localeCompare(b.dueDate || '') || a.id.localeCompare(b.id, 'en'));
  const seen = new Set<string>();
  return candidates.filter(row => { if (seen.has(row.ownerPhone)) return false; seen.add(row.ownerPhone); return true; });
}
export async function readOwnersToCallToday(ctx: AssistantContext, at = Date.now()) {
  const favorites: Row[] = []; let cursor: string | undefined;
  do {
    const page = await readResource(ctx, { resource: 'ownerListingFavorites', limit: 50, ...(cursor ? { cursor } : {}) });
    favorites.push(...page.rows);
    if (page.complete) break;
    if (!page.nextCursor || page.nextCursor === cursor) throw new Error('Citirea prospectelor este incompletă.');
    cursor = page.nextCursor;
  } while (true);
  const snapshots = await Promise.all(['tasks', 'aiOutreachCalls', 'aiOutreachOwnerListingStatuses'].map(resource => collectionFor(ctx, resource).get()));
  const [tasks, calls, statuses] = snapshots.map(snapshot => snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
  return { day: bucharestDay(at), rows: ownersToCallToday(favorites, tasks, calls, statuses, ctx.uid, at) };
}
