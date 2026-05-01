import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/firebase/admin';
import { expireScopeNewBadges, getNewBadgeLifetimeUnix, syncOwnerListingsSourcePage } from '@/lib/owner-listings/index';
import { getOwnerListingScope, listOwnerListingScopes } from '@/lib/owner-listings/scope';
import type {
  OwnerListingBaselineStatus,
  OwnerListingSource,
  OwnerListingSyncCycleJob,
  OwnerListingSyncCycleJobStatus,
  OwnerListingSyncCycleState,
  OwnerListingSyncRun,
  OwnerListingSyncTickResult,
  OwnerListingSyncTickScopeResult,
} from '@/lib/owner-listings/types';

const CYCLE_COLLECTION = 'ownerListingSyncCycles';
const CYCLE_JOB_COLLECTION = 'ownerListingSyncCycleJobs';
const CYCLE_RUN_COLLECTION = 'ownerListingSyncRuns';

const CYCLE_SOURCE_ORDER: OwnerListingSource[] = ['olx', 'publi24', 'imoradar24'];
const LOCK_STALE_MS = 20 * 60 * 1000;
const CYCLE_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const DEFAULT_HARD_PAGE_LIMIT = 250;
const DEFAULT_MAX_AGE_DAYS = 60;
const DEFAULT_MAX_PAGES_PER_TICK = 12;
const DEFAULT_MAX_RUNTIME_MS = 7 * 60 * 1000;

type SchedulerTickOptions = {
  scopeKey?: string | null;
  hardPageLimit?: number;
  maxAgeDays?: number;
  maxListingsPerSource?: number | null;
  maxPagesPerTick?: number;
  maxRuntimeMs?: number;
};

type AcquireCycleLockResult = {
  lockId: string;
  state: OwnerListingSyncCycleState;
};

function cycleDocRef(scopeKey: string) {
  return adminDb.collection(CYCLE_COLLECTION).doc(scopeKey);
}

function cycleJobDocRef(scopeKey: string, source: OwnerListingSource) {
  return adminDb.collection(CYCLE_JOB_COLLECTION).doc(`${scopeKey}_${source}`);
}

function nowIso() {
  return new Date().toISOString();
}

function addMs(dateIso: string, milliseconds: number) {
  return new Date(new Date(dateIso).getTime() + milliseconds).toISOString();
}

function withoutUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T;
}

function isFuture(dateIso?: string) {
  return Boolean(dateIso) && new Date(dateIso as string).getTime() > Date.now();
}

function getCycleLockStaleMs(existing: Partial<OwnerListingSyncCycleState>) {
  const runtimeWindow = Math.max(
    DEFAULT_MAX_RUNTIME_MS * 2,
    (existing.maxRuntimeMs || DEFAULT_MAX_RUNTIME_MS) + 2 * 60 * 1000
  );
  return Math.min(LOCK_STALE_MS, runtimeWindow);
}

function getCycleLockExpiresAtIso(existing: Partial<OwnerListingSyncCycleState>) {
  return addMs(nowIso(), getCycleLockStaleMs(existing));
}

