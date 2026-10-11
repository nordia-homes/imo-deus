import { collectionFor, getResource, type AssistantContext } from './access';
import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';
import { idSchema } from './contracts';

// A global source reference is only an identifier; the agency prospect supplies
// the owner association. Never infer ownership from the global phone alone.
export function ownerImportResolver(ctx: AssistantContext, selectedId: string, phone: string) {
  const listings = new Map<string, Promise<boolean>>();
  const urls = new Map<string, Promise<{ id?: string; unresolved?: string }>>();
  const related = (id: string) => {
    if (!listings.has(id)) listings.set(id, (async () => {
      if (!idSchema.safeParse(id).success) return false;
      if (id === selectedId) return true;
      if (!/^0[237]\d{8}$/.test(phone)) return false;
      if (!(await collectionFor(ctx, 'ownerListingFavorites').doc(id).get()).exists) return false;
      const prospect = await getResource(ctx, 'ownerListingFavorites', id);
      return normalizeRomanianPhone(prospect.ownerPhone) === phone;
    })());
    return listings.get(id)!;
  };
  const lookupUrl = (url: string) => {
    if (!urls.has(url)) urls.set(url, (async () => {
      const ids = new Set<string>();
      for (const field of ['link', 'originSourceUrl']) {
        const snapshot = await ctx.adminDb.collection('ownerListings').where(field, '==', url).limit(51).get();
        if (snapshot.size > 50) return { unresolved: 'source_reference_scan_limit' };
        for (const doc of snapshot.docs) if (doc.data().publicationStatus === 'ready' && doc.data().isCanonical === true) ids.add(doc.id);
      }
      if (ids.size > 1) return { unresolved: 'ambiguous_source_url' };
      return { id: [...ids][0] };
    })());
    return urls.get(url)!;
  };
  return async (property: Record<string, any>): Promise<{ related: boolean; listingId?: string; unresolved?: string }> => {
    if (typeof property.ownerListingId === 'string' && property.ownerListingId) {
      return { related: await related(property.ownerListingId), listingId: property.ownerListingId };
    }
    if (typeof property.ownerListingUrl !== 'string' || !/^https?:\/\//.test(property.ownerListingUrl)) return { related: false };
    const reference = await lookupUrl(property.ownerListingUrl);
    return { related: reference.id ? await related(reference.id) : false, listingId: reference.id, unresolved: reference.unresolved };
  };
}
