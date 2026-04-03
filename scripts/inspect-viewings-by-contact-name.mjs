import dotenv from 'dotenv';
import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

const search = process.argv.slice(2).join(' ').trim().toLowerCase();

if (!search) {
  console.error('Usage: node scripts/inspect-viewings-by-contact-name.mjs "name fragment"');
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
    const agencyId = agencyDoc.id;
    const viewings = await db.collection('agencies', agencyId, 'viewings').get();
    const matches = viewings.docs.filter((doc) => {
      const name = String(doc.data().contactName || '').toLowerCase();
      return name.includes(search);
    });

    if (!matches.length) continue;

    console.log(`Agency: ${agencyId}`);
    matches.forEach((doc) => {
      const viewing = doc.data();
      console.log({
        id: doc.id,
        contactId: viewing.contactId,
        contactName: viewing.contactName,
        propertyId: viewing.propertyId,
        propertyTitle: viewing.propertyTitle,
        viewingDate: viewing.viewingDate,
        status: viewing.status,
      });
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
