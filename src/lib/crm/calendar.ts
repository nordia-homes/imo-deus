import type { Transaction } from 'firebase-admin/firestore';
import { collectionFor, type AssistantContext } from '@/lib/ai-assistant/access';
import { overlaps } from '@/lib/ai-assistant/contracts';
import { resolveDatetime } from '@/lib/ai-assistant/datetime';
import { bucharestInputFromIso } from '@/lib/bucharest-time';
import { CommunicationError } from '@/lib/communications/server';

export function taskInterval(row: Record<string, any>) {
  if (row.status === 'completed' || !row.startTime || !row.dueDate) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(row.dueDate) ? row.dueDate : bucharestInputFromIso(row.dueDate).date;
  return { start: resolveDatetime({ date, time: row.startTime }).iso, duration: Number(row.duration || 30) };
}
export async function assertCalendarSlot(ctx: AssistantContext, tx: Transaction, resource: 'tasks' | 'viewings', id: string, row: Record<string, any>) {
  const slot = resource === 'tasks' ? taskInterval(row) : row.status === 'scheduled' ? { start: row.viewingDate, duration: row.duration || 60 } : null;
  if (!slot) return;
  const start = Date.parse(slot.start), end = start + slot.duration * 60000;
  if (!Number.isFinite(start)) throw new CommunicationError('Data calendaristică este invalidă.');
  const lockRef = collectionFor(ctx, 'assistantLocks').doc('calendar');
  const taskFrom = bucharestInputFromIso(new Date(start - 86400000)).date;
  const taskTo = bucharestInputFromIso(new Date(end + 86400000)).date;
  // Keep one read in flight: a rejected read must settle before Firestore can
  // retry this transaction, without other queries using its closed identity.
  const lock = await tx.get(lockRef);
  const tasks = await tx.get(collectionFor(ctx, 'tasks').where('dueDate', '>=', taskFrom).where('dueDate', '<', taskTo));
  const viewings = await tx.get(collectionFor(ctx, 'viewings').where('viewingDate', '>=', new Date(start - 4 * 3600000).toISOString()).where('viewingDate', '<', new Date(end).toISOString()));
  const related = (other: Record<string, any>) => row.agentId && other.agentId === row.agentId || row.contactId && other.contactId === row.contactId || row.propertyId && other.propertyId === row.propertyId;
  for (const item of tasks.docs) {
    if (resource === 'tasks' && item.id === id) continue;
    const other = item.data();
    if (!related(other)) continue;
    const interval = taskInterval(other);
    if (interval && overlaps(slot.start, slot.duration, interval.start, interval.duration)) throw new CommunicationError('Intervalul se suprapune cu o sarcină programată a agentului, clientului sau proprietății.', 409);
  }
  if (viewings.docs.some(item => !(resource === 'viewings' && item.id === id) && item.data().status === 'scheduled' && related(item.data()) && overlaps(slot.start, slot.duration, item.data().viewingDate, item.data().duration || 60))) throw new CommunicationError('Intervalul se suprapune cu o vizionare a agentului, clientului sau proprietății.', 409);
  // Written after every read; competing UI/AI transactions retry against this lock.
  tx.set(lockRef, { version: Number(lock.data()?.version || 0) + 1 });
}
