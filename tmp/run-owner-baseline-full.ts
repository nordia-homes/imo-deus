import { config as loadEnv } from 'dotenv';
import Module from 'node:module';
import path from 'node:path';

loadEnv({ path: '.env.local' });

const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function patchedResolveFilename(request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const mappedRequest = path.join(process.cwd(), 'src', request.slice(2));
    return originalResolveFilename.call(this, mappedRequest, parent, isMain, options);
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

async function deleteCollection(name: string) {
  const { adminDb } = await import('../src/firebase/admin');
  const snapshot = await adminDb.collection(name).get();
  for (let index = 0; index < snapshot.docs.length; index += 400) {
    const batch = adminDb.batch();
    for (const doc of snapshot.docs.slice(index, index + 400)) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }

  return snapshot.size;
}

async function main() {
  const { adminDb } = await import('../src/firebase/admin');
  const { runOwnerListingsBackgroundSync } = await import('../src/lib/owner-listings/background');

  const deleted: Record<string, number> = {};
  for (const name of [
    'ownerListings',
    'ownerListingSyncCycles',
    'ownerListingSyncCycleJobs',
    'ownerListingSyncRuns',
    'ownerListingSyncJobs',
    'ownerListingOlxPhoneQueue',
  ]) {
    deleted[name] = await deleteCollection(name);
  }

  const result = await runOwnerListingsBackgroundSync({
    scopeKey: 'bucuresti-ilfov',
    hardPageLimit: 250,
  });

  const cycleDoc = await adminDb.collection('ownerListingSyncCycles').doc('bucuresti-ilfov').get();
  const jobDoc = await adminDb.collection('ownerListingSyncJobs').doc(result.jobId).get();
  const totalCountSnap = await adminDb.collection('ownerListings').count().get();
  const baselineCountSnap = await adminDb.collection('ownerListings').where('isBaselineListing', '==', true).count().get();
  const isNewCountSnap = await adminDb.collection('ownerListings').where('isNew', '==', true).count().get();
  const bySourceSnap = await adminDb.collection('ownerListings').orderBy('lastSeenAt', 'desc').limit(200).get();

  const countsByOrigin = bySourceSnap.docs.reduce<Record<string, number>>((acc, doc) => {
    const label = String(doc.data().originSourceLabel || doc.data().sourceLabel || '(missing)');
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  console.log(
    JSON.stringify(
      {
        deleted,
        result,
        cycle: cycleDoc.exists ? cycleDoc.data() : null,
        job: jobDoc.exists ? jobDoc.data() : null,
        counts: {
          total: totalCountSnap.data().count,
          baseline: baselineCountSnap.data().count,
          isNewTrue: isNewCountSnap.data().count,
          recentSampleSize: bySourceSnap.size,
          recentCountsByOrigin: countsByOrigin,
        },
        sample: bySourceSnap.docs.slice(0, 30).map((doc) => ({
          id: doc.id,
          title: doc.data().title,
          price: doc.data().price,
          location: doc.data().location,
          rooms: doc.data().rooms,
          area: doc.data().area,
          constructionYear: doc.data().constructionYear,
          source: doc.data().source,
          originSourceLabel: doc.data().originSourceLabel,
          isBaselineListing: doc.data().isBaselineListing,
          isNew: doc.data().isNew,
          discoveredCycleNumber: doc.data().discoveredCycleNumber,
        })),
      },
      null,
      2
    )
  );
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
