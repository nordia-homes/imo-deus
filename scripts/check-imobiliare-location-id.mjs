import dotenv from 'dotenv';
import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

const [agencyId, ...ids] = process.argv.slice(2);

if (!agencyId || !ids.length) {
  console.error('Usage: node scripts/check-imobiliare-location-id.mjs <agencyId> <locationId> [moreIds...]');
  process.exit(1);
}

const IMOBILIARE_BASE_URL = (process.env.IMOBILIARE_API_BASE_URL || 'https://www.imobiliare.ro').replace(/\/+$/, '');
const PRIVATE_COLLECTION = 'agencyPrivateIntegrations';

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
  const docId = `${agencyId}__imobiliare`;
  const integrationSnap = await db.collection(PRIVATE_COLLECTION).doc(docId).get();

  if (!integrationSnap.exists) {
    throw new Error(`Nu am gasit integrarea privata pentru agentia ${agencyId}.`);
  }

  const integration = integrationSnap.data();
  const accessToken = integration?.accessToken;

  if (!accessToken) {
    throw new Error('Integrarea imobiliare.ro nu are access token salvat.');
  }

  const results = [];

  for (const id of ids) {
    const response = await fetch(`${IMOBILIARE_BASE_URL}/api/v3/locations/${encodeURIComponent(id)}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    results.push({
      locationId: id,
      status: response.status,
      ok: response.ok,
      payload,
    });
  }

  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
