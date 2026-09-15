import { createHash, timingSafeEqual } from 'node:crypto';
import { adminDb } from '@/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { decryptTikTokSecret, encryptTikTokSecret } from './crypto';
import { TikTokAdsError } from './errors';
import { TikTokMcpAdapter } from './mcp-adapter';
import { OPERATION_CLASS } from './capabilities';
import { getAdvertiser } from './store';
import type { TikTokCapability } from './types';

const COLLECTION = 'tiktokAdsJobs';
const MAX_ATTEMPTS = 5;
const adapter = new TikTokMcpAdapter();

type TikTokJob = {
  organizationId: string;
  kind: 'advertiser_discovery' | 'capability_discovery' | 'capability_read';
  capability?: TikTokCapability | null;
  advertiserId?: string | null;
  propertyId?: string | null;
  encryptedPayload?: string | null;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  attempts: number;
  recurrenceMinutes?: number | null;
  nextAttemptAt: string;
  leaseUntil?: string | null;
  leaseOwner?: string | null;
  createdByUid: string;
  createdAt: string;
  updatedAt: string;
};

function nowIso() {
  return new Date().toISOString();
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function isValidTikTokWorkerSecret(candidate: string | null | undefined) {
  const expected = process.env.TIKTOK_ADS_WORKER_SECRET || '';
  if (Buffer.byteLength(expected, 'utf8') < 32 || !candidate) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(candidate);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function enqueueTikTokAdsJob(input: {
  organizationId: string;
  createdByUid: string;
  kind: TikTokJob['kind'];
  capability?: TikTokCapability | null;
  advertiserId?: string | null;
  propertyId?: string | null;
  payload?: Record<string, unknown>;
  recurrenceMinutes?: number | null;
  runAt?: string | null;
}) {
  if (input.kind === 'capability_read') {
    if (!input.capability || OPERATION_CLASS[input.capability] !== 'READ_ONLY') {
      throw new TikTokAdsError('INVALID_REQUEST', 'Worker-ul TikTok acceptă numai capabilities READ_ONLY.');
    }
    if (!input.advertiserId) throw new TikTokAdsError('INVALID_REQUEST', 'advertiserId este obligatoriu pentru job-ul de citire.');
  }
  if (input.advertiserId) await getAdvertiser(input.organizationId, input.advertiserId);
  const recurrenceMinutes = input.recurrenceMinutes == null
    ? null
    : Math.max(5, Math.min(Math.trunc(input.recurrenceMinutes), 24 * 60));
  const id = hash([input.organizationId, input.kind, input.capability || '', input.advertiserId || '', input.propertyId || ''].join('|'));
  const serializedPayload = JSON.stringify(input.payload || {});
  if (serializedPayload.length > 500_000) throw new TikTokAdsError('INVALID_REQUEST', 'Payload-ul job-ului TikTok este prea mare.');
  const ref = adminDb.collection(COLLECTION).doc(id);
  await adminDb.runTransaction(async (transaction) => {
    const existing = await transaction.get(ref);
    const current = existing.data() as TikTokJob | undefined;
    if (current?.status === 'running' && current.leaseUntil && Date.parse(current.leaseUntil) > Date.now()) {
      throw new TikTokAdsError('CONFLICT', 'Job-ul TikTok este deja în curs.');
    }
    const now = nowIso();
    transaction.set(ref, {
      organizationId: input.organizationId,
      kind: input.kind,
      capability: input.capability || null,
      advertiserId: input.advertiserId || null,
      propertyId: input.propertyId || null,
      encryptedPayload: encryptTikTokSecret(serializedPayload, 'job-payload'),
      status: 'queued',
      attempts: 0,
      recurrenceMinutes,
      nextAttemptAt: input.runAt && Date.parse(input.runAt) > Date.now() ? input.runAt : now,
      leaseUntil: null,
      leaseOwner: null,
      createdByUid: input.createdByUid,
      createdAt: current?.createdAt || now,
      updatedAt: now,
      lastErrorCode: null,
    }, { merge: true });
  });
  return { jobId: id, status: 'queued' as const };
}

async function recoverExpiredLeases(limit: number) {
  const snapshot = await adminDb.collection(COLLECTION)
    .where('status', '==', 'running')
    .where('leaseUntil', '<=', nowIso())
    .limit(limit)
    .get();
  if (snapshot.empty) return;
  const batch = adminDb.batch();
  snapshot.docs.forEach((doc) => batch.set(doc.ref, { status: 'queued', leaseUntil: null, leaseOwner: null, nextAttemptAt: nowIso(), updatedAt: nowIso() }, { merge: true }));
  await batch.commit();
}

async function claimJob(ref: FirebaseFirestore.DocumentReference, workerId: string) {
  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const job = snapshot.data() as TikTokJob | undefined;
    if (!job || job.status !== 'queued' || Date.parse(job.nextAttemptAt) > Date.now()) return null;
    transaction.update(ref, {
      status: 'running',
      leaseOwner: workerId,
      leaseUntil: new Date(Date.now() + 10 * 60_000).toISOString(),
      attempts: job.attempts + 1,
      updatedAt: nowIso(),
    });
    return { ...job, attempts: job.attempts + 1 };
  });
}

