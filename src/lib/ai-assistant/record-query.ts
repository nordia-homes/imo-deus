import type { z } from 'zod';
import { collectionFor, getResource, type AssistantContext } from './access';
import { normalized, safeData, queryRecordsSchema } from './contracts';
import { resolveDatetime } from './datetime';
import { createHash } from 'node:crypto';

export function recordDateRange(input: z.infer<typeof queryRecordsSchema>, now = new Date()) {
  if ((input.date !== undefined || input.dayOffset !== undefined) && (input.dateFrom || input.dateTo)) throw new Error('Folosește ziua sau intervalul, nu ambele.');
  if (input.date !== undefined || input.dayOffset !== undefined) {
    const start = resolveDatetime({ ...(input.date ? { date: input.date } : { dayOffset: input.dayOffset }), time: '00:00' }, now);
    const date = start.local.slice(0, 10);
    const next = new Date(Date.parse(date + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10);
    return { from: start.iso, to: resolveDatetime({ date: next, time: '00:00' }, now).iso, label: date };
  }
  const from = input.dateFrom ? new Date(input.dateFrom).toISOString() : undefined, to = input.dateTo ? new Date(input.dateTo).toISOString() : undefined;
  if (from && to && from >= to) throw new Error('Interval calendaristic invalid.');
  return { from, to, label: from || to ? `${from || '…'} – ${to || '…'}` : undefined };
}
export async function decorateRecords(ctx: AssistantContext, resource: string, rows: Record<string, any>[]) {
  if (!['viewings', 'tasks'].includes(resource)) return rows;
  const cache = new Map<string, Promise<Record<string, any> | null>>();
  const read = (type: string, id: string) => { const key = type + ':' + id; if (!cache.has(key)) cache.set(key, getResource(ctx, type, id).catch(error => { if ([403,404].includes(error.status)) return null; throw error; })); return cache.get(key)!; };
  const result: Record<string, any>[] = [];
  for (let i = 0; i < rows.length; i += 3) result.push(...await Promise.all(rows.slice(i, i + 3).map(async row => {
    const [contact, property] = await Promise.all([!row.contactName && row.contactId ? read('contacts', row.contactId) : null, !row.propertyTitle && row.propertyId ? read('properties', row.propertyId) : null]);
    return { ...row, contactName: row.contactName || contact?.name || '', propertyTitle: row.propertyTitle || property?.title || '', location: row.location || property?.location || '', link: resource === 'viewings' ? '/viewings' : '/tasks' };
  })));
  return result;
}
export async function queryRecords(ctx: AssistantContext, input: z.infer<typeof queryRecordsSchema>) {
  const range = recordDateRange(input), field = input.resource === 'viewings' ? 'viewingDate' : input.resource === 'tasks' ? 'dueDate' : 'createdAt';
  const fingerprint = createHash('sha256').update(JSON.stringify([ctx.agencyId, ctx.uid, ctx.role, range, {...input,cursor:undefined}])).digest('hex').slice(0,12);
  const base = collectionFor(ctx, input.resource);
  let dated: FirebaseFirestore.Query = base;
  if (range.from) dated = dated.where(field, '>=', range.from);
  if (range.to) dated = dated.where(field, '<', range.to);
  const clauses = (['status', 'agentId', 'contactId', 'propertyId'] as const).filter(key => input[key] !== undefined).map(key => [key, input[key]!] as const);
  let query = dated;
  for (const [key, value] of clauses) query = query.where(key, '==', value);
  const ordered = (q: FirebaseFirestore.Query) => range.from || range.to ? q.orderBy(field).orderBy('__name__') : q.orderBy('__name__');
  let count: number | null = null, indexed = !input.search;
  if (indexed) try { count = (await query.count().get()).data().count; await ordered(query).limit(1).get(); } catch (e) { if (Number((e as {code?: number}).code) !== 9) throw e; indexed = false; count = null; }
  const rows: Record<string, any>[] = []; let scanned = 0, cursor = input.cursor, complete = false;
  const started = Date.now();
  do {
    let q = ordered(indexed ? query : dated).limit(indexed ? input.limit + 1 : 250);
    if (cursor) { const c = JSON.parse(Buffer.from(cursor, 'base64url').toString()) as { hash: string; id: string; value?: string }; if (c.hash !== fingerprint) throw new Error('Cursor invalid pentru această căutare.'); q = range.from || range.to ? q.startAfter(c.value, c.id) : q.startAfter(c.id); }
    const page = await q.get();
    if (page.empty) { complete = true; break; }
    let lastConsumedId: string | undefined;
    for (const doc of page.docs) {
      const row = safeData({ ...doc.data(), id: doc.id }); scanned++;
      if (indexed && rows.length === input.limit) break;
      lastConsumedId = doc.id;
      cursor = Buffer.from(JSON.stringify({ hash: fingerprint, id: doc.id, value: range.from || range.to ? row[field] : undefined })).toString('base64url');
      if (!clauses.every(([key, value]) => row[key] === value) || input.search && !normalized(JSON.stringify(row)).includes(normalized(input.search))) continue;
      if (!indexed) count = (count || 0) + 1;
      if (rows.length < input.limit) rows.push(row);
      if (input.mode === 'list' && rows.length === input.limit) break;
    }
    complete = (page.size < (indexed ? input.limit + 1 : 250) && lastConsumedId === page.docs.at(-1)?.id) || (indexed && count !== null && count <= rows.length);
    if (indexed || input.mode === 'list' && rows.length >= input.limit) break;
  } while (!complete && scanned < 10000 && Date.now() - started < 15000);
  // An aggregate can be exact while its display is just a preview.
  const exact = indexed || (complete && !input.cursor);
  const labels = { contacts: 'clienți', properties: 'proprietăți', viewings: 'vizionări', tasks: 'sarcini' };
  return { rows: await decorateRecords(ctx, input.resource, rows), count: count ?? rows.length, countScope: exact ? 'query' : 'segment', complete: input.mode === 'count' ? exact : complete, nextCursor: complete ? null : cursor || null, scanned, summary: { count: count ?? rows.length, label: labels[input.resource], ...(range.label ? {period: range.label} : {}), scope: exact ? 'Datele agenției · filtrate pe server' : complete ? 'Totalul segmentului final · nu totalul agenției' : 'Rezultate parțiale · continuare disponibilă' } };
}
