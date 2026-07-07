import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const ownerListingsAppBaseUrl = defineSecret('OWNER_LISTINGS_APP_BASE_URL');
const ownerListingsCronSecret = defineSecret('OWNER_LISTINGS_FUNCTIONS_CRON_SECRET');
const aiOutreachCronSecret = defineSecret('AI_OUTREACH_CRON_SECRET');
const propertyVideoTourCronSecret = defineSecret('PROPERTY_VIDEO_TOUR_CRON_SECRET');
const STORIA_WEBHOOK_FORWARD_URL = 'https://imodeus.ro/api/storia/webhook';
const STORIA_PROVIDER = 'storia';
const STORIA_SITE_URL = 'https://www.storia.ro';
const PRIVATE_COLLECTION = 'agencyPrivateIntegrations';
const STORIA_ADVERT_MAPPINGS_COLLECTION = 'storiaAdvertMappings';

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

type StoriaWebhookNotification = {
  transaction_id?: string;
  object_id?: string;
  flow?: string;
  event_type?: string;
  data?: {
    ad_id?: string | number | null;
    advert_uuid?: string | null;
    conversation_id?: string | number | null;
    id?: string | number | null;
    uuid?: string | null;
    message?: string | null;
    sender_name?: string | null;
    sender_email?: string | null;
    sender_phone?: string | number | null;
    created_at?: string | null;
  } | null;
};

type StoriaIntegrationPrivate = {
  provider?: string;
  agencyId?: string | null;
  accessToken?: string | null;
  hasLeadScopes?: boolean;
};

type PropertySnapshotData = {
  title?: string | null;
  images?: Array<{ url?: string | null; alt?: string | null }> | null;
  portalProfiles?: {
    storia?: {
      remoteUuid?: string | null;
      remoteAdId?: string | number | null;
      remoteUrl?: string | null;
    } | null;
  } | null;
  promotions?: {
    storia?: {
      link?: string | null;
      remoteId?: string | number | null;
      remoteAdId?: string | number | null;
      status?: string | null;
    } | null;
  } | null;
};

