import { createHash } from 'node:crypto';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { adminDb as primaryAdminDb } from '@/firebase/admin';
import { scrapeOlxPhoneNumber } from '@/lib/owner-listings/sources/olx';
import {
  describeRemoteOlxPhoneStage,
  resolveOlxPhoneViaRemoteWorker,
} from '@/lib/owner-listings/remote-olx-phone';
import { resolveOlxPhoneViaAgentCloud } from '@/lib/owner-listings/olx-cloud-phone';
import { registerOwnerListingCanonical } from '@/lib/owner-listings/canonical';
import type { OlxPhoneDrainResult, OlxPhoneQueueEntry, OwnerListingSummary } from '@/lib/owner-listings/types';

const OLX_PHONE_QUEUE_COLLECTION = 'ownerListingOlxPhoneQueue';
const PROCESSING_STALE_MS = 15 * 60 * 1000;
const RETRY_DELAY_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function nowIso() {
  return new Date().toISOString();
}

function getProspectingQueueId(agencyId: string, listingId: string) {
  return createHash('sha256').update(`${agencyId}:${listingId}`).digest('hex');
}

export async function upsertProspectingOlxPhoneQueueEntry(input: {
  adminDb?: Firestore;
  agencyId: string;
  requestedByUid: string;
  requestedByName?: string;
  listingId: string;
  link: string;
  title?: string;
  error?: string;
  forceRetry?: boolean;
}) {
  const timestamp = nowIso();
  const targetDb = input.adminDb || primaryAdminDb;
  const queueRef = targetDb
    .collection(OLX_PHONE_QUEUE_COLLECTION)
    .doc(getProspectingQueueId(input.agencyId, input.listingId));
  const snapshot = await queueRef.get();
  const existing = snapshot.exists ? (snapshot.data() as Partial<OlxPhoneQueueEntry>) : undefined;

  await queueRef.set(
    {
      listingId: input.listingId,
      source: 'olx',
      link: input.link,
      title: input.title || '',
      agencyId: input.agencyId,
      requestedByUid: input.requestedByUid,
      requestedByName: input.requestedByName || '',
      trigger: 'prospecting',
      lane: 'prospecting',
      priority: 3000,
      status: existing?.status === 'done' && existing.phone && !input.forceRetry ? 'done' : 'pending',
      attempts: input.forceRetry || existing?.status === 'failed' || existing?.status === 'cancelled'
        ? 0
        : existing?.attempts || 0,
      phone: existing?.status === 'done' && !input.forceRetry ? existing.phone || '' : '',
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
      nextAttemptAt: timestamp,
      lockedAt: FieldValue.delete(),
      lockedBy: FieldValue.delete(),
      error: input.error || FieldValue.delete(),
      completedAt:
        existing?.status === 'done' && existing.phone && !input.forceRetry
          ? existing.completedAt || timestamp
          : FieldValue.delete(),
    },
    { merge: true }
  );
}

export async function cancelProspectingOlxPhoneQueueEntry(input: {
  adminDb?: Firestore;
  agencyId: string;
  listingId: string;
}) {
  const targetDb = input.adminDb || primaryAdminDb;
  const queueRef = targetDb
    .collection(OLX_PHONE_QUEUE_COLLECTION)
    .doc(getProspectingQueueId(input.agencyId, input.listingId));
  const snapshot = await queueRef.get();
  if (!snapshot.exists || snapshot.data()?.status === 'done') return;
  await queueRef.set(
    {
      status: 'cancelled',
      updatedAt: nowIso(),
      lockedAt: FieldValue.delete(),
      lockedBy: FieldValue.delete(),
      nextAttemptAt: FieldValue.delete(),
    },
    { merge: true }
  );
}

