import type { DocumentReference } from 'firebase-admin/firestore';
import { adminDb } from '@/firebase/admin';
import { syncOwnerListings } from '@/lib/owner-listings';
import type { OwnerListingSource, OwnerListingSyncResult } from '@/lib/owner-listings/types';

export const OWNER_LISTINGS_CRON_SECRET_HEADER = 'x-owner-listings-cron-secret';

export function isValidOwnerListingsCronSecret(secret: string | null | undefined) {
  const expected = process.env.OWNER_LISTINGS_CRON_SECRET;
  return Boolean(expected) && Boolean(secret) && secret === expected;
}

type BackgroundSyncOptions = {
  agencyId?: string | null;
  sources?: OwnerListingSource[];
  hardPageLimit?: number;
};

type AgencyJobResult = {
  agencyId: string;
  agencyName: string;
  result?: OwnerListingSyncResult;
  error?: string;
};

type BackgroundJobMode = 'background' | 'manual';

type QueuedBackgroundSyncOptions = BackgroundSyncOptions & {
  mode?: BackgroundJobMode;
};

async function executeOwnerListingsBackgroundSync(jobRef: DocumentReference, options: QueuedBackgroundSyncOptions) {
  const sources = options.sources || ['olx', 'imoradar24', 'publi24'];

  const agenciesSnapshot = options.agencyId
    ? await adminDb.collection('agencies').where('__name__', '==', options.agencyId).get()
    : await adminDb.collection('agencies').where('city', '==', 'Bucuresti-Ilfov').get();

  const agencyResults: AgencyJobResult[] = [];

  for (const agencyDoc of agenciesSnapshot.docs) {
    const agencyData = agencyDoc.data() as { name?: string } | undefined;
    try {
      const result = await syncOwnerListings(agencyDoc.id, sources, {
        maxPages: null,
        hardPageLimit: options.hardPageLimit || 250,
        maxAgeDays: 60,
      });
      agencyResults.push({
        agencyId: agencyDoc.id,
        agencyName: agencyData?.name || agencyDoc.id,
        result,
      });
    } catch (error) {
      agencyResults.push({
        agencyId: agencyDoc.id,
        agencyName: agencyData?.name || agencyDoc.id,
        error: error instanceof Error ? error.message : 'Sincronizarea agentiei a esuat.',
      });
    }
  }

  const finishedAt = new Date().toISOString();
  const summary = agencyResults.reduce(
    (accumulator, agencyResult) => {
      if (agencyResult.result) {
        accumulator.scanned += agencyResult.result.scanned;
        accumulator.accepted += agencyResult.result.accepted;
        accumulator.stored += agencyResult.result.stored;
        accumulator.skipped += agencyResult.result.skipped;
        accumulator.errors += agencyResult.result.errors.length;
      }

      if (agencyResult.error) {
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
      agencies: agencyResults,
    },
    { merge: true }
  );

  return {
    jobId: jobRef.id,
    finishedAt,
    summary,
    agencies: agencyResults,
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
    agencyId: options.agencyId || null,
    sources,
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
    agencyId: options.agencyId || null,
    sources,
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
