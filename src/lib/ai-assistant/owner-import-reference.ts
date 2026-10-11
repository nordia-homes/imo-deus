import { collectionFor, getResource, type AssistantContext } from './access';
import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';
import { idSchema } from './contracts';

// A global source reference is only an identifier; the agency prospect supplies
// the owner association. Never infer ownership from the global phone alone.
export function ownerImportResolver(ctx: AssistantContext, selectedId: string, phone: string, selectedUrls: string[] = []) {
  const listings = new Map<string, Promise<boolean>>();
  type Association = { related: boolean; listingId?: string; listingIds?: string[]; unresolved?: string };
  const urls = new Map<string, Promise<Association>>();
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
      const ids = new Set<string>(selectedUrls.includes(url) ? [selectedId] : []);
      for (const field of ['link', 'originSourceUrl']) {
        const snapshot = await ctx.adminDb.collection('ownerListings').where(field, '==', url).limit(51).get();
        if (snapshot.size > 50) return { related: false, unresolved: 'source_reference_scan_limit' };
        for (const doc of snapshot.docs) if (doc.data().publicationStatus === 'ready' && doc.data().isCanonical === true) ids.add(doc.id);
      }
      const candidates = [...ids].sort();
      const matches = await Promise.all(candidates.map(related));
      // Multiple source records are not an ambiguous owner when every candidate
      // is independently associated through the current agency's prospects.
      if (candidates.length > 1) return matches.every(Boolean)
        ? { related: true, listingIds: candidates }
        : { related: false, unresolved: 'ambiguous_source_url' };
      return { related: matches[0] === true, listingId: candidates[0] };
    })());
    return urls.get(url)!;
  };
  return async (property: Record<string, any>): Promise<Association> => {
    if (typeof property.ownerListingId === 'string' && property.ownerListingId) {
      return { related: await related(property.ownerListingId), listingId: property.ownerListingId };
    }
    if (typeof property.ownerListingUrl !== 'string' || !/^https?:\/\//.test(property.ownerListingUrl)) return { related: false };
    return lookupUrl(property.ownerListingUrl);
  };
}
