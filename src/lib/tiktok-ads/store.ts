import { createHash, randomUUID } from 'node:crypto';
import { adminDb } from '@/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { TikTokAdsError } from './errors';
import { decryptTikTokSecret, encryptTikTokSecret, sha256Hex } from './crypto';
import { hashOperationIntent } from './policy';
import type {
  TikTokAdvertiserRecord,
  TikTokAccountPermissionRecord,
  TikTokCapability,
  TikTokCapabilityResolution,
  TikTokMcpTool,
  TikTokOperationRequest,
  TikTokOperationResult,
  TikTokResourceType,
} from './types';

function agencyRef(organizationId: string) {
  return adminDb.collection('agencies').doc(organizationId);
}

function resourceReferenceId(advertiserId: string, resourceType: TikTokResourceType, resourceId: string) {
  return `${advertiserId}__${resourceType}__${resourceId}`;
}

export async function getAdvertiser(organizationId: string, advertiserId: string) {
  const snapshot = await agencyRef(organizationId).collection('tiktokAdvertisers').doc(advertiserId).get();
  if (!snapshot.exists) throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'Advertiser-ul TikTok nu este autorizat pentru organizația curentă.');
  const advertiser = snapshot.data() as TikTokAdvertiserRecord;
  if (advertiser.organizationId !== organizationId || advertiser.advertiserId !== advertiserId || !advertiser.authorized) {
    throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'Advertiser-ul TikTok nu este autorizat pentru organizația curentă.');
  }
  return advertiser;
}

export async function upsertAdvertiser(record: TikTokAdvertiserRecord) {
  await agencyRef(record.organizationId).collection('tiktokAdvertisers').doc(record.advertiserId).set(record, { merge: true });
}

export async function listAdvertisers(organizationId: string) {
  const snapshot = await agencyRef(organizationId).collection('tiktokAdvertisers').where('authorized', '==', true).limit(200).get();
  return snapshot.docs.map((doc) => doc.data() as TikTokAdvertiserRecord);
}

