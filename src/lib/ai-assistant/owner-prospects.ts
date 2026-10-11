import { z } from 'zod';
import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';
import { getResource, readResource, type AssistantContext } from './access';
import { idSchema } from './contracts';

export const ownerProspectsSchema = z.object({ listingId: idSchema, cursor: z.string().max(2000).optional() }).strict();
const cursorSchema = z.object({ agencyId: idSchema, listingId: idSchema, phone: z.string(), after: idSchema }).strict();

export async function readOwnerProspects(ctx: AssistantContext, input: z.infer<typeof ownerProspectsSchema>) {
  const selected = await getResource(ctx, 'ownerListingFavorites', input.listingId);
  const phone = normalizeRomanianPhone(selected.ownerPhone);
  const cursor = input.cursor ? cursorSchema.parse(JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8'))) : null;
  if (cursor && (cursor.agencyId !== ctx.agencyId || cursor.listingId !== input.listingId || cursor.phone !== phone)) throw new Error('Cursorul nu mai corespunde prospectului și telefonului curent.');
  if (!/^0[237]\d{8}$/.test(phone)) return { rows: [], complete: false, nextCursor: null, reason: 'missing_valid_phone', scope: 'agency_prospects', note: 'Telefon complet indisponibil. Numele singur nu dovedește că două anunțuri aparțin aceleiași persoane.' };
  // Read enriched agency records, including inactive prospects with historical interactions.
  const page = await readResource(ctx, { resource: 'ownerListingFavorites', limit: 50, ...(cursor ? { cursor: cursor.after } : {}) });
  const rows = page.rows.filter(row => normalizeRomanianPhone(row.ownerPhone) === phone).map(row => ({ id: row.id, title: row.title || null, ownerName: row.ownerName || null, ownerPhone: row.ownerPhone, isFavoriteActive: row.isFavoriteActive ?? null, matchBasis: 'normalized_phone' }));
  return { rows, complete: page.complete, nextCursor: page.nextCursor ? Buffer.from(JSON.stringify({ agencyId: ctx.agencyId, listingId: input.listingId, phone, after: page.nextCursor })).toString('base64url') : null,
    scope: 'agency_prospects', normalizedPhone: phone, note: 'Anunțuri din prospectarea agenției cu același telefon. Un număr comun poate reprezenta mai multe persoane; nu este dovadă de identitate juridică. Nu include toate anunțurile globale sau conversațiile fără legătură înregistrată.' };
}