type StoriaAdvertMapping = {
  provider: 'storia';
  agencyId: string;
  propertyId: string;
  remoteUuid?: string | null;
  remoteAdId?: string | number | null;
  propertyTitle?: string | null;
  propertyUrl?: string | null;
  propertyImageUrl?: string | null;
  updatedAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

function sanitizeFirestoreId(value: string) {
  return value.replace(/[~/[\]#?]/g, '_').slice(0, 180) || 'storia-message';
}

function getStoriaAdvertMappingId(kind: 'uuid' | 'ad', value: string | number) {
  return `${kind}_${sanitizeFirestoreId(String(value))}`;
}

function getPropertyImageUrl(property?: PropertySnapshotData | null) {
  return property?.images?.find((image) => image?.url)?.url || null;
}

function isIncomingMessageNotification(notification: StoriaWebhookNotification) {
  return (notification.flow || '').toLowerCase() === 'incoming_message' ||
    (notification.event_type || '').toLowerCase() === 'incoming_message_success';
}

function extractStoriaAdIdFromUrl(rawUrl?: string | null) {
  const normalized = (rawUrl || '').trim();
  if (!normalized) return null;

  try {
    const url = new URL(normalized.startsWith('http') ? normalized : `${STORIA_SITE_URL}/${normalized.replace(/^\/+/, '')}`);
    const lastSegment = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
    const match = lastSegment.match(/(?:^|-)([A-Za-z0-9]{5,32})(?:\.html)?$/);
    return match?.[1] || null;
  } catch {
    const lastSegment = normalized.split(/[/?#]/).filter(Boolean).pop() || '';
    const match = lastSegment.match(/(?:^|-)([A-Za-z0-9]{5,32})(?:\.html)?$/);
    return match?.[1] || null;
  }
}

function getAgencyIdFromPropertyPath(path: string) {
  const parts = path.split('/');
  return parts[0] === 'agencies' && parts[2] === 'properties' ? parts[1] : null;
}

async function resolveStoriaAdvertMapping(notification: StoriaWebhookNotification) {
  const data = notification.data || {};
  const candidates: Array<['uuid' | 'ad', string | number | null | undefined]> = [
    ['uuid', data.advert_uuid],
    ['uuid', data.uuid],
    ['uuid', notification.object_id],
    ['ad', data.ad_id],
  ];

  for (const [kind, value] of candidates) {
    if (value === null || value === undefined || value === '') continue;
    const snapshot = await db
      .collection(STORIA_ADVERT_MAPPINGS_COLLECTION)
      .doc(getStoriaAdvertMappingId(kind, value))
      .get();

    if (snapshot.exists) {
      return snapshot.data() as StoriaAdvertMapping;
    }
  }

  return null;
}

async function persistIncomingAdIdMapping(mapping: StoriaAdvertMapping | null, adId?: string | number | null) {
  if (!mapping || adId === null || adId === undefined || adId === '') return;
  const nextMapping: StoriaAdvertMapping = {
    ...mapping,
    remoteAdId: adId,
    updatedAt: nowIso(),
  };
  const batch = db.batch();
  batch.set(
    db.collection(STORIA_ADVERT_MAPPINGS_COLLECTION).doc(getStoriaAdvertMappingId('ad', adId)),
    nextMapping,
    { merge: true }
  );
  if (mapping.remoteUuid) {
    batch.set(
      db.collection(STORIA_ADVERT_MAPPINGS_COLLECTION).doc(getStoriaAdvertMappingId('uuid', mapping.remoteUuid)),
      nextMapping,
      { merge: true }
    );
  }
  if (mapping.agencyId && mapping.propertyId) {
    batch.set(
      db.collection('agencies').doc(mapping.agencyId).collection('properties').doc(mapping.propertyId),
      {
        promotions: { storia: { remoteAdId: adId } },
        portalProfiles: { storia: { remoteAdId: adId } },
      },
      { merge: true }
    );
  }
  await batch.commit();
}

async function getMappedStoriaProperty(mapping: StoriaAdvertMapping | null) {
  if (!mapping?.agencyId || !mapping.propertyId) return null;
  const snapshot = await db
    .collection('agencies')
    .doc(mapping.agencyId)
    .collection('properties')
    .doc(mapping.propertyId)
    .get();

  if (!snapshot.exists) return null;
  return {
    snapshot,
    property: snapshot.data() as PropertySnapshotData,
  };
}

async function persistStoriaIncomingMessageDirect(notification: StoriaWebhookNotification) {
  if (!isIncomingMessageNotification(notification)) {
    logger.info('Storia webhook ignored by direct inbox persistence.', {
      flow: notification.flow || null,
      eventType: notification.event_type || null,
      objectId: notification.object_id || null,
    });
    return { persisted: false, reason: 'not_incoming_message' };
  }

  const data = notification.data || {};
  const conversationId = String(data.conversation_id || data.ad_id || notification.object_id || notification.transaction_id || '').trim();
  const messageText = (data.message || '').trim();
  const messageId = String(data.id || data.uuid || notification.object_id || notification.transaction_id || '').trim();

  if (!conversationId || !messageId || !messageText) {
    logger.warn('Storia incoming_message missing required fields.', {
      hasConversationId: Boolean(conversationId),
      hasMessageId: Boolean(messageId),
      hasMessageText: Boolean(messageText),
      flow: notification.flow || null,
      eventType: notification.event_type || null,
    });
    return { persisted: false, reason: 'missing_required_fields' };
  }

  const mapping = await resolveStoriaAdvertMapping(notification);
  await persistIncomingAdIdMapping(mapping, data.ad_id);
  const mappedProperty = await getMappedStoriaProperty(mapping);
  const property = mappedProperty?.property || null;
  const agencyId = mapping?.agencyId || null;

  if (!agencyId) {
    await db.collection('storiaIncomingMessagesUnmatched').doc(sanitizeFirestoreId(messageId)).set(
      {
        provider: STORIA_PROVIDER,
        source: 'storia_incoming_message',
        receivedAt: nowIso(),
        reason: 'advert_not_mapped',
        rawPayload: notification,
      },
      { merge: true }
    );
    return { persisted: false, reason: 'advert_not_mapped' };
  }

  const createdAt = data.created_at || nowIso();
  const senderName = (data.sender_name || 'Client Storia').trim();
  const senderEmail = data.sender_email || null;
  const senderPhone = data.sender_phone || null;
  const remoteAdId = data.ad_id ?? null;
  const remoteAdvertUuid = data.advert_uuid || data.uuid || notification.object_id || property?.portalProfiles?.storia?.remoteUuid || mapping?.remoteUuid || null;
  const propertyRemoteAdId =
    remoteAdId ||
    property?.portalProfiles?.storia?.remoteAdId ||
    property?.promotions?.storia?.remoteAdId ||
    extractStoriaAdIdFromUrl(property?.portalProfiles?.storia?.remoteUrl) ||
    extractStoriaAdIdFromUrl(property?.promotions?.storia?.link) ||
    null;
  const leadRef = db
    .collection('agencies')
    .doc(agencyId)
    .collection('storiaInboxLeads')
    .doc(sanitizeFirestoreId(conversationId));
  const message = {
    id: messageId,
    createdAt,
    direction: 'received',
    text: messageText,
    senderName,
    senderEmail,
    senderPhone,
    transactionId: notification.transaction_id || null,
  };

  await db.runTransaction(async (transaction) => {
    const leadSnapshot = await transaction.get(leadRef);
    const current = leadSnapshot.exists ? leadSnapshot.data() : null;
    const currentMessages = Array.isArray(current?.messages) ? current.messages : [];
    const hasMessage = currentMessages.some((item: { id?: string }) => item.id === message.id);
    const nextMessages = hasMessage ? currentMessages : [...currentMessages, message];
    nextMessages.sort((left: { createdAt?: string }, right: { createdAt?: string }) =>
      new Date(left.createdAt || '').getTime() - new Date(right.createdAt || '').getTime()
    );

    transaction.set(
      leadRef,
      {
        agencyId,
        provider: STORIA_PROVIDER,
        source: 'storia_incoming_message',
        conversationId,
        remoteAdId: propertyRemoteAdId,
        remoteAdvertUuid,
        propertyId: mapping?.propertyId || current?.propertyId || null,
        propertyTitle: property?.title || mapping?.propertyTitle || current?.propertyTitle || null,
        propertyUrl:
          property?.portalProfiles?.storia?.remoteUrl ||
          property?.promotions?.storia?.link ||
          mapping?.propertyUrl ||
          current?.propertyUrl ||
          null,
        propertyImageUrl: getPropertyImageUrl(property) || mapping?.propertyImageUrl || current?.propertyImageUrl || null,
        senderName: senderName || current?.senderName || 'Client Storia',
        senderEmail: senderEmail || current?.senderEmail || null,
        senderPhone: senderPhone || current?.senderPhone || null,
        firstMessage: current?.firstMessage || nextMessages[0]?.text || messageText,
        latestMessage: messageText,
        firstMessageAt: current?.firstMessageAt || nextMessages[0]?.createdAt || createdAt,
        lastMessageAt: createdAt,
        unread: true,
        status: current?.status || 'nou',
        createdAt: current?.createdAt || nowIso(),
        updatedAt: nowIso(),
        messageCount: nextMessages.length,
        messages: nextMessages.slice(-80),
        rawLastPayload: notification,
      },
      { merge: true }
    );
  });

  return { persisted: true, agencyId, conversationId, messageId };
}

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

async function postAiOutreachEndpoint(appBaseUrl: string, cronSecret: string, path: string) {
  const response = await fetch(`${appBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cronSecret}`,
    },
  });

  const payload = await response.text();
  if (!response.ok) {
    logger.error('AI outreach scheduled endpoint failed.', {
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

export const aiOutreachScheduledCallsDrain = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'Europe/Bucharest',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 120,
    secrets: [ownerListingsAppBaseUrl, aiOutreachCronSecret],
  },
  async () => {
    const appBaseUrl = ownerListingsAppBaseUrl.value().replace(/\/+$/, '');
    const cronSecret = aiOutreachCronSecret.value();

    const payload = await postAiOutreachEndpoint(
      appBaseUrl,
      cronSecret,
      '/api/ai-outreach/calls/drain-scheduled'
    );

    logger.info('AI outreach scheduled calls drain completed.', {
      payload,
    });
  }
);

export const propertyVideoTourJobsDrain = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'Europe/Bucharest',
    region: 'us-central1',
    memory: '2GiB',
    timeoutSeconds: 540,
    secrets: [ownerListingsAppBaseUrl, propertyVideoTourCronSecret],
  },
  async () => {
    const appBaseUrl = ownerListingsAppBaseUrl.value().replace(/\/+$/, '');
    const cronSecret = propertyVideoTourCronSecret.value();

    const response = await fetch(`${appBaseUrl}/api/property-video-tours/drain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ limit: 1 }),
    });
    const payload = await response.text();

    if (!response.ok) {
      logger.error('Property video tour drain failed.', {
        status: response.status,
        payload,
      });
      throw new Error(`Property video tour drain failed with status ${response.status}.`);
    }

    logger.info('Property video tour drain completed.', { payload });
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
    timeoutSeconds: 15,
    minInstances: 1,
  },
  async (request, response) => {
    const contentType = request.get('content-type') || 'application/json';
    const signature = request.get('x-signature') || '';
    const userAgent = request.get('user-agent') || null;
    let forwardStatus: number | null = null;
    let forwardError: string | null = null;
    let directPersistenceResult: Record<string, unknown> | null = null;

    if (request.method === 'POST' && request.rawBody?.length) {
      const forwardedBody = request.rawBody.toString('utf8');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      try {
        directPersistenceResult = await persistStoriaIncomingMessageDirect(JSON.parse(forwardedBody) as StoriaWebhookNotification);
      } catch (error) {
        directPersistenceResult = {
          persisted: false,
          reason: 'direct_persistence_error',
          message: error instanceof Error ? error.message : String(error),
        };
        logger.error('Storia direct inbox persistence failed.', directPersistenceResult);
      }

      try {
        const forwardResponse = await fetch(STORIA_WEBHOOK_FORWARD_URL, {
          method: 'POST',
          headers: {
            'Content-Type': contentType,
            'x-signature': signature,
            'user-agent': userAgent || 'olx-group-api',
          },
          body: forwardedBody,
          signal: controller.signal,
        });
        forwardStatus = forwardResponse.status;

        if (!forwardResponse.ok) {
          forwardError = await forwardResponse.text().catch(() => `HTTP ${forwardResponse.status}`);
        }
      } catch (error) {
        forwardError = error instanceof Error ? error.message : String(error);
        logger.error('Storia webhook forward failed.', {
          message: forwardError,
        });
      } finally {
        clearTimeout(timeout);
      }
    }

    logger.info('Storia webhook acknowledgment sent.', {
      method: request.method,
      userAgent,
      hasSignature: Boolean(signature),
      bodyPresent: Boolean(request.rawBody?.length),
      forwardStatus,
      forwardError,
      directPersistenceResult,
    });

    response.status(200).json({
      ok: true,
      provider: 'storia',
      method: request.method,
      receivedAt: new Date().toISOString(),
      forwarded: request.method === 'POST' && Boolean(request.rawBody?.length),
      directPersistenceResult,
    });
  }
);
