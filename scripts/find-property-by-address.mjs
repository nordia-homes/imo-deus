import dotenv from 'dotenv';
import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

const address = process.argv[2];

if (!address) {
  console.error('Usage: node scripts/find-property-by-address.mjs <address>');
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
    throw new Error('Lipsesc credentialele Firebase Admin din .env.local.');
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

async function main() {
  const db = getFirestore(getAdminApp());
  const agencies = await db.collection('agencies').get();
  const hits = [];

  for (const agencyDoc of agencies.docs) {
    const snap = await db
      .collection('agencies')
      .doc(agencyDoc.id)
      .collection('properties')
      .where('address', '==', address)
      .get();

    for (const doc of snap.docs) {
      const data = doc.data();
      hits.push({
        agencyId: agencyDoc.id,
        propertyId: doc.id,
        title: data?.title ?? null,
        address: data?.address ?? null,
        city: data?.city ?? null,
        zone: data?.zone ?? null,
        location: data?.location ?? null,
        portalProfileImobiliare: data?.portalProfiles?.imobiliare ?? null,
        promotionImobiliare: data?.promotions?.imobiliare ?? null,
      });
    }
  }

  console.log(JSON.stringify(hits, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
