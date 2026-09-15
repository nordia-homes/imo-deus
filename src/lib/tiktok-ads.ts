import { adminDb } from '@/firebase/admin';
import { randomUUID } from 'node:crypto';
import { TikTokMcpAdapter } from './tiktok-ads/mcp-adapter';
import { TikTokAdsError } from './tiktok-ads/errors';
import {
  createTikTokMcpAuthorization,
  disconnectTikTokMcp,
  finalizeTikTokMcpAuthorization,
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
  listAdvertisers,
  listPropertyReporting,
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
  const [snapshot, advertisers] = await Promise.all([
    adminDb.collection('agencies').doc(agencyId).collection('integrations').doc(PROVIDER).get(),
    listAdvertisers(agencyId),
  ]);
  const data = snapshot.data() || {};
  return {
    configured: Boolean(
      process.env.TIKTOK_ADS_MCP_TOKEN_ENCRYPTION_KEY
      && getTikTokMcpResourceUrl()
    ),
    provider: PROVIDER,
    transport: 'mcp',
    connected: Boolean(data.connected && data.transport === 'mcp'),
    requiresReconnect: Boolean(data.connected && data.transport !== 'mcp'),
    advertiserId: typeof data.advertiserId === 'string' ? data.advertiserId : advertisers.find((item) => item.selected)?.advertiserId || null,
    advertiserName: advertisers.find((item) => item.selected)?.name || null,
    advertiserCount: advertisers.length,
    capabilityDiscoveryStatus: data.capabilityDiscoveryStatus || 'pending',
    availableCapabilityCount: Number(data.availableCapabilityCount || 0),
    updatedAt: data.updatedAt || null,
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
