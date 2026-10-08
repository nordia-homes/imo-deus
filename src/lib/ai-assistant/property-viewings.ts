import { z } from 'zod';
import { collectionFor, getResource, canReadResource, type AssistantContext } from './access';

export const propertyViewingsSchema = z.object({
  propertyId: z.string().min(1).max(180),
  mode: z.enum(['all', 'completed', 'count_completed', 'latest_completed']),
  cursor: z.string().max(180).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.cursor && !['all', 'completed'].includes(value.mode)) ctx.addIssue({ code: 'custom', message: 'Cursorul este disponibil numai pentru liste.' });
});

export function completedViewings(rows: Record<string, any>[], now: Date) {
  return rows.filter(row => row.status === 'completed' && Number.isFinite(Date.parse(row.viewingDate)) && Date.parse(row.viewingDate) <= now.getTime());
}

export async function propertyViewings(ctx: AssistantContext, value: z.infer<typeof propertyViewingsSchema>, now = new Date()) {
  const input = propertyViewingsSchema.parse(value);
  const property = await getResource(ctx, 'properties', input.propertyId);
  const base = collectionFor(ctx, 'viewings').where('propertyId', '==', input.propertyId).orderBy('__name__');
  const rows: Record<string, any>[] = [];
  let cursor: string | undefined, exhausted = false;
  const started = Date.now();
  for (let page = 0; page < 20 && Date.now() - started < 12000; page++) {
    const snapshot = await (cursor ? base.startAfter(cursor) : base).limit(250).get();
    for (const doc of snapshot.docs) {
      const row = { ...doc.data(), id: doc.id };
      if (canReadResource(ctx, 'viewings', row)) rows.push(row);
    }
    if (snapshot.size < 250) { exhausted = true; break; }
    cursor = snapshot.docs.at(-1)!.id;
  }
  // Never certify a total or latest visit from an incomplete scan.
  if (!exhausted) return { rows: [], complete: false, status: 'partial', count: null, nextCursor: null, contactIds: [], propertyId: property.id };
  const matches = input.mode === 'all' ? rows : completedViewings(rows, now);
  const offset = input.cursor ? matches.findIndex(row => row.id === input.cursor) + 1 : 0;
  if (input.cursor && !offset) throw new Error('Cursorul nu mai există în rezultatele proprietății; reia lista.');
  let selected = matches;
  if (input.mode === 'latest_completed') {
    const latest = Math.max(...matches.map(row => Date.parse(row.viewingDate)));
    selected = matches.filter(row => Date.parse(row.viewingDate) === latest);
  } else if (input.mode === 'count_completed') selected = [];
  else selected = matches.slice(offset, offset + 100);
  const more = ['all', 'completed'].includes(input.mode) && offset + selected.length < matches.length;
  const contacts = new Map<string, Record<string, any> | null>();
  for (const row of selected) if (typeof row.contactId === 'string' && row.contactId && !contacts.has(row.contactId)) {
    try { contacts.set(row.contactId, await getResource(ctx, 'contacts', row.contactId)); }
    catch (error) { if (![403, 404].includes(Number((error as { status?: number }).status))) throw error; contacts.set(row.contactId, null); }
  }
  return {
    rows: selected.map(row => ({ id: row.id, viewingDate: row.viewingDate, status: row.status, agentId: row.agentId || null,
      contactId: contacts.get(row.contactId)?.id || null, contactName: contacts.get(row.contactId)?.name || null,
      propertyId: property.id, propertyTitle: property.title || null })),
    propertyId: property.id, propertyTitle: property.title || null, count: matches.length,
    complete: !more, nextCursor: more ? selected.at(-1)!.id : null,
    status: input.mode === 'latest_completed' && selected.length > 1 ? 'tied_latest' : 'resolved',
    contactIds: [...contacts.values()].filter(Boolean).map(contact => contact!.id),
    definition: input.mode === 'all' ? 'Toate stările, toți agenții proprietății.' : 'Numai vizionări completed cu dată validă, cel târziu acum; programările neconfirmate/anulate nu dovedesc o vizită.',
  };
}
