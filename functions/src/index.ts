import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import * as functionsV1 from 'firebase-functions/v1';

const ownerListingsAppBaseUrl = defineSecret('OWNER_LISTINGS_APP_BASE_URL');
const ownerListingsCronSecret = defineSecret('OWNER_LISTINGS_FUNCTIONS_CRON_SECRET');

export const ownerListingsBackgroundSync = onSchedule(
  {
    schedule: 'every 5 minutes',
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
        maxAgeDays: 60,
        maxPagesPerTick: 12,
        maxRuntimeMs: 420000,
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

export const storiaWebhookAck = functionsV1
  .runWith({
    memory: '256MB',
    timeoutSeconds: 10,
    minInstances: 1,
  })
  .region('us-central1')
  .https.onRequest(async (request, response) => {
    // Return the acknowledgment first so OLX/Storia webhook validation stays
    // comfortably below the 2-second timeout.
    response.status(200).json({
      ok: true,
      provider: 'storia',
      method: request.method,
      receivedAt: new Date().toISOString(),
    });

    logger.info('Storia webhook acknowledgment sent.', {
      method: request.method,
      userAgent: request.get('user-agent') || null,
      hasSignature: Boolean(request.get('x-signature')),
      bodyPresent: Boolean(request.rawBody?.length),
    });
  });