export async function selectAdvertiser(organizationId: string, advertiserId: string) {
  await getAdvertiser(organizationId, advertiserId);
  const advertisers = await listAdvertisers(organizationId);
  const batch = adminDb.batch();
  for (const advertiser of advertisers) {
    batch.set(agencyRef(organizationId).collection('tiktokAdvertisers').doc(advertiser.advertiserId), {
      selected: advertiser.advertiserId === advertiserId,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }
  batch.set(agencyRef(organizationId).collection('integrations').doc('tiktok_ads'), { advertiserId, updatedAt: new Date().toISOString() }, { merge: true });
  await batch.commit();
}

export async function clearSelectedAdvertiser(organizationId: string) {
  const advertisers = await listAdvertisers(organizationId);
  const batch = adminDb.batch();
  for (const advertiser of advertisers) {
    batch.set(agencyRef(organizationId).collection('tiktokAdvertisers').doc(advertiser.advertiserId), {
      selected: false,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }
  batch.set(agencyRef(organizationId).collection('integrations').doc('tiktok_ads'), { advertiserId: null, updatedAt: new Date().toISOString() }, { merge: true });
  await batch.commit();
}

export async function assertResourceOwnership(organizationId: string, resourceType: TikTokResourceType, resourceId: string, advertiserId?: string | null) {
  if (!advertiserId) throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'Advertiser-ul este obligatoriu pentru verificarea ownership-ului TikTok.');
  const collection = agencyRef(organizationId).collection('tiktokResourceReferences');
  const ref = collection.doc(resourceReferenceId(advertiserId, resourceType, resourceId));
  let snapshot = await ref.get();
  if (!snapshot.exists) {
    const legacy = await collection.doc(`${resourceType}__${resourceId}`).get();
    const legacyData = legacy.data() as { organizationId?: string; advertiserId?: string; active?: boolean } | undefined;
    if (legacy.exists && legacyData?.organizationId === organizationId && legacyData.advertiserId === advertiserId && legacyData.active !== false) {
      await ref.set({ ...legacyData, migratedFromLegacyAt: new Date().toISOString() }, { merge: true });
      snapshot = await ref.get();
    }
  }
  const data = snapshot.data() as { organizationId?: string; advertiserId?: string; active?: boolean } | undefined;
  if (!snapshot.exists || data?.organizationId !== organizationId || data.active === false || data.advertiserId !== advertiserId) {
    throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'Resursa TikTok nu aparține organizației și advertiser-ului curent.');
  }
}

export async function registerResource(input: {
  organizationId: string;
  advertiserId: string;
  resourceType: TikTokResourceType;
  resourceId: string;
  propertyId?: string | null;
  operationId: string;
  remoteSnapshot?: Record<string, unknown> | null;
}) {
  await agencyRef(input.organizationId).collection('tiktokResourceReferences').doc(resourceReferenceId(input.advertiserId, input.resourceType, input.resourceId)).set({
    organizationId: input.organizationId,
    advertiserId: input.advertiserId,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    propertyId: input.propertyId || null,
    operationId: input.operationId,
    active: true,
    remoteSnapshot: input.remoteSnapshot || null,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

export async function registerResources(inputs: Array<{
  organizationId: string;
  advertiserId: string;
  resourceType: TikTokResourceType;
  resourceId: string;
  propertyId?: string | null;
  operationId: string;
}>) {
  for (let offset = 0; offset < inputs.length; offset += 400) {
    const batch = adminDb.batch();
    for (const input of inputs.slice(offset, offset + 400)) {
      batch.set(agencyRef(input.organizationId).collection('tiktokResourceReferences').doc(resourceReferenceId(input.advertiserId, input.resourceType, input.resourceId)), {
        ...input,
        active: true,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }
    await batch.commit();
  }
}

export async function saveCapabilityResolutions(organizationId: string, resolutions: TikTokCapabilityResolution[]) {
  const batch = adminDb.batch();
  for (const resolution of resolutions) {
    batch.set(agencyRef(organizationId).collection('tiktokCapabilityStates').doc(resolution.capability), {
      organizationId,
      ...resolution,
      cacheExpiresAt: new Date(Date.now() + 6 * 60 * 60_000).toISOString(),
    }, { merge: true });
  }
  batch.set(agencyRef(organizationId).collection('integrations').doc('tiktok_ads'), {
    capabilityDiscoveryStatus: 'ready',
    capabilityDiscoveredAt: new Date().toISOString(),
    availableCapabilityCount: resolutions.filter((item) => item.executionAllowed).length,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  await batch.commit();
}

export async function loadCapabilityResolutions(organizationId: string) {
  const snapshot = await agencyRef(organizationId).collection('tiktokCapabilityStates').get();
  return snapshot.docs.map((doc) => doc.data() as TikTokCapabilityResolution);
}

export async function markCapabilityIncompatible(organizationId: string, capability: TikTokCapability, reason: string) {
  const now = new Date().toISOString();
  await Promise.all([
    agencyRef(organizationId).collection('tiktokCapabilityStates').doc(capability).set({
      organizationId,
      capability,
      available: false,
      executionAllowed: false,
      schemaStatus: 'changed',
      reason,
      invalidatedAt: now,
    }, { merge: true }),
    agencyRef(organizationId).collection('integrations').doc('tiktok_ads').set({
      capabilityDiscoveryStatus: 'schema_incompatible',
      lastErrorCode: 'SCHEMA_INCOMPATIBLE',
      updatedAt: now,
    }, { merge: true }),
  ]);
}

export async function appendAudit(input: {
  organizationId: string;
  actorUid?: string | null;
  operation: string;
  targetType?: string | null;
  targetId?: string | null;
  outcome: 'attempted' | 'succeeded' | 'failed' | 'partial';
  correlationId: string;
  safeMetadata?: Record<string, unknown>;
}) {
  await agencyRef(input.organizationId).collection('tiktokAuditEvents').add({
    organizationId: input.organizationId,
    actorUid: input.actorUid || null,
    operation: input.operation,
    targetType: input.targetType || null,
    targetId: input.targetId || null,
    outcome: input.outcome,
    correlationId: input.correlationId,
    safeMetadata: input.safeMetadata || {},
    createdAt: new Date().toISOString(),
    expiresAt: Timestamp.fromMillis(Date.now() + 7 * 365 * 24 * 60 * 60_000),
  });
}

export type OperationLedgerRecord = {
  organizationId: string;
  operationId: string;
  capability: TikTokCapability;
  actorUid: string;
  advertiserId?: string | null;
  propertyId?: string | null;
  idempotencyKey?: string | null;
  intentHash: string;
  currentStep: string;
  status: 'in_progress' | 'succeeded' | 'failed' | 'partial' | 'pending_recovery';
  createdResourceIds: Array<{ resourceType: string; resourceId: string }>;
  result?: TikTokOperationResult | null;
  createdAt: string;
  updatedAt: string;
  expiresAt?: Timestamp;
  retryCount: number;
  recoverable: boolean;
  lastErrorCode?: string | null;
  spendAuthorizedAt?: string | null;
  remoteOutcomeUnknown?: boolean;
  recoveredByUid?: string | null;
  recoveredAt?: string | null;
};

export async function beginOperation(request: TikTokOperationRequest) {
  const intentHash = hashOperationIntent({
    organizationId: request.organizationId,
    actorUid: request.actor.uid,
    capability: request.capability,
    advertiserId: request.advertiserId,
    propertyId: request.propertyId,
    payload: request.payload,
    idempotencyKey: request.idempotencyKey,
  });
  const operationId = request.idempotencyKey
    ? `idem_${createHashSafe(`${request.organizationId}|${request.capability}|${request.idempotencyKey}`)}`
    : randomUUID();
  const ref = agencyRef(request.organizationId).collection('tiktokOperationLedger').doc(operationId);
  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) {
      const existing = snapshot.data() as OperationLedgerRecord;
      if (existing.organizationId !== request.organizationId || existing.intentHash !== intentHash) {
        throw new TikTokAdsError('CONFLICT', 'Cheia de idempotency a fost folosită pentru o altă intenție.');
      }
      if (existing.status === 'succeeded' && existing.result) return { record: existing, cachedResult: existing.result };
      if (existing.status === 'pending_recovery' && existing.remoteOutcomeUnknown) {
        throw new TikTokAdsError('PARTIAL_FAILURE', 'Rezultatul remote este necunoscut. Reconciliază resursele TikTok și confirmă recovery înainte de retry.');
      }
      if (existing.status === 'in_progress' && Date.parse(existing.updatedAt) > Date.now() - 6 * 60_000) {
        throw new TikTokAdsError('CONFLICT', 'Această operație este deja în curs.');
      }
      transaction.update(ref, { status: 'in_progress', retryCount: existing.retryCount + 1, updatedAt: new Date().toISOString() });
      return { record: { ...existing, status: 'in_progress' as const, retryCount: existing.retryCount + 1 }, cachedResult: null };
    }
    const now = new Date().toISOString();
    const record: OperationLedgerRecord = {
      organizationId: request.organizationId,
      operationId,
      capability: request.capability,
      actorUid: request.actor.uid,
      advertiserId: request.advertiserId || null,
      propertyId: request.propertyId || null,
      idempotencyKey: request.idempotencyKey || null,
      intentHash,
      currentStep: 'authorized',
      status: 'in_progress',
      createdResourceIds: [],
      result: null,
      createdAt: now,
      updatedAt: now,
      expiresAt: Timestamp.fromMillis(Date.now() + 7 * 365 * 24 * 60 * 60_000),
      retryCount: 0,
      recoverable: true,
      lastErrorCode: null,
      spendAuthorizedAt: null,
      remoteOutcomeUnknown: false,
    };
    transaction.create(ref, record);
    return { record, cachedResult: null };
  });
}

function createHashSafe(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export async function updateOperation(organizationId: string, operationId: string, patch: Partial<OperationLedgerRecord>) {
  await agencyRef(organizationId).collection('tiktokOperationLedger').doc(operationId).set({ ...patch, updatedAt: new Date().toISOString() }, { merge: true });
}

export async function getOperation(organizationId: string, operationId: string) {
  const snapshot = await agencyRef(organizationId).collection('tiktokOperationLedger').doc(operationId).get();
  const data = snapshot.data() as OperationLedgerRecord | undefined;
  return snapshot.exists && data?.organizationId === organizationId ? data : null;
}

export async function acknowledgeOperationRecovery(input: {
  organizationId: string;
  operationId: string;
  actorUid: string;
  resources: Array<{ resourceType: TikTokResourceType; resourceId: string }>;
}) {
  const operation = await getOperation(input.organizationId, input.operationId);
  if (!operation || operation.status !== 'pending_recovery') {
    throw new TikTokAdsError('INVALID_REQUEST', 'Operația nu așteaptă recovery.');
  }
  for (const resource of input.resources) {
    await assertResourceOwnership(input.organizationId, resource.resourceType, resource.resourceId, operation.advertiserId);
  }
  const resources = Array.from(new Map([...operation.createdResourceIds, ...input.resources]
    .map((resource) => [`${resource.resourceType}:${resource.resourceId}`, resource])).values());
  await updateOperation(input.organizationId, input.operationId, {
    status: 'failed',
    currentStep: 'recovery_reconciled',
    createdResourceIds: resources,
    remoteOutcomeUnknown: false,
    recoverable: true,
    lastErrorCode: null,
    recoveredByUid: input.actorUid,
    recoveredAt: new Date().toISOString(),
  });
  return { operationId: input.operationId, createdResourceIds: resources, retryAllowed: true };
}

export async function acquireMutationLock(input: { organizationId: string; advertiserId: string; capability: TikTokCapability; resourceId?: string | null; owner: string }) {
  const scope = input.resourceId ? `resource|${input.resourceId}` : `create|${input.capability}`;
  const lockId = createHashSafe(`${input.advertiserId}|${scope}`);
  const ref = agencyRef(input.organizationId).collection('tiktokMutationLocks').doc(lockId);
  await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data() as { leaseUntil?: string; owner?: string } | undefined;
    if (data?.leaseUntil && Date.parse(data.leaseUntil) > Date.now() && data.owner !== input.owner) {
      throw new TikTokAdsError('CONFLICT', 'Resursa TikTok este modificată de o altă operație.');
    }
    transaction.set(ref, { organizationId: input.organizationId, owner: input.owner, scope, leaseUntil: new Date(Date.now() + 6 * 60_000).toISOString(), updatedAt: new Date().toISOString() }, { merge: true });
  });
  return async () => adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (snapshot.data()?.owner === input.owner) transaction.delete(ref);
  }).catch(() => undefined);
}

export async function acquireTenantProviderSlot(organizationId: string) {
  const configured = Number(process.env.TIKTOK_ADS_TENANT_MAX_CONCURRENT_CALLS || 4);
  const limit = Number.isFinite(configured) ? Math.max(1, Math.min(Math.trunc(configured), 20)) : 4;
  const leaseId = randomUUID();
  const ref = agencyRef(organizationId).collection('tiktokRateLimitState').doc('provider_calls');
  await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const stored = snapshot.data()?.leases as Record<string, string> | undefined;
    const leases = Object.fromEntries(Object.entries(stored || {}).filter(([, expiresAt]) => Date.parse(expiresAt) > Date.now()));
    if (Object.keys(leases).length >= limit) {
      throw new TikTokAdsError('RATE_LIMITED', 'Organizația are deja numărul maxim de apeluri TikTok concurente.', { retryable: true });
    }
    leases[leaseId] = new Date(Date.now() + 5 * 60_000).toISOString();
    transaction.set(ref, { organizationId, leases, updatedAt: new Date().toISOString() }, { merge: true });
  });
  return async () => {
    await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      const stored = snapshot.data()?.leases as Record<string, string> | undefined;
      const leases = Object.fromEntries(Object.entries(stored || {})
        .filter(([id, expiresAt]) => id !== leaseId && Date.parse(expiresAt) > Date.now()));
      transaction.set(ref, { leases, updatedAt: new Date().toISOString() }, { merge: true });
    }).catch(() => undefined);
  };
}

