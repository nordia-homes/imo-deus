import { z } from 'zod';
import { collectionFor, getResource, type AssistantContext } from './access';
import { completedViewings } from './property-viewings';
import { resolveDatetime } from './datetime';
import { zonedParts } from './zoned-time';

export const viewingFollowupsSchema = z.object({
  dayOffset: z.number().int().min(-3650).max(0).optional(),
  agentId: z.string().min(1).max(180).optional(),
  cursor: z.string().min(1).max(180).optional(),
}).strict();
export function withoutFollowup(viewings: Record<string, any>[], tasks: Record<string, any>[], agentId: string, now: Date, date?: string) {
  const linked = new Set(tasks.filter(task => ['open', 'completed'].includes(task.status)).map(task => task.viewingId));
  return completedViewings(viewings, now).filter(row => row.agentId === agentId && !linked.has(row.id)
    && (!date || zonedParts(new Date(row.viewingDate), 'Europe/Bucharest').date === date));
}
export async function viewingFollowups(ctx: AssistantContext, value: z.infer<typeof viewingFollowupsSchema>, now = new Date()) {
  const input = viewingFollowupsSchema.parse(value);
  const scan = async (resource: string) => {
    const rows: Record<string, any>[] = []; let cursor: string | undefined;
    const started = Date.now();
    for (let page = 0; page < 20 && Date.now() - started < 12000; page++) {
      let query = collectionFor(ctx, resource).orderBy('__name__').limit(250);
      if (cursor) query = query.startAfter(cursor);
      const snapshot = await query.get();
      rows.push(...snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })));
      if (snapshot.size < 250) return rows;
      cursor = snapshot.docs.at(-1)!.id;
    }
    return null;
  };
  const [viewings, tasks] = await Promise.all([scan('viewings'), scan('tasks')]);
  if (!viewings || !tasks) return { rows: [], complete: false, status: 'partial', nextCursor: null, count: null };
  const date = input.dayOffset === undefined ? undefined : resolveDatetime({ dayOffset: input.dayOffset, time: '12:00' }, now).local.slice(0, 10);
  const matches = withoutFollowup(viewings, tasks, input.agentId || ctx.uid, now, date);
  const offset = input.cursor ? matches.findIndex(row => row.id === input.cursor) + 1 : 0;
  if (input.cursor && !offset) throw new Error('Lista s-a schimbat; reia citirea fără cursor.');
  const selected = matches.slice(offset, offset + 100), rows = [];
  for (const row of selected) {
    const [contact, property] = await Promise.all([getResource(ctx, 'contacts', row.contactId), getResource(ctx, 'properties', row.propertyId)]);
    const local = zonedParts(new Date(row.viewingDate), 'Europe/Bucharest');
    rows.push({ viewingLocal: `${local.date} ${local.time} (ora București)`, id: row.id, viewingId: row.id, viewingDate: row.viewingDate, contactId: contact.id, contactName: contact.name,
      propertyId: property.id, propertyTitle: property.title, agentId: row.agentId,
      suggestedTask: { viewingId: row.id, contactId: contact.id, propertyId: property.id, agentId: row.agentId,
        description: `Follow-up după vizionare: ${contact.name} — ${property.title}`,
        dueDate: zonedParts(now, 'Europe/Bucharest').date } });
  }
  const more = offset + selected.length < matches.length;
  return { rows, count: matches.length, complete: !more, nextCursor: more ? selected.at(-1)!.id : null, status: 'resolved',
    definition: 'Vizionări completed ale agentului, fără sarcină open/completed legată explicit prin viewingId. Sarcinile vechi fără această legătură necesită verificare separată; lipsa legăturii nu dovedește lipsa contactării clientului.' };
}
