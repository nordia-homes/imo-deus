import { z } from 'zod';
import { collectionFor, getResource, type AssistantContext } from './access';
import { taskDueDay } from './task-agenda';
import { resolveDatetime } from './datetime';
import { zonedParts } from './zoned-time';

export const todayReviewSchema = z.object({ cursor: z.number().int().min(0).max(10000).optional() }).strict();
const definition = 'Bilanț al calendarului CRM al agentului, azi în București, la momentul verificării. Sarcinile deschise cu ora de început depășită necesită verificare; aceasta nu dovedește că nu au fost executate. Vizionările programate al căror interval s-a încheiat necesită înregistrarea rezultatului; nu sunt declarate neprezentări. Sarcinile deschise fără oră sunt încă de făcut azi, nu întârzieri demonstrate. Nu include zile anterioare, activități viitoare, mesaje sau alte sisteme. Confirmarea WhatsApp nu dovedește efectuarea vizionării.';

export function reviewActivity(resource: 'tasks' | 'viewings', row: Record<string, any>, actor: string, now: Date) {
  if (row.agentId !== actor || row.status !== (resource === 'tasks' ? 'open' : 'scheduled')) return { state: 'excluded' as const };
  const today = zonedParts(now, 'Europe/Bucharest').date;
  const day = taskDueDay(resource === 'tasks' ? row.dueDate : row.viewingDate);
  if (!day) return { state: 'invalid' as const, reason: 'Dată lipsă sau invalidă.' };
  if (day !== today) return { state: 'excluded' as const };
  if (resource === 'tasks') {
    // Date-only tasks have no hour. An ISO instant still supplies an hour when
    // a legacy record has no separate startTime field.
    if (!row.startTime && !row.dueDate.includes('T')) return { state: 'included' as const, category: 'untimed_task', at: null,
      reason: 'Sarcină deschisă pentru azi, fără oră; nu poate fi declarată întârziată.' };
    if (row.startTime && (typeof row.startTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(row.startTime))) return { state: 'invalid' as const, reason: 'Ora sarcinii este invalidă.' };
    let at: string;
    try {
      const explicit = row.dueDate.includes('T') && (!row.startTime || zonedParts(new Date(row.dueDate), 'Europe/Bucharest').time === row.startTime);
      at = explicit ? new Date(row.dueDate).toISOString() : resolveDatetime({ date: day, time: row.startTime }, now).iso;
    }
    catch { return { state: 'invalid' as const, reason: 'Ora locală nu poate fi stabilită.' }; }
    return Date.parse(at) < now.getTime() ? { state: 'included' as const, category: 'overdue_task', at,
      reason: 'Ora programată a trecut, iar sarcina este încă deschisă în CRM; verifică efectuarea.' } : { state: 'excluded' as const };
  }
  if (!row.viewingDate.includes('T')) return { state: 'invalid' as const, reason: 'Vizionarea nu are o oră explicită.' };
  const duration = row.duration ?? 60;
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0 || duration > 1440) return { state: 'invalid' as const, reason: 'Durata vizionării este invalidă.' };
  const at = new Date(row.viewingDate).toISOString();
  return Date.parse(at) + duration * 60000 <= now.getTime() ? { state: 'included' as const, category: 'viewing_outcome_missing', at,
    reason: 'Intervalul s-a încheiat, dar vizionarea este încă programată în CRM; rezultatul trebuie verificat. Nu dovedește neprezentarea.' } : { state: 'excluded' as const };
}

export async function todayReview(ctx: AssistantContext, value: z.infer<typeof todayReviewSchema>, now = new Date()) {
  const input = todayReviewSchema.parse(value), started = Date.now();
  const rows: Record<string, any>[] = [], issues: { resource: string; id: string; reason: string }[] = [];
  const localNow = zonedParts(now, 'Europe/Bucharest');
  const base = { checkedAt: now.toISOString(), checkedLocal: `${localNow.date} ${localNow.time} (ora București)`, day: localNow.date, definition };
  for (const resource of ['tasks', 'viewings'] as const) {
    let cursor: string | undefined, exhausted = false;
    for (let page = 0; page < 20 && Date.now() - started < 12000; page++) {
      let query = collectionFor(ctx, resource).where('agentId', '==', ctx.uid).orderBy('__name__').limit(250);
      if (cursor) query = query.startAfter(cursor);
      const snapshot = await query.get();
      for (const doc of snapshot.docs) {
        const row = doc.data(), result = reviewActivity(resource, row, ctx.uid, now);
        if (result.state === 'invalid') issues.push({ resource, id: doc.id, reason: result.reason });
        if (result.state !== 'included') continue;
        const local = result.at ? zonedParts(new Date(result.at), 'Europe/Bucharest') : null;
        rows.push({ id: doc.id, resource, category: result.category, title: resource === 'tasks' ? row.description || 'Sarcină fără descriere' : 'Vizionare · rezultat de verificat',
          description: result.reason, at: result.at, activityLocal: `${base.day}${local ? ` ${local.time}` : ' fără oră'} (ora București)`,
          contactId: row.contactId || null, propertyId: row.propertyId || null });
      }
      if (snapshot.size < 250) { exhausted = true; break; }
      cursor = snapshot.docs.at(-1)!.id;
    }
    if (!exhausted) return { ...base, rows: [], issues, complete: false, status: 'partial', nextCursor: null, count: null, note: 'Citirea calendarului nu s-a încheiat; nu există un bilanț complet.' };
  }
  rows.sort((a, b) => (a.at || '9999').localeCompare(b.at || '9999') || a.resource.localeCompare(b.resource) || a.id.localeCompare(b.id));
  const offset = input.cursor || 0, selected = rows.slice(offset, offset + 100), more = offset + selected.length < rows.length;
  const cache = new Map<string, Promise<Record<string, any> | null>>();
  const related = (resource: string, id: unknown) => {
    if (typeof id !== 'string' || !id || id.includes('/')) return Promise.resolve(null);
    const key = `${resource}/${id}`;
    if (!cache.has(key)) cache.set(key, getResource(ctx, resource, id).catch(error => {
      if ([403, 404].includes(Number(error.status))) return null;
      throw error;
    }));
    return cache.get(key)!;
  };
  for (const row of selected) {
    if (row.resource !== 'viewings') continue;
    const [contact, property] = await Promise.all([related('contacts', row.contactId), related('properties', row.propertyId)]);
    row.title = `${contact?.name || 'Client indisponibil'} — ${property?.title || 'Proprietate indisponibilă'}`;
    row.contactName = contact?.name || null; row.propertyTitle = property?.title || null;
  }
  const counts = { overdueTasks: rows.filter(row => row.category === 'overdue_task').length, viewingsWithoutOutcome: rows.filter(row => row.category === 'viewing_outcome_missing').length, untimedTasks: rows.filter(row => row.category === 'untimed_task').length };
  return { ...base, rows: selected, issues, counts, count: rows.length, complete: !more && !issues.length, status: issues.length ? 'invalid_data' : 'resolved', nextCursor: more ? offset + selected.length : null,
    note: issues.length ? `${definition} ${issues.length} înregistrări au date invalide; bilanțul nu este complet.` : definition };
}