export async function saveToolCache(organizationId: string, tools: TikTokMcpTool[]) {
  const collection = agencyRef(organizationId).collection('tiktokMcpToolSchemas');
  const expiresAtIso = new Date(Date.now() + 6 * 60 * 60_000).toISOString();
  const expiresAt = Timestamp.fromDate(new Date(expiresAtIso));
  const generation = randomUUID();
  for (let offset = 0; offset < tools.length; offset += 400) {
    const batch = adminDb.batch();
    for (const tool of tools.slice(offset, offset + 400)) {
      batch.set(collection.doc(createHashSafe(tool.name)), { organizationId, generation, tool, expiresAt, updatedAt: new Date().toISOString() });
    }
    await batch.commit();
  }
  await agencyRef(organizationId).collection('tiktokSyncState').doc('mcp_tool_cache').set({ organizationId, generation, expiresAt, expiresAtIso, updatedAt: new Date().toISOString() });
}

export async function loadToolCache(organizationId: string) {
  const metadata = await agencyRef(organizationId).collection('tiktokSyncState').doc('mcp_tool_cache').get();
  const generation = metadata.data()?.generation;
  if (!metadata.exists || typeof generation !== 'string' || Date.parse(String(metadata.data()?.expiresAtIso || '')) <= Date.now()) return [];
  const snapshot = await agencyRef(organizationId).collection('tiktokMcpToolSchemas')
    .where('generation', '==', generation)
    .limit(500)
    .get();
  return snapshot.docs
    .map((doc) => doc.data())
    .filter((data) => data.organizationId === organizationId && data.tool)
    .map((data) => data.tool as TikTokMcpTool);
}

