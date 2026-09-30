import { createHash } from 'node:crypto';

export function listingIdFor(agencyId: string, propertyId: string) {
  return createHash('sha256').update(`${agencyId}:${propertyId}`).digest('hex');
}
