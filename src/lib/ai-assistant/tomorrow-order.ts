import { z } from 'zod';
import { collectionFor, getResource, type AssistantContext } from './access';
import { resolveDatetime } from './datetime';
import { taskDueDay } from './task-agenda';
import { zonedParts } from './zoned-time';

export const tomorrowOrderSchema = z.object({}).strict();
type Row = Record<string, any>;
const method = 'Propunere de ordine, nesalvată. Programările existente își păstrează orele. Pentru sarcinile fără oră folosim orientativ 09:00–18:00 București, 30 minute pentru sarcini sau 60 pentru vizionări dacă durata lipsește și o rezervă de 15 minute înainte/după vizionări. Încercăm întâi sarcinile mai scurte, în primul interval suficient; nu este un optim matematic sau un traseu rutier. Nu verifică disponibilitatea clienților, calendarele externe sau timpul real de deplasare. Explică separat sarcinile care nu încap și suprapunerile deja existente.';
const local = (value: number) => { const p = zonedParts(new Date(value), 'Europe/Bucharest'); return `${p.date} ${p.time} (ora București)`; };

export function orderTomorrow(tasks: Row[], viewings: Row[], actor: string, now = new Date()) {
  const date = resolveDatetime({ dayOffset: 1, time: '12:00' }, now).local.slice(0, 10);
  const start = Date.parse(resolveDatetime({ date, time: '09:00' }, now).iso), end = Date.parse(resolveDatetime({ date, time: '18:00' }, now).iso);
  const dayStart = Date.parse(resolveDatetime({ date, time: '00:00' }, now).iso);
  const dayEnd = Date.parse(resolveDatetime({ dayOffset: 2, time: '00:00' }, now).iso);
  const today = zonedParts(now, 'Europe/Bucharest').date;
  const fixed: Row[] = [], flexible: Row[] = [], issues: Row[] = [];
  for (const [resource, list] of [['tasks', tasks], ['viewings', viewings]] as const) for (const row of list) {
    if (row.agentId !== actor || row.status !== (resource === 'tasks' ? 'open' : 'scheduled')) continue;
    const value = resource === 'tasks' ? row.dueDate : row.viewingDate, day = taskDueDay(value);
    if (!day) { issues.push({ resource, id: row.id, reason: 'Dată invalidă; calendarul nu poate fi evaluat complet.' }); continue; }
    if (day < today || day > date) continue;
    const minutes = row.duration ?? (resource === 'tasks' ? 30 : 60);
    if (!Number.isInteger(minutes) || minutes <= 0 || minutes > 1440) {
      if (day === date || day < date && day >= zonedParts(now, 'Europe/Bucharest').date) issues.push({ resource, id: row.id, reason: 'Durată invalidă.' });
      continue;
    }
    const base = { id: row.id, resource, title: resource === 'tasks' ? row.description || 'Sarcină fără descriere' : 'Vizionare', contactId: row.contactId || null, propertyId: row.propertyId || null, duration: minutes, assumedDuration: row.duration == null };
    if (resource === 'tasks' && !row.startTime && !value.includes('T')) {
      if (day === date) flexible.push(base);
      continue;
    }
    let at: number;
    try {
      if (resource === 'viewings') { if (!value.includes('T')) throw new Error('Missing clock'); at = Date.parse(value); }
      else {
        const explicit = value.includes('T') && (!row.startTime || zonedParts(new Date(value), 'Europe/Bucharest').time === row.startTime);
        at = Date.parse(explicit ? value : resolveDatetime({ date: day, time: row.startTime }, now).iso);
      }
    } catch { if (day <= date) issues.push({ resource, id: row.id, reason: 'Ora nu poate fi stabilită.' }); continue; }
    const until = at + minutes * 60000;
    if (at < dayEnd && until > dayStart) fixed.push({ ...base, kind: 'fixed', at, until, startLocal: local(at), endLocal: local(until), description: 'Programare existentă, păstrată.' });
  }
  if (issues.length || fixed.length + flexible.length > 100) return { rows: [], unplaced: [], conflicts: [], issues, complete: false, status: issues.length ? 'invalid_calendar' : 'partial', date, method };
  fixed.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  const conflicts: Row[] = [];
  for (let i = 0; i < fixed.length; i++) for (let j = i + 1; j < fixed.length && fixed[j].at < fixed[i].until; j++) conflicts.push({ first: { resource: fixed[i].resource, id: fixed[i].id }, second: { resource: fixed[j].resource, id: fixed[j].id }, reason: 'Suprapunere existentă; orele au fost păstrate.' });
  const busy = fixed.map(row => ({ start: Math.max(start, row.at - (row.resource === 'viewings' ? 15 * 60000 : 0)), end: Math.min(end, row.until + (row.resource === 'viewings' ? 15 * 60000 : 0)) })).filter(row => row.start < row.end).sort((a, b) => a.start - b.start);
  const gaps: { start: number; end: number }[] = []; let cursor = start;
  for (const row of busy) { if (row.start > cursor) gaps.push({ start: cursor, end: row.start }); cursor = Math.max(cursor, row.end); }
  if (cursor < end) gaps.push({ start: cursor, end });
  const suggested: Row[] = [], unplaced: Row[] = [];
  flexible.sort((a, b) => a.duration - b.duration || a.id.localeCompare(b.id));
  for (const row of flexible) {
    const gap = gaps.find(g => g.end - g.start >= row.duration * 60000);
    if (!gap) { unplaced.push({ ...row, reason: 'Nu încape integral în intervalele disponibile din 09:00–18:00.' }); continue; }
    const at = gap.start, until = at + row.duration * 60000; gap.start = until;
    suggested.push({ ...row, kind: 'suggested', at, until, startLocal: local(at), endLocal: local(until), description: `Oră propusă, nesalvată.${row.assumedDuration ? ' Durată orientativă: 30 minute.' : ''}` });
  }
  const rows = [...fixed, ...suggested].sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  return { rows, unplaced, conflicts, issues, complete: true, status: conflicts.length ? 'existing_conflicts' : 'resolved', date, method };
}

export async function tomorrowOrder(ctx: AssistantContext, now = new Date()) {
  const read = (resource: string) => collectionFor(ctx, resource).where('agentId', '==', ctx.uid).orderBy('__name__').limit(5001).get();
  const [tasks, viewings] = await Promise.all([read('tasks'), read('viewings')]);
  if (tasks.size > 5000 || viewings.size > 5000) return { rows: [], unplaced: [], conflicts: [], issues: [], complete: false, status: 'partial', method };
  const result = orderTomorrow(tasks.docs.map(doc => ({ ...doc.data(), id: doc.id })), viewings.docs.map(doc => ({ ...doc.data(), id: doc.id })), ctx.uid, now);
  const cache = new Map<string, Promise<Row | null>>();
  const related = (source: string, id: unknown) => {
    if (typeof id !== 'string' || !id || id.includes('/')) return Promise.resolve(null);
    const key = `${source}/${id}`;
    if (!cache.has(key)) cache.set(key, getResource(ctx, source, id).catch(error => { if ([403, 404].includes(Number(error.status))) return null; throw error; }));
    return cache.get(key)!;
  };
  for (const row of result.rows.filter(row => row.resource === 'viewings')) {
    const [contact, property] = await Promise.all([related('contacts', row.contactId), related('properties', row.propertyId)]);
    row.title = `${contact?.name || 'Client indisponibil'} — ${property?.title || 'Proprietate indisponibilă'}`;
  }
  return result;
}
