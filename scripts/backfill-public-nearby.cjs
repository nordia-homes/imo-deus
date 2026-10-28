// One-time initialization for existing active listings, after deploying the API.
// Default is dry-run. Explicit agency ID and --apply required for paid lookups.
// Uses ADC and OWNER_LISTINGS_CRON_SECRET from the process; never prints secrets.
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
async function main() {
  const agencyId = process.argv.find(v => v.startsWith('--agency='))?.slice(9);
  if (!agencyId || !/^[\w-]{1,128}$/.test(agencyId)) throw Error('Specify --agency=<agencyId>');
  const apply = process.argv.includes('--apply');
  const base = process.env.PUBLIC_NEARBY_APP_URL || 'https://imodeus.ro';
  if (apply && !process.env.OWNER_LISTINGS_CRON_SECRET) throw Error('Missing server secret');
  initializeApp({ credential: applicationDefault(), projectId: process.env.GOOGLE_CLOUD_PROJECT || 'studio-652232171-42fb6' });
  const db = getFirestore();
  const properties = await db.collection(`agencies/${agencyId}/properties`).where('status', '==', 'Activ').get();
  for (const doc of properties.docs) {
    if (doc.data().publicNearby) continue;
    const job = await db.doc(`publicNearbyJobs/${agencyId}/properties/${doc.id}`).get();
    if (job.exists) continue;
    if (!apply) { console.log(`Pending: ${doc.id}`); continue; }
    const response = await fetch(`${base}/api/internal/public-nearby`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-owner-listings-cron-secret': process.env.OWNER_LISTINGS_CRON_SECRET },
      body: JSON.stringify({ agencyId, propertyId: doc.id }),
      signal: AbortSignal.timeout(280000),
    });
    if (!response.ok) throw Error(`Stopped at ${doc.id}: HTTP ${response.status}`);
    console.log(`${doc.id}: ${(await response.json()).status}`);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
