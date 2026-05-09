import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';

const ownerListingsAppBaseUrl = defineSecret('OWNER_LISTINGS_APP_BASE_URL');
const ownerListingsCronSecret = defineSecret('OWNER_LISTINGS_FUNCTIONS_CRON_SECRET');
const STORIA_WEBHOOK_FORWARD_URL = 'https://imodeus.ro/api/storia/webhook';

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

export const storiaWebhookAck = onRequest(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 10,
    minInstances: 1,
  },
  (request, response) => {
    // Return the acknowledgment first so OLX/Storia webhook validation stays
    // comfortably below the 2-second timeout.
    response.status(200).json({
      ok: true,
      provider: 'storia',
      method: request.method,
      receivedAt: new Date().toISOString(),
    });

    const contentType = request.get('content-type') || 'application/json';
    const signature = request.get('x-signature') || '';
    const userAgent = request.get('user-agent') || null;

    if (request.method === 'POST' && request.rawBody?.length) {
      const forwardedBody = request.rawBody.toString('utf8');
      void fetch(STORIA_WEBHOOK_FORWARD_URL, {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'x-signature': signature,
          'user-agent': userAgent || 'olx-group-api',
        },
        body: forwardedBody,
      }).catch((error) => {
        logger.error('Storia webhook forward failed.', {
          message: error instanceof Error ? error.message : String(error),
        });
      });
    }

    logger.info('Storia webhook acknowledgment sent.', {
      method: request.method,
      userAgent,
      hasSignature: Boolean(signature),
      bodyPresent: Boolean(request.rawBody?.length),
    });
  }
);
