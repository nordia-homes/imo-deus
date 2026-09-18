import { adminDb } from '@/firebase/admin';
import { randomUUID } from 'node:crypto';
import { buildTikTokVideoLibrary } from './tiktok-video-library';
import type { Property, TikTokStudioAsset } from './types';
import { TikTokMcpAdapter } from './tiktok-ads/mcp-adapter';
import { TikTokAdsError } from './tiktok-ads/errors';
import {
  createTikTokMcpAuthorization,
  disconnectTikTokMcp,
  finalizeTikTokMcpAuthorization,
  getTikTokMcpConnection,
  getTikTokMcpResourceUrl,
} from './tiktok-ads/oauth';
import { issueSpendAuthorization } from './tiktok-ads/policy';
import { disableTikTokAdsJobs, enqueueTikTokAdsJob } from './tiktok-ads/jobs';
import {
  acknowledgeOperationRecovery,
  appendAudit,
  deleteLead,
  getAdvertiser,
  getLeadForExport,
  getOperation,
  listAdvertisers,
  listRecentTikTokOperations,
  listTikTokAccountPermissions,
  listPropertyReporting,
  loadToolCache,
  selectAdvertiser,
} from './tiktok-ads/store';
import type { TikTokActor, TikTokCapability, TikTokOperationRequest } from './tiktok-ads/types';

const PROVIDER = 'tiktok_ads';
const adapter = new TikTokMcpAdapter();

export { TikTokAdsError, formatTikTokAdsError } from './tiktok-ads/errors';
export { TIKTOK_CAPABILITIES } from './tiktok-ads/types';
export type {
  TikTokAdsPort,
  TikTokCapability,
  TikTokCapabilityClassification,
  TikTokCapabilityResolution,
  TikTokOperationClass,
  TikTokOperationRequest,
  TikTokOperationResult,
} from './tiktok-ads/types';

export function decryptTikTokAdsToken() {
  throw new Error('Accesul direct la tokenul TikTok Ads este interzis; folosește TikTokAdsPort.');
}

export async function createTikTokAdsAuthorization(params: {
  agencyId: string;
  requestedByUid: string;
  returnTo?: string;
}) {
  const authorization = await createTikTokMcpAuthorization({
    organizationId: params.agencyId,
    requestedByUid: params.requestedByUid,
    returnTo: params.returnTo,
  });
  await appendAudit({ organizationId: params.agencyId, actorUid: params.requestedByUid, operation: 'CONNECT', outcome: 'attempted', correlationId: `oauth-${randomUUID()}` });
  return authorization;
}