function buildBaseCycleState(input: {
  scopeKey: string;
  scopeLabel: string;
  cycleNumber: number;
  baselineStatus?: OwnerListingBaselineStatus;
  hardPageLimit?: number;
  maxAgeDays?: number;
  maxListingsPerSource?: number | null;
  maxPagesPerTick?: number;
  maxRuntimeMs?: number;
  createdAt?: string;
}): OwnerListingSyncCycleState {
  const timestamp = input.createdAt || nowIso();
  return {
    scopeKey: input.scopeKey,
    scopeLabel: input.scopeLabel,
    cycleNumber: input.cycleNumber,
    baselineStatus: input.baselineStatus || 'pending',
    status: 'idle',
    sourcesOrder: CYCLE_SOURCE_ORDER,
    currentSourceIndex: 0,
    currentSource: null,
    hardPageLimit: input.hardPageLimit ?? DEFAULT_HARD_PAGE_LIMIT,
    maxAgeDays: input.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS,
    maxListingsPerSource: input.maxListingsPerSource ?? null,
    maxPagesPerTick: input.maxPagesPerTick ?? DEFAULT_MAX_PAGES_PER_TICK,
    maxRuntimeMs: input.maxRuntimeMs ?? DEFAULT_MAX_RUNTIME_MS,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildCycleJobState(
  scopeKey: string,
  cycleNumber: number,
  source: OwnerListingSource,
  status: OwnerListingSyncCycleJobStatus = 'pending'
): OwnerListingSyncCycleJob {
  const timestamp = nowIso();
  return {
    scopeKey,
    cycleNumber,
    source,
    status,
    nextPage: 1,
    pagesProcessed: 0,
    scanned: 0,
    accepted: 0,
    stored: 0,
    skipped: 0,
    errors: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function listTargetScopes(scopeKey?: string | null) {
  if (scopeKey) {
    const scope = getOwnerListingScope(scopeKey);
    return scope ? [scope] : [];
  }

  return listOwnerListingScopes();
}

async function acquireCycleLock(scopeKey: string, options: SchedulerTickOptions): Promise<AcquireCycleLockResult | null> {
  const stateRef = cycleDocRef(scopeKey);
  const lockId = crypto.randomUUID();

  return adminDb.runTransaction(async (transaction) => {
    const scope = getOwnerListingScope(scopeKey);
    if (!scope) {
      return null;
    }

    const existingSnapshot = await transaction.get(stateRef);
    const existing = existingSnapshot.exists
      ? (existingSnapshot.data() as OwnerListingSyncCycleState)
      : buildBaseCycleState({
          scopeKey,
          scopeLabel: scope.displayName,
          cycleNumber: 0,
          hardPageLimit: options.hardPageLimit,
          maxAgeDays: options.maxAgeDays,
          maxListingsPerSource: options.maxListingsPerSource,
          maxPagesPerTick: options.maxPagesPerTick,
          maxRuntimeMs: options.maxRuntimeMs,
        });

    const staleAfterMs = getCycleLockStaleMs(existing);
    const lockedAtMs = existing.lockedAt ? new Date(existing.lockedAt).getTime() : 0;
    const lastHeartbeatMs = existing.lastHeartbeatAt ? new Date(existing.lastHeartbeatAt).getTime() : 0;
    const freshestActivityMs = Math.max(lockedAtMs, lastHeartbeatMs);
    const lockExpiresAtMs = existing.lockExpiresAt ? new Date(existing.lockExpiresAt).getTime() : 0;
    const activityExpiryMs = freshestActivityMs ? freshestActivityMs + staleAfterMs : 0;
    const effectiveLockExpiryMs = Math.max(lockExpiresAtMs, activityExpiryMs);
    if (existing.lockedBy && effectiveLockExpiryMs && Date.now() < effectiveLockExpiryMs) {
      return null;
    }

    const lockedAt = nowIso();
    const nextState: OwnerListingSyncCycleState = {
      ...existing,
      scopeKey,
      scopeLabel: scope.displayName,
      hardPageLimit: options.hardPageLimit ?? existing.hardPageLimit ?? DEFAULT_HARD_PAGE_LIMIT,
      maxAgeDays: options.maxAgeDays ?? existing.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS,
      maxListingsPerSource: options.maxListingsPerSource ?? existing.maxListingsPerSource ?? null,
      maxPagesPerTick: options.maxPagesPerTick ?? existing.maxPagesPerTick ?? DEFAULT_MAX_PAGES_PER_TICK,
      maxRuntimeMs: options.maxRuntimeMs ?? existing.maxRuntimeMs ?? DEFAULT_MAX_RUNTIME_MS,
      lockedBy: lockId,
      lockedAt,
      lockExpiresAt: getCycleLockExpiresAtIso({
        ...existing,
        maxRuntimeMs: options.maxRuntimeMs ?? existing.maxRuntimeMs ?? DEFAULT_MAX_RUNTIME_MS,
      }),
      updatedAt: lockedAt,
      createdAt: existing.createdAt || lockedAt,
    };

    transaction.set(
      stateRef,
      {
        ...nextState,
        firestoreUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      lockId,
      state: nextState,
    };
  });
}

async function releaseCycleLock(scopeKey: string, lockId: string, patch: Partial<OwnerListingSyncCycleState>) {
  const stateRef = cycleDocRef(scopeKey);
  const snapshot = await stateRef.get();
  if (!snapshot.exists) {
    return;
  }

  const current = snapshot.data() as OwnerListingSyncCycleState;
  if (current.lockedBy !== lockId) {
    return;
  }

  await stateRef.set(
    {
      ...patch,
      lockedBy: null,
      lockedAt: null,
      lockExpiresAt: null,
      updatedAt: nowIso(),
      firestoreUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

function buildCycleHeartbeatPatch(
  state: Partial<OwnerListingSyncCycleState>,
  patch: Partial<OwnerListingSyncCycleState> = {}
) {
  const heartbeatAt = nowIso();
  return {
    ...patch,
    lastHeartbeatAt: heartbeatAt,
    lockExpiresAt: getCycleLockExpiresAtIso(state),
    updatedAt: heartbeatAt,
    firestoreUpdatedAt: FieldValue.serverTimestamp(),
  };
}

async function ensureCycleJobs(scopeKey: string, cycleNumber: number) {
  const batch = adminDb.batch();
  for (const source of CYCLE_SOURCE_ORDER) {
    batch.set(cycleJobDocRef(scopeKey, source), buildCycleJobState(scopeKey, cycleNumber, source));
  }
  await batch.commit();
}

async function startNewCycle(state: OwnerListingSyncCycleState) {
  const nextCycleNumber = (state.cycleNumber || 0) + 1;
  const startedAt = nowIso();
  await expireScopeNewBadges(state.scopeKey);
  await ensureCycleJobs(state.scopeKey, nextCycleNumber);

  const isBaselineCycle = state.baselineStatus !== 'completed';
  const nextState: Partial<OwnerListingSyncCycleState> = {
    cycleNumber: nextCycleNumber,
    baselineStatus: isBaselineCycle ? 'running' : state.baselineStatus,
    status: 'running',
    currentSourceIndex: 0,
    currentSource: CYCLE_SOURCE_ORDER[0],
    cycleStartedAt: startedAt,
    cycleFinishedAt: null as never,
    cooldownUntil: null as never,
    lastError: null as never,
    lastHeartbeatAt: startedAt,
  };

  await cycleDocRef(state.scopeKey).set(
    {
      ...nextState,
      firestoreUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    ...state,
    ...nextState,
  } as OwnerListingSyncCycleState;
}

async function getCycleJob(scopeKey: string, source: OwnerListingSource, cycleNumber: number) {
  const jobRef = cycleJobDocRef(scopeKey, source);
  const snapshot = await jobRef.get();
  if (snapshot.exists) {
    return snapshot.data() as OwnerListingSyncCycleJob;
  }

  const nextJob = buildCycleJobState(scopeKey, cycleNumber, source);
  await jobRef.set(nextJob, { merge: true });
  return nextJob;
}

async function writeRunLog(run: OwnerListingSyncRun) {
  await adminDb.collection(CYCLE_RUN_COLLECTION).add({
    ...run,
    createdAt: run.finishedAt,
    firestoreCreatedAt: FieldValue.serverTimestamp(),
  });
}

async function markCycleCooldown(state: OwnerListingSyncCycleState) {
  const finishedAt = nowIso();
  const cooldownUntil = addMs(finishedAt, CYCLE_COOLDOWN_MS);
  const baselineCompleted = state.baselineStatus !== 'completed' && state.cycleNumber > 0;

  await cycleDocRef(state.scopeKey).set(
    {
      status: 'cooldown',
      currentSource: null,
      currentSourceIndex: CYCLE_SOURCE_ORDER.length,
      cycleFinishedAt: finishedAt,
      cooldownUntil,
      lastHeartbeatAt: finishedAt,
      lastError: null,
      baselineStatus: baselineCompleted ? 'completed' : state.baselineStatus,
      baselineCycleNumber: baselineCompleted ? state.cycleNumber : state.baselineCycleNumber,
      baselineCompletedAt: baselineCompleted ? finishedAt : state.baselineCompletedAt,
      firestoreUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    cooldownUntil,
    baselineStatus: baselineCompleted ? 'completed' as const : state.baselineStatus,
    baselineCycleNumber: baselineCompleted ? state.cycleNumber : state.baselineCycleNumber,
    baselineCompletedAt: baselineCompleted ? finishedAt : state.baselineCompletedAt,
  };
}

async function processScopeCycleTick(
  scopeKey: string,
  scopeLabel: string,
  options: SchedulerTickOptions
): Promise<OwnerListingSyncTickScopeResult> {
  const acquired = await acquireCycleLock(scopeKey, options);
  if (!acquired) {
    const snapshot = await cycleDocRef(scopeKey).get();
    const current = snapshot.exists ? (snapshot.data() as OwnerListingSyncCycleState) : null;
    return {
      scopeKey,
      scopeLabel,
      cycleNumber: current?.cycleNumber || 0,
      baselineStatus: current?.baselineStatus || 'pending',
      status: current?.status || 'idle',
      currentSource: current?.currentSource || null,
      pagesProcessed: 0,
      cooldownUntil: current?.cooldownUntil,
      summary: { scanned: 0, accepted: 0, stored: 0, skipped: 0, errors: 0 },
      message: current?.lockedBy ? 'Un alt worker proceseaza deja ciclul.' : 'Nu a fost nevoie de procesare in acest tick.',
    };
  }

  let state = acquired.state;
  const tickStartedAt = Date.now();
  const totals = { scanned: 0, accepted: 0, stored: 0, skipped: 0, errors: 0 };
  let pagesProcessed = 0;
  let message = 'Nicio pagina procesata.';

  try {
    if (state.status === 'cooldown' && isFuture(state.cooldownUntil)) {
      return {
        scopeKey,
        scopeLabel,
        cycleNumber: state.cycleNumber,
        baselineStatus: state.baselineStatus,
        status: state.status,
        currentSource: state.currentSource,
        pagesProcessed: 0,
        cooldownUntil: state.cooldownUntil,
        summary: totals,
        message: 'Ciclul este in cooldown.',
      };
    }

    if (state.status !== 'running') {
      state = await startNewCycle(state);
      message = state.baselineStatus === 'running' ? 'A fost pornit ciclul de baseline.' : 'A fost pornit un ciclu nou.';
    }

    while (pagesProcessed < (state.maxPagesPerTick || DEFAULT_MAX_PAGES_PER_TICK) && Date.now() - tickStartedAt < (state.maxRuntimeMs || DEFAULT_MAX_RUNTIME_MS)) {
      const currentSource = state.currentSource || CYCLE_SOURCE_ORDER[state.currentSourceIndex] || null;
      if (!currentSource) {
        const cooldownState = await markCycleCooldown(state);
        state = {
          ...state,
          status: 'cooldown',
          currentSource: null,
          currentSourceIndex: CYCLE_SOURCE_ORDER.length,
          cycleFinishedAt: nowIso(),
          cooldownUntil: cooldownState.cooldownUntil,
          baselineStatus: cooldownState.baselineStatus,
          baselineCycleNumber: cooldownState.baselineCycleNumber,
          baselineCompletedAt: cooldownState.baselineCompletedAt,
        };
        message = cooldownState.baselineStatus === 'completed' && state.cycleNumber === cooldownState.baselineCycleNumber
          ? 'Baseline-ul s-a incheiat si a intrat in cooldown.'
          : 'Ciclul s-a incheiat si a intrat in cooldown.';
        break;
      }

      let job = await getCycleJob(scopeKey, currentSource, state.cycleNumber);
      if (job.status === 'done') {
        state.currentSourceIndex += 1;
        state.currentSource = CYCLE_SOURCE_ORDER[state.currentSourceIndex] || null;
        await cycleDocRef(scopeKey).set(
          buildCycleHeartbeatPatch(state, {
            currentSourceIndex: state.currentSourceIndex,
            currentSource: state.currentSource,
          }),
          { merge: true }
        );
        continue;
      }

      await cycleJobDocRef(scopeKey, currentSource).set(
        {
          status: 'running',
          startedAt: job.startedAt || nowIso(),
          lastRunAt: nowIso(),
          updatedAt: nowIso(),
          firestoreUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await cycleDocRef(scopeKey).set(
        buildCycleHeartbeatPatch(state, {
          status: 'running',
          currentSourceIndex: state.currentSourceIndex,
          currentSource,
          lastError: null as never,
        }),
        { merge: true }
      );

      const runStartedAt = Date.now();
      try {
        const pageResult = await syncOwnerListingsSourcePage(
          scopeKey,
          currentSource,
          job.nextPage,
          {
            hardPageLimit: state.hardPageLimit,
            maxAgeDays: state.maxAgeDays,
            maxListingsPerSource: state.maxListingsPerSource ?? undefined,
          },
          {
            markNew: state.baselineStatus === 'completed',
            isBaselineListing: state.baselineStatus !== 'completed',
            discoveredCycleNumber: state.cycleNumber,
            newUntilAt: state.baselineStatus === 'completed' ? getNewBadgeLifetimeUnix() : null,
          }
        );

        totals.scanned += pageResult.scanned;
        totals.accepted += pageResult.accepted;
        totals.stored += pageResult.stored;
        totals.skipped += pageResult.skipped;
        totals.errors += pageResult.errors.length;
        pagesProcessed += 1;

        const finishedAt = nowIso();
        await writeRunLog({
          scopeKey,
          cycleNumber: state.cycleNumber,
          source: currentSource,
          page: job.nextPage,
          scanned: pageResult.scanned,
          accepted: pageResult.accepted,
          stored: pageResult.stored,
          skipped: pageResult.skipped,
          errors: pageResult.errors.length,
          reachedEnd: pageResult.reachedEnd,
          startedAt: new Date(runStartedAt).toISOString(),
          finishedAt,
          durationMs: Date.now() - runStartedAt,
          errorMessages: pageResult.errors.map((entry) => entry.message),
        });

        const nextJobPatch: Partial<OwnerListingSyncCycleJob> = {
          cycleNumber: state.cycleNumber,
          source: currentSource,
          status: pageResult.reachedEnd ? 'done' : 'running',
          nextPage: pageResult.reachedEnd ? job.nextPage : job.nextPage + 1,
          pagesProcessed: job.pagesProcessed + 1,
          scanned: job.scanned + pageResult.scanned,
          accepted: job.accepted + pageResult.accepted,
          stored: job.stored + pageResult.stored,
          skipped: job.skipped + pageResult.skipped,
          errors: job.errors + pageResult.errors.length,
          lastRunAt: finishedAt,
          lastSuccessAt: finishedAt,
          finishedAt: pageResult.reachedEnd ? finishedAt : undefined,
          lastError: null as never,
          updatedAt: finishedAt,
        };

        await cycleJobDocRef(scopeKey, currentSource).set(
          withoutUndefined({
            ...nextJobPatch,
            firestoreUpdatedAt: FieldValue.serverTimestamp(),
          }),
          { merge: true }
        );

        job = {
          ...job,
          ...nextJobPatch,
        } as OwnerListingSyncCycleJob;

        if (pageResult.reachedEnd) {
          state.currentSourceIndex += 1;
          state.currentSource = CYCLE_SOURCE_ORDER[state.currentSourceIndex] || null;
          await cycleDocRef(scopeKey).set(
            buildCycleHeartbeatPatch(state, {
              currentSourceIndex: state.currentSourceIndex,
              currentSource: state.currentSource,
              lastError: null as never,
            }),
            { merge: true }
          );
          message = `${currentSource} a fost finalizat; trecem mai departe.`;
        } else {
          message = `${currentSource} a procesat pagina ${job.nextPage - 1}.`;
          await cycleDocRef(scopeKey).set(
            buildCycleHeartbeatPatch(state, {
              currentSourceIndex: state.currentSourceIndex,
              currentSource,
              lastError: null as never,
            }),
            { merge: true }
          );
        }
      } catch (error) {
        const finishedAt = nowIso();
        totals.errors += 1;
        await cycleJobDocRef(scopeKey, currentSource).set(
          {
            status: 'failed',
            errors: job.errors + 1,
            lastRunAt: finishedAt,
            lastError: error instanceof Error ? error.message : 'Procesarea paginii a esuat.',
            updatedAt: finishedAt,
            firestoreUpdatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        await writeRunLog({
          scopeKey,
          cycleNumber: state.cycleNumber,
          source: currentSource,
          page: job.nextPage,
          scanned: 0,
          accepted: 0,
          stored: 0,
          skipped: 0,
          errors: 1,
          reachedEnd: false,
          startedAt: new Date(runStartedAt).toISOString(),
          finishedAt,
          durationMs: Date.now() - runStartedAt,
          errorMessages: [error instanceof Error ? error.message : 'Procesarea paginii a esuat.'],
        });

        await cycleDocRef(scopeKey).set(
          buildCycleHeartbeatPatch(state, {
            status: 'running',
            currentSourceIndex: state.currentSourceIndex,
            currentSource,
            lastError: error instanceof Error ? error.message : 'Procesarea paginii a esuat.',
          }),
          { merge: true }
        );

        message = `${currentSource} a esuat pe pagina ${job.nextPage}; va fi reincercat la urmatorul tick.`;
        break;
      }
    }

    if (!state.currentSource && state.status === 'running') {
      const cooldownState = await markCycleCooldown(state);
      state = {
        ...state,
        status: 'cooldown',
        cooldownUntil: cooldownState.cooldownUntil,
        baselineStatus: cooldownState.baselineStatus,
        baselineCycleNumber: cooldownState.baselineCycleNumber,
        baselineCompletedAt: cooldownState.baselineCompletedAt,
      };
      message = 'Ciclul s-a incheiat si a intrat in cooldown.';
    }

    const latestStateSnapshot = await cycleDocRef(scopeKey).get();
    const latestState = latestStateSnapshot.exists ? (latestStateSnapshot.data() as OwnerListingSyncCycleState) : state;

    return {
      scopeKey,
      scopeLabel,
      cycleNumber: latestState.cycleNumber,
      baselineStatus: latestState.baselineStatus,
      status: latestState.status,
      currentSource: latestState.currentSource,
      pagesProcessed,
      cooldownUntil: latestState.cooldownUntil,
      summary: totals,
      message,
    };
  } finally {
    await releaseCycleLock(scopeKey, acquired.lockId, {});
  }
}

export async function runOwnerListingsSyncSchedulerTick(
  options: SchedulerTickOptions = {}
): Promise<OwnerListingSyncTickResult> {
  const startedAt = nowIso();
  const targets = listTargetScopes(options.scopeKey);
  const scopes: OwnerListingSyncTickScopeResult[] = [];

  for (const scope of targets) {
    scopes.push(await processScopeCycleTick(scope.key, scope.displayName, options));
  }

  return {
    startedAt,
    finishedAt: nowIso(),
    scopes,
  };
}
