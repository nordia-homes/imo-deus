import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const ownerListingsAppBaseUrl = defineSecret('OWNER_LISTINGS_APP_BASE_URL');
const ownerListingsCronSecret = defineSecret('OWNER_LISTINGS_FUNCTIONS_CRON_SECRET');
const STORIA_WEBHOOK_FORWARD_URL = 'https://imodeus.ro/api/storia/webhook';
const STORIA_PROVIDER = 'storia';
const STORIA_SITE_URL = 'https://www.storia.ro';
const PRIVATE_COLLECTION = 'agencyPrivateIntegrations';

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

function nowIso() {
  return new Date().toISOString();
}

function sanitizeFirestoreId(value: string) {
  return value.replace(/[~/[\]#?]/g, '_').slice(0, 180) || 'storia-message';
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

async function resolveFallbackAgencyIdForIncomingMessage() {
  const configuredAgencyId = (process.env.STORIA_DEFAULT_AGENCY_ID || '').trim();
  if (configuredAgencyId) return configuredAgencyId;

  const integrationsSnapshot = await db
    .collection(PRIVATE_COLLECTION)
    .where('provider', '==', STORIA_PROVIDER)
    .get();

  const integrations = integrationsSnapshot.docs
    .map((docSnapshot) => docSnapshot.data() as StoriaIntegrationPrivate)
    .filter((integration) => integration.agencyId && integration.accessToken);
  const leadReadyIntegrations = integrations.filter((integration) => integration.hasLeadScopes !== false);
  const candidates = leadReadyIntegrations.length ? leadReadyIntegrations : integrations;

  return candidates.length === 1 ? candidates[0].agencyId || null : null;
}

async function findStoriaPropertySnapshotsForIncomingMessage(notification: StoriaWebhookNotification) {
  const docsByPath = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  const addSnapshotDocs = (snapshot: FirebaseFirestore.QuerySnapshot) => {
    snapshot.docs.forEach((docSnapshot) => {
      docsByPath.set(docSnapshot.ref.path, docSnapshot);
    });
  };
  const tryAddSnapshotDocs = async (
    query: FirebaseFirestore.Query,
    label: string
  ) => {
    try {
      addSnapshotDocs(await query.get());
    } catch (error) {
      logger.warn('Storia property matching query failed; continuing with fallback.', {
        label,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const data = notification.data || {};
  const identifiers = [
    data.advert_uuid,
    data.ad_id != null ? String(data.ad_id) : null,
  ].filter((value): value is string => Boolean(value));

  for (const identifier of identifiers) {
    await tryAddSnapshotDocs(
      db.collectionGroup('properties').where('promotions.storia.remoteId', '==', identifier),
      'promotions.storia.remoteId'
    );
    await tryAddSnapshotDocs(
      db.collectionGroup('properties').where('promotions.storia.remoteAdId', '==', identifier),
      'promotions.storia.remoteAdId'
    );
    await tryAddSnapshotDocs(
      db.collectionGroup('properties').where('portalProfiles.storia.remoteUuid', '==', identifier),
      'portalProfiles.storia.remoteUuid'
    );
    await tryAddSnapshotDocs(
      db.collectionGroup('properties').where('portalProfiles.storia.remoteAdId', '==', identifier),
      'portalProfiles.storia.remoteAdId'
    );
  }

  if (docsByPath.size || !data.ad_id) {
    return Array.from(docsByPath.values());
  }

  const remoteAdId = String(data.ad_id);
  let publishedSnapshot: FirebaseFirestore.QuerySnapshot;
  try {
    publishedSnapshot = await db
      .collectionGroup('properties')
      .where('promotions.storia.status', '==', 'published')
      .limit(500)
      .get();
  } catch (error) {
    logger.warn('Storia published property URL matching query failed; continuing with agency fallback.', {
      message: error instanceof Error ? error.message : String(error),
    });
    return Array.from(docsByPath.values());
  }

  publishedSnapshot.docs.forEach((docSnapshot) => {
    const property = docSnapshot.data() as PropertySnapshotData;
    const hasMatchingUrl = [
      property.portalProfiles?.storia?.remoteUrl,
      property.promotions?.storia?.link,
    ].some((url) => extractStoriaAdIdFromUrl(url) === remoteAdId);

    if (hasMatchingUrl) {
      docsByPath.set(docSnapshot.ref.path, docSnapshot);
    }
  });

  return Array.from(docsByPath.values());
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
  const messageId = String(data.uuid || data.id || notification.object_id || notification.transaction_id || '').trim();

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

  const propertySnapshots = await findStoriaPropertySnapshotsForIncomingMessage(notification);
  const firstPropertySnapshot = propertySnapshots[0] || null;
  const property = firstPropertySnapshot ? (firstPropertySnapshot.data() as PropertySnapshotData) : null;
  const agencyId =
    (firstPropertySnapshot ? getAgencyIdFromPropertyPath(firstPropertySnapshot.ref.path) : null) ||
    (await resolveFallbackAgencyIdForIncomingMessage());

  if (!agencyId) {
    await db.collection('storiaIncomingMessagesUnmatched').doc(sanitizeFirestoreId(messageId)).set(
      {
        provider: STORIA_PROVIDER,
        source: 'storia_incoming_message',
        receivedAt: nowIso(),
        reason: 'agency_not_resolved',
        rawPayload: notification,
      },
      { merge: true }
    );
    return { persisted: false, reason: 'agency_not_resolved' };
  }

  const createdAt = data.created_at || nowIso();
  const senderName = (data.sender_name || 'Client Storia').trim();
  const senderEmail = data.sender_email || null;
  const senderPhone = data.sender_phone || null;
  const remoteAdId = data.ad_id ?? null;
  const remoteAdvertUuid = data.advert_uuid || property?.portalProfiles?.storia?.remoteUuid || null;
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
        propertyId: firstPropertySnapshot?.id || current?.propertyId || null,
        propertyTitle: property?.title || current?.propertyTitle || null,
        propertyUrl:
          property?.portalProfiles?.storia?.remoteUrl ||
          property?.promotions?.storia?.link ||
          current?.propertyUrl ||
          null,
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