export async function getTikTokAccountPermission(organizationId: string, advertiserId: string, tiktokAccountId: string) {
  const snapshot = await agencyRef(organizationId).collection('tiktokAccountPermissions').doc(`${advertiserId}__${tiktokAccountId}`).get();
  const data = snapshot.data() as import('./types').TikTokAccountPermissionRecord | undefined;
  if (!snapshot.exists || data?.organizationId !== organizationId || data.advertiserId !== advertiserId || data.tiktokAccountId !== tiktokAccountId) {
    throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'Contul TikTok nu este autorizat pentru advertiser-ul curent.');
  }
  return data;
}

export async function upsertTikTokAccountPermission(record: import('./types').TikTokAccountPermissionRecord) {
  await agencyRef(record.organizationId).collection('tiktokAccountPermissions').doc(`${record.advertiserId}__${record.tiktokAccountId}`).set(record, { merge: true });
}

export async function listTikTokAccountPermissions(organizationId: string, advertiserId: string) {
  const snapshot = await agencyRef(organizationId).collection('tiktokAccountPermissions')
    .where('advertiserId', '==', advertiserId)
    .limit(200)
    .get();
  return snapshot.docs
    .map((doc) => doc.data() as TikTokAccountPermissionRecord)
    .filter((record) => record.organizationId === organizationId && record.advertiserId === advertiserId)
    .sort((left, right) => (left.username || left.tiktokAccountId).localeCompare(right.username || right.tiktokAccountId));
}

