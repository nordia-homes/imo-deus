import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';

const ownerListingsAppBaseUrl = defineSecret('OWNER_LISTINGS_APP_BASE_URL');
const ownerListingsCronSecret = defineSecret('OWNER_LISTINGS_FUNCTIONS_CRON_SECRET');

export const ownerListingsBackgroundSync = onSchedule(
  {
    schedule: 'every 2 hours',
    timeZone: 'Europe/Bucharest',
    region: 'us-central1',
    memory: '1GiB',
    timeoutSeconds: 540,
    secrets: [ownerListingsAppBaseUrl, ownerListingsCronSecret],
  },
  async () => {
    const appBaseUrl = ownerListingsAppBaseUrl.value().replace(/\/+$/, '');
    const cronSecret = ownerListingsCronSecret.value();

    const response = await fetch(`${appBaseUrl}/api/owner-listings/sync/background`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-owner-listings-cron-secret': cronSecret,
      },
      body: JSON.stringify({
        hardPageLimit: 250,
      }),
    });

    const payload = await response.text();
    if (!response.ok) {
      logger.error('Owner listings background sync failed.', {
        status: response.status,
        payload,
      });
      throw new Error(`Background sync failed with status ${response.status}.`);
    }

    logger.info('Owner listings background sync completed.', {
      payload,
    });
  }
);
