import dotenv from 'dotenv';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

function adminApp() {
  if (getApps().length) return getApps()[0];
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT) {
    return initializeApp({ credential: applicationDefault(), projectId });
  }
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Lipsesc credentialele Firebase Admin.');
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore(adminApp());

async function count(query) {
  // Root app still uses firebase-admin 10; select() keeps verification reads payload-free.
  return (await query.select().get()).size;
}

async function statusCounts(collectionName, statuses) {
  return Object.fromEntries(
    await Promise.all(
      statuses.map(async (status) => [status, await count(db.collection(collectionName).where('status', '==', status))])
    )
  );
}

const listings = db.collection('ownerListings');
const readyCanonical = listings.where('publicationStatus', '==', 'ready').where('isCanonical', '==', true);
const sources = ['olx', 'publi24', 'imoradar24'];
const bySource = Object.fromEntries(
  await Promise.all(
    sources.map(async (source) => [source, await count(readyCanonical.where('source', '==', source))])
  )
);

const frontierBySource = Object.fromEntries(
  await Promise.all(
    sources.map(async (source) => [source, await count(db.collection('ownerListingScrapeFrontier').where('source', '==', source))])
  )
);

const healthSnapshot = await db.collection('ownerListingScrapeHealth').get();
const health = Object.fromEntries(
  healthSnapshot.docs.map((snapshot) => {
    const data = snapshot.data();
    return [snapshot.id, {
      status: data.status || null,
      lastSuccessAt: data.lastSuccessAt || null,
      lastFailureAt: data.lastFailureAt || null,
      lastScanned: data.lastScanned ?? null,
      lastInserted: data.lastInserted ?? null,
      lastError: data.lastError || null,
      healthy: data.healthy ?? null,
      staleSources: data.staleSources || null,
    }];
  })
);

const result = {
  checkedAt: new Date().toISOString(),
  listings: {
    total: await count(listings),
    ready: await count(listings.where('publicationStatus', '==', 'ready')),
    rejected: await count(listings.where('publicationStatus', '==', 'rejected')),
    canonicalReady: await count(readyCanonical),
    duplicateDocuments: await count(listings.where('isCanonical', '==', false)),
    bySource,
  },
  canonicalGroups: await count(db.collection('ownerListingCanonicalGroups')),
  enrichmentQueue: await statusCounts('ownerListingEnrichmentQueue', ['pending', 'processing', 'retry', 'done', 'failed']),
  olxPhoneQueue: await statusCounts('ownerListingOlxPhoneQueue', ['pending', 'processing', 'retry', 'done', 'failed']),
  frontier: {
    total: await count(db.collection('ownerListingScrapeFrontier')),
    bySource: frontierBySource,
    statuses: await statusCounts('ownerListingScrapeFrontier', ['pending', 'running', 'cooldown', 'failed']),
  },
  health,
};

console.log(JSON.stringify(result, null, 2));
