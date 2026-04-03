import dotenv from 'dotenv';
import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

const isHostedRuntime = Boolean(process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT);

function getAdminApp() {
  if (getApps().length) {
    return getApps()[0];
  }

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
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

function buildAutoDescription(propertyTitle) {
  return `Notita automata: client adaugat pentru vizionarea proprietatii ${propertyTitle}`;
}

function shouldUpdateDescription(description) {
  return !description || description.trim().length === 0 || description.startsWith('Notita automata: client adaugat pentru vizionarea proprietatii');
}

async function main() {
  const app = getAdminApp();
  const db = getFirestore(app);

  const agenciesSnapshot = await db.collection('agencies').get();
  let updatedContacts = 0;

  for (const agencyDoc of agenciesSnapshot.docs) {
    const agencyId = agencyDoc.id;
    const contactsRef = db.collection('agencies', agencyId, 'contacts');
    const viewingsRef = db.collection('agencies', agencyId, 'viewings');
    const propertiesRef = db.collection('agencies', agencyId, 'properties');

    const contactsSnapshot = await contactsRef
      .where('contactType', '==', 'Cumparator')
      .get();

    if (contactsSnapshot.empty) {
      continue;
    }

    for (const contactDoc of contactsSnapshot.docs) {
      const contact = contactDoc.data();
      const needsBackfill =
        !contact.sourcePropertyId ||
        contact.budget == null ||
        !contact.city ||
        !Array.isArray(contact.zones) ||
        contact.zones.length === 0 ||
        shouldUpdateDescription(contact.description);

      if (!needsBackfill) {
        continue;
      }

      let firstViewingSnapshot = await viewingsRef
        .where('contactId', '==', contactDoc.id)
        .orderBy('viewingDate', 'asc')
        .limit(1)
        .get();

      if (firstViewingSnapshot.empty && typeof contact.name === 'string' && contact.name.trim().length > 0) {
        firstViewingSnapshot = await viewingsRef
          .where('contactName', '==', contact.name)
          .orderBy('viewingDate', 'asc')
          .limit(1)
          .get();
      }

      if (firstViewingSnapshot.empty) {
        continue;
      }

      const firstViewing = firstViewingSnapshot.docs[0].data();
      const propertyId = firstViewing.propertyId;

      if (!propertyId) {
        continue;
      }

      const propertyDoc = await propertiesRef.doc(propertyId).get();
      const property = propertyDoc.exists ? propertyDoc.data() : null;
      const propertyTitle = property?.title || firstViewing.propertyTitle;
      const updates = {};

      if (!contact.sourcePropertyId) {
        updates.sourcePropertyId = propertyId;
      }

      if (contact.budget == null && typeof property?.price === 'number') {
        updates.budget = property.price;
      }

      if ((!contact.city || String(contact.city).trim().length === 0) && typeof property?.city === 'string' && property.city.trim().length > 0) {
        updates.city = property.city.trim();
      }

      if (
        (!Array.isArray(contact.zones) || contact.zones.length === 0) &&
        typeof property?.zone === 'string' &&
        property.zone.trim().length > 0
      ) {
        updates.zones = [property.zone.trim()];
      }

      if (propertyTitle && shouldUpdateDescription(contact.description)) {
        updates.description = buildAutoDescription(propertyTitle);
      }

      if (Object.keys(updates).length === 0) {
        continue;
      }

      await contactDoc.ref.update(updates);
      updatedContacts += 1;
      console.log(`[${agencyId}] Updated contact ${contactDoc.id}`, updates);
    }
  }

  console.log(`Backfill complet. Contacte actualizate: ${updatedContacts}`);
}

main().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