export async function finalizeTikTokAdsAuthorization(params: { authCode?: string; code?: string; state: string; callbackBinding: string }) {
  const code = params.code || params.authCode;
  if (!code) throw new Error('Callback-ul TikTok MCP nu conține code.');
  const result = await finalizeTikTokMcpAuthorization({ code, state: params.state, callbackBinding: params.callbackBinding });
  try {
    await adapter.discoverCapabilities(result.organizationId, true);
    await adapter.synchronizeAdvertisers(result.organizationId, result.requestedByUid);
  } catch (error) {
    await adminDb.collection('agencies').doc(result.organizationId).collection('integrations').doc(PROVIDER).set({
      capabilityDiscoveryStatus: 'error',
      lastErrorCode: error && typeof error === 'object' && 'code' in error ? String(error.code) : 'CAPABILITY_UNAVAILABLE',
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  }
  await appendAudit({ organizationId: result.organizationId, actorUid: result.requestedByUid, operation: 'CONNECT', outcome: 'succeeded', correlationId: `oauth-${randomUUID()}` });
  await Promise.all([
    enqueueTikTokAdsJob({ organizationId: result.organizationId, createdByUid: result.requestedByUid, kind: 'advertiser_discovery', recurrenceMinutes: 60 }),
    enqueueTikTokAdsJob({ organizationId: result.organizationId, createdByUid: result.requestedByUid, kind: 'capability_discovery', recurrenceMinutes: 360 }),
  ]).catch(() => {
    console.error(JSON.stringify({ event: 'tiktok_background_schedule_failed', organizationId: result.organizationId }));
  });
  return { agencyId: result.organizationId, returnTo: result.returnTo };
}

export async function disconnectTikTokAds(agencyId: string, actorUid?: string) {
  const result = await disconnectTikTokMcp(agencyId);
  await disableTikTokAdsJobs(agencyId);
  await appendAudit({ organizationId: agencyId, actorUid, operation: 'DISCONNECT', outcome: 'succeeded', correlationId: `disconnect-${randomUUID()}` });
  return result;
}

export async function getTikTokAdsStatus(agencyId: string) {
  const [snapshot, advertisers, connection] = await Promise.all([
    adminDb.collection('agencies').doc(agencyId).collection('integrations').doc(PROVIDER).get(),
    listAdvertisers(agencyId),
    getTikTokMcpConnection(agencyId).catch(() => null),
  ]);
  const data = snapshot.data() || {};
  const configuredResourceUrl = getTikTokMcpResourceUrl();
  const connected = Boolean(data.connected && data.transport === 'mcp');
  const requiresReconnect = Boolean(
    data.connected
    && (data.transport !== 'mcp' || !connection || connection.resourceUrl !== configuredResourceUrl)
  );
  return {
    configured: Boolean(
      process.env.TIKTOK_ADS_MCP_TOKEN_ENCRYPTION_KEY
      && getTikTokMcpResourceUrl()
    ),
    provider: PROVIDER,
    transport: 'mcp',
    connected,
    requiresReconnect,
    mcpDisclosure: configuredResourceUrl.endsWith('/tt-ads-mcp-flat') ? 'full' : 'progressive',
    advertiserId: typeof data.advertiserId === 'string' ? data.advertiserId : advertisers.find((item) => item.selected)?.advertiserId || null,
    advertiserName: advertisers.find((item) => item.selected)?.name || null,
    advertiserCount: advertisers.length,
    capabilityDiscoveryStatus: data.capabilityDiscoveryStatus || 'pending',
    lastErrorCode: typeof data.lastErrorCode === 'string' ? data.lastErrorCode : null,
    availableCapabilityCount: Number(data.availableCapabilityCount || 0),
    readsEnabled: String(process.env.TIKTOK_READS_ENABLED || 'true').toLowerCase() !== 'false',
    writesEnabled: String(process.env.TIKTOK_WRITES_ENABLED || 'true').toLowerCase() !== 'false',
    spendMutationsEnabled: String(process.env.TIKTOK_SPEND_MUTATIONS_ENABLED || 'false').toLowerCase() === 'true',
    updatedAt: data.updatedAt || null,
  };
}

export async function getTikTokAdsWorkspace(agencyId: string, options?: { advertiserId?: string | null; propertyId?: string | null }) {
  const [status, advertisers, assetsSnapshot, propertiesSnapshot, recentOperations] = await Promise.all([
    getTikTokAdsStatus(agencyId),
    listAdvertisers(agencyId),
    adminDb.collection('agencies').doc(agencyId).collection('tiktokStudioAssets').where('type', '==', 'video').get(),
    adminDb.collection('agencies').doc(agencyId).collection('properties').limit(500).get(),
    listRecentTikTokOperations(agencyId, options?.propertyId),
  ]);
  const advertiserId = options?.advertiserId
    || advertisers.find((advertiser) => advertiser.selected)?.advertiserId
    || (advertisers.length === 1 ? advertisers[0].advertiserId : null);
  if (options?.advertiserId && !advertisers.some((advertiser) => advertiser.advertiserId === options.advertiserId)) {
    throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'Advertiser-ul solicitat nu aparține organizației curente.');
  }

  let capabilities: Awaited<ReturnType<TikTokMcpAdapter['discoverCapabilities']>> = [];
  let schemas: Record<string, unknown> = {};
  let permissions: Awaited<ReturnType<typeof listTikTokAccountPermissions>> = [];
  if (status.connected && !status.requiresReconnect) {
    permissions = advertiserId ? await listTikTokAccountPermissions(agencyId, advertiserId) : [];
    try {
      capabilities = await adapter.discoverCapabilities(agencyId, false);
      const tools = await loadToolCache(agencyId);
      schemas = Object.fromEntries(capabilities.flatMap((resolution) => {
        if (!resolution.toolName) return [];
        const tool = tools.find((candidate) => candidate.name === resolution.toolName);
        return tool ? [[resolution.capability, tool.inputSchema] as const] : [];
      }));
    } catch (error) {
      console.error(JSON.stringify({
        event: 'tiktok_workspace_discovery_unavailable',
        organizationId: agencyId,
        errorCode: error && typeof error === 'object' && 'code' in error ? String(error.code) : 'PROVIDER_UNAVAILABLE',
      }));
    }
  }

  type StudioAssetDocument = { id: string } & Record<string, unknown>;
  const studioAssets = assetsSnapshot.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) }) as StudioAssetDocument)
    .filter((asset) => asset.agencyId === agencyId && asset.type === 'video' && asset.status === 'ready' && typeof asset.url === 'string')
    .map((asset) => ({
      id: asset.id,
      propertyId: typeof asset.propertyId === 'string' ? asset.propertyId : null,
      name: typeof asset.name === 'string' && asset.name ? asset.name : 'Video TikTok',
      url: typeof asset.url === 'string' ? asset.url : '',
      thumbnailUrl: typeof asset.thumbnailUrl === 'string' ? asset.thumbnailUrl : null,
      mimeType: typeof asset.mimeType === 'string' ? asset.mimeType : null,
      sizeBytes: typeof asset.sizeBytes === 'number' ? asset.sizeBytes : null,
      durationSeconds: typeof asset.durationSeconds === 'number' ? asset.durationSeconds : null,
      updatedAt: typeof asset.updatedAt === 'string' ? asset.updatedAt : null,
      source: asset.source,
      createdAt: asset.createdAt,
      ownerUid: asset.ownerUid,
    }));
  // Use the same sources as the Videos tab, including property Video AI and uploads.
  // Native property videos are registered lazily when selected, never during this GET.
  const assets = buildTikTokVideoLibrary(agencyId,
    propertiesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }) as Property),
    studioAssets.map(asset => ({ ...asset, agencyId, type: 'video', status: 'ready' }) as TikTokStudioAsset),
  );
  const properties = propertiesSnapshot.docs.map((doc) => {
    const property = doc.data();
    return {
      id: doc.id,
      title: typeof property.title === 'string' && property.title ? property.title : `Proprietate ${doc.id}`,
      location: typeof property.location === 'string' ? property.location : typeof property.address === 'string' ? property.address : null,
      price: typeof property.price === 'number' ? property.price : null,
    };
  }).sort((left, right) => left.title.localeCompare(right.title));
  const operations = recentOperations.filter((operation) => !advertiserId || operation.advertiserId === advertiserId).map((operation) => ({
    operationId: operation.operationId,
    capability: operation.capability,
    advertiserId: operation.advertiserId,
    propertyId: operation.propertyId,
    currentStep: operation.currentStep,
    status: operation.status,
    createdResourceIds: operation.createdResourceIds,
    createdAt: operation.createdAt,
    updatedAt: operation.updatedAt,
    retryCount: operation.retryCount,
    recoverable: operation.recoverable,
    lastErrorCode: operation.lastErrorCode,
    remoteOutcomeUnknown: operation.remoteOutcomeUnknown,
  }));

  return { status, advertisers, advertiserId, permissions, capabilities, schemas, assets, properties, operations };
}

