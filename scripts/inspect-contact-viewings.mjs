import dotenv from 'dotenv';
import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

const contactName = process.argv.slice(2).join(' ').trim();

if (!contactName) {
  console.error('Usage: node scripts/inspect-contact-viewings.mjs "Contact Name"');
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
  const normalizedSearch = contactName
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  for (const agencyDoc of agencies.docs) {
    const agencyId = agencyDoc.id;
    const allContacts = await db.collection('agencies', agencyId, 'contacts').get();
    const matchingContacts = allContacts.docs.filter((contactDoc) => {
      const name = String(contactDoc.data().name || '').toLowerCase();
      return normalizedSearch.every((token) => name.includes(token));
    });

    if (matchingContacts.length === 0) {
      continue;
    }

    console.log(`Agency: ${agencyId}`);

    for (const contactDoc of matchingContacts) {
      const contact = contactDoc.data();
      console.log('CONTACT', {
        id: contactDoc.id,
        name: contact.name,
        source: contact.source,
        sourcePropertyId: contact.sourcePropertyId ?? null,
        budget: contact.budget ?? null,
        zones: contact.zones ?? null,
        description: contact.description ?? null,
        createdAt: contact.createdAt ?? null,
      });

      const byContactId = await db
        .collection('agencies', agencyId, 'viewings')
        .where('contactId', '==', contactDoc.id)
        .get();

      console.log(`VIEWINGS by contactId (${contactDoc.id}): ${byContactId.size}`);
      byContactId.docs.forEach((viewingDoc) => {
        const viewing = viewingDoc.data();
        console.log('VIEWING_MATCH', {
          id: viewingDoc.id,
          contactId: viewing.contactId,
          contactName: viewing.contactName,
          propertyId: viewing.propertyId,
          propertyTitle: viewing.propertyTitle,
          viewingDate: viewing.viewingDate,
          status: viewing.status,
          createdAt: viewing.createdAt ?? null,
        });
      });

      const byContactName = await db
        .collection('agencies', agencyId, 'viewings')
        .where('contactName', '==', contact.name)
        .get();

      console.log(`VIEWINGS by contactName (${contact.name}): ${byContactName.size}`);
      byContactName.docs.forEach((viewingDoc) => {
        const viewing = viewingDoc.data();
        console.log('VIEWING_NAME_MATCH', {
          id: viewingDoc.id,
          contactId: viewing.contactId,
          contactName: viewing.contactName,
          propertyId: viewing.propertyId,
          propertyTitle: viewing.propertyTitle,
          viewingDate: viewing.viewingDate,
          status: viewing.status,
          createdAt: viewing.createdAt ?? null,
        });
      });
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
