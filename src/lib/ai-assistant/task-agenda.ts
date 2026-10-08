import { z } from 'zod';
import { collectionFor, type AssistantContext } from './access';
import { zonedParts } from './zoned-time';

export const taskAgendaSchema = z.object({
  mode: z.enum(['today', 'overdue']),
  agentId: z.string().min(1).max(180).optional(),
  cursor: z.string().min(1).max(180).optional(),
}).strict();
export function taskDueDay(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const time = Date.parse(value + 'T12:00:00Z');
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? value : null;
  }
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) return null;
  if (!taskDueDay(value.slice(0, 10))) return null;
  return zonedParts(new Date(value), 'Europe/Bucharest').date;
}
export function agendaMatches(row: Record<string, any>, mode: 'today' | 'overdue', actor: string, now: Date) {
  const day = taskDueDay(row.dueDate), today = zonedParts(now, 'Europe/Bucharest').date;
  return row.agentId === actor && row.status === 'open' && day !== null && (mode === 'today' ? day === today : day < today);
}
export async function taskAgenda(ctx: AssistantContext, value: z.infer<typeof taskAgendaSchema>, now = new Date()) {
  const input = taskAgendaSchema.parse(value), actor = input.agentId || ctx.uid;
  const rows: Record<string, any>[] = []; let cursor = input.cursor, exhausted = false, invalidDates = 0;
  const started = Date.now();
  for (let page = 0; page < 20 && Date.now() - started < 12000 && rows.length < 100; page++) {
    let query = collectionFor(ctx, 'tasks').orderBy('__name__').limit(250);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    for (const doc of snapshot.docs) {
      cursor = doc.id;
      const row = doc.data();
      if (row.agentId === actor && row.status === 'open' && !taskDueDay(row.dueDate)) invalidDates++;
      if (agendaMatches(row, input.mode, actor, now)) rows.push({ id: doc.id, description: row.description || '', status: row.status,
        dueDate: row.dueDate, dueLocal: `${taskDueDay(row.dueDate)}${row.startTime ? ` ${row.startTime} (ora București)` : ''}`,
        startTime: row.startTime || null, agentId: row.agentId, contactId: row.contactId || null, propertyId: row.propertyId || null });
      if (rows.length === 100) break;
    }
    if (snapshot.size < 250 && (!snapshot.size || cursor === snapshot.docs.at(-1)!.id)) { exhausted = true; break; }
  }
  return { rows, complete: exhausted, nextCursor: exhausted ? null : cursor, invalidDates,
    definition: input.mode === 'today' ? 'Taskuri open ale agentului cu scadența calendaristică azi în București.' : 'Taskuri open ale agentului cu ziua scadenței înainte de azi în București, inclusiv mai vechi de 30 zile. Ora depășită azi nu schimbă categoria calendaristică.' };
}