export async function listRecentTikTokOperations(organizationId: string, propertyId?: string | null) {
  const snapshot = await agencyRef(organizationId).collection('tiktokOperationLedger')
    .orderBy('updatedAt', 'desc')
    .limit(100)
    .get();
  return snapshot.docs
    .map((doc) => doc.data() as OperationLedgerRecord)
    .filter((record) => record.organizationId === organizationId && (!propertyId || record.propertyId === propertyId))
    .slice(0, 25);
}

export async function getOwnedStudioVideoAsset(organizationId: string, assetId: string) {
  const snapshot = await agencyRef(organizationId).collection('tiktokStudioAssets').doc(assetId).get();
  const data = snapshot.data() as {
    agencyId?: string;
    type?: string;
    status?: string;
    url?: string;
    mimeType?: string | null;
    sizeBytes?: number | null;
    durationSeconds?: number | null;
  } | undefined;
  if (!snapshot.exists || data?.agencyId !== organizationId || data.type !== 'video' || data.status !== 'ready' || !data.url) {
    throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'Asset-ul video Imodeus nu aparține organizației sau nu este pregătit.');
  }
  return { id: snapshot.id, ...data, url: data.url };
}

export async function findMediaMapping(organizationId: string, advertiserId: string, mediaAssetId: string) {
  const id = sha256Hex(`${advertiserId}|${mediaAssetId}`);
  const snapshot = await agencyRef(organizationId).collection('tiktokMediaMappings').doc(id).get();
  const data = snapshot.data() as { organizationId?: string; advertiserId?: string; mediaAssetId?: string; videoId?: string; active?: boolean } | undefined;
  if (!snapshot.exists || data?.organizationId !== organizationId || data.advertiserId !== advertiserId || data.mediaAssetId !== mediaAssetId || !data.videoId || data.active === false) return null;
  await assertResourceOwnership(organizationId, 'video', data.videoId, advertiserId);
  return { videoId: data.videoId };
}

