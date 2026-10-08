import { z } from 'zod';
import type { Transaction } from 'firebase-admin/firestore';
import { collectionFor, getResource, type AssistantContext } from './access';
import { resolveDatetime } from './datetime';
import { zonedParts } from './zoned-time';
import { taskInterval, calendarRead } from '@/lib/crm/calendar';

const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
export const calendarAvailabilitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), dayOffset: z.number().int().min(0).max(365).optional(),
  fromTime: clock, untilTime: z.union([clock, z.literal('24:00')]).default('24:00'),
  duration: z.number().int().min(1).max(240).default(1),
  contactId: z.string().min(1).max(180).optional(), propertyId: z.string().min(1).max(180).optional(),
}).strict().refine(v => !(v.date && v.dayOffset !== undefined), 'Alege date sau dayOffset.');
type Window = { start: string; end: string };
type Row = Record<string, any>;
export function freeCalendarIntervals(tasks: Row[], viewings: Row[], window: Window, duration: number, actor: string, contactId?: string, propertyId?: string, now = new Date()) {
  const start = Math.max(Date.parse(window.start), (Math.floor(now.getTime() / 60000) + 1) * 60000), end = Date.parse(window.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= Date.parse(window.start) || end - Date.parse(window.start) > 25 * 3600000) throw new Error('Fereastra calendaristică trebuie să aibă cel mult 25 de ore.');
  const related = (row: Row) => row.agentId === actor || contactId && row.contactId === contactId || propertyId && row.propertyId === propertyId;
  const busy: { start: number; end: number }[] = []; let invalid = 0, untimed = 0;
  for (const [resource, rows] of [['tasks', tasks], ['viewings', viewings]] as const) for (const row of rows) {
    if (!related(row) || (resource === 'tasks' ? row.status !== 'open' : row.status !== 'scheduled')) continue;
    if (resource === 'tasks' && !row.startTime) { untimed++; continue; }
    try {
      const interval = resource === 'tasks' ? taskInterval(row) : { start: row.viewingDate, duration: row.duration ?? 60 };
      const at = Date.parse(interval?.start || ''), minutes = Number(interval?.duration);
      if (!Number.isFinite(at) || !Number.isInteger(minutes) || minutes < 1 || minutes > (resource === 'tasks' ? 1440 : 240)) { invalid++; continue; }
      const until = at + minutes * 60000;
      if (at < end && until > start) busy.push({ start: Math.max(start, at), end: Math.min(end, until) });
    } catch { invalid++; }
  }
  if (invalid) return { rows: [], complete: false, status: 'invalid_calendar', invalid, untimed };
  busy.sort((a, b) => a.start - b.start);
  const rows: { start: string; end: string; startLocal: string; endLocal: string }[] = [];
  const add = (a: number, b: number) => {
    if (b - a < duration * 60000) return;
    const local = (at: number) => { const value = zonedParts(new Date(at), 'Europe/Bucharest'); return `${value.date} ${value.time}`; };
    rows.push({ start: new Date(a).toISOString(), end: new Date(b).toISOString(), startLocal: local(a), endLocal: local(b) });
  };
  let cursor = start;
  for (const slot of busy) { add(cursor, slot.start); cursor = Math.max(cursor, slot.end); }
  add(cursor, end);
  return { rows, complete: true, status: rows.length ? 'resolved' : 'no_availability', invalid, untimed };
}
export async function readCalendarAvailability(ctx: AssistantContext, window: Window, duration: number, contactId?: string, propertyId?: string, tx?: Transaction, now = new Date()) {
  const read = async (resource: string) => { const query = collectionFor(ctx, resource).orderBy('__name__').limit(5001); return calendarRead(() => tx ? tx.get(query) : query.get()); };
  const tasks = await read('tasks'), viewings = await read('viewings');
  if (tasks.size > 5000 || viewings.size > 5000) return { rows: [], complete: false, status: 'partial', invalid: 0, untimed: 0 };
  return freeCalendarIntervals(tasks.docs.map(doc => doc.data()), viewings.docs.map(doc => doc.data()), window, duration, ctx.uid, contactId, propertyId, now);
}
export async function calendarAvailability(ctx: AssistantContext, value: z.infer<typeof calendarAvailabilitySchema>, now = new Date()) {
  const input = calendarAvailabilitySchema.parse(value);
  const contact = input.contactId ? await getResource(ctx, 'contacts', input.contactId) : null;
  const property = input.propertyId ? await getResource(ctx, 'properties', input.propertyId) : null;
  const date = resolveDatetime({ ...(input.date ? { date: input.date } : { dayOffset: input.dayOffset ?? 1 }), time: '12:00' }, now).local.slice(0, 10);
  const nextDay = new Date(Date.parse(date + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10);
  const window = { start: resolveDatetime({ date, time: input.fromTime }, now).iso, end: resolveDatetime({ date: input.untilTime === '24:00' ? nextDay : date, time: input.untilTime === '24:00' ? '00:00' : input.untilTime }, now).iso };
  const result = await readCalendarAvailability(ctx, window, input.duration, input.contactId, input.propertyId, undefined, now);
  const propertyAvailable = !property || ['Activ', 'Rezervat'].includes(property.status);
  const first = result.complete && propertyAvailable && result.rows[0];
  return { ...result, window, duration: input.duration, timezone: 'Europe/Bucharest',
    contact: contact ? { id: contact.id, name: contact.name } : null, property: property ? { id: property.id, title: property.title, status: property.status } : null, propertyAvailable,
    scope: 'Calendar CRM: taskuri open cu oră și vizionări scheduled. Fără timp de deplasare sau calendare externe. Limita implicită este sfârșitul zilei, nu programul de lucru.',
    suggestedViewing: first && input.contactId && input.propertyId && input.duration >= 15 ? { kind: 'schedule_viewing', contactId: input.contactId, propertyId: input.propertyId, viewingDate: first.start, duration: input.duration, notes: '', firstAvailable: window } : null };
}
