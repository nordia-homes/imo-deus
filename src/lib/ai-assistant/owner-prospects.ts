import { z } from 'zod';
import { createHash } from 'node:crypto';
import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';
import { getResource, readResource, type AssistantContext } from './access';
import { idSchema } from './contracts';

export const ownerProspectsSchema = z.object({ listingId: idSchema, scope: z.literal('agency_history').optional(), cursor: z.string().max(2000).optional() }).strict();
const cursorSchema = z.object({ agencyId: idSchema, listingId: idSchema, phone: z.string(), after: idSchema }).strict();
const historyCursorSchema = z.object({ agencyId: idSchema, listingId: idSchema, identity: z.string(), after: z.object({ ownerListingFavorites: idSchema.nullable(), properties: idSchema.nullable(), conversations: idSchema.nullable() }).strict() }).strict();

async function linkedHistoryRecords(ctx: AssistantContext, input: z.infer<typeof ownerProspectsSchema>, selected: Record<string, any>, phone: string) {
  const source = (await ctx.adminDb.collection('ownerListings').doc(input.listingId).get()).data();
  const sourceUrls = source?.publicationStatus === 'ready' && source.isCanonical === true ? [source.link, source.originSourceUrl] : [];
  const urls = [...new Set([selected.link, selected.originSourceUrl, ...sourceUrls].filter((url): url is string => typeof url === 'string' && /^https?:\/\//.test(url)))].sort();
  const identity = createHash('sha256').update(JSON.stringify({ phone, urls })).digest('hex');
  const cursor = input.cursor ? historyCursorSchema.parse(JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8'))) : null;
  if (cursor && (cursor.agencyId !== ctx.agencyId || cursor.listingId !== input.listingId || cursor.identity !== identity)) throw new Error('Cursorul nu mai corespunde proprietarului curent.');
  const fullPhone = /^0[237]\d{8}$/.test(phone);
  const resources = ['ownerListingFavorites', 'properties', 'conversations'] as const;
  const after = { ownerListingFavorites: null, properties: null, conversations: null } as Record<typeof resources[number], string | null>;
  const rows: Record<string, any>[] = [];
  for (const resource of resources) {
    if (cursor && cursor.after[resource] === null) continue;
    const page = await readResource(ctx, { resource, limit: 50, ...(cursor?.after[resource] ? { cursor: cursor.after[resource]! } : {}) });
    after[resource] = page.nextCursor;
    for (const row of page.rows) {
      const exact = resource === 'ownerListingFavorites' ? row.id === input.listingId : resource === 'properties' && (row.ownerListingId === input.listingId || (typeof row.ownerListingUrl === 'string' && urls.includes(row.ownerListingUrl)));
      const phoneMatch = fullPhone && normalizeRomanianPhone(resource === 'conversations' ? row.phone : row.ownerPhone) === phone;
      if (!exact && !phoneMatch) continue;
      rows.push({ resource, id: row.id, title: row.title || row.name || null, matchBasis: exact ? 'exact_listing_reference' : 'normalized_phone', ...(resource === 'ownerListingFavorites' ? { isFavoriteActive: row.isFavoriteActive ?? null } : {}) });
    }
  }
  const complete = Object.values(after).every(value => value === null);
  return { rows, complete, nextCursor: complete ? null : Buffer.from(JSON.stringify({ agencyId: ctx.agencyId, listingId: input.listingId, identity, after })).toString('base64url'), scope: 'agency_history', identityComplete: fullPhone,
    note: 'Înregistrări autorizate din agenție asociate prin referință exactă la anunț sau telefon comun complet. Citește timeline pentru fiecare resource/id. Nu include conversațiile cumpărătorilor doar pentru că au aceeași proprietate. Telefonul comun nu garantează identitatea persoanei; lipsa telefonului limitează asocierea la referințe exacte.' };
}

export async function readOwnerProspects(ctx: AssistantContext, input: z.infer<typeof ownerProspectsSchema>) {
  const selected = await getResource(ctx, 'ownerListingFavorites', input.listingId);
  const phone = normalizeRomanianPhone(selected.ownerPhone);
  if (input.scope === 'agency_history') return linkedHistoryRecords(ctx, input, selected, phone);
  const cursor = input.cursor ? cursorSchema.parse(JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8'))) : null;
  if (cursor && (cursor.agencyId !== ctx.agencyId || cursor.listingId !== input.listingId || cursor.phone !== phone)) throw new Error('Cursorul nu mai corespunde prospectului și telefonului curent.');
  if (!/^0[237]\d{8}$/.test(phone)) return { rows: [], complete: false, nextCursor: null, reason: 'missing_valid_phone', scope: 'agency_prospects', note: 'Telefon complet indisponibil. Numele singur nu dovedește că două anunțuri aparțin aceleiași persoane.' };
  // Read enriched agency records, including inactive prospects with historical interactions.
  const page = await readResource(ctx, { resource: 'ownerListingFavorites', limit: 50, ...(cursor ? { cursor: cursor.after } : {}) });
  const rows = page.rows.filter(row => normalizeRomanianPhone(row.ownerPhone) === phone).map(row => ({ id: row.id, title: row.title || null, ownerName: row.ownerName || null, ownerPhone: row.ownerPhone, isFavoriteActive: row.isFavoriteActive ?? null, matchBasis: 'normalized_phone' }));
  return { rows, complete: page.complete, nextCursor: page.nextCursor ? Buffer.from(JSON.stringify({ agencyId: ctx.agencyId, listingId: input.listingId, phone, after: page.nextCursor })).toString('base64url') : null,
    scope: 'agency_prospects', normalizedPhone: phone, note: 'Anunțuri din prospectarea agenției cu același telefon. Un număr comun poate reprezenta mai multe persoane; nu este dovadă de identitate juridică. Nu include toate anunțurile globale sau conversațiile fără legătură înregistrată.' };
}
