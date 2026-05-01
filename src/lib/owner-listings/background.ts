import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import { adminDb } from '@/firebase/admin';
import { drainNextOlxPhoneQueueItem } from '@/lib/owner-listings/olx-phone-queue';
import { getNewBadgeLifetimeUnix, syncOwnerListings } from '@/lib/owner-listings';
import { runOwnerListingsSyncSchedulerTick } from '@/lib/owner-listings/cycle';
import { getOwnerListingScope, listOwnerListingScopes } from '@/lib/owner-listings/scope';
import type {
  OlxPhoneDrainResult,
  OwnerListingSource,
  OwnerListingSyncResult,
  OwnerListingSyncTickResult,
} from '@/lib/owner-listings/types';

export const OWNER_LISTINGS_CRON_SECRET_HEADER = 'x-owner-listings-cron-secret';

export function isValidOwnerListingsCronSecret(secret: string | null | undefined) {
  const expected = process.env.OWNER_LISTINGS_CRON_SECRET;
  return Boolean(expected) && Boolean(secret) && secret === expected;
}

export async function runOwnerListingsOlxPhoneDrain(): Promise<OlxPhoneDrainResult> {
  return drainNextOlxPhoneQueueItem();
}

type CycleTickOptions = {
  scopeKey?: string | null;
  hardPageLimit?: number;
  maxAgeDays?: number;
  maxListingsPerSource?: number | null;
  maxPagesPerTick?: number;
  maxRuntimeMs?: number;
};

export async function runOwnerListingsScheduledCycleTick(options: CycleTickOptions = {}): Promise<OwnerListingSyncTickResult> {
  return runOwnerListingsSyncSchedulerTick(options);
}

type BackgroundSyncOptions = {
  scopeKey?: string | null;
  sources?: OwnerListingSource[];
  maxPages?: number;
  maxListingsPerSource?: number;
  hardPageLimit?: number;
};

type ScopeJobResult = {
  scopeKey: string;
  scopeLabel: string;
  result?: OwnerListingSyncResult;
  error?: string;
};

type BackgroundJobMode = 'background' | 'manual';

type QueuedBackgroundSyncOptions = BackgroundSyncOptions & {
  mode?: BackgroundJobMode;
};

function listTargetScopes(scopeKey?: string | null) {
  if (scopeKey) {
    const scope = getOwnerListingScope(scopeKey);
    return scope ? [scope] : [];
  }

  return listOwnerListingScopes();
}

function nowIso() {
  return new Date().toISOString();
}

function addMs(dateIso: string, milliseconds: number) {
  return new Date(new Date(dateIso).getTime() + milliseconds).toISOString();
}

async function loadScopeCycleState(scopeKey: string) {
  const snapshot = await adminDb.collection('ownerListingSyncCycles').doc(scopeKey).get();
  return snapshot.exists
    ? snapshot.data() as { baselineStatus?: string; baselineCompletedAt?: string; cycleNumber?: number; scopeLabel?: string }
    : null;
}

