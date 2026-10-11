import { taskScheduleDetails } from './task-schedule';
import type { OwnerAssociationAnswer } from './owner-history-continuation';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';
import { getResource, readResource, type AssistantContext } from './access';
import { idSchema, safeData } from './contracts';
import { ownerImportResolver } from './owner-import-reference';

export const ownerProspectsSchema = z.object({ listingId: idSchema, scope: z.literal('agency_history').optional(), cursor: z.string().max(4000).optional() }).strict();
const cursorSchema = z.object({ agencyId: idSchema, listingId: idSchema, phone: z.string(), after: idSchema }).strict();
const historyCursorSchema = z.object({ agencyId: idSchema, listingId: idSchema, identity: z.string(), after: z.object({ ownerListingFavorites: idSchema.nullable(), properties: idSchema.nullable(), conversations: idSchema.nullable(), aiOutreachCalls: idSchema.nullable(), tasks: idSchema.nullable() }).strict() }).strict();

async function linkedHistoryRecords(ctx: AssistantContext, input: z.infer<typeof ownerProspectsSchema>, selected: Record<string, any>, phone: string, answers: OwnerAssociationAnswer[]) {
  const source = (await ctx.adminDb.collection('ownerListings').doc(input.listingId).get()).data();
  const sourceUrls = source?.publicationStatus === 'ready' && source.isCanonical === true ? [source.link, source.originSourceUrl] : [];
  const urls = [...new Set([selected.link, selected.originSourceUrl, ...sourceUrls].filter((url): url is string => typeof url === 'string' && /^https?:\/\//.test(url)))].sort();
  const identity = createHash('sha256').update(JSON.stringify({ phone, urls, answers })).digest('hex');
  const cursor = input.cursor ? historyCursorSchema.parse(JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8'))) : null;
  if (cursor && (cursor.agencyId !== ctx.agencyId || cursor.listingId !== input.listingId || cursor.identity !== identity)) throw new Error('Cursorul nu mai corespunde proprietarului curent.');
  const fullPhone = /^0[237]\d{8}$/.test(phone);
  const resources = ['ownerListingFavorites', 'properties', 'conversations', 'aiOutreachCalls', 'tasks'] as const;
  const after = { ownerListingFavorites: null, properties: null, conversations: null, aiOutreachCalls: null, tasks: null } as Record<typeof resources[number], string | null>;
  const rows: Record<string, any>[] = [];
  const resolveImport = ownerImportResolver(ctx, input.listingId, phone, urls, answers);
  const unresolvedReferences: { propertyId: string; reason: string; title?: string; referenceHash?: string }[] = [];
  for (const resource of resources) {
    if (cursor && cursor.after[resource] === null) continue;
    const page = await readResource(ctx, { resource, limit: 50, ...(cursor?.after[resource] ? { cursor: cursor.after[resource]! } : {}) });
    after[resource] = page.nextCursor;
    for (const row of page.rows) {
      let exact = resource === 'ownerListingFavorites' ? row.id === input.listingId : resource === 'properties' ? row.ownerListingId === input.listingId : ['aiOutreachCalls', 'tasks'].includes(resource) && row.ownerListingId === input.listingId;
      const phoneMatch = fullPhone && normalizeRomanianPhone(resource === 'conversations' ? row.phone : resource === 'tasks' ? row.participantPhone : row.ownerPhone) === phone;
      let linkedListingId: string | undefined;
      let linkedListingIds: string[] | undefined;
      let agentConfirmed = false;
      if (resource === 'properties' && !exact && !phoneMatch) {
        const reference = await resolveImport(row);
        exact = reference.related;
        agentConfirmed = Boolean(reference.referenceHash && reference.related && !reference.unresolved);
        linkedListingId = reference.listingId;
        linkedListingIds = reference.listingIds;
        if (reference.unresolved) unresolvedReferences.push({ propertyId: row.id, reason: reference.unresolved, ...(reference.referenceHash ? { referenceHash: reference.referenceHash, title: row.title || row.id } : {}) });
      }
      if (!exact && !phoneMatch) continue;
      const direct = resource === 'aiOutreachCalls' || resource === 'tasks';
      rows.push({ resource, id: row.id, title: row.title || row.name || row.description || row.ownerListingTitle || null, matchBasis: agentConfirmed ? 'agent_confirmed_association' : linkedListingIds ? 'verified_source_candidates' : exact ? 'exact_listing_reference' : 'normalized_phone', ...(linkedListingId ? { linkedListingId } : {}), ...(linkedListingIds ? { linkedListingIds } : {}), ...(resource === 'ownerListingFavorites' ? { isFavoriteActive: row.isFavoriteActive ?? null } : {}),
        ...(direct ? { readMode: 'interaction', interaction: safeData({ id: row.id, source: resource, status: row.status || null, outcome: row.outcome || null, summary: row.summary || null, description: row.description || null, occurredAt: row.endedAt || row.startedAt || row.createdAt || null, dueDate: row.dueDate || null, scheduledAt: row.scheduledAt || null, ...(resource === 'tasks' ? taskScheduleDetails(row) : { startedAt: row.startedAt ?? null, endedAt: row.endedAt ?? null, durationSeconds: row.durationSeconds ?? null, result: row.result ?? null }), ownerListingId: row.ownerListingId || null, propertyId: row.propertyId || null }) } : { readMode: 'timeline' }) });
    }
  }
  const complete = Object.values(after).every(value => value === null);
  return { rows, complete, nextCursor: complete ? null : Buffer.from(JSON.stringify({ agencyId: ctx.agencyId, listingId: input.listingId, identity, after })).toString('base64url'), scope: 'agency_history', identityComplete: fullPhone, associationComplete: unresolvedReferences.length === 0, unresolvedReferences,
    note: 'agent_confirmed_association reprezintă precizarea agentului pentru această citire, fără modificarea fișei CRM. Înregistrări autorizate din agenție asociate prin referință exactă la anunț sau telefon comun complet. Pentru readMode=timeline citește timeline. readMode=interaction conține deja apelul/taskul verificat, inclusiv dacă prospectul a fost șters. Deduplică după source/id împreună cu timeline. Taskurile și apelurile programate nu dovedesc o conversație efectuată. Telefonul comun nu garantează identitatea; lipsa lui limitează asocierea la referințe exacte.' };
}

export async function readOwnerProspects(ctx: AssistantContext, input: z.infer<typeof ownerProspectsSchema>, identityPhone?: string, answers: OwnerAssociationAnswer[] = []) {
  const selected = await getResource(ctx, 'ownerListingFavorites', input.listingId);
  const savedPhone = normalizeRomanianPhone(selected.ownerPhone);
  const phone = /^0[237]\d{8}$/.test(savedPhone) ? savedPhone : normalizeRomanianPhone(identityPhone || '');
  if (input.scope === 'agency_history') return linkedHistoryRecords(ctx, input, selected, phone, answers);
  const cursor = input.cursor ? cursorSchema.parse(JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8'))) : null;
  if (cursor && (cursor.agencyId !== ctx.agencyId || cursor.listingId !== input.listingId || cursor.phone !== phone)) throw new Error('Cursorul nu mai corespunde prospectului și telefonului curent.');
  if (!/^0[237]\d{8}$/.test(phone)) return { rows: [], complete: false, nextCursor: null, reason: 'missing_valid_phone', scope: 'agency_prospects', note: 'Telefon complet indisponibil. Numele singur nu dovedește că două anunțuri aparțin aceleiași persoane.' };
  // Read enriched agency records, including inactive prospects with historical interactions.
  const page = await readResource(ctx, { resource: 'ownerListingFavorites', limit: 50, ...(cursor ? { cursor: cursor.after } : {}) });
  const rows = page.rows.filter(row => normalizeRomanianPhone(row.ownerPhone) === phone).map(row => ({ id: row.id, title: row.title || null, ownerName: row.ownerName || null, ownerPhone: row.ownerPhone, isFavoriteActive: row.isFavoriteActive ?? null, matchBasis: 'normalized_phone' }));
  return { rows, complete: page.complete, nextCursor: page.nextCursor ? Buffer.from(JSON.stringify({ agencyId: ctx.agencyId, listingId: input.listingId, phone, after: page.nextCursor })).toString('base64url') : null,
    scope: 'agency_prospects', normalizedPhone: phone, note: 'Anunțuri din prospectarea agenției cu același telefon. Un număr comun poate reprezenta mai multe persoane; nu este dovadă de identitate juridică. Nu include toate anunțurile globale sau conversațiile fără legătură înregistrată.' };
}
