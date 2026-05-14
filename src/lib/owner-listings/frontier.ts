import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/firebase/admin';
import { getNewBadgeLifetimeUnix, syncOwnerListingsSourceUrlPage } from '@/lib/owner-listings';
import { listOwnerListingScopes, type OwnerListingSourceUrl } from '@/lib/owner-listings/scope';
import type {
  OwnerListingPropertyType,
  OwnerListingSource,
  OwnerListingTransactionType,
} from '@/lib/owner-listings/types';

const FRONTIER_COLLECTION = 'ownerListingScrapeFrontier';
const FRONTIER_RUN_COLLECTION = 'ownerListingScrapeFrontierRuns';
const LOCK_STALE_MS = 10 * 60 * 1000;
const FRESH_RADAR_INTERVAL_MS = 20 * 60 * 1000;
const COVERAGE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MAX_FAILURES_BEFORE_BACKOFF = 3;
const SOURCE_LIMITS_PER_TICK: Record<OwnerListingSource, number> = {
  olx: 3,
  publi24: 3,
  imoradar24: 2,
};

export type OwnerListingScrapeFrontierJob = {
  id: string;
  scopeKey: string;
  scopeLabel: string;
  source: OwnerListingSource;
  sourceUrl: string;
  sourceUrlKind: 'coverage' | 'fresh-radar';
  label: string;
  propertyType?: OwnerListingPropertyType;
  transactionType?: OwnerListingTransactionType;
  status: 'pending' | 'running' | 'cooldown' | 'failed';
  priority: number;
  nextPage: number;
  pagesProcessed: number;
  scanned: number;
  stored: number;
  skipped: number;
  errors: number;
  consecutiveEmptyPages?: number;
  consecutiveDuplicateHeavyPages?: number;
  lastStoredRatio?: number;
  lastRunAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  nextRunAt: string;
  lockedAt?: string;
  lockedBy?: string;
  createdAt: string;
  updatedAt: string;
};

type FrontierTickOptions = {
  scopeKey?: string | null;
  limit?: number;
  maxRuntimeMs?: number;
  maxPage?: number;
};

function nowIso() {
  return new Date().toISOString();
}

function addMs(referenceIso: string, ms: number) {
  return new Date(new Date(referenceIso).getTime() + ms).toISOString();
}

function hashUrl(value: string) {
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 18);
}

function jobId(scopeKey: string, source: OwnerListingSource, url: string) {
  return `${scopeKey}_${source}_${hashUrl(url)}`;
}

function sourceUrlsForScope(scope: ReturnType<typeof listOwnerListingScopes>[number]) {
  return [
    ...scope.olxSourceUrls.map((entry) => ({ ...entry, source: 'olx' as const })),
    ...scope.publi24SourceUrls.map((entry) => ({ ...entry, source: 'publi24' as const })),
    ...scope.imoradar24SourceUrls.map((entry) => ({ ...entry, source: 'imoradar24' as const })),
  ];
}

function initialPriority(entry: OwnerListingSourceUrl, source: OwnerListingSource) {
  let priority = entry.kind === 'fresh-radar' ? 1000 : 500;
  if (source === 'imoradar24') priority -= 80;
  if (entry.propertyType === 'apartment') priority += 30;
  if (entry.transactionType === 'sale') priority += 10;
  return priority;
}

