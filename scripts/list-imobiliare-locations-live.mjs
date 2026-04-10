import dotenv from 'dotenv';
import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

const agencyId = process.argv[2];
const search = (process.argv[3] || '').trim().toLowerCase();

if (!agencyId) {
  console.error('Usage: node scripts/list-imobiliare-locations-live.mjs <agencyId> [search]');
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

function flattenLocations(node, results = []) {
  if (!node || typeof node !== 'object') {
    return results;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      flattenLocations(item, results);
    }
    return results;
  }

  const record = node;
  if (typeof record.id === 'number') {
    results.push({
      id: record.id,
      title: record.title ?? null,
      slug: record.slug ?? null,
      depth: record.depth ?? null,
      parent_id: record.parent_id ?? null,
      is_hidden: record.is_hidden ?? null,
      custom_display: record.custom_display ?? null,
    });
  }

  for (const value of Object.values(record)) {
    flattenLocations(value, results);
  }

  return results;
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

  const response = await fetch(`${IMOBILIARE_BASE_URL}/api/v3/locations`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  const payload = await response.json();
  const all = flattenLocations(payload);
  const deduped = Array.from(new Map(all.map((item) => [item.id, item])).values());
  const filtered = search
    ? deduped.filter((item) =>
        [item.title, item.slug, item.custom_display]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search))
      )
    : deduped;

  console.log(
    JSON.stringify(
      {
        status: response.status,
        total: deduped.length,
        filtered,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
