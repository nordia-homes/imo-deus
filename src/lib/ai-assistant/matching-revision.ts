import { createHash } from 'node:crypto';

// Canonical source fingerprint; changes invalidate the explanation, not the
// existing matching algorithm. No contact values are exposed in the digest.
export function matchingRevision(row: Record<string, unknown>) {
  const excluded = new Set(['interactionHistory', 'recommendationHistory', 'offers', 'updatedAt', 'createdAt', 'id', 'photoUrl', 'images', 'portalId', 'preferencesLinkId']);
  function ordered(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(ordered);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)]));
    return value;
  }
  return createHash('sha256').update(JSON.stringify(ordered(Object.fromEntries(Object.entries(row).filter(([key]) => !excluded.has(key)))))).digest('hex');
}