export async function getTikTokAdsOperationStatus(agencyId: string, operationId: string) {
  const operation = await getOperation(agencyId, operationId);
  if (!operation) throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'Operația TikTok Ads nu aparține organizației curente.');
  return {
    operationId: operation.operationId,
    capability: operation.capability,
    advertiserId: operation.advertiserId,
    propertyId: operation.propertyId,
    currentStep: operation.currentStep,
    status: operation.status,
    createdResourceIds: operation.createdResourceIds,
    createdAt: operation.createdAt,
    updatedAt: operation.updatedAt,
    retryCount: operation.retryCount,
    recoverable: operation.recoverable,
    lastErrorCode: operation.lastErrorCode,
    remoteOutcomeUnknown: operation.remoteOutcomeUnknown,
  };
}

export async function discoverTikTokAdsCapabilities(agencyId: string, force = false) {
  return adapter.discoverCapabilities(agencyId, force);
}

export async function synchronizeTikTokAdvertisers(agencyId: string, actorUid: string) {
  return adapter.synchronizeAdvertisers(agencyId, actorUid);
}

export async function listTikTokAdvertisers(agencyId: string) {
  return listAdvertisers(agencyId);
}

export async function selectTikTokAdvertiser(agencyId: string, advertiserId: string, actorUid?: string) {
  await selectAdvertiser(agencyId, advertiserId);
  await appendAudit({ organizationId: agencyId, actorUid, operation: 'ADVERTISER_ATTACH', targetType: 'advertiser', targetId: advertiserId, outcome: 'succeeded', correlationId: `advertiser-${randomUUID()}` });
}

