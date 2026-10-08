import { z } from 'zod';
import { taskPriorities, taskPriority } from './task-priorities';
import { zonedParts } from './zoned-time';
import { resolveDatetime } from './datetime';
import type { AssistantContext } from './access';

export const taskDeferralSchema = z.object({}).strict();
export function deferralBlocked(task: Record<string, any>, contact: Record<string, any> | null, property: Record<string, any> | null, viewing: Record<string, any> | null, actor: string, now: Date) {
  const priority = taskPriority(task, contact, property, viewing, now);
  if (task.agentId !== actor || task.status !== 'open') return 'Taskul nu este deschis și atribuit agentului curent.';
  if (priority.urgent) return 'Task urgent.';
  if (!priority.dueDay || priority.missingRelations.length || task.viewingId && !Number.isFinite(Date.parse(viewing?.viewingDate))) return 'Date sau relații lipsă.';
  if (viewing && Number.isFinite(Date.parse(viewing.viewingDate)) && zonedParts(new Date(viewing.viewingDate), 'Europe/Bucharest').date === zonedParts(now, 'Europe/Bucharest').date) return 'Task asociat unei vizionări de azi.';
  return null;
}
export async function taskDeferral(ctx: AssistantContext, now = new Date()) {
  const result = await taskPriorities(ctx, { mode: 'commercial' }, now);
  if (!result.complete) return { rows: [], complete: false, status: 'partial', excluded: [] };
  const tomorrow = resolveDatetime({ dayOffset: 1, time: '12:00' }, now).local.slice(0, 10);
  const today = zonedParts(now, 'Europe/Bucharest').date;
  const rows = [], excluded = [];
  for (const row of result.rows) {
    const viewingToday = row.viewingDate && Number.isFinite(Date.parse(row.viewingDate)) && zonedParts(new Date(row.viewingDate), 'Europe/Bucharest').date === today;
    let reason = row.urgent ? 'urgent' : !row.dueDay || row.missingRelations.length || row.hasViewing && !Number.isFinite(Date.parse(row.viewingDate)) ? 'missing_data' : viewingToday ? 'viewing_today' : row.dueDay === tomorrow ? 'already_tomorrow' : null;
    if (reason) { excluded.push({ taskId: row.id, reason }); continue; }
    const startTime = row.startTime || (typeof row.sourceDueDate === 'string' && row.sourceDueDate.includes('T') ? zonedParts(new Date(row.sourceDueDate), 'Europe/Bucharest').time : undefined);
    if (!reason && startTime) {
      try { resolveDatetime({ date: tomorrow, time: startTime }, now); }
      catch { reason = 'ambiguous_or_invalid_time'; }
    }
    if (reason) { excluded.push({ taskId: row.id, reason }); continue; }
    rows.push({ id: row.id, description: row.description, suggestedTask: { kind: 'update_task' as const, taskId: row.id, deferNonUrgent: true as const,
      expectedUpdatedAt: row.updatedAt, dueDate: tomorrow, ...(startTime ? { startTime } : {}) } });
  }
  return { rows, excluded, complete: true, status: 'resolved', targetDate: tomorrow,
    definition: 'Plan propus, fără scrieri: taskuri proprii open neurgente, cu date complete, exceptând vizionările de azi și taskurile deja scadente mâine. Păstrează ora și durata. Scadențele azi/depășite sunt urgente conform regulii curente.' };
}
