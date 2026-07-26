import { FieldValue, type Firestore } from 'firebase-admin/firestore';
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

class PublicPhoneUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PublicPhoneUnavailableError';
  }
}

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
  agencyId?: string;
  requestedByUid?: string;
  requestedByName?: string;
  trigger?: 'discovery' | 'prospecting';
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

export function getOwnerListingEnrichmentTaskTypes(
  listing: OwnerListingSummary
): OwnerListingEnrichmentTaskType[] {
  const tasks: OwnerListingEnrichmentTaskType[] = [];
  const needsDetail =
    listing.publicationStatus !== 'ready' &&
    shouldQueueTask(listing, 'detail');
  if (needsDetail) {
    tasks.push('detail');
  }
  if (
    !needsDetail &&
    listing.source === 'publi24' &&
    listing.publicationStatus !== 'rejected' &&
    shouldQueueTask(listing, 'phone')
  ) {
    tasks.push('phone');
  }
  return tasks;
}

export async function upsertOwnerListingEnrichmentQueueEntries(listingId: string, listing: OwnerListingSummary) {
  const timestamp = nowIso();
  const taskTypes = getOwnerListingEnrichmentTaskTypes(listing);
  const created = await Promise.all(
    taskTypes.map(async (taskType) => {
      const id = queueId(listingId, taskType);
      const ref = adminDb.collection(ENRICHMENT_COLLECTION).doc(id);
      const existing = await ref.get();
      if (existing.exists) return 0;

      await ref
        .create({
          listingId,
          source: listing.source,
          link: listing.link,
          taskType,
          status: 'pending',
          priority: taskPriority(listing, taskType),
          attempts: 0,
          trigger: 'discovery',
          createdAt: timestamp,
          updatedAt: timestamp,
          nextAttemptAt: timestamp,
          firestoreUpdatedAt: FieldValue.serverTimestamp(),
        })
        .catch((error: unknown) => {
          const code = String((error as { code?: unknown })?.code || '');
          if (code !== '6' && !code.toLowerCase().includes('already')) throw error;
        });
      return 1;
    })
  );

  return created.reduce<number>((sum, value) => sum + value, 0);
}

export async function upsertPubli24ProspectingPhoneQueueEntry(input: {
  adminDb?: Firestore;
  agencyId: string;
  requestedByUid: string;
  requestedByName?: string;
  listingId: string;
  link: string;
  title?: string;
  forceRetry?: boolean;
}) {
  const targetDb = input.adminDb || adminDb;
  const timestamp = nowIso();
  const ref = targetDb
    .collection(ENRICHMENT_COLLECTION)
    .doc(queueId(input.listingId, 'phone'));
  const snapshot = await ref.get();
  const existing = snapshot.exists
    ? (snapshot.data() as Partial<OwnerListingEnrichmentQueueEntry>)
    : null;
  const keepProcessing = existing?.status === 'processing' && !input.forceRetry;

  await ref.set(
    {
      listingId: input.listingId,
      source: 'publi24',
      link: input.link,
      title: input.title || '',
      taskType: 'phone',
      status: keepProcessing ? 'processing' : 'pending',
      priority: 3000,
      attempts:
        input.forceRetry || existing?.status === 'done' || existing?.status === 'failed'
          ? 0
          : existing?.attempts || 0,
      trigger: 'prospecting',
      agencyId: input.agencyId,
      requestedByUid: input.requestedByUid,
      requestedByName: input.requestedByName || '',
      createdAt:
        existing?.trigger === 'prospecting' && !input.forceRetry
          ? existing.createdAt || timestamp
          : timestamp,
      updatedAt: timestamp,
      nextAttemptAt: timestamp,
      ...(keepProcessing
        ? {}
        : {
            lockedAt: FieldValue.delete(),
            lockedBy: FieldValue.delete(),
            completedAt: FieldValue.delete(),
            error: FieldValue.delete(),
          }),
      firestoreUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
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
      .where('taskType', 'in', ['detail', 'phone'])
      .orderBy('createdAt', 'desc')
      .orderBy('priority', 'desc')
      .limit(50)
      .get(),
    adminDb
      .collection(ENRICHMENT_COLLECTION)
      .where('status', '==', 'retry')
      .where('taskType', 'in', ['detail', 'phone'])
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

function normalizeRomanianPhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('004') && digits.length === 13) return digits.slice(3);
  if (digits.startsWith('4') && digits.length === 11) return digits.slice(1);
  if (/^0[237]\d{8}$/.test(digits)) return digits;
  if (/^[237]\d{7}$/.test(digits)) return digits;
  return '';
}

function detailPatch(detail: OwnerListingDetail, taskType: OwnerListingEnrichmentTaskType) {
  const ownerPhone = normalizeRomanianPhone(detail.contactPhone || detail.ownerPhone || '');
  if (taskType === 'phone') {
    return removeEmptyDetailValues({
      ownerPhone,
      phoneResolvedAt: nowIso(),
      phoneResolvedBy: detail.source === 'publi24' ? 'publi24-direct' : `${detail.source}-detail`,
    });
  }

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
    ownerPhone,
    ownerName: detail.contactName || detail.ownerName || '',
    originSourceUrl: detail.originSourceUrl || '',
    originSourceLabel: detail.originSourceLabel || '',
    enrichmentStatus: 'complete' as const,
  }));
}

