import crypto from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/firebase/admin';
import { syncOwnerListingsSourcePage } from '@/lib/owner-listings/index';
import { resolveAgencyOwnerListingScope } from '@/lib/owner-listings/scope';
import type {
  OwnerListingSource,
  OwnerListingSyncCycleJob,
  OwnerListingSyncCycleJobStatus,
  OwnerListingSyncCycleState,
  OwnerListingSyncRun,
  OwnerListingSyncTickAgencyResult,
  OwnerListingSyncTickResult,
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
  agencyId?: string | null;
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

function cycleDocRef(agencyId: string) {
  return adminDb.collection(CYCLE_COLLECTION).doc(agencyId);
}

function cycleJobDocRef(agencyId: string, source: OwnerListingSource) {
  return adminDb.collection(CYCLE_JOB_COLLECTION).doc(`${agencyId}_${source}`);
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

function buildBaseCycleState(input: {
  agencyId: string;
  agencyName: string;
  scopeKey: string;
  scopeCity: string;
  cycleNumber: number;
  hardPageLimit?: number;
  maxAgeDays?: number;
  maxListingsPerSource?: number | null;
  maxPagesPerTick?: number;
  maxRuntimeMs?: number;
  createdAt?: string;
}): OwnerListingSyncCycleState {
  const timestamp = input.createdAt || nowIso();
  return {
    agencyId: input.agencyId,
    agencyName: input.agencyName,
    scopeKey: input.scopeKey,
    scopeCity: input.scopeCity,
    cycleNumber: input.cycleNumber,
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
  agencyId: string,
  cycleNumber: number,
  source: OwnerListingSource,
  status: OwnerListingSyncCycleJobStatus = 'pending'
): OwnerListingSyncCycleJob {
  const timestamp = nowIso();
  return {
    agencyId,
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

async function listTargetAgencies(agencyId?: string | null) {
  const agenciesSnapshot = agencyId
    ? await adminDb.collection('agencies').where('__name__', '==', agencyId).get()
    : await adminDb.collection('agencies').where('city', '==', 'Bucuresti-Ilfov').get();

  return agenciesSnapshot.docs.map((doc) => {
    const data = doc.data() as { name?: string; city?: string } | undefined;
    return {
      agencyId: doc.id,
      agencyName: data?.name || doc.id,
      city: data?.city || '',
      agency: data,
    };
  });
}

async function acquireCycleLock(
  agencyId: string,
  agencyName: string,
  options: SchedulerTickOptions
): Promise<AcquireCycleLockResult | null> {
  const stateRef = cycleDocRef(agencyId);
  const lockId = crypto.randomUUID();

  return adminDb.runTransaction(async (transaction) => {
    const agencySnapshot = await transaction.get(adminDb.collection('agencies').doc(agencyId));
    const agency = agencySnapshot.data() as import('@/lib/types').Agency | undefined;
    const scope = resolveAgencyOwnerListingScope(agency);
    if (!scope) {
      return null;
    }

    const existingSnapshot = await transaction.get(stateRef);
    const existing = existingSnapshot.exists
      ? (existingSnapshot.data() as OwnerListingSyncCycleState)
      : buildBaseCycleState({
          agencyId,
          agencyName,
          scopeKey: scope.key,
          scopeCity: scope.displayName,
          cycleNumber: 0,
          hardPageLimit: options.hardPageLimit,
          maxAgeDays: options.maxAgeDays,
          maxListingsPerSource: options.maxListingsPerSource,
          maxPagesPerTick: options.maxPagesPerTick,
          maxRuntimeMs: options.maxRuntimeMs,
        });

    const lockedAtMs = existing.lockedAt ? new Date(existing.lockedAt).getTime() : 0;
    if (existing.lockedBy && lockedAtMs && Date.now() - lockedAtMs < LOCK_STALE_MS) {
      return null;
    }

    const nextState: OwnerListingSyncCycleState = {
      ...existing,
      agencyId,
      agencyName,
      scopeKey: scope.key,
      scopeCity: scope.displayName,
      hardPageLimit: options.hardPageLimit ?? existing.hardPageLimit ?? DEFAULT_HARD_PAGE_LIMIT,
      maxAgeDays: options.maxAgeDays ?? existing.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS,
      maxListingsPerSource: options.maxListingsPerSource ?? existing.maxListingsPerSource ?? null,
      maxPagesPerTick: options.maxPagesPerTick ?? existing.maxPagesPerTick ?? DEFAULT_MAX_PAGES_PER_TICK,
      maxRuntimeMs: options.maxRuntimeMs ?? existing.maxRuntimeMs ?? DEFAULT_MAX_RUNTIME_MS,
      lockedBy: lockId,
      lockedAt: nowIso(),
      updatedAt: nowIso(),
      createdAt: existing.createdAt || nowIso(),
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

async function releaseCycleLock(agencyId: string, lockId: string, patch: Partial<OwnerListingSyncCycleState>) {
  const stateRef = cycleDocRef(agencyId);
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
      updatedAt: nowIso(),
      firestoreUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function ensureCycleJobs(agencyId: string, cycleNumber: number) {
  const batch = adminDb.batch();
  for (const source of CYCLE_SOURCE_ORDER) {
    batch.set(cycleJobDocRef(agencyId, source), buildCycleJobState(agencyId, cycleNumber, source));
  }
  await batch.commit();
}

async function startNewCycle(state: OwnerListingSyncCycleState) {
  const nextCycleNumber = (state.cycleNumber || 0) + 1;
  const startedAt = nowIso();
  await ensureCycleJobs(state.agencyId, nextCycleNumber);

  const nextState: Partial<OwnerListingSyncCycleState> = {
    cycleNumber: nextCycleNumber,
    status: 'running',
    currentSourceIndex: 0,
    currentSource: CYCLE_SOURCE_ORDER[0],
    cycleStartedAt: startedAt,
    cycleFinishedAt: null as never,
    cooldownUntil: null as never,
    lastError: null as never,
    lastHeartbeatAt: startedAt,
  };

  await cycleDocRef(state.agencyId).set(
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

async function getCycleJob(agencyId: string, source: OwnerListingSource, cycleNumber: number) {
  const jobRef = cycleJobDocRef(agencyId, source);
  const snapshot = await jobRef.get();
  if (snapshot.exists) {
    return snapshot.data() as OwnerListingSyncCycleJob;
  }

  const nextJob = buildCycleJobState(agencyId, cycleNumber, source);
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
  await cycleDocRef(state.agencyId).set(
    {
      status: 'cooldown',
      currentSource: null,
      currentSourceIndex: CYCLE_SOURCE_ORDER.length,
      cycleFinishedAt: finishedAt,
      cooldownUntil,
      lastHeartbeatAt: finishedAt,
      lastError: null,
      firestoreUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return cooldownUntil;
}

async function processAgencyCycleTick(
  agencyId: string,
  agencyName: string,
  options: SchedulerTickOptions
): Promise<OwnerListingSyncTickAgencyResult> {
  const acquired = await acquireCycleLock(agencyId, agencyName, options);
  if (!acquired) {
    const snapshot = await cycleDocRef(agencyId).get();
    const current = snapshot.exists ? (snapshot.data() as OwnerListingSyncCycleState) : null;
    return {
      agencyId,
      agencyName,
      cycleNumber: current?.cycleNumber || 0,
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
        agencyId,
        agencyName,
        cycleNumber: state.cycleNumber,
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
      message = 'A fost pornit un ciclu nou.';
    }

    while (pagesProcessed < (state.maxPagesPerTick || DEFAULT_MAX_PAGES_PER_TICK) && Date.now() - tickStartedAt < (state.maxRuntimeMs || DEFAULT_MAX_RUNTIME_MS)) {
      const currentSource = state.currentSource || CYCLE_SOURCE_ORDER[state.currentSourceIndex] || null;
      if (!currentSource) {
        const cooldownUntil = await markCycleCooldown(state);
        state = {
          ...state,
          status: 'cooldown',
          currentSource: null,
          currentSourceIndex: CYCLE_SOURCE_ORDER.length,
          cycleFinishedAt: nowIso(),
          cooldownUntil,
        };
        message = 'Ciclul s-a incheiat si a intrat in cooldown.';
        break;
      }

      let job = await getCycleJob(agencyId, currentSource, state.cycleNumber);
      if (job.status === 'done') {
        state.currentSourceIndex += 1;
        state.currentSource = CYCLE_SOURCE_ORDER[state.currentSourceIndex] || null;
        await cycleDocRef(agencyId).set(
          {
            currentSourceIndex: state.currentSourceIndex,
            currentSource: state.currentSource,
            lastHeartbeatAt: nowIso(),
            firestoreUpdatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
        continue;
      }

      await cycleJobDocRef(agencyId, currentSource).set(
        {
          status: 'running',
          startedAt: job.startedAt || nowIso(),
          lastRunAt: nowIso(),
          updatedAt: nowIso(),
          firestoreUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      const runStartedAt = Date.now();
      try {
        const pageResult = await syncOwnerListingsSourcePage(agencyId, currentSource, job.nextPage, {
          hardPageLimit: state.hardPageLimit,
          maxAgeDays: state.maxAgeDays,
          maxListingsPerSource: state.maxListingsPerSource ?? undefined,
        });

        totals.scanned += pageResult.scanned;
        totals.accepted += pageResult.accepted;
        totals.stored += pageResult.stored;
        totals.skipped += pageResult.skipped;
        totals.errors += pageResult.errors.length;
        pagesProcessed += 1;

        const finishedAt = nowIso();
        await writeRunLog({
          agencyId,
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

        await cycleJobDocRef(agencyId, currentSource).set(
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
          await cycleDocRef(agencyId).set(
            {
              currentSourceIndex: state.currentSourceIndex,
              currentSource: state.currentSource,
              lastHeartbeatAt: finishedAt,
              lastError: null,
              firestoreUpdatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
          message = `${currentSource} a fost finalizat; trecem mai departe.`;
        } else {
          message = `${currentSource} a procesat pagina ${job.nextPage - 1}.`;
          await cycleDocRef(agencyId).set(
            {
              currentSourceIndex: state.currentSourceIndex,
              currentSource,
              lastHeartbeatAt: finishedAt,
              lastError: null,
              firestoreUpdatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch (error) {
        const finishedAt = nowIso();
        totals.errors += 1;
        await cycleJobDocRef(agencyId, currentSource).set(
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
          agencyId,
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
        await cycleDocRef(agencyId).set(
          {
            status: 'running',
            currentSourceIndex: state.currentSourceIndex,
            currentSource,
            lastHeartbeatAt: finishedAt,
            lastError: error instanceof Error ? error.message : 'Procesarea paginii a esuat.',
            firestoreUpdatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        message = `${currentSource} a esuat pe pagina ${job.nextPage}; va fi reincercat la urmatorul tick.`;
        break;
      }
    }

    if (!state.currentSource && state.status === 'running') {
      const cooldownUntil = await markCycleCooldown(state);
      state = {
        ...state,
        status: 'cooldown',
        cooldownUntil,
      };
      message = 'Ciclul s-a incheiat si a intrat in cooldown.';
    }

    const latestStateSnapshot = await cycleDocRef(agencyId).get();
    const latestState = latestStateSnapshot.exists
      ? (latestStateSnapshot.data() as OwnerListingSyncCycleState)
      : state;

    return {
      agencyId,
      agencyName,
      cycleNumber: latestState.cycleNumber,
      status: latestState.status,
      currentSource: latestState.currentSource,
      pagesProcessed,
      cooldownUntil: latestState.cooldownUntil,
      summary: totals,
      message,
    };
  } finally {
    await releaseCycleLock(agencyId, acquired.lockId, {});
  }
}

export async function runOwnerListingsSyncSchedulerTick(
  options: SchedulerTickOptions = {}
): Promise<OwnerListingSyncTickResult> {
  const startedAt = nowIso();
  const targets = await listTargetAgencies(options.agencyId);
  const agencies: OwnerListingSyncTickAgencyResult[] = [];

  for (const target of targets) {
    agencies.push(await processAgencyCycleTick(target.agencyId, target.agencyName, options));
  }

  return {
    startedAt,
    finishedAt: nowIso(),
    agencies,
  };
}
