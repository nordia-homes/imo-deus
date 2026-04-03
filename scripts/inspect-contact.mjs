import dotenv from 'dotenv';
import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

const contactId = process.argv[2];

if (!contactId) {
  console.error('Usage: node scripts/inspect-contact.mjs <contactId>');
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
    const contactDoc = await db.collection('agencies', agencyDoc.id, 'contacts').doc(contactId).get();
    if (!contactDoc.exists) continue;
    console.log({
      agencyId: agencyDoc.id,
      contactId: contactDoc.id,
      ...contactDoc.data(),
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
