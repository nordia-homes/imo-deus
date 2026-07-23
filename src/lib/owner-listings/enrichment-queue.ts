import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/firebase/admin';
import { registerOwnerListingCanonical } from '@/lib/owner-listings/canonical';
import { scrapeImoradar24ListingDetail } from '@/lib/owner-listings/sources/imoradar24';
import { scrapeOlxListingDetail } from '@/lib/owner-listings/sources/olx';
import { scrapePubli24ListingDetail } from '@/lib/owner-listings/sources/publi24';
import type {
  OwnerListingDetail,
  OwnerListingSource,
  OwnerListingSummary,
} from '@/lib/owner-listings/types';
import { compareOwnerListingEnrichmentPriority, getOwnerListingMissingFields, hasMinimumOwnerListingQuality, parseArea, parseExactConstructionYear, parsePriceNumber, parseRooms, stripUndefined } from '@/lib/owner-listings/utils';

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
  if (taskType === 'detail') return listing.publicationStatus !== 'ready' || !hasUsefulDetailFields(listing);
  if (taskType === 'images') return !listing.imageUrl;
  if (taskType === 'origin-source') return listing.source === 'imoradar24' && !listing.originSourceUrl;
  return false;
}

export async function upsertOwnerListingEnrichmentQueueEntries(listingId: string, listing: OwnerListingSummary) {
  const taskType: OwnerListingEnrichmentTaskType = 'detail';
  if (!shouldQueueTask(listing, taskType) || listing.publicationStatus === 'ready') return 0;

  const timestamp = nowIso();
  const id = queueId(listingId, taskType);
  const ref = adminDb.collection(ENRICHMENT_COLLECTION).doc(id);
  const existing = await ref.get();
  if (existing.exists) return 0;

  await ref.create({
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
    firestoreUpdatedAt: FieldValue.serverTimestamp(),
  }).catch((error: unknown) => {
    const code = String((error as { code?: unknown })?.code || '');
    if (code !== '6' && !code.toLowerCase().includes('already')) throw error;
  });

  return 1;
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
  const now = new Date();
  const [pendingSnapshot, retrySnapshot] = await Promise.all([
    adminDb
      .collection(ENRICHMENT_COLLECTION)
      .where('status', '==', 'pending')
      .orderBy('priority', 'desc')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get(),
    adminDb
      .collection(ENRICHMENT_COLLECTION)
      .where('status', '==', 'retry')
      .where('nextAttemptAt', '<=', now.toISOString())
      .orderBy('nextAttemptAt', 'asc')
      .orderBy('priority', 'desc')
      .limit(20)
      .get(),
  ]);
  const eligibleDocs = [...pendingSnapshot.docs, ...retrySnapshot.docs].sort((left, right) =>
    compareOwnerListingEnrichmentPriority(
      left.data() as Partial<OwnerListingEnrichmentQueueEntry>,
      right.data() as Partial<OwnerListingEnrichmentQueueEntry>
    )
  );
  const staleSnapshot = eligibleDocs.length === 0
    ? await adminDb.collection(ENRICHMENT_COLLECTION)
        .where('status', '==', 'processing')
        .where('lockedAt', '<=', new Date(now.getTime() - PROCESSING_STALE_MS).toISOString())
        .orderBy('lockedAt', 'asc')
        .limit(10)
        .get()
    : null;

  for (const docSnapshot of [...eligibleDocs, ...(staleSnapshot?.docs || [])]) {
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

function removeEmptyDetailValues<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => {
      if (entry === undefined || entry === null) return false;
      return typeof entry !== 'string' || entry.trim().length > 0;
    })
  ) as T;
}

function detailPatch(detail: OwnerListingDetail, _taskType: OwnerListingEnrichmentTaskType) {
  return removeEmptyDetailValues(stripUndefined({
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
    enrichmentStatus: 'complete' as const,
  }));
}