async function markManualScopeRunStarted(scopeKey: string, scopeLabel: string, nextCycleNumber: number, isBaselineRun: boolean) {
  const startedAt = nowIso();
  await adminDb.collection('ownerListingSyncCycles').doc(scopeKey).set(
    {
      scopeKey,
      scopeLabel,
      cycleNumber: nextCycleNumber,
      baselineStatus: isBaselineRun ? 'running' : 'completed',
      status: 'running',
      currentSourceIndex: 0,
      currentSource: null,
      sourcesOrder: ['olx', 'publi24', 'imoradar24'],
      cycleStartedAt: startedAt,
      cycleFinishedAt: null,
      cooldownUntil: null,
      lastHeartbeatAt: startedAt,
      lastError: null,
      updatedAt: startedAt,
      createdAt: startedAt,
      firestoreUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function markManualScopeRunFinished(scopeKey: string, nextCycleNumber: number, isBaselineRun: boolean) {
  const finishedAt = nowIso();
  await adminDb.collection('ownerListingSyncCycles').doc(scopeKey).set(
    {
      scopeKey,
      cycleNumber: nextCycleNumber,
      baselineStatus: isBaselineRun ? 'completed' : 'completed',
      ...(isBaselineRun ? { baselineCycleNumber: nextCycleNumber, baselineCompletedAt: finishedAt } : {}),
      status: 'cooldown',
      currentSourceIndex: 3,
      currentSource: null,
      cycleFinishedAt: finishedAt,
      cooldownUntil: addMs(finishedAt, 2 * 60 * 60 * 1000),
      lastHeartbeatAt: finishedAt,
      lastError: null,
      updatedAt: finishedAt,
      firestoreUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function markManualScopeRunFailed(scopeKey: string, nextCycleNumber: number, errorMessage: string) {
  const failedAt = nowIso();
  await adminDb.collection('ownerListingSyncCycles').doc(scopeKey).set(
    {
      scopeKey,
      cycleNumber: nextCycleNumber,
      status: 'failed',
      lastError: errorMessage,
      lastHeartbeatAt: failedAt,
      updatedAt: failedAt,
      firestoreUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function executeOwnerListingsBackgroundSync(jobRef: DocumentReference, options: QueuedBackgroundSyncOptions) {
  const sources = options.sources || ['olx', 'imoradar24', 'publi24'];
  const scopes = listTargetScopes(options.scopeKey);
  const scopeResults: ScopeJobResult[] = [];

  for (const scope of scopes) {
    try {
      const cycleState = await loadScopeCycleState(scope.key);
      const isBaselineCompleted = cycleState?.baselineStatus === 'completed';
      const nextCycleNumber = Math.max(1, (cycleState?.cycleNumber || 0) + 1);
      await markManualScopeRunStarted(scope.key, scope.displayName, nextCycleNumber, !isBaselineCompleted);
      const result = await syncOwnerListings(
        scope.key,
        sources,
        {
          maxPages: options.maxPages ?? null,
          maxListingsPerSource: options.maxListingsPerSource ?? null,
          hardPageLimit: options.hardPageLimit || 250,
          maxAgeDays: 60,
        },
        {
          markNew: isBaselineCompleted,
          isBaselineListing: !isBaselineCompleted,
          discoveredCycleNumber: nextCycleNumber,
          newUntilAt: isBaselineCompleted ? getNewBadgeLifetimeUnix() : null,
        }
      );
      await markManualScopeRunFinished(scope.key, nextCycleNumber, !isBaselineCompleted);
      scopeResults.push({
        scopeKey: scope.key,
        scopeLabel: scope.displayName,
        result,
      });
    } catch (error) {
      const cycleState = await loadScopeCycleState(scope.key);
      const nextCycleNumber = Math.max(1, (cycleState?.cycleNumber || 0));
      await markManualScopeRunFailed(
        scope.key,
        nextCycleNumber,
        error instanceof Error ? error.message : 'Sincronizarea scope-ului a esuat.'
      );
      scopeResults.push({
        scopeKey: scope.key,
        scopeLabel: scope.displayName,
        error: error instanceof Error ? error.message : 'Sincronizarea scope-ului a esuat.',
      });
    }
  }

  const finishedAt = new Date().toISOString();
  const summary = scopeResults.reduce(
    (accumulator, scopeResult) => {
      if (scopeResult.result) {
        accumulator.scanned += scopeResult.result.scanned;
        accumulator.accepted += scopeResult.result.accepted;
        accumulator.stored += scopeResult.result.stored;
        accumulator.skipped += scopeResult.result.skipped;
        accumulator.errors += scopeResult.result.errors.length;
      }

      if (scopeResult.error) {
        accumulator.errors += 1;
      }

      return accumulator;
    },
    { scanned: 0, accepted: 0, stored: 0, skipped: 0, errors: 0 }
  );

  await jobRef.set(
    {
      status: 'completed',
      finishedAt,
      summary,
      scopes: scopeResults,
    },
    { merge: true }
  );

  return {
    jobId: jobRef.id,
    finishedAt,
    summary,
    scopes: scopeResults,
  };
}

export async function queueOwnerListingsBackgroundSync(options: QueuedBackgroundSyncOptions) {
  const sources = options.sources || ['olx', 'imoradar24', 'publi24'];
  const startedAt = new Date().toISOString();
  const jobRef = adminDb.collection('ownerListingSyncJobs').doc();

  await jobRef.set({
    type: options.mode || 'manual',
    status: 'running',
    startedAt,
    scopeKey: options.scopeKey || null,
    sources,
    maxPages: options.maxPages ?? null,
    maxListingsPerSource: options.maxListingsPerSource ?? null,
    hardPageLimit: options.hardPageLimit || 250,
  });

  void executeOwnerListingsBackgroundSync(jobRef, options).catch(async (error) => {
    await jobRef.set(
      {
        status: 'failed',
        finishedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Jobul de sync a esuat.',
      },
      { merge: true }
    );
  });

  return {
    jobId: jobRef.id,
    startedAt,
    status: 'running' as const,
  };
}

export async function runOwnerListingsBackgroundSync(options: BackgroundSyncOptions) {
  const sources = options.sources || ['olx', 'imoradar24', 'publi24'];
  const startedAt = new Date().toISOString();
  const jobRef = adminDb.collection('ownerListingSyncJobs').doc();

  await jobRef.set({
    type: 'background',
    status: 'running',
    startedAt,
    scopeKey: options.scopeKey || null,
    sources,
    maxPages: options.maxPages ?? null,
    maxListingsPerSource: options.maxListingsPerSource ?? null,
    hardPageLimit: options.hardPageLimit || 250,
  });

  const result = await executeOwnerListingsBackgroundSync(jobRef, {
    ...options,
    mode: 'background',
  });

  return {
    ...result,
    startedAt,
  };
}