export async function authorizeTikTokSpend(input: {
  agencyId: string;
  actor: TikTokActor;
  capability: TikTokCapability;
  advertiserId?: string | null;
  propertyId?: string | null;
  payload: Record<string, unknown>;
  idempotencyKey?: string | null;
}) {
  if (!input.advertiserId) throw new TikTokAdsError('INVALID_REQUEST', 'advertiserId este obligatoriu pentru autorizarea unei operații cu spend.');
  await getAdvertiser(input.agencyId, input.advertiserId);
  if (input.propertyId) {
    const property = await adminDb.collection('agencies').doc(input.agencyId).collection('properties').doc(input.propertyId).get();
    if (!property.exists) throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'Proprietatea nu aparține organizației curente.');
  }
  return issueSpendAuthorization({ organizationId: input.agencyId, ...input });
}

export async function executeTikTokAdsOperation(request: TikTokOperationRequest) {
  return adapter.execute(request);
}

export async function exportTikTokLead(agencyId: string, leadReferenceId: string) {
  return getLeadForExport(agencyId, leadReferenceId);
}

export async function deleteTikTokLead(agencyId: string, leadReferenceId: string) {
  return deleteLead(agencyId, leadReferenceId);
}

export async function getPropertyTikTokReporting(agencyId: string, propertyId: string) {
  return listPropertyReporting(agencyId, propertyId);
}

export async function acknowledgeTikTokOperationRecovery(input: {
  agencyId: string;
  operationId: string;
  actorUid: string;
  resources: Array<{ resourceType: import('./tiktok-ads/types').TikTokResourceType; resourceId: string }>;
}) {
  const result = await acknowledgeOperationRecovery({
    organizationId: input.agencyId,
    operationId: input.operationId,
    actorUid: input.actorUid,
    resources: input.resources,
  });
  await appendAudit({
    organizationId: input.agencyId,
    actorUid: input.actorUid,
    operation: 'OPERATION_RECOVERY_ACKNOWLEDGED',
    targetType: 'operation',
    targetId: input.operationId,
    outcome: 'succeeded',
    correlationId: input.operationId,
    safeMetadata: { attachedResourceCount: input.resources.length },
  });
  return result;
}
