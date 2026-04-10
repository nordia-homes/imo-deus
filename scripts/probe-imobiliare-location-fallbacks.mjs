import dotenv from 'dotenv';
import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

const agencyId = process.argv[2];
const propertyId = process.argv[3];
const candidateIds = process.argv.slice(4).map((value) => Number(value)).filter(Number.isFinite);

if (!agencyId || !propertyId || !candidateIds.length) {
  console.error('Usage: node scripts/probe-imobiliare-location-fallbacks.mjs <agencyId> <propertyId> <locationId...>');
  process.exit(1);
}

const IMOBILIARE_BASE_URL = (process.env.IMOBILIARE_API_BASE_URL || 'https://www.imobiliare.ro').replace(/\/+$/, '');

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

async function safeJson(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function imobiliareFetch(accessToken, path, init = {}) {
  const response = await fetch(`${IMOBILIARE_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers || {}),
    },
  });

  return {
    status: response.status,
    ok: response.ok,
    payload: await safeJson(response),
  };
}

async function main() {
  const db = getFirestore(getAdminApp());
  const propertySnap = await db.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).get();
  if (!propertySnap.exists) {
    throw new Error(`Property ${propertyId} not found in agency ${agencyId}.`);
  }

  const privateSnap = await db.collection('agencyPrivateIntegrations').doc(`${agencyId}__imobiliare`).get();
  if (!privateSnap.exists) {
    throw new Error(`Imobiliare integration not found for agency ${agencyId}.`);
  }

  const property = propertySnap.data();
  const integration = privateSnap.data();
  const accessToken = integration?.accessToken;
  const basePayload = property?.portalProfiles?.imobiliare?.lastPublishAudit?.request;

  if (!accessToken) {
    throw new Error('Integration access token is missing.');
  }

  if (!basePayload || typeof basePayload !== 'object') {
    throw new Error('Base publish payload missing from lastPublishAudit.request.');
  }

  const customReference = String(basePayload.custom_reference || propertyId);
  const existing = await imobiliareFetch(accessToken, `/api/v3/listings/${encodeURIComponent(customReference)}`);
  const method = existing.ok ? 'PUT' : 'POST';
  const path = existing.ok ? `/api/v3/listings/${encodeURIComponent(customReference)}` : '/api/v3/listings';
  const results = [];

  for (const locationId of candidateIds) {
    const payload = {
      ...basePayload,
      location_id: locationId,
    };

    const response = await imobiliareFetch(accessToken, path, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    results.push({
      locationId,
      status: response.status,
      ok: response.ok,
      message:
        response.payload && typeof response.payload === 'object' && 'message' in response.payload
          ? response.payload.message
          : null,
      responseLocationId:
        response.payload &&
        typeof response.payload === 'object' &&
        'data' in response.payload &&
        response.payload.data &&
        typeof response.payload.data === 'object' &&
        'location_id' in response.payload.data
          ? response.payload.data.location_id
          : null,
      path:
        response.payload &&
        typeof response.payload === 'object' &&
        'data' in response.payload &&
        response.payload.data &&
        typeof response.payload.data === 'object' &&
        'path' in response.payload.data
          ? response.payload.data.path
          : null,
    });
  }

  console.log(JSON.stringify({ agencyId, propertyId, method, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
