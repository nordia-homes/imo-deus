import { z } from 'zod';
import { collectionFor, getResource, canReadResource, type AssistantContext } from './access';
import { idSchema, safeData } from './contracts';
const resources = ['contacts', 'properties', 'sales', 'conversations', 'aiOutreachCalls', 'ownerListingFavorites'] as const;
export const timelineSchema = z.object({ resource: z.enum(resources), id: idSchema, limit: z.number().int().min(1).max(20).default(10), cursor: z.string().max(4000).optional() }).strict();
const cursorSchema = z.object({ resource: z.enum(resources), id: idSchema, cursors: z.record(z.string().max(180).nullable()) }).strict();

export async function readTimeline(ctx: AssistantContext, input: z.infer<typeof timelineSchema>) {
  const parent = await getResource(ctx, input.resource, input.id);
  const decoded = input.cursor ? cursorSchema.parse(JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8'))) : null;
  if (decoded && (decoded.resource !== input.resource || decoded.id !== input.id)) throw new Error('Cursorul aparține altei entități.');
  const cursors = decoded?.cursors || {}, next: Record<string, string | null> = {};
  const rows: Record<string, any>[] = [];
  const idField = { contacts: 'contactId', properties: 'propertyId', sales: 'saleId', conversations: 'conversationId', aiOutreachCalls: 'callId', ownerListingFavorites: 'listingId' }[input.resource];
  const sources: { name: string; query: FirebaseFirestore.Query; permission?: string }[] = [
    { name: 'crmEvents', query: collectionFor(ctx, 'crmEvents').where(`entities.${idField}`, '==', input.id), permission: 'crmEvents' },
  ];
  if (input.resource === 'properties') for (const resource of ['propertyStatusEvents', 'propertyDeletionEvents']) sources.push({ name: resource, query: collectionFor(ctx, resource).where('propertyId', '==', input.id) });
  if (['contacts', 'properties'].includes(input.resource)) for (const resource of ['tasks', 'viewings']) sources.push({ name: resource, query: collectionFor(ctx, resource).where(idField, '==', input.id), permission: resource });
  if (['sales', 'conversations', 'aiOutreachCalls'].includes(input.resource)) {
    const related = input.resource === 'sales' ? ['audit', 'emailMessages'] : input.resource === 'conversations' ? ['messages', 'notes'] : ['audit', 'messages'];
    for (const name of related) sources.push({ name, query: collectionFor(ctx, input.resource).doc(input.id).collection(name) });
  }
  let complete = true;
  for (const source of sources) {
    if (decoded && Object.hasOwn(cursors, source.name) && cursors[source.name] === null) { next[source.name] = null; continue; }
    let query = source.query.orderBy('__name__').limit(input.limit + 1);
    if (cursors[source.name]) query = query.startAfter(cursors[source.name]);
    const snapshot = await query.get(), page = snapshot.docs.slice(0, input.limit);
    next[source.name] = snapshot.size > input.limit ? page.at(-1)?.id || null : null;
    if (next[source.name]) complete = false;
    for (const doc of page) {
      const data: Record<string, any> = { ...doc.data(), id: doc.id };
      if (source.permission && !canReadResource(ctx, source.permission, data)) continue;
      const occurredAt = data.occurredAt || data.changedAt || data.createdAt || data.date || null;
      rows.push({ ...safeData(data), source: source.name, occurredAt, dueDate: occurredAt,
        title: data.capability || data.title || data.description || data.type || data.status || 'Eveniment CRM',
        description: Array.isArray(data.changedFields) ? 'Câmpuri modificate: ' + data.changedFields.join(', ') : data.notes || null });
    }
  }
  // Embedded histories are snapshots; never invent missing historical actors/dates.
  for (const field of ['interactionHistory', 'offers']) {
    const source = `embedded_${field}`;
    if (decoded && Object.hasOwn(cursors, source) && cursors[source] === null) { next[source] = null; continue; }
    const offset = Number(cursors[source] || 0);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Cursor invalid.');
    const history = Array.isArray(parent[field]) ? parent[field] : [];
    rows.push(...history.slice(offset, offset + input.limit).map((row: any) => ({ ...safeData(row), source: field, occurredAt: row.date || null })));
    next[source] = history.length > offset + input.limit ? String(offset + input.limit) : null;
    if (next[source]) complete = false;
  }
  return { rows: rows.sort((a, b) => String(b.occurredAt || '').localeCompare(String(a.occurredAt || ''))), complete,
    nextCursor: complete ? null : Buffer.from(JSON.stringify({ resource: input.resource, id: input.id, cursors: next })).toString('base64url'),
    asOf: new Date().toISOString(), note: 'Istoric din sursele disponibile. Evenimentele CRM noi includ fluxurile migrate. Absența istoricului vechi nu dovedește absența unei acțiuni. Ordinea globală necesită toate paginile.' };
}
