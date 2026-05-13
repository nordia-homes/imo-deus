import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';

const ownerListingsAppBaseUrl = defineSecret('OWNER_LISTINGS_APP_BASE_URL');
const ownerListingsCronSecret = defineSecret('OWNER_LISTINGS_FUNCTIONS_CRON_SECRET');
const STORIA_WEBHOOK_FORWARD_URL = 'https://imodeus.ro/api/storia/webhook';

async function postOwnerListingsEndpoint(
  appBaseUrl: string,
  cronSecret: string,
  path: string,
  body: Record<string, unknown> = {}
) {
  const response = await fetch(`${appBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-owner-listings-cron-secret': cronSecret,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.text();
  if (!response.ok) {
    logger.error('Owner listings scheduled endpoint failed.', {
      path,
      status: response.status,
      payload,
    });
    throw new Error(`${path} failed with status ${response.status}.`);
  }

  return payload;
}

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

    const frontierPayload = await postOwnerListingsEndpoint(
      appBaseUrl,
      cronSecret,
      '/api/owner-listings/sync/frontier',
      {
        limit: 8,
        maxPage: 20,
        maxRuntimeMs: 420000,
      }
    );

    const enrichmentPayloads: string[] = [];
    for (let index = 0; index < 8; index += 1) {
      const payload = await postOwnerListingsEndpoint(
        appBaseUrl,
        cronSecret,
        '/api/owner-listings/enrichment-drain'
      );
      enrichmentPayloads.push(payload);
      if (payload.includes('"status":"empty"')) {
        break;
      }
    }

    logger.info('Owner listings frontier/enrichment sync completed.', {
      frontierPayload,
      enrichmentPayloads,
    });
  }
);

export const ownerListingsLegacyCycleSync = onSchedule(
  {
    schedule: 'every 24 hours',
    timeZone: 'Europe/Bucharest',
    region: 'us-central1',
    memory: '1GiB',
    timeoutSeconds: 540,
    secrets: [ownerListingsAppBaseUrl, ownerListingsCronSecret],
  },
  async () => {
    const appBaseUrl = ownerListingsAppBaseUrl.value().replace(/\/+$/, '');
    const cronSecret = ownerListingsCronSecret.value();

    const payload = await postOwnerListingsEndpoint(
      appBaseUrl,
      cronSecret,
      '/api/owner-listings/sync/background',
      {
        hardPageLimit: 60,
        maxAgeDays: 60,
        maxPagesPerTick: 6,
        maxRuntimeMs: 300000,
      }
    );

    logger.info('Owner listings legacy safety cycle completed.', {
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
