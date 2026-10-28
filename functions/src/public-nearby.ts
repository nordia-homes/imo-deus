import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';

const appBaseUrl = defineSecret('OWNER_LISTINGS_APP_BASE_URL');
const cronSecret = defineSecret('OWNER_LISTINGS_FUNCTIONS_CRON_SECRET');
const agencyId = 'lTLGa8vkfrQOEZQ9iQwW'; // Nordia public website only.

// No admin UI or page-view hooks. Firestore creation is the only automatic trigger.
export const publicPropertyNearbyCreated = onDocumentCreated({
  document: `agencies/${agencyId}/properties/{propertyId}`,
  region: 'us-central1',
  timeoutSeconds: 300,
  retry: true,
  maxInstances: 3,
  secrets: [appBaseUrl, cronSecret],
}, async (event) => {
  if (!event.data) return;
  const response = await fetch(`${appBaseUrl.value().replace(/\/+$/, '')}/api/internal/public-nearby`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-owner-listings-cron-secret': cronSecret.value() },
    body: JSON.stringify({ agencyId, propertyId: event.params.propertyId }),
    signal: AbortSignal.timeout(280000),
  });
  if (!response.ok) throw new Error(`Public nearby snapshot failed: ${response.status}`);
});