function getProspectingFavoriteRef(
  database: Firestore,
  entry: Partial<OwnerListingEnrichmentQueueEntry>
) {
  if (!entry.agencyId || !entry.listingId) return null;
  return database
    .collection('agencies')
    .doc(entry.agencyId)
    .collection('ownerListingFavorites')
    .doc(entry.listingId);
}

async function updateProspectingPhoneState(
  entry: Partial<OwnerListingEnrichmentQueueEntry>,
  patch: Record<string, unknown>
) {
  const favoriteRef = getProspectingFavoriteRef(adminDb, entry);
  if (!favoriteRef) return;
  const snapshot = await favoriteRef.get();
  if (!snapshot.exists || snapshot.data()?.isFavoriteActive === false) return;
  const requestedBy = String(snapshot.data()?.phoneExtractionRequestedBy || '');
  if (entry.requestedByUid && requestedBy && requestedBy !== entry.requestedByUid) return;
  await favoriteRef.set(
    {
      ...patch,
      updatedAt: nowIso(),
      firestoreUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function scrapeDetail(
  source: OwnerListingSource,
  link: string,
  taskType: OwnerListingEnrichmentTaskType
): Promise<OwnerListingDetail> {
  if (source === 'olx') return scrapeOlxListingDetail(link, { includePhone: false });
  if (source === 'publi24') {
    return scrapePubli24ListingDetail(link, {
      requirePhone: taskType === 'phone',
    });
  }
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
    const existingSnapshot = await listingRef.get();
    const existing = (existingSnapshot.data() || {}) as OwnerListingSummary;
    const existingPhone = normalizeRomanianPhone(existing.ownerPhone);
    if (job.entry.taskType === 'phone' && existingPhone) {
      const timestamp = nowIso();
      await Promise.all([
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
        updateProspectingPhoneState(job.entry, {
          ownerPhone: existingPhone,
          phoneExtractionStatus: 'available',
          phoneExtractionMessage: 'Numarul proprietarului este disponibil.',
          phoneExtractionCompletedAt: timestamp,
          phoneExtractionError: null,
          phoneExtractionNextAttemptAt: null,
        }),
      ]);
      return {
        status: 'processed',
        queueId: job.id,
        listingId: job.entry.listingId,
        taskType: job.entry.taskType,
        attempts: job.entry.attempts,
      };
    }

    if (job.entry.taskType === 'phone') {
      await updateProspectingPhoneState(job.entry, {
        phoneExtractionStatus: 'processing',
        phoneExtractionMessage: 'Preluam numarul direct din anuntul Publi24.',
        phoneExtractionLastAttemptAt: nowIso(),
        phoneExtractionError: null,
      });
    }

    const detail = await scrapeDetail(
      job.entry.source,
      job.entry.link,
      job.entry.taskType
    );
    const resolvedPhone = normalizeRomanianPhone(
      detail.contactPhone || detail.ownerPhone || ''
    );
    if (job.entry.taskType === 'phone' && !resolvedPhone) {
      if (detail.contactPhoneStatus === 'unavailable') {
        throw new PublicPhoneUnavailableError(
          'Acest anunt Publi24 nu publica un numar de telefon.'
        );
      }
      throw new Error(
        detail.contactPhoneError ||
          'Publi24 nu a returnat temporar numarul de telefon.'
      );
    }
    const patch = detailPatch(detail, job.entry.taskType);
    const timestamp = nowIso();
    const merged = { ...existing, ...patch } as OwnerListingSummary;
    const qualityPatch =
      job.entry.taskType === 'detail'
        ? stripUndefined({
            publicationStatus: hasMinimumOwnerListingQuality(merged)
              ? ('ready' as const)
              : ('rejected' as const),
            missingFields: getOwnerListingMissingFields(merged),
            enrichmentStatus: 'complete' as const,
            enrichmentCompletedAt: Math.floor(Date.now() / 1000),
            priceValue: parsePriceNumber(merged.price),
            areaValue: parseArea(merged.area),
            roomsValue: parseRooms(String(merged.rooms ?? '')),
            constructionYearValue:
              parseExactConstructionYear(merged.constructionYear) ??
              parseExactConstructionYear(merged.year),
          })
        : {};

    await Promise.all([
      listingRef.set(
        {
          ...patch,
          lastVerifiedAt: Math.floor(Date.now() / 1000),
          updatedAt: timestamp,
          ...qualityPatch,
          ...(job.entry.taskType === 'detail'
            ? { enrichmentAttemptedAt: Math.floor(Date.now() / 1000) }
            : { phoneExtractionAttemptedAt: Math.floor(Date.now() / 1000) }),
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
      job.entry.taskType === 'phone'
        ? updateProspectingPhoneState(job.entry, {
            ownerPhone: resolvedPhone,
            phoneExtractionStatus: 'available',
            phoneExtractionMessage: 'Numarul proprietarului a fost preluat din Publi24.',
            phoneExtractionCompletedAt: timestamp,
            phoneExtractionLastAttemptAt: timestamp,
            phoneExtractionError: null,
            phoneExtractionNextAttemptAt: null,
          })
        : Promise.resolve(),
    ]);

    await registerOwnerListingCanonical(job.entry.listingId, {
      ...merged,
      ...qualityPatch,
      lastVerifiedAt: Math.floor(Date.now() / 1000),
      lastSeenAt: merged.lastSeenAt || Math.floor(Date.now() / 1000),
      scrapedAt: merged.scrapedAt || Math.floor(Date.now() / 1000),
    });

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
    const publicPhoneUnavailable = error instanceof PublicPhoneUnavailableError;
    const nextStatus =
      sourceListingGone || publicPhoneUnavailable
        ? 'done'
        : job.entry.attempts >= MAX_ATTEMPTS
          ? 'failed'
          : 'retry';
    const nextAttemptAt = new Date(Date.now() + RETRY_DELAY_MS).toISOString();

    await queueRef.set(
      {
        status: nextStatus,
        updatedAt: timestamp,
        ...(nextStatus === 'retry'
          ? { nextAttemptAt }
          : { completedAt: timestamp, nextAttemptAt: FieldValue.delete() }),
        ...(sourceListingGone
          ? { outcome: 'source-gone', sourceStatus }
          : publicPhoneUnavailable
            ? { outcome: 'phone-unavailable' }
            : {}),
        lockedAt: FieldValue.delete(),
        lockedBy: FieldValue.delete(),
        error: error instanceof Error ? error.message : 'Enrichment job a esuat.',
        firestoreUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );


    if (
      job.entry.taskType === 'detail' &&
      (nextStatus === 'failed' || sourceListingGone)
    ) {
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
    if (job.entry.taskType === 'phone') {
      const message =
        error instanceof Error
          ? error.message
          : 'Preluarea telefonului Publi24 a esuat.';
      await updateProspectingPhoneState(job.entry, {
        phoneExtractionStatus: sourceListingGone || publicPhoneUnavailable
          ? 'unavailable'
          : nextStatus === 'failed'
            ? 'failed'
            : 'retrying',
        phoneExtractionMessage: message,
        phoneExtractionError: message,
        phoneExtractionLastAttemptAt: timestamp,
        phoneExtractionNextAttemptAt: nextStatus === 'retry' ? nextAttemptAt : null,
      });
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
