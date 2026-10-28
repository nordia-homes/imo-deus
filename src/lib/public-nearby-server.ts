import type { Firestore } from 'firebase-admin/firestore';
import type { Property } from '@/lib/types';
import { getNearbyObjectivesForProperty } from '@/lib/property-presentations/nearby-google';

// A durable claim is made BEFORE any paid requests. Duplicate events, concurrent
// calls and failed workers never trigger a second Google calculation.
export async function populatePublicNearbyOnce(
  db: Firestore,
  agencyId: string,
  propertyId: string,
  calculate = getNearbyObjectivesForProperty,
) {
  const ref = db.doc(`agencies/${agencyId}/properties/${propertyId}`);
  const job = db.doc(`publicNearbyJobs/${agencyId}/properties/${propertyId}`);
  const property = await db.runTransaction(async (tx) => {
    const [existing, saved] = await Promise.all([tx.get(job), tx.get(ref)]);
    if (existing.exists || !saved.exists || saved.data()?.publicNearby) return null;
    const data = saved.data()!;
    const hasCoordinates = Number.isFinite(data.latitude) && Number.isFinite(data.longitude);
    if (!hasCoordinates && ![data.address, data.zone, data.city, data.location].some(v => typeof v === 'string' && v.trim())) return null;
    tx.create(job, { status: 'claimed', claimedAt: new Date().toISOString(), agencyId, propertyId });
    return { ...data, id: propertyId } as Property;
  });
  if (!property) return { status: 'skipped' };
  try {
    const objectives = await calculate(property);
    const snapshot = { status: 'ready', objectives, calculatedAt: new Date().toISOString() };
    await db.runTransaction(async (tx) => {
      const current = await tx.get(ref);
      if (current.exists) tx.update(ref, { publicNearby: snapshot });
      tx.update(job, { status: 'completed', completedAt: snapshot.calculatedAt });
    });
    return { status: 'completed', count: objectives.length };
  } catch (error) {
    // Keep the claim permanently, even if the process failed after Google billed
    // the requests. Recovery must never be triggered by a public page visit.
    await job.update({ status: 'failed', completedAt: new Date().toISOString() });
    throw error;
  }
}
