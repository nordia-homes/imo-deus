import dotenv from 'dotenv';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

const args = process.argv.slice(2);
const shouldWrite = args.includes('--write');
const agencyIndex = args.indexOf('--agency');
const agencyFilter = agencyIndex >= 0 ? args[agencyIndex + 1] : '';

function adminApp() {
  if (getApps().length) return getApps()[0];
  if (process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT) {
    return initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT });
  }
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) throw new Error('Lipsesc credentialele Firebase Admin din .env.local.');
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

function normalized(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function eligible(property) {
  const status = normalized(property.status);
  return status.includes('vandut') || status.includes('rezervat');
}

function trackingCode(propertyId) {
  const compact = propertyId.replace(/[^a-z0-9]/gi, '').toUpperCase();
  return `IMD-V${compact.slice(-7).padStart(7, '0')}`;
}

function saleData(agencyId, propertyId, property) {
  const now = new Date().toISOString();
  const sold = normalized(property.status).includes('vandut');
  const agentId = property.agentId || '';
  return {
    agencyId,
    trackingCode: trackingCode(propertyId),
    propertyId,
    propertyTitle: property.title || 'Proprietate',
    propertyAddress: property.address || property.location || property.title || '',
    propertyImageUrl: property.images?.[0]?.url || null,
    agentId,
    agentName: property.agentName || property.agent?.name || 'Agent neatribuit',
    collaboratorIds: [],
    stage: sold ? 'completed' : 'preparing',
    agreedPrice: property.soldPrice || property.price || null,
    financingType: 'unknown',
    participants: property.ownerName ? [{ id: `owner-${propertyId}`, role: 'owner', name: property.ownerName, email: '', phone: property.ownerPhone || null, preferredChannel: 'email' }] : [],
    checklist: [],
    notary: null,
    nextAction: sold ? 'Verifică și arhivează dosarul final' : 'Completează participanții și documentele',
    nextActionAt: null,
    lastCommunicationAt: null,
    unreadReplyCount: 0,
    receivedDocumentCount: 0,
    requiredDocumentCount: 0,
    createdAt: now,
    updatedAt: now,
    completedAt: sold ? now : null,
    cancelledAt: null,
    source: sold ? 'sold_property' : 'reserved_property',
  };
}

async function main() {
  const db = getFirestore(adminApp());
  const agencies = agencyFilter
    ? { docs: [await db.collection('agencies').doc(agencyFilter).get()].filter((snapshot) => snapshot.exists) }
    : await db.collection('agencies').get();
  let eligibleCount = 0;
  let existingCount = 0;
  let createdCount = 0;

  for (const agency of agencies.docs) {
    const properties = await agency.ref.collection('properties').get();
    for (const propertySnapshot of properties.docs) {
      const property = propertySnapshot.data();
      if (!eligible(property)) continue;
      eligibleCount += 1;
      const saleRef = agency.ref.collection('sales').doc(propertySnapshot.id);
      if ((await saleRef.get()).exists) {
        existingCount += 1;
        continue;
      }
      console.log(`[${agency.id}] ${propertySnapshot.id} · ${property.title || 'Proprietate'} · ${shouldWrite ? 'create' : 'dry-run'}`);
      if (shouldWrite) {
        await saleRef.set(saleData(agency.id, propertySnapshot.id, property));
        createdCount += 1;
      }
    }
  }
  console.log({ mode: shouldWrite ? 'write' : 'dry-run', eligible: eligibleCount, existing: existingCount, created: createdCount });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