async function executeJob(jobId: string, job: TikTokJob) {
  if (job.kind === 'capability_discovery') {
    await adapter.discoverCapabilities(job.organizationId, true);
    return;
  }
  if (job.kind === 'advertiser_discovery') {
    await adapter.synchronizeAdvertisers(job.organizationId, 'system:tiktok-ads-worker');
    return;
  }
  if (!job.capability || !job.advertiserId || OPERATION_CLASS[job.capability] !== 'READ_ONLY') {
    throw new TikTokAdsError('INVALID_REQUEST', 'Job TikTok READ_ONLY invalid.');
  }
  const payload = JSON.parse(decryptTikTokSecret(job.encryptedPayload || '', 'job-payload')) as Record<string, unknown>;
  await adapter.execute({
    organizationId: job.organizationId,
    actor: { uid: 'system:tiktok-ads-worker', role: 'admin', type: 'system' },
    capability: job.capability,
    advertiserId: job.advertiserId,
    propertyId: job.propertyId || null,
    payload,
    idempotencyKey: `worker_${jobId}`,
    correlationId: `tiktok-job-${jobId}`,
  });
}

async function settleJob(ref: FirebaseFirestore.DocumentReference, job: TikTokJob, error?: unknown) {
  const now = Date.now();
  if (!error) {
    const recurring = Boolean(job.recurrenceMinutes);
    await ref.set({
      status: recurring ? 'queued' : 'completed',
      nextAttemptAt: recurring ? new Date(now + Number(job.recurrenceMinutes) * 60_000).toISOString() : nowIso(),
      leaseOwner: null,
      leaseUntil: null,
      lastErrorCode: null,
      attempts: 0,
      lastCompletedAt: nowIso(),
      updatedAt: nowIso(),
      expiresAt: recurring ? null : Timestamp.fromMillis(now + 90 * 24 * 60 * 60_000),
    }, { merge: true });
    return;
  }
  const code = error instanceof TikTokAdsError ? error.code : 'PROVIDER_UNAVAILABLE';
  const retryable = error instanceof TikTokAdsError && error.retryable
    || ['RATE_LIMITED', 'TIMEOUT', 'PROVIDER_UNAVAILABLE', 'CONFLICT'].includes(code);
  const retry = retryable && job.attempts < MAX_ATTEMPTS;
  const backoffMs = Math.min(15 * 60_000, 15_000 * 2 ** Math.max(0, job.attempts - 1)) + Math.floor(Math.random() * 2_000);
  await ref.set({
    status: retry ? 'queued' : 'failed',
    nextAttemptAt: retry ? new Date(now + backoffMs).toISOString() : nowIso(),
    leaseOwner: null,
    leaseUntil: null,
    lastErrorCode: code,
    updatedAt: nowIso(),
    expiresAt: retry || job.recurrenceMinutes ? null : Timestamp.fromMillis(now + 90 * 24 * 60 * 60_000),
  }, { merge: true });
}

export async function drainTikTokAdsJobs(options: { limit?: number; concurrency?: number; maxRuntimeMs?: number } = {}) {
  const limit = Math.max(1, Math.min(Math.trunc(options.limit || 20), 100));
  const concurrency = Math.max(1, Math.min(Math.trunc(options.concurrency || 4), 8));
  const deadline = Date.now() + Math.max(5_000, Math.min(Math.trunc(options.maxRuntimeMs || 50_000), 55_000));
  await recoverExpiredLeases(limit);
  const snapshot = await adminDb.collection(COLLECTION)
    .where('status', '==', 'queued')
    .where('nextAttemptAt', '<=', nowIso())
    .orderBy('nextAttemptAt', 'asc')
    .limit(Math.min(500, limit * 5))
    .get();
  const fair: typeof snapshot.docs = [];
  const seenOrganizations = new Set<string>();
  for (const doc of snapshot.docs) {
    const organizationId = String(doc.data().organizationId || '');
    if (organizationId && !seenOrganizations.has(organizationId)) {
      fair.push(doc);
      seenOrganizations.add(organizationId);
      if (fair.length === limit) break;
    }
  }
  if (fair.length < limit) {
    for (const doc of snapshot.docs) {
      if (!fair.includes(doc)) fair.push(doc);
      if (fair.length === limit) break;
    }
  }
  const workerId = `worker-${hash(`${nowIso()}|${Math.random()}`).slice(0, 16)}`;
  let completed = 0;
  let failed = 0;
  for (let offset = 0; offset < fair.length && Date.now() < deadline; offset += concurrency) {
    await Promise.all(fair.slice(offset, offset + concurrency).map(async (doc) => {
      const claimed = await claimJob(doc.ref, workerId);
      if (!claimed) return;
      try {
        await executeJob(doc.id, claimed);
        await settleJob(doc.ref, claimed);
        completed += 1;
      } catch (error) {
        await settleJob(doc.ref, claimed, error);
        console.error(JSON.stringify({
          event: 'tiktok_ads_job_failure',
          jobId: doc.id,
          organizationHash: hash(claimed.organizationId).slice(0, 12),
          errorCode: error instanceof TikTokAdsError ? error.code : 'PROVIDER_UNAVAILABLE',
          attempt: claimed.attempts,
        }));
        failed += 1;
      }
    }));
  }
  return { scanned: snapshot.size, claimed: completed + failed, completed, failed };
}

export async function disableTikTokAdsJobs(organizationId: string) {
  const snapshot = await adminDb.collection(COLLECTION).where('organizationId', '==', organizationId).limit(500).get();
  for (let offset = 0; offset < snapshot.docs.length; offset += 400) {
    const batch = adminDb.batch();
    for (const doc of snapshot.docs.slice(offset, offset + 400)) {
      batch.set(doc.ref, {
        status: 'cancelled',
        recurrenceMinutes: null,
        leaseOwner: null,
        leaseUntil: null,
        lastErrorCode: 'CONNECTION_REVOKED',
        updatedAt: nowIso(),
        expiresAt: Timestamp.fromMillis(Date.now() + 90 * 24 * 60 * 60_000),
      }, { merge: true });
    }
    await batch.commit();
  }
}
