import { createHash, randomUUID } from 'node:crypto';
import { normalized, safeData, type AssistantMessage, type AccessReference } from './contracts';
import { collectionFor, referencesAllowed, getResource, type AssistantContext } from './access';
import { matchingRevision } from './matching-revision';
import { preferenceKeys, validatePreference } from './preferences';
import { DEFAULT_TIMEZONE, timezoneSchema } from './timezone';

export async function preferredTimezone(ctx: AssistantContext) {
  if (!ctx.adminDb || process.env.JARVIS_MEMORY === 'false') return DEFAULT_TIMEZONE;
  const id = createHash('sha256').update(`${ctx.uid}:timezone`).digest('hex').slice(0, 32);
  const row = (await collectionFor(ctx, 'assistantMemory').doc(id).get()).data();
  const parsed = timezoneSchema.safeParse(row?.value);
  return row?.ownerId === ctx.uid && row?.expiresAt > Date.now() && parsed.success ? parsed.data : DEFAULT_TIMEZONE;
}

export function compressedResult(result: unknown, maxBytes = 14000) {
  const safe = safeData(result), serialized = JSON.stringify(safe);
  if (Buffer.byteLength(serialized) <= maxBytes) return serialized;
  if (typeof safe?.value === 'string') {
    let value = safe.value.slice(0, 4000);
    const result = () => JSON.stringify({ value, offset: safe.offset || 0, nextOffset: Number(safe.offset || 0) + value.length, total: safe.total, complete: false, truncated: true });
    while (value.length && Buffer.byteLength(result()) > maxBytes) value = value.slice(0, Math.floor(value.length / 2));
    return result();
  }
  const rows = Array.isArray(safe?.rows) ? safe.rows : [];
  const overview = rows.slice(0, 100).map((row: any) => ({ ...Object.fromEntries(['id', 'name', 'title', 'status', 'price', 'matchScore', 'contactId', 'propertyId', 'viewingDate', 'dueDate'].filter(key => row[key] !== undefined).map(key => [key, typeof row[key] === 'string' ? row[key].slice(0, 150) : row[key]])), availableFields: Object.keys(row).slice(0, 30) }));
  const selected = overview.slice(0, 40);
  const preview = () => JSON.stringify({ truncated: true, rows: selected, resultSetId: safe?.resultSetId || null, nextCursor: safe?.nextCursor || null, complete: false, warning: 'Previzualizare incompletă; folosește read_field/read cu limită mai mică.' });
  while (selected.length && Buffer.byteLength(preview()) > maxBytes) selected.pop();
  return preview();
}
export function contextMessages(history: AssistantMessage[], maxBytes = 14000) {
  const messages: { role: string; content: string }[] = []; let bytes = 0;
  for (const row of [...history].reverse()) {
    const content = row.text.slice(0, 2200) + (row.cards?.length ? '\nRESULT_REFERENCES ' + JSON.stringify(row.cards.slice(-4).map(card => ({ source: card.source, resultSetId: card.resultSetId, entities: card.rows.slice(0, 6).map(r => ({id:r.id,title:r.title||r.name||r.propertyTitle,status:r.status})), ...(card.summary?{summary:card.summary}:{}) }))) : '');
    const size = Buffer.byteLength(content); if (bytes + size > maxBytes) break;
    bytes += size; messages.unshift({ role: row.role, content });
  }
  return messages;
}
export async function rememberPreference(ctx: AssistantContext, key: string, value: string) {
  value = validatePreference(key, value);
  const id = createHash('sha256').update(`${ctx.uid}:${key}`).digest('hex').slice(0, 32);
  const ref = collectionFor(ctx, 'assistantMemory').doc(id);
  const record = { ownerId: ctx.uid, key, value, importance: 1, version: '2', source: 'explicit_user_preference', updatedAt: new Date().toISOString(), expiresAt: Date.now() + 180 * 86400000 };
  await ctx.adminDb.runTransaction(async tx => {
    const existing = await tx.get(ref);
    tx.set(ref, { ...record, createdAt: existing.data()?.createdAt || record.updatedAt });
  });
  return { saved: true, key };
}
export async function relevantMemory(ctx: AssistantContext) {
  if (process.env.JARVIS_MEMORY === 'false') return [];
  // The vocabulary is bounded; exact reads cannot let expired/arbitrary rows
  // crowd a valid preference out of the first query page.
  const rows = await Promise.all(preferenceKeys.map(key => collectionFor(ctx, 'assistantMemory').doc(createHash('sha256').update(`${ctx.uid}:${key}`).digest('hex').slice(0, 32)).get()));
  return rows.map(doc => doc.data()).filter(row => row?.ownerId === ctx.uid && row.expiresAt > Date.now()).map(row => ({ key: row!.key, value: row!.value }));
}
export async function forgetPreference(ctx: AssistantContext, key: string) {
  const id = createHash('sha256').update(`${ctx.uid}:${key}`).digest('hex').slice(0, 32);
  await collectionFor(ctx, 'assistantMemory').doc(id).delete();
  return { removed: true, key };
}
export function sessionSummary(messages: AssistantMessage[]) {
  const resultSetIds = [...new Set(messages.flatMap(message => message.cards || []).map(card => card.resultSetId).filter(Boolean))].slice(-8);
  const entities = [...new Set(messages.flatMap(message => message.cards || []).flatMap(card => card.rows).map(row => row.id).filter(value => typeof value === 'string'))].slice(-20);
  const selections = messages.flatMap(message => (message.cards || []).map(card => ({ messageId: message.id, source: card.source, resultSetId: card.resultSetId || null, orderedIds: card.rows.map(row => row.id).filter(id => typeof id === 'string').slice(0, 100) }))).slice(-8);
  return { version: '2', resultSetIds, entities, selections, pendingPlanIds: messages.map(message => message.planId).filter(Boolean).slice(-3), source: 'validated_server_messages' };
}
export async function saveResultSet(ctx: AssistantContext, rows: Record<string, unknown>[], contactId?: string, accessRefs: AccessReference[] = [], sourceContactRevision?: string) {
  const id = randomUUID();
  const contactRevision = sourceContactRevision || (typeof rows[0]?.sourceContactRevision === 'string' ? rows[0].sourceContactRevision : undefined) || (contactId ? matchingRevision(await getResource(ctx, 'contacts', contactId)) : null);
  await collectionFor(ctx, 'assistantResultSets').doc(id).create({ ownerId: ctx.uid, kind: 'existing_matches', contactId: contactId || null, contactRevision, rows: safeData(rows), accessRefs, createdAt: new Date().toISOString(), expiresAt: Date.now() + 3600000 });
  return id;
}
export function filterMatches(rows: Record<string, any>[], input: { priceMax?: number; zone?: string; limit: number; sortBy?: 'existing_order' | 'score' | 'price' }) {
  const selected = rows.filter(row => (!input.priceMax || Number(row.price) <= input.priceMax) && (!input.zone || normalized(row.location).includes(normalized(input.zone)))).map((row, index) => ({ row, index }));
  if (input.sortBy === 'score') selected.sort((a, b) => Number(b.row.matchScore || 0) - Number(a.row.matchScore || 0) || a.index - b.index);
  if (input.sortBy === 'price') selected.sort((a, b) => Number(a.row.price) - Number(b.row.price) || a.index - b.index);
  return selected.slice(0, input.limit).map(({ row }) => row);
}
export async function filterResultSet(ctx: AssistantContext, input: { resultSetId: string; priceMax?: number; zone?: string; limit: number; sortBy?: 'existing_order' | 'score' | 'price' }) {
  const doc = await collectionFor(ctx, 'assistantResultSets').doc(input.resultSetId).get(), record = doc.data();
  if (!record || record.ownerId !== ctx.uid || record.expiresAt < Date.now() || !(await referencesAllowed(ctx, record.accessRefs))) throw new Error('Setul contextual a expirat sau nu este accesibil.');
  // Refresh existence/status/current price without recalculating any stored matching score.
  const contactChanged = record.contactId ? record.contactRevision !== matchingRevision(await getResource(ctx, 'contacts', record.contactId)) : false;
  const eligible = await Promise.all((record.rows || []).map(async (row: any) => { try { const property = await getResource(ctx, 'properties', row.id); return property.status === 'Activ' ? { ...row, price: property.price, location: property.location, scoreMayBeStale: contactChanged || row.matchingRevision !== matchingRevision(property) } : null; } catch (error: any) { if ([403, 404].includes(error.status)) return null; throw error; } }));
  const rows = filterMatches(eligible.filter(Boolean), input);
  const resultSetId = await saveResultSet(ctx, rows, record.contactId, record.accessRefs, record.contactRevision);
  const stale = rows.some(row => row.scoreMayBeStale);
  return { rows, resultSetId, contactId: record.contactId, complete: true, scoringSource: 'existing_imodeus_matching', scoreRecalculated: false, scoreMayBeStale: stale, note: stale ? 'Datele clientului sau proprietăților s-au schimbat. Scorurile păstrează calculul anterior; cere matching nou pentru scoruri actuale.' : null };
}