export async function registerMediaMapping(input: {
  organizationId: string;
  advertiserId: string;
  mediaAssetId: string;
  videoId: string;
  propertyId?: string | null;
  operationId: string;
}) {
  const id = sha256Hex(`${input.advertiserId}|${input.mediaAssetId}`);
  await agencyRef(input.organizationId).collection('tiktokMediaMappings').doc(id).set({
    ...input,
    active: true,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

async function loadResourceOwnership(organizationId: string, advertiserId: string, resourceKeys: string[]) {
  const ownership = new Map<string, { propertyId?: string | null }>();
  const ids = Array.from(new Set(resourceKeys));
  for (let offset = 0; offset < ids.length; offset += 400) {
    const chunk = ids.slice(offset, offset + 400);
    const refs = chunk.map((id) => agencyRef(organizationId).collection('tiktokResourceReferences').doc(`${advertiserId}__${id}`));
    if (!refs.length) continue;
    const snapshots = await adminDb.getAll(...refs);
    const missing: string[] = [];
    snapshots.forEach((snapshot, index) => {
      const data = snapshot.data() as { organizationId?: string; advertiserId?: string; propertyId?: string | null } | undefined;
      if (data?.organizationId === organizationId && data.advertiserId === advertiserId) ownership.set(chunk[index], data);
      else missing.push(chunk[index]);
    });
    if (missing.length) {
      const legacySnapshots = await adminDb.getAll(...missing.map((id) => agencyRef(organizationId).collection('tiktokResourceReferences').doc(id)));
      legacySnapshots.forEach((snapshot, index) => {
        const data = snapshot.data() as { organizationId?: string; advertiserId?: string; propertyId?: string | null } | undefined;
        if (data?.organizationId === organizationId && data.advertiserId === advertiserId) ownership.set(missing[index], data);
      });
    }
  }
  return ownership;
}

function attributionResourceKeys(record: Record<string, unknown>) {
  return [
    typeof record.ad_id === 'string' ? `ad__${record.ad_id}` : null,
    typeof record.adgroup_id === 'string' ? `adgroup__${record.adgroup_id}` : null,
    typeof record.campaign_id === 'string' ? `campaign__${record.campaign_id}` : null,
  ].filter((value): value is string => Boolean(value));
}

export async function persistLeadRecords(input: {
  organizationId: string;
  advertiserId: string;
  leads: Array<{ remoteLeadId: string; data: Record<string, unknown> }>;
}) {
  const retentionDays = Math.max(1, Math.min(Number(process.env.TIKTOK_LEAD_RETENTION_DAYS || 365), 3650));
  const collection = agencyRef(input.organizationId).collection('tiktokLeadReferences');
  const unique = Array.from(new Map(input.leads.map((lead) => [lead.remoteLeadId, lead])).values());
  const ownership = await loadResourceOwnership(
    input.organizationId,
    input.advertiserId,
    unique.flatMap((lead) => attributionResourceKeys(lead.data))
  );
  const refs = unique.map((lead) => collection.doc(sha256Hex(`${input.advertiserId}|${lead.remoteLeadId}`)));
  const existingById = new Map<string, { organizationId?: string; advertiserId?: string; ingestedAt?: string; expiresAt?: Timestamp }>();
  for (let offset = 0; offset < refs.length; offset += 400) {
    const snapshots = await adminDb.getAll(...refs.slice(offset, offset + 400));
    snapshots.filter((snapshot) => snapshot.exists).forEach((snapshot) => {
      const data = snapshot.data() as { organizationId?: string; advertiserId?: string; ingestedAt?: string; expiresAt?: Timestamp };
      if (data.organizationId !== input.organizationId || data.advertiserId !== input.advertiserId) {
        throw new TikTokAdsError('TENANT_ACCESS_DENIED', 'Referința lead-ului TikTok aparține altui tenant sau advertiser.');
      }
      existingById.set(snapshot.id, data);
    });
  }
  for (let offset = 0; offset < unique.length; offset += 400) {
    const batch = adminDb.batch();
    for (const lead of unique.slice(offset, offset + 400)) {
      const id = sha256Hex(`${input.advertiserId}|${lead.remoteLeadId}`);
      const ref = collection.doc(id);
      const existing = existingById.get(id);
      const resourceKeys = attributionResourceKeys(lead.data);
      const propertyId = resourceKeys.map((key) => ownership.get(key)?.propertyId).find(Boolean) || null;
      const attribution = {
        campaignId: typeof lead.data.campaign_id === 'string' ? lead.data.campaign_id : null,
        adgroupId: typeof lead.data.adgroup_id === 'string' ? lead.data.adgroup_id : null,
        adId: typeof lead.data.ad_id === 'string' ? lead.data.ad_id : null,
        formId: typeof (lead.data.form_id || lead.data.page_id) === 'string' ? String(lead.data.form_id || lead.data.page_id) : null,
        tiktokAccountId: typeof (lead.data.tiktok_account_id || lead.data.identity_id) === 'string' ? String(lead.data.tiktok_account_id || lead.data.identity_id) : null,
        propertyId,
      };
      batch.set(ref, {
        organizationId: input.organizationId,
        advertiserId: input.advertiserId,
        remoteLeadId: lead.remoteLeadId,
        encryptedPayload: encryptTikTokSecret(JSON.stringify(lead.data), 'lead-pii'),
        ...attribution,
        source: 'tiktok',
        receivedAt: typeof lead.data.create_time === 'string' || typeof lead.data.create_time === 'number' ? String(lead.data.create_time) : null,
        ingestedAt: existing?.ingestedAt || new Date().toISOString(),
        expiresAt: existing?.expiresAt || Timestamp.fromMillis(Date.now() + retentionDays * 24 * 60 * 60_000),
      }, { merge: true });
    }
    await batch.commit();
  }
  const inserted = unique.filter((lead) => !existingById.has(sha256Hex(`${input.advertiserId}|${lead.remoteLeadId}`))).length;
  return { received: input.leads.length, inserted, duplicates: input.leads.length - inserted };
}

export async function getLeadForExport(organizationId: string, leadReferenceId: string) {
  const snapshot = await agencyRef(organizationId).collection('tiktokLeadReferences').doc(leadReferenceId).get();
  const data = snapshot.data() as { organizationId?: string; encryptedPayload?: string; [key: string]: unknown } | undefined;
  if (!snapshot.exists || data?.organizationId !== organizationId || !data.encryptedPayload) {
    throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'Lead-ul TikTok nu aparține organizației curente.');
  }
  const payload = JSON.parse(decryptTikTokSecret(data.encryptedPayload, 'lead-pii')) as Record<string, unknown>;
  const { encryptedPayload, ...metadata } = data;
  void encryptedPayload;
  return { id: snapshot.id, metadata, data: payload };
}

export async function deleteLead(organizationId: string, leadReferenceId: string) {
  const ref = agencyRef(organizationId).collection('tiktokLeadReferences').doc(leadReferenceId);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data()?.organizationId !== organizationId) {
    throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'Lead-ul TikTok nu aparține organizației curente.');
  }
  await ref.delete();
}

