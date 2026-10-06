import { collectionFor, type AssistantContext } from './access';
import { CommunicationError } from '@/lib/communications/server';

type Candidate = { id: string; row: Record<string, unknown> };
// Exact references only. Similar address/phone/description never proves identity.
// Do not return any CRM record or contact data to the model through this lookup.
export async function importedListingIds(ctx: AssistantContext, candidates: Candidate[]) {
  const references = (candidate: Candidate) => [candidate.row.link, candidate.row.originSourceUrl].filter((value): value is string => typeof value === 'string' && value.length > 0 && value.length <= 2000);
  const ids = [...new Set(candidates.map(candidate => candidate.id))];
  const urls = [...new Set(candidates.flatMap(references))];
  const importedIds = new Set<string>(), importedUrls = new Set<string>();
  for (const [field, values, found] of [['ownerListingId', ids, importedIds], ['ownerListingUrl', urls, importedUrls]] as const) {
    for (let offset = 0; offset < values.length; offset += 30) {
      const snapshot = await collectionFor(ctx, 'properties').where(field, 'in', values.slice(offset, offset + 30)).select(field).limit(1001).get();
      if (snapshot.size > 1000) throw new CommunicationError('Verificarea importurilor CRM este incompletă. Rezultatele nu pot fi declarate noi.', 409);
      for (const doc of snapshot.docs) {
        const value = doc.data()[field];
        if (typeof value === 'string') found.add(value);
      }
    }
  }
  return new Set(candidates.filter(candidate => importedIds.has(candidate.id) || references(candidate).some(url => importedUrls.has(url))).map(candidate => candidate.id));
}