function scrapeDetail(source: OwnerListingSource, link: string) {
  if (source === 'olx') return scrapeOlxListingDetail(link, { includePhone: false });
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
    const existingSnapshot = await listingRef.get();
    const existing = (existingSnapshot.data() || {}) as OwnerListingSummary;
    const merged = { ...existing, ...patch } as OwnerListingSummary;
    const missingFields = getOwnerListingMissingFields(merged);
    const publicationStatus: OwnerListingSummary['publicationStatus'] = hasMinimumOwnerListingQuality(merged) ? 'ready' : 'rejected';
    const qualityPatch = stripUndefined({
      publicationStatus,
      missingFields,
      enrichmentStatus: 'complete' as const,
      enrichmentCompletedAt: Math.floor(Date.now() / 1000),
      priceValue: parsePriceNumber(merged.price),
      areaValue: parseArea(merged.area),
      roomsValue: parseRooms(String(merged.rooms ?? '')),
      constructionYearValue: parseExactConstructionYear(merged.constructionYear) ?? parseExactConstructionYear(merged.year),
    });

    await Promise.all([
      listingRef.set(
        {
          ...patch,
          lastVerifiedAt: Math.floor(Date.now() / 1000),
          updatedAt: timestamp,
          ...qualityPatch,
          enrichmentAttemptedAt: Math.floor(Date.now() / 1000),
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

    await registerOwnerListingCanonical(job.entry.listingId, {
      ...merged,
      ...qualityPatch,
      lastVerifiedAt: Math.floor(Date.now() / 1000),
      lastSeenAt: merged.lastSeenAt || Math.floor(Date.now() / 1000),
      scrapedAt: merged.scrapedAt || Math.floor(Date.now() / 1000),
    });

    const siblingSnapshot = await adminDb.collection(ENRICHMENT_COLLECTION).where('listingId', '==', job.entry.listingId).get();
    if (siblingSnapshot.size > 1) {
      const siblingBatch = adminDb.batch();
      for (const sibling of siblingSnapshot.docs) {
        if (sibling.id === job.id) continue;
        siblingBatch.set(sibling.ref, { status: 'done', completedAt: timestamp, updatedAt: timestamp, supersededBy: job.id }, { merge: true });
      }
      await siblingBatch.commit();
    }

    return {
      status: 'processed',
      queueId: job.id,
      listingId: job.entry.listingId,
      taskType: job.entry.taskType,
      attempts: job.entry.attempts,
    };

  } catch (error) {
    const timestamp = nowIso();
    const sourceStatus = (error as { status?: number })?.status;
    const sourceListingGone = sourceStatus === 404 || sourceStatus === 410;
    const nextStatus = sourceListingGone ? 'done' : job.entry.attempts >= MAX_ATTEMPTS ? 'failed' : 'retry';
    const nextAttemptAt = new Date(Date.now() + RETRY_DELAY_MS).toISOString();

    await queueRef.set(
      {
        status: nextStatus,
        updatedAt: timestamp,
        ...(nextStatus === 'retry'
          ? { nextAttemptAt }
          : { completedAt: timestamp, nextAttemptAt: FieldValue.delete() }),
        ...(sourceListingGone ? { outcome: 'source-gone', sourceStatus } : {}),
        lockedAt: FieldValue.delete(),
        lockedBy: FieldValue.delete(),
        error: error instanceof Error ? error.message : 'Enrichment job a esuat.',
        firestoreUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );


    if (nextStatus === 'failed' || sourceListingGone) {
      const listingSnapshot = await listingRef.get();
      const listing = (listingSnapshot.data() || {}) as OwnerListingSummary;
      await listingRef.set(
        {
          publicationStatus: sourceListingGone
            ? 'rejected'
            : hasMinimumOwnerListingQuality(listing)
              ? 'ready'
              : 'rejected',
          enrichmentStatus: 'failed',
          missingFields: getOwnerListingMissingFields(listing),
          enrichmentCompletedAt: Math.floor(Date.now() / 1000),
          ...(sourceListingGone ? { sourceUnavailableAt: Math.floor(Date.now() / 1000) } : {}),
          firestoreUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
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

export async function drainOwnerListingEnrichmentQueue(options: {
  limit?: number;
  concurrency?: number;
  maxRuntimeMs?: number;
} = {}) {
  const limit = Math.max(1, Math.min(options.limit ?? 12, 100));
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 4, 10));
  const maxRuntimeMs = Math.max(1000, options.maxRuntimeMs ?? 8 * 60 * 1000);
  const startedAt = Date.now();
  const results: OwnerListingEnrichmentDrainResult[] = [];

  while (results.length < limit && Date.now() - startedAt < maxRuntimeMs) {
    const batchSize = Math.min(concurrency, limit - results.length);
    const batch = await Promise.all(
      Array.from({ length: batchSize }, () => drainNextOwnerListingEnrichmentQueueItem())
    );
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
