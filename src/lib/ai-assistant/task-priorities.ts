import { z } from 'zod';
import { collectionFor, getResource, type AssistantContext } from './access';
import { taskDueDay } from './task-agenda';
import { zonedParts } from './zoned-time';
import { normalized } from './contracts';

export const taskPrioritiesSchema = z.object({ mode: z.enum(['urgent', 'commercial']), cursor: z.number().int().min(0).max(5000).optional() }).strict();
export function taskPriority(task: Record<string, any>, contact: Record<string, any> | null, property: Record<string, any> | null, viewing: Record<string, any> | null, now: Date) {
  const today = zonedParts(now, 'Europe/Bucharest').date, dueDay = taskDueDay(task.dueDate);
  const reasons: string[] = [], urgencyReasons: string[] = [];
  const activeContact = contact && !contact.archivedAt && !['castigat', 'pierdut'].includes(normalized(contact.status));
  const high = activeContact && normalized(contact.priority) === 'ridicata';
  if (dueDay && dueDay < today) urgencyReasons.push('Scadență depășită.');
  if (dueDay === today) urgencyReasons.push('Scadență azi.');
  if (high) urgencyReasons.push('Client cu prioritate Ridicată în CRM.');
  const eligibleProperty = property && ['activ', 'rezervat'].includes(normalized(property.status));
  const offers = activeContact && eligibleProperty && task.propertyId && Array.isArray(contact.offers)
    ? contact.offers.filter((offer: any) => offer && offer.propertyId === task.propertyId) : [];
  let impact = 0;
  if (offers.some((offer: any) => normalized(offer.status) === 'acceptata')) { impact = 50; reasons.push('Ofertă acceptată pentru proprietatea acestui task.'); }
  else if (offers.some((offer: any) => normalized(offer.status) === 'in asteptare')) { impact = 40; reasons.push('Ofertă în așteptare pentru proprietatea acestui task.'); }
  else if (activeContact && normalized(contact.status) === 'in negociere') { impact = 30; reasons.push('Client în negociere în CRM.'); }
  else if (activeContact && viewing?.status === 'completed' && Date.parse(viewing.viewingDate) <= now.getTime() && viewing.contactId === task.contactId && viewing.propertyId === task.propertyId) { impact = 20; reasons.push('Follow-up legat de o vizionare efectuată.'); }
  else if (high) { impact = 10; reasons.push('Client cu prioritate Ridicată în CRM.'); }
  if (!impact) reasons.push('Nu există un semnal comercial confirmat dintre criteriile folosite.');
  return { impact, reasons, urgencyReasons, urgent: urgencyReasons.length > 0, dueDay,
    missingRelations: [task.contactId && !contact ? 'contact' : '', task.propertyId && !property ? 'property' : '', task.viewingId && !viewing ? 'viewing' : ''].filter(Boolean) };
}
export async function taskPriorities(ctx: AssistantContext, value: z.infer<typeof taskPrioritiesSchema>, now = new Date()) {
  const input = taskPrioritiesSchema.parse(value), started = Date.now();
  const tasks: Record<string, any>[] = []; let cursor: string | undefined, complete = false;
  for (let page = 0; page < 20 && Date.now() - started < 12000; page++) {
    let query = collectionFor(ctx, 'tasks').orderBy('__name__').limit(250);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    for (const doc of snapshot.docs) if (doc.data().agentId === ctx.uid && doc.data().status === 'open') tasks.push({ ...doc.data(), id: doc.id });
    if (snapshot.size < 250) { complete = true; break; }
    cursor = snapshot.docs.at(-1)!.id;
  }
  const partial = { rows: [], complete: false, status: 'partial', nextCursor: null, count: null };
  if (!complete) return partial;
  const cache = new Map<string, Promise<Record<string, any> | null>>();
  const related = (resource: string, id: unknown) => {
    if (typeof id !== 'string' || !id) return Promise.resolve(null);
    const key = resource + ':' + id;
    if (!cache.has(key)) cache.set(key, getResource(ctx, resource, id).catch(error => { if ([403, 404].includes(Number(error.status))) return null; throw error; }));
    return cache.get(key)!;
  };
  const ranked = [];
  for (const task of tasks) {
    if (Date.now() - started >= 12000) return partial;
    const [contact, property, viewing] = await Promise.all([related('contacts', task.contactId), related('properties', task.propertyId), related('viewings', task.viewingId)]);
    const priority = taskPriority(task, contact, property, viewing, now);
    ranked.push({ hasViewing: Boolean(task.viewingId), sourceDueDate: task.dueDate, startTime: task.startTime || null, updatedAt: task.updatedAt || null, viewingDate: viewing?.viewingDate || null, id: task.id, description: task.description || '', dueLocal: priority.dueDay || 'Dată invalidă/lipsă', contactId: contact?.id || null,
      contactName: contact?.name || null, propertyTitle: property?.title || null, ...priority });
  }
  const results = ranked.filter(row => input.mode === 'commercial' || row.urgent).sort((a, b) =>
    (input.mode === 'commercial' ? b.impact - a.impact : 0) || (a.dueDay || '9999').localeCompare(b.dueDay || '9999') || a.id.localeCompare(b.id));
  const offset = input.cursor || 0, rows = results.slice(offset, offset + 100).map((row, index) => ({ ...row, rank: offset + index + 1 }));
  const more = offset + rows.length < results.length;
  return { rows, complete: !more, status: 'resolved', count: results.length, nextCursor: more ? offset + rows.length : null,
    method: 'Recomandare, fără modificarea taskurilor. Urgență = scadență azi/depășită sau client activ cu prioritate Ridicată. Impact: ofertă acceptată pe proprietatea taskului > ofertă în așteptare > client în negociere > follow-up vizionare efectuată > client prioritar > fără semnal. Egalități: scadență, apoi ID. Nu estimează venituri, probabilități sau comisioane; nu este un scor comercial calibrat. Datele lipsă sunt indicate.' };
}
