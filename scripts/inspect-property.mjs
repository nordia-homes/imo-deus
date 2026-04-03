import dotenv from 'dotenv';
import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

const propertyId = process.argv[2];

if (!propertyId) {
  console.error('Usage: node scripts/inspect-property.mjs <propertyId>');
  process.exit(1);
}

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const isHostedRuntime = Boolean(process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT);
  if (isHostedRuntime) {
    return initializeApp({
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
    });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Lipsesc credențialele Firebase Admin din .env.local.');
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

async function main() {
  const db = getFirestore(getAdminApp());
  const agencies = await db.collection('agencies').get();

  for (const agencyDoc of agencies.docs) {
    const propertyDoc = await db.collection('agencies', agencyDoc.id, 'properties').doc(propertyId).get();
    if (!propertyDoc.exists) continue;

    const data = propertyDoc.data();
    console.log({
      agencyId: agencyDoc.id,
      propertyId: propertyDoc.id,
      title: data?.title ?? null,
      address: data?.address ?? null,
      city: data?.city ?? null,
      zone: data?.zone ?? null,
      location: data?.location ?? null,
      price: data?.price ?? null,
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
