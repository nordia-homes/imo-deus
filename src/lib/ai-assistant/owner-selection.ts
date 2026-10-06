import type { AssistantContext } from './access';
import type { AssistantSearch } from './contracts';
import type { Agency } from '@/lib/types';
import { getOwnerListingScope, resolveAgencyOwnerListingScope } from '@/lib/owner-listings/scope';
import { CommunicationError } from '@/lib/communications/server';
import { constructionYearEvidence, constructionYearFilterSatisfied } from './search-criteria';

export async function readSelectedOwner(ctx: AssistantContext, id: string, search?: AssistantSearch | null) {
  const agency = await ctx.adminDb.collection('agencies').doc(ctx.agencyId).get();
  const scope = search?.scopeKey ? getOwnerListingScope(search.scopeKey) : resolveAgencyOwnerListingScope(agency.data() as Agency);
  if (!scope) throw new CommunicationError('Orașul selecției nu mai este disponibil.', 409);
  const doc = await ctx.adminDb.collection('ownerListings').doc(id).get(), row = doc.data();
  if (!row || row.scopeKey !== scope.key || row.publicationStatus !== 'ready' || row.isCanonical !== true) throw new CommunicationError('Anunțul selectat nu mai este disponibil în această sursă.', 404);
  // Same public projection as owner search: never expose phone, internal enrichment
  // payloads or import another row when the selected item disappears.
  return { id, title: row.title || '', price: row.price ?? null, location: row.location || '', rooms: row.roomsValue ?? row.rooms ?? null,
    source: 'owners', link: row.link || '', ...constructionYearEvidence(row),
    yearFilterSatisfied: search && (search.yearMin !== undefined || search.yearMax !== undefined) ? constructionYearFilterSatisfied(row, search) === true : null };
}