async function ensureFrontierJobs(scopeKey?: string | null) {
  const scopes = listOwnerListingScopes().filter((scope) => !scopeKey || scope.key === scopeKey);
  const timestamp = nowIso();
  const activeImoradarJobIds = new Set<string>();

  for (const scope of scopes) {
    const batch = adminDb.batch();
    for (const entry of sourceUrlsForScope(scope)) {
      const id = jobId(scope.key, entry.source, entry.url);
      if (entry.source === 'imoradar24') {
        activeImoradarJobIds.add(id);
      }

      const ref = adminDb.collection(FRONTIER_COLLECTION).doc(id);
      batch.set(
        ref,
        {
          id,
          scopeKey: scope.key,
          scopeLabel: scope.displayName,
          source: entry.source,
          sourceUrl: entry.url,
          sourceUrlKind: entry.kind,
          label: entry.label,
          propertyType: entry.propertyType || null,
          transactionType: entry.transactionType || null,
          status: 'pending',
          priority: initialPriority(entry, entry.source),
          nextPage: 1,
          pagesProcessed: 0,
          scanned: 0,
          stored: 0,
          skipped: 0,
          errors: 0,
          nextRunAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp,
          firestoreUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();
  }

  await retireObsoleteImoradarFrontierJobs(activeImoradarJobIds, scopes.map((scope) => scope.key), timestamp);
}

async function retireObsoleteImoradarFrontierJobs(activeJobIds: Set<string>, scopeKeys: string[], timestamp: string) {
  if (!activeJobIds.size || !scopeKeys.length) {
    return;
  }

  const snapshot = await adminDb
    .collection(FRONTIER_COLLECTION)
    .where('source', '==', 'imoradar24')
    .limit(500)
    .get();

  let batch = adminDb.batch();
  let pendingWrites = 0;
  const obsoleteNextRunAt = addMs(timestamp, 30 * 24 * 60 * 60 * 1000);

  for (const docSnapshot of snapshot.docs) {
    const job = docSnapshot.data() as Partial<OwnerListingScrapeFrontierJob>;
    if (!job.scopeKey || !scopeKeys.includes(job.scopeKey) || activeJobIds.has(docSnapshot.id)) {
      continue;
    }

    batch.set(
      docSnapshot.ref,
      {
        status: 'failed',
        lastError: 'Obsolete Imoradar URL replaced by canonical route',
        lockedAt: FieldValue.delete(),
        lockedBy: FieldValue.delete(),
        nextRunAt: obsoleteNextRunAt,
        updatedAt: timestamp,
        firestoreUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    pendingWrites += 1;

    if (pendingWrites >= 400) {
      await batch.commit();
      batch = adminDb.batch();
      pendingWrites = 0;
    }
  }

  if (pendingWrites) {
    await batch.commit();
  }
}

function isLockStale(job: Partial<OwnerListingScrapeFrontierJob>) {
  if (!job.lockedAt) return true;
  return Date.now() - new Date(job.lockedAt).getTime() > LOCK_STALE_MS;
}

async function acquireFrontierJob(scopeKey?: string | null) {
  const now = nowIso();
  let query: FirebaseFirestore.Query = adminDb
    .collection(FRONTIER_COLLECTION)
    .where('nextRunAt', '<=', now)
    .orderBy('nextRunAt', 'asc')
    .limit(50);

  if (scopeKey) {
    query = adminDb
      .collection(FRONTIER_COLLECTION)
      .where('scopeKey', '==', scopeKey)
      .where('nextRunAt', '<=', now)
      .orderBy('nextRunAt', 'asc')
      .limit(50);
  }

  const snapshot = await query.get();
  const lockId = crypto.randomUUID();

  const candidates = [...snapshot.docs].sort((left, right) => {
    const leftData = left.data() as Partial<OwnerListingScrapeFrontierJob>;
    const rightData = right.data() as Partial<OwnerListingScrapeFrontierJob>;
    return (rightData.priority || 0) - (leftData.priority || 0);
  });

  for (const docSnapshot of candidates) {
    const candidate = docSnapshot.data() as OwnerListingScrapeFrontierJob;
    if (candidate.lockedBy && !isLockStale(candidate)) {
      continue;
    }

    const acquired = await adminDb.runTransaction(async (transaction) => {
      const fresh = await transaction.get(docSnapshot.ref);
      if (!fresh.exists) return null;
      const latest = fresh.data() as OwnerListingScrapeFrontierJob;
      if (latest.lockedBy && !isLockStale(latest)) return null;
      if (new Date(latest.nextRunAt).getTime() > Date.now()) return null;

      const timestamp = nowIso();
      transaction.set(
        docSnapshot.ref,
        {
          status: 'running',
          lockedAt: timestamp,
          lockedBy: lockId,
          updatedAt: timestamp,
          firestoreUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return {
        ref: docSnapshot.ref,
        lockId,
        job: {
          ...latest,
          id: fresh.id,
          status: 'running' as const,
          lockedAt: timestamp,
          lockedBy: lockId,
        },
      };
    });

    if (acquired) {
      return acquired;
    }
  }

  return null;
}

async function acquireFrontierJobWithSourceLimits(
  processedBySource: Record<OwnerListingSource, number>,
  scopeKey?: string | null
) {
  for (let attempts = 0; attempts < 20; attempts += 1) {
    const acquired = await acquireFrontierJob(scopeKey);
    if (!acquired) return null;

    const currentCount = processedBySource[acquired.job.source] || 0;
    if (currentCount < SOURCE_LIMITS_PER_TICK[acquired.job.source]) {
      return acquired;
    }

    const timestamp = nowIso();
    await acquired.ref.set(
      {
        status: 'pending',
        lockedAt: FieldValue.delete(),
        lockedBy: FieldValue.delete(),
        nextRunAt: addMs(timestamp, 2 * 60 * 1000),
        updatedAt: timestamp,
        firestoreUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  return null;
}

function nextRunDelayMs(job: OwnerListingScrapeFrontierJob, reachedEnd: boolean, maxPage: number) {
  if (job.sourceUrlKind === 'fresh-radar') {
    return FRESH_RADAR_INTERVAL_MS;
  }

  if (reachedEnd || job.nextPage >= maxPage) {
    return COVERAGE_INTERVAL_MS;
  }

  return 5 * 60 * 1000;
}

function shouldPauseForLowYield(input: {
  job: OwnerListingScrapeFrontierJob;
  scanned: number;
  stored: number;
  reachedEnd: boolean;
}) {
  const storedRatio = input.scanned > 0 ? input.stored / input.scanned : 0;
  const consecutiveEmptyPages = input.scanned === 0 || input.stored === 0 ? (input.job.consecutiveEmptyPages || 0) + 1 : 0;
  const duplicateHeavy = input.scanned >= 10 && storedRatio <= 0.05;
  const consecutiveDuplicateHeavyPages = duplicateHeavy ? (input.job.consecutiveDuplicateHeavyPages || 0) + 1 : 0;

  return {
    storedRatio,
    consecutiveEmptyPages,
    consecutiveDuplicateHeavyPages,
    shouldCooldown:
      input.reachedEnd ||
      consecutiveEmptyPages >= 2 ||
      consecutiveDuplicateHeavyPages >= 2,
  };
}

export async function runOwnerListingsFrontierTick(options: FrontierTickOptions = {}) {
  await ensureFrontierJobs(options.scopeKey);

  const startedAt = nowIso();
  const startedMs = Date.now();
  const maxRuntimeMs = options.maxRuntimeMs ?? 8 * 60 * 1000;
  const limit = options.limit ?? 10;
  const maxPage = options.maxPage ?? 20;
  const processedBySource: Record<OwnerListingSource, number> = {
    olx: 0,
    publi24: 0,
    imoradar24: 0,
  };
  const results: Array<{
    jobId: string;
    scopeKey: string;
    source: OwnerListingSource;
    sourceUrlKind: string;
    page: number;
    scanned: number;
    stored: number;
    skipped: number;
    errors: number;
    reachedEnd: boolean;
    message: string;
  }> = [];

  while (results.length < limit && Date.now() - startedMs < maxRuntimeMs) {
    const acquired = await acquireFrontierJobWithSourceLimits(processedBySource, options.scopeKey);
    if (!acquired) break;

    const { ref, lockId, job } = acquired;
    const page = Math.max(1, job.nextPage || 1);
    const runStartedMs = Date.now();

    try {
      const result = await syncOwnerListingsSourceUrlPage(
        job.scopeKey,
        job.source,
        job.sourceUrl,
        page,
        {
          hardPageLimit: maxPage,
          maxAgeDays: job.sourceUrlKind === 'fresh-radar' ? 14 : 60,
          sourceUrlKind: job.sourceUrlKind,
        },
        {
          markNew: true,
          isBaselineListing: false,
          newUntilAt: getNewBadgeLifetimeUnix(),
        }
      );

      processedBySource[job.source] += 1;
      const reachedEnd = result.reachedEnd || page >= maxPage;
      const lowYield = shouldPauseForLowYield({
        job,
        scanned: result.scanned,
        stored: result.stored,
        reachedEnd,
      });
      const timestamp = nowIso();
      const shouldCooldown = lowYield.shouldCooldown;
      const nextPage = shouldCooldown ? 1 : page + 1;
      await ref.set(
        {
          status: shouldCooldown ? 'cooldown' : 'pending',
          nextPage,
          pagesProcessed: (job.pagesProcessed || 0) + 1,
          scanned: (job.scanned || 0) + result.scanned,
          stored: (job.stored || 0) + result.stored,
          skipped: (job.skipped || 0) + result.skipped,
          errors: job.errors || 0,
          consecutiveEmptyPages: lowYield.consecutiveEmptyPages,
          consecutiveDuplicateHeavyPages: lowYield.consecutiveDuplicateHeavyPages,
          lastStoredRatio: lowYield.storedRatio,
          lastRunAt: timestamp,
          lastSuccessAt: timestamp,
          lastError: FieldValue.delete(),
          nextRunAt: addMs(timestamp, nextRunDelayMs(job, shouldCooldown, maxPage)),
          lockedAt: FieldValue.delete(),
          lockedBy: FieldValue.delete(),
          updatedAt: timestamp,
          firestoreUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await adminDb.collection(FRONTIER_RUN_COLLECTION).add({
        jobId: job.id,
        scopeKey: job.scopeKey,
        source: job.source,
        sourceUrlKind: job.sourceUrlKind,
        sourceUrl: job.sourceUrl,
        page,
        scanned: result.scanned,
        stored: result.stored,
        skipped: result.skipped,
        errors: result.errors.length,
        reachedEnd,
        startedAt: new Date(runStartedMs).toISOString(),
        finishedAt: timestamp,
        durationMs: Date.now() - runStartedMs,
        firestoreCreatedAt: FieldValue.serverTimestamp(),
      });

      results.push({
        jobId: job.id,
        scopeKey: job.scopeKey,
        source: job.source,
        sourceUrlKind: job.sourceUrlKind,
        page,
        scanned: result.scanned,
        stored: result.stored,
        skipped: result.skipped,
        errors: result.errors.length,
        reachedEnd,
        message: shouldCooldown ? 'Jobul a intrat in cooldown dupa stop condition.' : 'Pagina procesata.',
      });
    } catch (error) {
      const timestamp = nowIso();
      const nextErrors = (job.errors || 0) + 1;
      const failedHard = nextErrors >= MAX_FAILURES_BEFORE_BACKOFF;
      const message = error instanceof Error ? error.message : 'Frontier job a esuat.';

      await ref.set(
        {
          status: failedHard ? 'failed' : 'pending',
          errors: nextErrors,
          lastRunAt: timestamp,
          lastError: message,
          nextRunAt: addMs(timestamp, failedHard ? 60 * 60 * 1000 : 15 * 60 * 1000),
          lockedAt: FieldValue.delete(),
          lockedBy: FieldValue.delete(),
          updatedAt: timestamp,
          firestoreUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      results.push({
        jobId: job.id,
        scopeKey: job.scopeKey,
        source: job.source,
        sourceUrlKind: job.sourceUrlKind,
        page,
        scanned: 0,
        stored: 0,
        skipped: 0,
        errors: 1,
        reachedEnd: false,
        message,
      });

      if (lockId !== job.lockedBy) {
        break;
      }
    }
  }

  return {
    startedAt,
    finishedAt: nowIso(),
    processed: results.length,
    results,
  };
}