export async function upsertRawOlxPhoneQueueEntry(input: {
  adminDb?: Firestore;
  listingId: string;
  link: string;
  title?: string;
  error?: string;
  forceRetry?: boolean;
}) {
  const timestamp = nowIso();
  const targetDb = input.adminDb || primaryAdminDb;
  const queueRef = targetDb.collection(OLX_PHONE_QUEUE_COLLECTION).doc(input.listingId);
  const snapshot = await queueRef.get();
  const existing = snapshot.exists ? (snapshot.data() as Partial<OlxPhoneQueueEntry>) : undefined;

  if (existing?.status === 'done' && existing.phone) {
    return;
  }

  if (existing) {
    if (input.forceRetry && existing.status !== 'processing') {
      await queueRef.set(
        {
          listingId: input.listingId,
          source: 'olx',
          link: input.link,
          title: input.title || '',
          status: 'pending',
          attempts: existing.status === 'failed' ? 0 : existing.attempts || 0,
          lane: 'interactive',
          priority: Math.max(existing.priority || 0, 2000),
          updatedAt: timestamp,
          nextAttemptAt: timestamp,
          phone: '',
          ...(input.error ? { error: input.error } : {}),
          lockedAt: FieldValue.delete(),
          lockedBy: FieldValue.delete(),
          completedAt: FieldValue.delete(),
        },
        { merge: true }
      );
      return;
    }

    await queueRef.set(
      {
        link: input.link,
        title: input.title || '',
        updatedAt: timestamp,
        ...(input.error && !existing.error ? { error: input.error } : {}),
      },
      { merge: true }
    );
    return;
  }

  await queueRef.set(
    {
      listingId: input.listingId,
      source: 'olx',
      link: input.link,
      title: input.title || '',
      status: 'pending',
      attempts: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      nextAttemptAt: timestamp,
      lane: 'interactive',
      priority: 2000,
      phone: '',
      ...(input.error ? { error: input.error } : {}),
      lockedAt: FieldValue.delete(),
      lockedBy: FieldValue.delete(),
      completedAt: FieldValue.delete(),
    },
    { merge: true }
  );
}

function isQueueEligible(entry: Partial<OlxPhoneQueueEntry> | undefined, now: Date) {
  if (!entry) {
    return false;
  }

  if (entry.status === 'pending' || entry.status === 'retry') {
    const nextAttemptAt = entry.nextAttemptAt ? new Date(entry.nextAttemptAt).getTime() : 0;
    return !Number.isFinite(nextAttemptAt) || nextAttemptAt <= now.getTime();
  }

  if (entry.status === 'processing') {
    const lockedAt = entry.lockedAt ? new Date(entry.lockedAt).getTime() : 0;
    return Number.isFinite(lockedAt) && lockedAt > 0 && now.getTime() - lockedAt >= PROCESSING_STALE_MS;
  }

  return false;
}

export async function upsertOlxPhoneQueueEntry(listingId: string, listing: OwnerListingSummary) {
  if (listing.source !== 'olx') {
    return;
  }

  const queueRef = primaryAdminDb.collection(OLX_PHONE_QUEUE_COLLECTION).doc(listingId);
  const snapshot = await queueRef.get();
  const existing = snapshot.exists ? (snapshot.data() as Partial<OlxPhoneQueueEntry>) : undefined;
  const timestamp = nowIso();

  if (listing.ownerPhone) {
    await queueRef.set(
      {
        listingId,
        source: 'olx',
        link: listing.link,
        status: 'done',
        phone: listing.ownerPhone,
        updatedAt: timestamp,
        completedAt: timestamp,
        lockedAt: FieldValue.delete(),
        lockedBy: FieldValue.delete(),
        error: FieldValue.delete(),
        nextAttemptAt: FieldValue.delete(),
      },
      { merge: true }
    );
    return;
  }

  if (existing && (existing.status === 'processing' || existing.status === 'pending' || existing.status === 'retry' || existing.status === 'failed')) {
    await queueRef.set(
      {
        listingId,
        source: 'olx',
        link: listing.link,
        updatedAt: timestamp,
      },
      { merge: true }
    );
    return;
  }

  await queueRef.set(
    {
      listingId,
      source: 'olx',
      link: listing.link,
      status: 'pending',
      attempts: existing?.attempts || 0,
      lane: listing.isNew ? 'fresh' : 'backfill',
      priority: listing.isNew ? 1000 : 400,
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
      nextAttemptAt: timestamp,
      phone: existing?.phone || '',
      error: FieldValue.delete(),
      lockedAt: FieldValue.delete(),
      lockedBy: FieldValue.delete(),
      completedAt: FieldValue.delete(),
    },
    { merge: true }
  );
}

