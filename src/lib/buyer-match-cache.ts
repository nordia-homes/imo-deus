import type { Contact, MatchedBuyer, Property } from '@/lib/types';

type MatchResult = { matchedBuyers: MatchedBuyer[] };
type Matcher = (property: Property, contacts: Contact[]) => Promise<MatchResult>;

// Memory only: never persist contact data in browser storage. Include every
// input, plus the authenticated agency/user, so changed data cannot reuse a result.
export function createBuyerMatchCache(matcher: Matcher, ttlMs = 120_000, maxEntries = 8) {
  const entries = new Map<string, { promise: Promise<MatchResult>; expiresAt: number }>();

  return (scope: string, property: Property, contacts: Contact[]) => {
    const key = JSON.stringify([scope, property, contacts]);
    const existing = entries.get(key);
    if (existing && existing.expiresAt > Date.now()) return existing.promise;

    const entry = { promise: null as unknown as Promise<MatchResult>, expiresAt: Infinity };
    entry.promise = Promise.resolve().then(() => matcher(property, contacts)).then(
      (result) => {
        entry.expiresAt = Date.now() + ttlMs;
        return result;
      },
      (error) => {
        if (entries.get(key) === entry) entries.delete(key);
        throw error;
      },
    );
    entries.delete(key);
    entries.set(key, entry);
    while (entries.size > maxEntries) entries.delete(entries.keys().next().value!);
    return entry.promise;
  };
}