const REPORT_METRICS = new Set([
  'spend', 'impressions', 'reach', 'clicks', 'ctr', 'cpc', 'cpm', 'conversions',
  'leads', 'cost_per_lead', 'cpl', 'cpa', 'video_views', 'engagement',
]);

const REPORT_DIMENSIONS = new Set([
  'advertiser_id', 'campaign_id', 'adgroup_id', 'ad_id', 'identity_id', 'stat_time_day', 'date',
]);

export async function persistReportingRows(input: {
  organizationId: string;
  advertiserId: string;
  rows: Record<string, unknown>[];
  reportingTimezone?: string | null;
}) {
  const remoteIds = new Set<string>();
  input.rows.forEach((row) => {
    ['campaign_id', 'adgroup_id', 'ad_id'].forEach((key) => {
      if (typeof row[key] === 'string') remoteIds.add(`${key === 'campaign_id' ? 'campaign' : key === 'adgroup_id' ? 'adgroup' : 'ad'}__${row[key]}`);
    });
  });
  const ownership = await loadResourceOwnership(input.organizationId, input.advertiserId, Array.from(remoteIds));
  const writes: Array<{ id: string; data: Record<string, unknown> }> = [];
  for (const row of input.rows.slice(0, 10_000)) {
    const resourceKeys = attributionResourceKeys(row);
    const propertyId = resourceKeys.map((key) => ownership.get(key)?.propertyId).find(Boolean) || null;
    const date = typeof (row.stat_time_day || row.date) === 'string' ? String(row.stat_time_day || row.date).slice(0, 10) : 'aggregate';
    const dimensions = Object.fromEntries(Object.entries(row)
      .filter(([key, value]) => REPORT_DIMENSIONS.has(key) && (typeof value === 'string' || typeof value === 'number'))
      .map(([key, value]) => [key, String(value).slice(0, 256)]));
    const metrics = Object.fromEntries(Object.entries(row)
      .filter(([key, value]) => REPORT_METRICS.has(key) && (typeof value === 'string' || typeof value === 'number' && Number.isFinite(value)))
      .map(([key, value]) => [key, String(value)]));
    if (!Object.keys(metrics).length) continue;
    const id = sha256Hex(`${input.advertiserId}|${propertyId || 'unmapped'}|${date}|${JSON.stringify(dimensions)}`);
    writes.push({ id, data: {
      organizationId: input.organizationId,
      advertiserId: input.advertiserId,
      propertyId,
      date,
      dimensions,
      metrics,
      reportingTimezone: typeof row.timezone === 'string' ? row.timezone.slice(0, 100) : input.reportingTimezone?.slice(0, 100) || null,
      syncedAt: new Date().toISOString(),
    } });
  }
  for (let offset = 0; offset < writes.length; offset += 400) {
    const batch = adminDb.batch();
    for (const write of writes.slice(offset, offset + 400)) {
      batch.set(agencyRef(input.organizationId).collection('tiktokReportSnapshots').doc(write.id), write.data, { merge: true });
    }
    await batch.commit();
  }
  await agencyRef(input.organizationId).collection('tiktokReportingState').doc(input.advertiserId).set({
    organizationId: input.organizationId,
    advertiserId: input.advertiserId,
    status: 'idle',
    lastSyncAt: new Date().toISOString(),
    rowCount: writes.length,
  }, { merge: true });
  return { persisted: writes.length };
}

export async function listPropertyReporting(organizationId: string, propertyId: string) {
  const snapshot = await agencyRef(organizationId).collection('tiktokReportSnapshots')
    .where('propertyId', '==', propertyId)
    .orderBy('date', 'desc')
    .limit(1000)
    .get();
  return snapshot.docs
    .map((doc): Record<string, unknown> & { id: string } => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }))
    .filter((row) => row['organizationId'] === organizationId);
}
