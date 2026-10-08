import { z } from 'zod';
import { collectionFor, getResource, canReadResource, type AssistantContext } from './access';
import { resolveDatetime } from './datetime';
import { zonedParts } from './zoned-time';
export const viewingDetailsSchema = z.object({
  mode: z.enum(['selected', 'at_time', 'next']), viewingId: z.string().min(1).max(180).optional(),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).optional(),
  dayOffset: z.number().int().min(-3650).max(3650).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), agentId: z.string().min(1).max(180).optional(),
}).strict().superRefine((v, ctx) => {
  if (v.mode === 'selected' && (!v.viewingId || v.time || v.date || v.dayOffset !== undefined || v.agentId)) ctx.addIssue({ code: 'custom', message: 'selected necesită numai viewingId.' });
  if (v.mode !== 'selected' && v.viewingId) ctx.addIssue({ code: 'custom', message: 'viewingId se folosește numai cu selected.' });
  if (v.mode === 'at_time' && (!v.time || v.date && v.dayOffset !== undefined)) ctx.addIssue({ code: 'custom', message: 'at_time necesită time HH:mm și cel mult date sau dayOffset.' });
  if (v.mode === 'next' && (v.time || v.date || v.dayOffset !== undefined)) ctx.addIssue({ code: 'custom', message: 'next folosește ora curentă a serverului, fără alte filtre de timp.' });
});
type Input = z.infer<typeof viewingDetailsSchema>;
export function viewingCandidates(rows: Record<string, any>[], input: Input, actorId: string, now: Date) {
  const date = input.mode === 'at_time' ? resolveDatetime({ ...(input.date ? { date: input.date } : { dayOffset: input.dayOffset ?? 0 }), time: '12:00' }, now).local.slice(0, 10) : null;
  const matches = rows.filter(row => {
    if (row.agentId !== (input.agentId || actorId) || row.status !== 'scheduled' || !Number.isFinite(Date.parse(row.viewingDate))) return false;
    if (input.mode === 'next') return Date.parse(row.viewingDate) >= now.getTime();
    const local = zonedParts(new Date(row.viewingDate), 'Europe/Bucharest');
    return local.date === date && local.time === input.time;
  }).sort((a, b) => Date.parse(a.viewingDate) - Date.parse(b.viewingDate) || String(a.id).localeCompare(String(b.id)));
  return input.mode === 'next' && matches.length ? matches.filter(row => Date.parse(row.viewingDate) === Date.parse(matches[0].viewingDate)) : matches;
}
export async function viewingDetails(ctx: AssistantContext, value: Input, now = new Date()) {
  const input = viewingDetailsSchema.parse(value);
  let viewing: Record<string, any>;
  if (input.mode === 'selected') viewing = await getResource(ctx, 'viewings', input.viewingId!);
  else {
    // Parse real instants server-side: legacy offset spellings do not sort chronologically as strings.
    const rows: Record<string, any>[] = []; let cursor: string | undefined, complete = false;
    const started = Date.now();
    for (let page = 0; page < 20 && Date.now() - started < 12000; page++) {
      let query = collectionFor(ctx, 'viewings').orderBy('__name__').limit(250);
      if (cursor) query = query.startAfter(cursor);
      const snapshot = await query.get();
      for (const doc of snapshot.docs) { const row = { ...doc.data(), id: doc.id }; if (canReadResource(ctx, 'viewings', row)) rows.push(row); }
      if (snapshot.size < 250) { complete = true; break; }
      cursor = snapshot.docs.at(-1)!.id;
    }
    const candidates = viewingCandidates(rows, input, ctx.uid, now);
    if (!complete || candidates.length !== 1) return { status: !complete ? 'partial' : candidates.length ? 'needs_clarification' : 'not_found', complete, rows: candidates.slice(0, 8).map(row => ({ id: row.id, viewingDate: row.viewingDate, contactId: row.contactId, propertyId: row.propertyId })), contactId: null };
    viewing = await getResource(ctx, 'viewings', candidates[0].id);
    if (!viewingCandidates([viewing], input, ctx.uid, now).length) return { status: 'changed', complete: false, rows: [], contactId: null };
  }
  const related = async (resource: string, id: unknown) => {
    if (typeof id !== 'string' || !id) return null;
    try { return await getResource(ctx, resource, id); }
    catch (error) { if ([403, 404].includes(Number((error as { status?: number }).status))) return null; throw error; }
  };
  const [contact, property] = await Promise.all([related('contacts', viewing.contactId), related('properties', viewing.propertyId)]);
  const row = { id: viewing.id, viewingDate: viewing.viewingDate, status: viewing.status,
    contactId: contact?.id || null, contactName: contact?.name || null, contactPhone: contact?.phone || null,
    propertyId: property?.id || null, propertyTitle: property?.title || null, propertyAddress: property?.address || property?.location || null,
    ownerName: property?.ownerName || null, ownerPhone: property?.ownerPhone || null };
  return { status: 'resolved', complete: true, rows: [row], contactId: contact?.id || null };
}