async function acquireNextOlxPhoneQueueJob() {
  const now = new Date();
  const eligibleAt = now.toISOString();
  const interactiveSnapshot = await primaryAdminDb.collection(OLX_PHONE_QUEUE_COLLECTION)
    .where('lane', '==', 'prospecting')
    .where('status', 'in', ['pending', 'retry'])
    .where('nextAttemptAt', '<=', eligibleAt)
    .orderBy('nextAttemptAt', 'asc')
    .limit(25)
    .get();
  const staleSnapshot = interactiveSnapshot.empty
    ? await primaryAdminDb.collection(OLX_PHONE_QUEUE_COLLECTION)
        .where('lane', '==', 'prospecting')
        .where('status', '==', 'processing')
        .where('lockedAt', '<=', new Date(now.getTime() - PROCESSING_STALE_MS).toISOString())
        .orderBy('lockedAt', 'asc')
        .limit(10)
        .get()
    : null;

  for (const doc of [...interactiveSnapshot.docs, ...(staleSnapshot?.docs || [])]) {
    const entry = doc.data() as Partial<OlxPhoneQueueEntry>;
    if (!isQueueEligible(entry, now)) {
      continue;
    }

    const acquired = await primaryAdminDb.runTransaction(async (transaction) => {
      const fresh = await transaction.get(doc.ref);
      if (!fresh.exists) {
        return null;
      }

      const latest = fresh.data() as Partial<OlxPhoneQueueEntry>;
      if (!isQueueEligible(latest, now)) {
        return null;
      }

      const attempts = (latest.attempts || 0) + 1;
      const timestamp = nowIso();

      transaction.set(
        doc.ref,
        {
          status: 'processing',
          attempts,
          lastAttemptAt: timestamp,
          lockedAt: timestamp,
          lockedBy: 'olx-phone-drain',
          updatedAt: timestamp,
          error: FieldValue.delete(),
        },
        { merge: true }
      );

      return {
        id: fresh.id,
        entry: {
          ...latest,
          listingId: latest.listingId || fresh.id,
          source: 'olx',
          link: latest.link || '',
          status: 'processing' as const,
          attempts,
          updatedAt: timestamp,
          createdAt: latest.createdAt || timestamp,
          lastAttemptAt: timestamp,
          lockedAt: timestamp,
          lockedBy: 'olx-phone-drain',
        } satisfies OlxPhoneQueueEntry,
      };
    });

    if (acquired) {
      return acquired;
    }
  }

  return null;
}

