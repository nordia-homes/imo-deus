import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/firebase/admin';
import { scrapeImoradar24ListingDetail } from '@/lib/owner-listings/sources/imoradar24';
import { scrapeOlxListingDetail } from '@/lib/owner-listings/sources/olx';
import { scrapePubli24ListingDetail } from '@/lib/owner-listings/sources/publi24';
import type {
  OwnerListingDetail,
  OwnerListingSource,
  OwnerListingSummary,
} from '@/lib/owner-listings/types';

const ENRICHMENT_COLLECTION = 'ownerListingEnrichmentQueue';
const PROCESSING_STALE_MS = 15 * 60 * 1000;
const RETRY_DELAY_MS = 45 * 60 * 1000;
const MAX_ATTEMPTS = 6;

export type OwnerListingEnrichmentTaskType = 'phone' | 'detail' | 'images' | 'origin-source';
export type OwnerListingEnrichmentStatus = 'pending' | 'processing' | 'done' | 'retry' | 'failed';

export type OwnerListingEnrichmentQueueEntry = {
  listingId: string;
  source: OwnerListingSource;
  link: string;
  taskType: OwnerListingEnrichmentTaskType;
  status: OwnerListingEnrichmentStatus;
  priority: number;
  attempts: number;
  error?: string;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  lockedAt?: string;
  lockedBy?: string;
  updatedAt: string;
  createdAt: string;
  completedAt?: string;
};