export async function drainNextOlxPhoneQueueItem(): Promise<OlxPhoneDrainResult> {
  const job = await acquireNextOlxPhoneQueueJob();
  if (!job) {
    return { status: 'empty', reason: 'Nu exista joburi OLX phone eligibile.' };
  }

  const queueRef = primaryAdminDb.collection(OLX_PHONE_QUEUE_COLLECTION).doc(job.id);
  const listingRef = primaryAdminDb.collection('ownerListings').doc(job.entry.listingId);
  const favoriteRef =
    job.entry.agencyId
      ? primaryAdminDb
          .collection('agencies')
          .doc(job.entry.agencyId)
          .collection('ownerListingFavorites')
          .doc(job.entry.listingId)
      : null;

  try {
    if (!favoriteRef || !job.entry.agencyId || !job.entry.requestedByUid) {
      await queueRef.set(
        {
          status: 'cancelled',
          error: 'Job OLX fara context de Prospectare.',
          updatedAt: nowIso(),
          lockedAt: FieldValue.delete(),
          lockedBy: FieldValue.delete(),
        },
        { merge: true }
      );
      return {
        status: 'skipped',
        queueId: job.id,
        listingId: job.entry.listingId,
        attempts: job.entry.attempts,
        reason: 'Job OLX fara context de Prospectare.',
      };
    }

    const favoriteSnapshot = await favoriteRef.get();
    if (!favoriteSnapshot.exists || favoriteSnapshot.data()?.isFavoriteActive === false) {
      await queueRef.set(
        {
          status: 'cancelled',
          error: 'Anuntul nu mai este in Prospectare.',
          updatedAt: nowIso(),
          lockedAt: FieldValue.delete(),
          lockedBy: FieldValue.delete(),
        },
        { merge: true }
      );
      return {
        status: 'skipped',
        queueId: job.id,
        listingId: job.entry.listingId,
        attempts: job.entry.attempts,
        reason: 'Anuntul nu mai este in Prospectare.',
      };
    }

    await favoriteRef.set(
      {
        phoneExtractionStatus: 'processing',
        phoneExtractionMessage: 'Preluam numarul prin profilul OLX conectat.',
        phoneExtractionLastAttemptAt: nowIso(),
        updatedAt: nowIso(),
      },
      { merge: true }
    );

    const directPhone = await scrapeOlxPhoneNumber(job.entry.link, { allowLocalBrowser: false });
    const cloudResult = directPhone
      ? { phone: '', stage: 'not_needed', message: '' }
      : await resolveOlxPhoneViaAgentCloud({
          adminDb: primaryAdminDb,
          agencyId: job.entry.agencyId,
          uid: job.entry.requestedByUid,
          url: job.entry.link,
        });
    const remoteResult = directPhone || cloudResult.phone
      ? { phone: '', stage: 'not_needed' }
      : await resolveOlxPhoneViaRemoteWorker(job.entry.link);
    const phone = directPhone || cloudResult.phone || remoteResult.phone;
    const resolutionSource = directPhone
      ? 'internal-scraper'
      : cloudResult.phone
        ? 'agent-cloud-browser'
        : 'remote-browser';
    const timestamp = nowIso();

    if (phone) {
      await Promise.all([
        listingRef.set(
          {
            ownerPhone: phone,
            phoneResolvedAt: timestamp,
            phoneResolvedBy: resolutionSource,
            updatedAt: timestamp,
            firestoreUpdatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        ),
        queueRef.set(
          {
            status: 'done',
            phone,
            updatedAt: timestamp,
            completedAt: timestamp,
            lockedAt: FieldValue.delete(),
            lockedBy: FieldValue.delete(),
            error: FieldValue.delete(),
            nextAttemptAt: FieldValue.delete(),
          },
          { merge: true }
        ),
        favoriteRef.set(
          {
            ownerPhone: phone,
            phoneExtractionStatus: 'available',
            phoneExtractionMessage: 'Numarul proprietarului a fost preluat.',
            phoneExtractionCompletedAt: timestamp,
            phoneExtractionLastAttemptAt: timestamp,
            phoneExtractionError: null,
            updatedAt: timestamp,
          },
          { merge: true }
        ),
      ]);
      const refreshedListing = await listingRef.get();
      if (refreshedListing.exists) {
        await registerOwnerListingCanonical(job.entry.listingId, refreshedListing.data() as OwnerListingSummary);
      }


      return {
        status: 'processed',
        queueId: job.id,
        listingId: job.entry.listingId,
        phone,
        attempts: job.entry.attempts,
      };
    }

    const needsConnection =
      cloudResult.stage === 'not_connected' || cloudResult.stage === 'login_required';
    const terminalUnavailable =
      cloudResult.stage === 'phone_control_missing' ||
      (cloudResult.stage === 'not_found' && job.entry.attempts >= 2) ||
      cloudResult.stage === 'listing_unavailable';
    const nextStatus =
      terminalUnavailable || job.entry.attempts >= MAX_ATTEMPTS ? 'failed' : 'retry';
    const retryDelayMs = needsConnection ? 5 * 60 * 1000 : RETRY_DELAY_MS;
    const nextAttemptAt = new Date(Date.now() + retryDelayMs).toISOString();
    const failureMessage =
      cloudResult.message ||
      describeRemoteOlxPhoneStage(remoteResult.stage);
    const refreshedListing = await listingRef.get();
    if (refreshedListing.exists) {
      await registerOwnerListingCanonical(job.entry.listingId, refreshedListing.data() as OwnerListingSummary);
    }

    await queueRef.set(
      {
        status: nextStatus,
        updatedAt: timestamp,
        nextAttemptAt,
        lockedAt: FieldValue.delete(),
        lockedBy: FieldValue.delete(),
        error: failureMessage,
      },
      { merge: true }
    );
    await favoriteRef.set(
      {
        phoneExtractionStatus: needsConnection
          ? 'awaiting_connection'
          : terminalUnavailable
            ? 'unavailable'
            : nextStatus === 'failed'
              ? 'failed'
              : 'retrying',
        phoneExtractionMessage: failureMessage,
        phoneExtractionError: failureMessage,
        phoneExtractionLastAttemptAt: timestamp,
        phoneExtractionNextAttemptAt: nextStatus === 'retry' ? nextAttemptAt : null,
        updatedAt: timestamp,
      },
      { merge: true }
    );

    return {
      status: 'skipped',
      queueId: job.id,
      listingId: job.entry.listingId,
      attempts: job.entry.attempts,
      reason: failureMessage,
    };
  } catch (error) {
    const timestamp = nowIso();
    const nextStatus = job.entry.attempts >= MAX_ATTEMPTS ? 'failed' : 'retry';
    const nextAttemptAt = new Date(Date.now() + RETRY_DELAY_MS).toISOString();

    await queueRef.set(
      {
        status: nextStatus,
        updatedAt: timestamp,
        nextAttemptAt,
        lockedAt: FieldValue.delete(),
        lockedBy: FieldValue.delete(),
        error: error instanceof Error ? error.message : 'OLX phone drain a esuat.',
      },
      { merge: true }
    );
    if (favoriteRef) {
      await favoriteRef.set(
        {
          phoneExtractionStatus: nextStatus === 'failed' ? 'failed' : 'retrying',
          phoneExtractionMessage: 'Preluarea telefonului va fi reincercata automat.',
          phoneExtractionError:
            error instanceof Error ? error.message.slice(0, 300) : 'Preluarea telefonului a esuat.',
          phoneExtractionLastAttemptAt: timestamp,
          phoneExtractionNextAttemptAt: nextAttemptAt,
          updatedAt: timestamp,
        },
        { merge: true }
      );
    }

    throw error;
  }
}

export async function drainOlxPhoneQueue(options: {
  limit?: number;
  concurrency?: number;
  maxRuntimeMs?: number;
} = {}) {
  const limit = Math.max(1, Math.min(options.limit ?? 8, 50));
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 2, 5));
  const maxRuntimeMs = Math.max(1000, options.maxRuntimeMs ?? 8 * 60 * 1000);
  const startedAt = Date.now();
  const results: OlxPhoneDrainResult[] = [];

  while (results.length < limit && Date.now() - startedAt < maxRuntimeMs) {
    const size = Math.min(concurrency, limit - results.length);
    const batch = await Promise.all(Array.from({ length: size }, () => drainNextOlxPhoneQueueItem()));
    results.push(...batch);
    if (batch.every((entry) => entry.status === 'empty')) break;
  }

  return {
    processed: results.filter((entry) => entry.status === 'processed').length,
    skipped: results.filter((entry) => entry.status === 'skipped').length,
    empty: results.filter((entry) => entry.status === 'empty').length,
    results,
  };
}