export type OwnerListingEnrichmentDrainResult = {
  status: 'processed' | 'skipped' | 'empty';
  queueId?: string;
  listingId?: string;
  taskType?: OwnerListingEnrichmentTaskType;
  attempts?: number;
  reason?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function queueId(listingId: string, taskType: OwnerListingEnrichmentTaskType) {
  return `${listingId}_${taskType}`.replace(/[^a-zA-Z0-9_-]+/g, '_');
}

function hasUsefulPhone(listing: Partial<OwnerListingSummary>) {
  return Boolean(listing.ownerPhone && String(listing.ownerPhone).trim());
}

function hasUsefulDetailFields(listing: Partial<OwnerListingSummary>) {
  return Boolean(listing.description && listing.area && listing.price && listing.location);
}

function taskPriority(listing: OwnerListingSummary, taskType: OwnerListingEnrichmentTaskType) {
  let priority = listing.isNew ? 1000 : 400;
  if (taskType === 'phone') priority += 120;
  if (taskType === 'detail') priority += 80;
  if (listing.scopeKey === 'bucuresti-ilfov' || listing.scopeKey === 'cluj-napoca') priority += 40;
  return priority;
}

function shouldQueueTask(listing: OwnerListingSummary, taskType: OwnerListingEnrichmentTaskType) {
  if (!listing.link) return false;
  if (taskType === 'phone') return !hasUsefulPhone(listing);
  if (taskType === 'detail') return !hasUsefulDetailFields(listing);
  if (taskType === 'images') return !listing.imageUrl;
  if (taskType === 'origin-source') return listing.source === 'imoradar24' && !listing.originSourceUrl;
  return false;
}

export async function upsertOwnerListingEnrichmentQueueEntries(listingId: string, listing: OwnerListingSummary) {
  const taskTypes: OwnerListingEnrichmentTaskType[] = ['phone', 'detail', 'images', 'origin-source'];
  const timestamp = nowIso();
  const batch = adminDb.batch();
  let queued = 0;

  for (const taskType of taskTypes) {
    if (!shouldQueueTask(listing, taskType)) {
      continue;
    }

    const id = queueId(listingId, taskType);
    const ref = adminDb.collection(ENRICHMENT_COLLECTION).doc(id);
    batch.set(
      ref,
      {
        listingId,
        source: listing.source,
        link: listing.link,
        taskType,
        status: 'pending',
        priority: taskPriority(listing, taskType),
        attempts: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
        nextAttemptAt: timestamp,
        fingerprint: crypto.createHash('sha1').update(`${listingId}:${taskType}:${listing.link}`).digest('hex'),
        firestoreUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    queued += 1;
  }

  if (queued > 0) {
    await batch.commit();
  }

  return queued;
}

function isQueueEligible(entry: Partial<OwnerListingEnrichmentQueueEntry> | undefined, now: Date) {
  if (!entry) return false;

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

async function acquireNextEnrichmentJob() {
  const snapshot = await adminDb
    .collection(ENRICHMENT_COLLECTION)
    .orderBy('priority', 'desc')
    .orderBy('updatedAt', 'asc')
    .limit(50)
    .get();
  const now = new Date();

  for (const docSnapshot of snapshot.docs) {
    const entry = docSnapshot.data() as Partial<OwnerListingEnrichmentQueueEntry>;
    if (!isQueueEligible(entry, now)) {
      continue;
    }

    const acquired = await adminDb.runTransaction(async (transaction) => {
      const fresh = await transaction.get(docSnapshot.ref);
      if (!fresh.exists) return null;

      const latest = fresh.data() as Partial<OwnerListingEnrichmentQueueEntry>;
      if (!isQueueEligible(latest, now)) return null;

      const attempts = (latest.attempts || 0) + 1;
      const timestamp = nowIso();
      transaction.set(
        docSnapshot.ref,
        {
          status: 'processing',
          attempts,
          lastAttemptAt: timestamp,
          lockedAt: timestamp,
          lockedBy: 'owner-listing-enrichment-drain',
          updatedAt: timestamp,
          error: FieldValue.delete(),
          firestoreUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return {
        id: fresh.id,
        entry: {
          ...latest,
          listingId: latest.listingId || '',
          source: latest.source || 'olx',
          link: latest.link || '',
          taskType: latest.taskType || 'detail',
          status: 'processing' as const,
          priority: latest.priority || 0,
          attempts,
          updatedAt: timestamp,
          createdAt: latest.createdAt || timestamp,
          lastAttemptAt: timestamp,
          lockedAt: timestamp,
          lockedBy: 'owner-listing-enrichment-drain',
        } satisfies OwnerListingEnrichmentQueueEntry,
      };
    });

    if (acquired) {
      return acquired;
    }
  }

  return null;
}

function detailPatch(detail: OwnerListingDetail, taskType: OwnerListingEnrichmentTaskType) {
  if (taskType === 'phone') {
    return {
      ownerPhone: detail.contactPhone || detail.ownerPhone || '',
      ownerName: detail.contactName || detail.ownerName || '',
    };
  }

  if (taskType === 'images') {
    return {
      imageUrl: detail.imageUrl || detail.images?.[0] || '',
      images: detail.images || [],
    };
  }

  if (taskType === 'origin-source') {
    return {
      originSourceUrl: detail.originSourceUrl || '',
      originSourceLabel: detail.originSourceLabel || '',
    };
  }

  return {
    title: detail.title,
    price: detail.price,
    area: detail.area,
    rooms: detail.rooms,
    constructionYear: detail.constructionYear,
    year: detail.year,
    location: detail.location,
    description: detail.description,
    fullDescription: detail.fullDescription,
    imageUrl: detail.imageUrl || detail.images?.[0] || '',
    ownerPhone: detail.contactPhone || detail.ownerPhone || '',
    ownerName: detail.contactName || detail.ownerName || '',
    originSourceUrl: detail.originSourceUrl || '',
    originSourceLabel: detail.originSourceLabel || '',
    enrichmentStatus: 'complete',
  };
}

function scrapeDetail(source: OwnerListingSource, link: string) {
  if (source === 'olx') return scrapeOlxListingDetail(link);
  if (source === 'publi24') return scrapePubli24ListingDetail(link);
  return scrapeImoradar24ListingDetail(link);
}

export async function drainNextOwnerListingEnrichmentQueueItem(): Promise<OwnerListingEnrichmentDrainResult> {
  const job = await acquireNextEnrichmentJob();
  if (!job) {
    return { status: 'empty', reason: 'Nu exista joburi de enrichment eligibile.' };
  }

  const queueRef = adminDb.collection(ENRICHMENT_COLLECTION).doc(job.id);
  const listingRef = adminDb.collection('ownerListings').doc(job.entry.listingId);

  try {
    const detail = await scrapeDetail(job.entry.source, job.entry.link);
    const patch = detailPatch(detail, job.entry.taskType);
    const timestamp = nowIso();

    await Promise.all([
      listingRef.set(
        {
          ...patch,
          lastVerifiedAt: Math.floor(Date.now() / 1000),
          updatedAt: timestamp,
          firestoreUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      ),
      queueRef.set(
        {
          status: 'done',
          updatedAt: timestamp,
          completedAt: timestamp,
          lockedAt: FieldValue.delete(),
          lockedBy: FieldValue.delete(),
          error: FieldValue.delete(),
          nextAttemptAt: FieldValue.delete(),
          firestoreUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      ),
    ]);

    return {
      status: 'processed',
      queueId: job.id,
      listingId: job.entry.listingId,
      taskType: job.entry.taskType,
      attempts: job.entry.attempts,
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
        error: error instanceof Error ? error.message : 'Enrichment job a esuat.',
        firestoreUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      status: 'skipped',
      queueId: job.id,
      listingId: job.entry.listingId,
      taskType: job.entry.taskType,
      attempts: job.entry.attempts,
      reason: error instanceof Error ? error.message : 'Enrichment job a esuat.',
    };
  }
}
