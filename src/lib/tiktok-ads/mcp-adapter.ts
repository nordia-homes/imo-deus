import { TikTokAdsError } from './errors';
import { randomUUID } from 'node:crypto';
import { CAPABILITY_CLASSIFICATION, OPERATION_CLASS, findToolForCapability, resolveTikTokCapabilities } from './capabilities';
import { TikTokMcpClient } from './mcp-client';
import { getValidTikTokMcpAccessToken } from './oauth';
import {
  acquireMutationLock,
  acquireTenantProviderSlot,
  appendAudit,
  assertResourceOwnership,
  beginOperation,
  clearSelectedAdvertiser,
  getAdvertiser,
  getOwnedStudioVideoAsset,
  getOperation,
  getTikTokAccountPermission,
  findMediaMapping,
  listAdvertisers,
  loadCapabilityResolutions,
  loadToolCache,
  markCapabilityIncompatible,
  registerResource,
  registerMediaMapping,
  registerResources,
  persistLeadRecords,
  persistReportingRows,
  saveCapabilityResolutions,
  saveToolCache,
  selectAdvertiser,
  updateOperation,
  upsertAdvertiser,
  upsertTikTokAccountPermission,
} from './store';
import {
  assertActorPolicy,
  assertAdsOnlyPayload,
  assertAdvertiserWriteEligibility,
  assertCapabilityPayloadBoundaries,
  assertFreshTikTokAccountPermissions,
  assertKillSwitches,
  assertSignificantChangeSafeguard,
  consumeSpendAuthorization,
  validateMoneyPayload,
} from './policy';
import { validateRemoteVideo } from './media-security';
import type {
  JsonSchema,
  TikTokAdsPort,
  TikTokAdvertiserRecord,
  TikTokCapability,
  TikTokCapabilityResolution,
  TikTokMcpTool,
  TikTokOperationClass,
  TikTokOperationRequest,
  TikTokOperationResult,
  TikTokResourceType,
} from './types';

const ID_KEY_TO_TYPE: Record<string, TikTokResourceType> = {
  campaign_id: 'campaign',
  campaignid: 'campaign',
  adgroup_id: 'adgroup',
  ad_group_id: 'adgroup',
  adgroupid: 'adgroup',
  ad_id: 'ad',
  adid: 'ad',
  creative_id: 'creative',
  creativeid: 'creative',
  video_id: 'video',
  videoid: 'video',
  identity_id: 'identity',
  identityid: 'identity',
  tiktok_account_id: 'identity',
  tiktokaccountid: 'identity',
  tiktok_item_id: 'tiktok_post',
  item_id: 'tiktok_post',
  form_id: 'form',
  page_id: 'form',
  audience_id: 'audience',
};

const CREATE_RESOURCE: Partial<Record<TikTokCapability, TikTokResourceType>> = {
  CAMPAIGN_CREATE: 'campaign',
  ADGROUP_CREATE: 'adgroup',
  AD_CREATE: 'ad',
  CREATIVE_UPLOAD: 'video',
};

const SAFE_PROVIDER_ID = /^[A-Za-z0-9._:-]{1,128}$/;

function isFresh(resolutions: TikTokCapabilityResolution[]) {
  if (!resolutions.length) return false;
  const oldest = Math.min(...resolutions.map((item) => item.discoveredAt ? Date.parse(item.discoveredAt) : 0));
  return oldest > Date.now() - 6 * 60 * 60_000;
}

function resolutionMap(resolutions: TikTokCapabilityResolution[]) {
  return new Map(resolutions.map((item) => [item.capability, item]));
}

function normalizedKey(key: string) {
  return key.replace(/[^a-z0-9_]/gi, '').toLowerCase();
}

function stringIds(value: unknown, source: 'provider' | 'request'): string[] {
  if (value == null) return [];
  if (typeof value === 'string' && SAFE_PROVIDER_ID.test(value)) return [value];
  if (typeof value === 'number' && Number.isSafeInteger(value) && SAFE_PROVIDER_ID.test(String(value))) return [String(value)];
  if (Array.isArray(value)) return value.flatMap((item) => stringIds(item, source));
  throw new TikTokAdsError(source === 'request' ? 'INVALID_REQUEST' : 'SCHEMA_INCOMPATIBLE', source === 'request'
    ? 'Payload-ul conține un identificator TikTok cu format nesigur.'
    : 'TikTok a furnizat un identificator cu format nesigur.');
}

function providerId(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value == null) continue;
    if ((typeof value !== 'string' && typeof value !== 'number') || !SAFE_PROVIDER_ID.test(String(value))) {
      throw new TikTokAdsError('SCHEMA_INCOMPATIBLE', `TikTok a returnat un ${key} invalid.`);
    }
    return String(value);
  }
  return null;
}

function collectIds(value: unknown, output: Array<{ key: string; type: TikTokResourceType; id: string }> = [], source: 'provider' | 'request' = 'provider') {
  if (Array.isArray(value)) {
    value.forEach((child) => collectIds(child, output, source));
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizedKey(key).replace(/s$/, '');
    const type = ID_KEY_TO_TYPE[normalized];
    if (type) stringIds(child, source).forEach((id) => output.push({ key, type, id }));
    else collectIds(child, output, source);
  }
  return output;
}

function propertyAccepts(schema: JsonSchema, key: string) {
  return Boolean(schema.properties?.[key]);
}

type SchemaPath = Array<string | '*'>;

function schemaPropertyPaths(schema: JsonSchema, candidates: string[], path: SchemaPath = [], output: SchemaPath[] = [], seen = new Set<JsonSchema>()) {
  if (seen.has(schema)) return output;
  seen.add(schema);
  for (const [key, child] of Object.entries(schema.properties || {})) {
    if (candidates.includes(key)) output.push([...path, key]);
    schemaPropertyPaths(child, candidates, [...path, key], output, seen);
  }
  if (schema.items) schemaPropertyPaths(schema.items, candidates, [...path, '*'], output, seen);
  for (const alternative of [...(schema.anyOf || []), ...(schema.oneOf || []), ...(schema.allOf || [])]) {
    schemaPropertyPaths(alternative, candidates, path, output, seen);
  }
  return output;
}

function payloadValuesForKeys(value: unknown, candidates: string[], output: unknown[] = []) {
  if (Array.isArray(value)) {
    value.forEach((child) => payloadValuesForKeys(child, candidates, output));
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (candidates.includes(key)) output.push(child);
    payloadValuesForKeys(child, candidates, output);
  }
  return output;
}

function writeAtSchemaPath(target: unknown, path: SchemaPath, value: string, label: string): unknown {
  if (!path.length) return value;
  const [segment, ...rest] = path;
  if (segment === '*') {
    if (!Array.isArray(target) || !target.length) throw new TikTokAdsError('INVALID_REQUEST', `${label} necesită o listă nevidă în payload.`);
    return target.map((child) => writeAtSchemaPath(child, rest, value, label));
  }
  const record = target && typeof target === 'object' && !Array.isArray(target) ? target as Record<string, unknown> : {};
  return { ...record, [segment]: writeAtSchemaPath(record[segment], rest, value, label) };
}

function bindTrustedId(
  payload: Record<string, unknown>,
  schema: JsonSchema,
  candidates: string[],
  value: string,
  label: string,
  required = true,
  mismatchCode: 'RESOURCE_NOT_OWNED' | 'SPEND_NOT_AUTHORIZED' = 'RESOURCE_NOT_OWNED'
) {
  const supplied = payloadValuesForKeys(payload, candidates);
  if (supplied.some((candidate) => candidate != null && String(candidate) !== value)) {
    throw new TikTokAdsError(mismatchCode, `${label} din payload nu corespunde valorii impuse de server.`);
  }
  const uniquePaths = Array.from(new Map(schemaPropertyPaths(schema, candidates).map((path) => [JSON.stringify(path), path])).values());
  if (!uniquePaths.length) {
    if (required || supplied.length) throw new TikTokAdsError('SCHEMA_INCOMPATIBLE', `Schema TikTok nu expune câmpul ${label} necesar workflow-ului.`);
    return { ...payload };
  }
  if (uniquePaths.length > 1) throw new TikTokAdsError('SCHEMA_INCOMPATIBLE', `Schema TikTok este ambiguă pentru ${label}.`);
  return writeAtSchemaPath(payload, uniquePaths[0], value, label) as Record<string, unknown>;
}

function bindAdvertiser(payload: Record<string, unknown>, schema: JsonSchema, advertiserId?: string | null) {
  if (!advertiserId) return { ...payload };
  return bindTrustedId(payload, schema, ['advertiser_id', 'advertiserId'], advertiserId, 'advertiser_id');
}

function coerceForSchema(value: unknown, schema: JsonSchema): unknown {
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (typeof value === 'string' && types.includes('number') && /^-?(0|[1-9]\d*)(\.\d+)?$/.test(value)) return Number(value);
  if (typeof value === 'string' && types.includes('integer') && /^-?(0|[1-9]\d*)$/.test(value)) return Number(value);
  if (Array.isArray(value) && schema.items) return value.map((item) => coerceForSchema(item, schema.items!));
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, coerceForSchema(child, schema.properties?.[key] || {})]));
  }
  return value;
}

export function forceDisabledCreatePayload(capability: TikTokCapability, payload: Record<string, unknown>, schema: JsonSchema) {
  if (!['CAMPAIGN_CREATE', 'ADGROUP_CREATE', 'AD_CREATE'].includes(capability)) return payload;
  return bindTrustedId(
    payload,
    schema,
    ['operation_status', 'status'],
    'DISABLE',
    'statusul de creare inactiv',
    true,
    'SPEND_NOT_AUTHORIZED'
  );
}

function assertRemoteAdvertiserBoundary(result: unknown, advertiserId?: string | null) {
  if (!advertiserId) return;
  for (const record of extractObjects(result)) {
    const remoteAdvertiserId = providerId(record, ['advertiser_id', 'advertiserId']);
    if (remoteAdvertiserId && remoteAdvertiserId !== advertiserId) {
      throw new TikTokAdsError('TENANT_ACCESS_DENIED', 'TikTok a returnat date pentru un alt advertiser decât cel autorizat.');
    }
  }
}

function mutationTarget(capability: TikTokCapability, payload: Record<string, unknown>) {
  const ids = collectIds(payload, [], 'request');
  const first = (type: TikTokResourceType) => ids.find((item) => item.type === type);
  if (capability === 'SPARK_EXISTING_POST') return first('tiktok_post');
  if (capability === 'SPARK_NEW_VIDEO_AD_ONLY') {
    const video = payload.video;
    const mediaAssetId = video && typeof video === 'object' && !Array.isArray(video) && typeof (video as Record<string, unknown>).mediaAssetId === 'string'
      ? (video as Record<string, unknown>).mediaAssetId as string
      : null;
    if (mediaAssetId) return { key: 'mediaAssetId', type: 'video' as const, id: `imodeus-${mediaAssetId}` };
  }
  if (/^CAMPAIGN_/.test(capability)) return first('campaign');
  if (/^ADGROUP_/.test(capability) || ['TARGETING_UPDATE', 'BID_UPDATE'].includes(capability)) return first('adgroup');
  if (['BUDGET_UPDATE', 'SCHEDULE_UPDATE'].includes(capability)) return first('adgroup') || first('campaign');
  if (/^AD_/.test(capability)) return first('ad');
  return first('adgroup') || first('campaign') || first('ad');
}

function enforceStatusIntent(capability: TikTokCapability, payload: Record<string, unknown>, schema: JsonSchema) {
  const statuses: Partial<Record<TikTokCapability, string>> = {
    CAMPAIGN_ACTIVATE: 'ENABLE', CAMPAIGN_RESUME: 'ENABLE', CAMPAIGN_PAUSE: 'DISABLE',
    ADGROUP_RESUME: 'ENABLE', ADGROUP_PAUSE: 'DISABLE', AD_RESUME: 'ENABLE', AD_PAUSE: 'DISABLE',
  };
  const status = statuses[capability];
  if (!status) return payload;
  return bindTrustedId(payload, schema, ['operation_status', 'status'], status, 'operation_status', true, 'SPEND_NOT_AUTHORIZED');
}

function extractObjects(value: unknown, output: Record<string, unknown>[] = []) {
  if (Array.isArray(value)) {
    value.forEach((child) => extractObjects(child, output));
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  const record = value as Record<string, unknown>;
  output.push(record);
  Object.values(record).forEach((child) => extractObjects(child, output));
  return output;
}

function text(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value);
  }
  return null;
}

function booleanField(record: Record<string, unknown>, keys: string[], permissionNames: string[] = []) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return { found: true, value };
    if (typeof value === 'string') {
      if (/^(true|enabled|granted|yes)$/i.test(value)) return { found: true, value: true };
      if (/^(false|disabled|revoked|no)$/i.test(value)) return { found: true, value: false };
    }
  }
  const permissionList = [record.permissions, record.permission_list, record.authorized_permissions]
    .find((value) => Array.isArray(value));
  if (Array.isArray(permissionList)) {
    const granted = new Set(permissionList.filter((value): value is string => typeof value === 'string')
      .map((value) => value.replace(/[^a-z0-9]/gi, '').toLowerCase()));
    return { found: true, value: permissionNames.some((name) => granted.has(name.replace(/[^a-z0-9]/gi, '').toLowerCase())) };
  }
  return { found: false, value: false };
}

export class TikTokMcpAdapter implements TikTokAdsPort {
  private async tools(organizationId: string, force = false) {
    if (!force) {
      const cached = await loadToolCache(organizationId);
      if (cached.length) return cached;
    }
    const { accessToken, connection } = await getValidTikTokMcpAccessToken(organizationId);
    const release = await acquireTenantProviderSlot(organizationId);
    let tools: TikTokMcpTool[];
    try {
      tools = await new TikTokMcpClient(connection.resourceUrl, accessToken).discoverTools();
    } finally {
      await release();
    }
    if (!tools.length) throw new TikTokAdsError('CAPABILITY_UNAVAILABLE', 'TikTok MCP nu a expus niciun tool după autorizare.');
    await saveToolCache(organizationId, tools);
    return tools;
  }

  async discoverCapabilities(organizationId: string, force = false) {
    const previous = await loadCapabilityResolutions(organizationId);
    if (!force && isFresh(previous)) return previous;
    const tools = await this.tools(organizationId, force);
    const resolutions = resolveTikTokCapabilities(tools, resolutionMap(previous));
    await saveCapabilityResolutions(organizationId, resolutions);
    const incompatible = resolutions.filter((item) => item.schemaStatus === 'changed' || item.schemaStatus === 'ambiguous');
    if (incompatible.length) {
      console.error(JSON.stringify({ event: 'tiktok_mcp_schema_incompatible', organizationId, capabilities: incompatible.map((item) => item.capability) }));
    }
    return resolutions;
  }

  private async assertOwnedPayloadIds(request: TikTokOperationRequest, payload: Record<string, unknown>) {
    const ids = collectIds(payload, [], 'request');
    const unique = new Map(ids.map((item) => [`${item.type}:${item.id}`, item]));
    for (const item of unique.values()) {
      if (item.type === 'identity' && ['TIKTOK_PERMISSION_READ', 'TIKTOK_PERMISSION_RECONCILE'].includes(request.capability) && request.advertiserId) {
        try {
          await getTikTokAccountPermission(request.organizationId, request.advertiserId, item.id);
        } catch {
          await assertResourceOwnership(request.organizationId, 'identity', item.id, request.advertiserId);
        }
        continue;
      }
      await assertResourceOwnership(request.organizationId, item.type, item.id, request.advertiserId);
    }
  }

  private async invokeSingle(input: {
    request: TikTokOperationRequest;
    capability: TikTokCapability;
    payload: Record<string, unknown>;
    tools: TikTokMcpTool[];
    operationClassOverride?: TikTokOperationClass;
    operationId: string;
  }) {
    const tool = findToolForCapability(input.capability, input.tools);
    if (!tool) throw new TikTokAdsError('CAPABILITY_UNAVAILABLE', `Capability-ul ${input.capability} nu are un tool MCP neambiguu.`, { correlationId: input.request.correlationId });
    const providerPayload = Object.fromEntries(Object.entries(input.payload).filter(([key]) => key !== '_imodeus'));
    let payload = bindAdvertiser(providerPayload, tool.inputSchema, input.request.advertiserId);
    payload = enforceStatusIntent(input.capability, payload, tool.inputSchema);
    payload = forceDisabledCreatePayload(input.capability, payload, tool.inputSchema);
    await this.assertOwnedPayloadIds({ ...input.request, capability: input.capability }, payload);
    const { accessToken, connection } = await getValidTikTokMcpAccessToken(input.request.organizationId);
    const operationClass = input.operationClassOverride || OPERATION_CLASS[input.capability];
    const client = new TikTokMcpClient(connection.resourceUrl, accessToken);
    const coercedPayload = coerceForSchema(payload, tool.inputSchema) as Record<string, unknown>;
    const release = await acquireTenantProviderSlot(input.request.organizationId);
    let result: unknown;
    try {
      result = operationClass === 'READ_ONLY'
        ? await client.callToolPaginated(tool, coercedPayload, input.request.correlationId)
        : await client.callTool(tool, coercedPayload, operationClass, input.request.correlationId);
    } finally {
      await release();
    }
    assertRemoteAdvertiserBoundary(result, input.request.advertiserId);
    const returnedIds = collectIds(result);
    const createdType = CREATE_RESOURCE[input.capability];
    const createdId = createdType ? returnedIds.find((item) => item.type === createdType)?.id || null : null;
    if (createdType && !createdId) {
      throw new TikTokAdsError('PARTIAL_FAILURE', `TikTok a executat ${input.capability}, dar răspunsul nu conține ID-ul resursei create.`, { correlationId: input.request.correlationId });
    }
    if (createdType && createdId && input.request.advertiserId) {
      await registerResource({
        organizationId: input.request.organizationId,
        advertiserId: input.request.advertiserId,
        resourceType: createdType,
        resourceId: createdId,
        propertyId: input.request.propertyId,
        operationId: input.operationId,
        remoteSnapshot: null,
      });
    }
    return { result, created: createdId && createdType ? { resourceType: createdType, resourceId: createdId } : null };
  }

  private async reconcilePermissions(request: TikTokOperationRequest, tools: TikTokMcpTool[], toolInput: Record<string, unknown>, expectedAccountId?: string) {
    if (!request.advertiserId) throw new TikTokAdsError('INVALID_REQUEST', 'advertiserId este obligatoriu pentru reconcilierea permisiunilor.');
    const invoked = await this.invokeSingle({ request, capability: 'TIKTOK_PERMISSION_READ', payload: toolInput, tools, operationId: 'permission-reconcile' });
    const records = extractObjects(invoked.result);
    const seenAccountIds = new Set<string>();
    for (const record of records) {
      const accountId = providerId(record, ['tiktok_account_id', 'tt_user_id', 'identity_id', 'user_id']);
      if (!accountId) continue;
      seenAccountIds.add(accountId);
      const deliverAds = booleanField(record, ['deliver_ads', 'is_ad_delivery_authorized'], ['Deliver ads']);
      const existingPosts = booleanField(record, ['existing_posts', 'can_use_existing_posts'], ['Existing posts']);
      const publishNew = booleanField(record, ['publish_and_manage_new_videos', 'can_publish_new_video'], ['Publish and manage new videos']);
      const adsOnly = booleanField(record, ['only_show_as_ads', 'ads_only_mode', 'is_ads_only'], ['Only show as ads']);
      const revoked = booleanField(record, ['revoked', 'is_revoked']);
      const completeContract = deliverAds.found && existingPosts.found && publishNew.found && adsOnly.found;
      await upsertTikTokAccountPermission({
        organizationId: request.organizationId,
        advertiserId: request.advertiserId,
        tiktokAccountId: accountId,
        username: text(record, ['username', 'display_name', 'identity_name']),
        deliverAds: deliverAds.value,
        existingPosts: existingPosts.value,
        publishAndManageNewVideos: publishNew.value,
        onlyShowAsAds: adsOnly.value,
        grantedAt: text(record, ['granted_at', 'authorized_at']),
        revokedAt: revoked.value ? new Date().toISOString() : null,
        lastVerifiedAt: new Date().toISOString(),
        verificationStatus: revoked.value ? 'revoked' : completeContract ? 'verified' : 'unknown',
      });
      await registerResource({
        organizationId: request.organizationId,
        advertiserId: request.advertiserId,
        resourceType: 'identity',
        resourceId: accountId,
        propertyId: null,
        operationId: 'permission-reconcile',
        remoteSnapshot: null,
      });
    }
    if (expectedAccountId && !seenAccountIds.has(expectedAccountId)) {
      const current = await getTikTokAccountPermission(request.organizationId, request.advertiserId, expectedAccountId);
      await upsertTikTokAccountPermission({
        ...current,
        deliverAds: false,
        existingPosts: false,
        publishAndManageNewVideos: false,
        onlyShowAsAds: false,
        revokedAt: new Date().toISOString(),
        lastVerifiedAt: new Date().toISOString(),
        verificationStatus: 'revoked',
      });
    }
    return invoked.result;
  }

  private async executeAdsOnly(request: TikTokOperationRequest, tools: TikTokMcpTool[], operationId: string, existingCreated: Array<{ resourceType: string; resourceId: string }>) {
    assertAdsOnlyPayload(request.payload);
    if (!request.advertiserId) throw new TikTokAdsError('INVALID_REQUEST', 'advertiserId este obligatoriu.');
    const tiktokAccountId = typeof request.payload.tiktokAccountId === 'string' ? request.payload.tiktokAccountId : '';
    if (!tiktokAccountId) throw new TikTokAdsError('INVALID_REQUEST', 'tiktokAccountId este obligatoriu pentru Ads Only.');
    const permissionToolInput = request.payload.permissionToolInput;
    if (permissionToolInput && typeof permissionToolInput === 'object' && !Array.isArray(permissionToolInput)) {
      await this.reconcilePermissions(request, tools, permissionToolInput as Record<string, unknown>, tiktokAccountId);
    }
    const permission = await getTikTokAccountPermission(request.organizationId, request.advertiserId, tiktokAccountId);
    assertFreshTikTokAccountPermissions(permission, 'new_video_ads_only');

    const created = [...existingCreated];
    const existing = (type: TikTokResourceType) => created.find((item) => item.resourceType === type)?.resourceId || null;
    const recoveredAdId = existing('ad');
    if (recoveredAdId) return { result: { recoveredAdId }, created };
    let campaignId = existing('campaign');
    let adgroupId = existing('adgroup');
    let videoId = existing('video');

    const video = request.payload.video;
    if (!video || typeof video !== 'object' || Array.isArray(video)) throw new TikTokAdsError('INVALID_REQUEST', 'Workflow-ul Ads Only necesită un asset video Imodeus.');
    const videoRecord = video as Record<string, unknown>;
    const mediaAssetId = typeof videoRecord.mediaAssetId === 'string' ? videoRecord.mediaAssetId : '';
    if (!mediaAssetId) throw new TikTokAdsError('INVALID_REQUEST', 'video.mediaAssetId este obligatoriu pentru tenant isolation și deduplicare.');
    const mediaAsset = await getOwnedStudioVideoAsset(request.organizationId, mediaAssetId);
    if (videoRecord.sourceUrl != null && videoRecord.sourceUrl !== mediaAsset.url) {
      throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'URL-ul video nu corespunde asset-ului Imodeus autorizat.');
    }
    if (!videoId) videoId = (await findMediaMapping(request.organizationId, request.advertiserId, mediaAssetId))?.videoId || null;

    const campaign = request.payload.campaign;
    if (!campaignId && campaign && typeof campaign === 'object' && !Array.isArray(campaign)) {
      const step = await this.invokeSingle({ request, capability: 'CAMPAIGN_CREATE', payload: { ...(campaign as Record<string, unknown>) }, tools, operationClassOverride: 'SPEND_AFFECTING', operationId });
      if (step.created) created.push(step.created);
      campaignId = step.created?.resourceId || null;
      await updateOperation(request.organizationId, operationId, { currentStep: 'campaign_created', createdResourceIds: created });
    }

    const adGroup = request.payload.adGroup;
    if (!adgroupId && adGroup && typeof adGroup === 'object' && !Array.isArray(adGroup)) {
      const tool = findToolForCapability('ADGROUP_CREATE', tools);
      if (!tool) throw new TikTokAdsError('CAPABILITY_UNAVAILABLE', 'Tool-ul de creare ad group lipsește.');
      const basePayload = { ...(adGroup as Record<string, unknown>) };
      const payload = campaignId
        ? bindTrustedId(basePayload, tool.inputSchema, ['campaign_id', 'campaignId'], campaignId, 'campaign_id')
        : basePayload;
      const step = await this.invokeSingle({ request, capability: 'ADGROUP_CREATE', payload, tools, operationClassOverride: 'SPEND_AFFECTING', operationId });
      if (step.created) created.push(step.created);
      adgroupId = step.created?.resourceId || null;
      await updateOperation(request.organizationId, operationId, { currentStep: 'adgroup_created', createdResourceIds: created });
    }

    if (!videoId) {
      const validatedSource = await validateRemoteVideo(mediaAsset.url, {
        expectedMimeType: mediaAsset.mimeType,
        expectedSizeBytes: mediaAsset.sizeBytes,
        expectedDurationSeconds: mediaAsset.durationSeconds,
      });
      const toolInput = videoRecord.toolInput;
      if (!toolInput || typeof toolInput !== 'object' || Array.isArray(toolInput)) throw new TikTokAdsError('INVALID_REQUEST', 'video.toolInput trebuie să respecte schema MCP descoperită.');
      const uploadTool = findToolForCapability('CREATIVE_UPLOAD', tools);
      if (!uploadTool) throw new TikTokAdsError('CAPABILITY_UNAVAILABLE', 'Tool-ul de upload video lipsește.');
      const remoteUrls: string[] = [];
      const collectUrls = (value: unknown) => {
        if (Array.isArray(value)) return value.forEach(collectUrls);
        if (!value || typeof value !== 'object') return;
        Object.values(value as Record<string, unknown>).forEach((child) => {
          if (typeof child === 'string' && /^https:\/\//i.test(child)) remoteUrls.push(child);
          else collectUrls(child);
        });
      };
      collectUrls(toolInput);
      if (remoteUrls.some((url) => url !== mediaAsset.url && url !== validatedSource.finalUrl)) {
        throw new TikTokAdsError('INVALID_CREATIVE', 'URL-ul trimis către upload nu corespunde asset-ului media validat.');
      }
      let uploadPayload = toolInput as Record<string, unknown>;
      const uploadUrlCandidates = ['video_url', 'source_url', 'file_url', 'url'];
      if (schemaPropertyPaths(uploadTool.inputSchema, uploadUrlCandidates).length) {
        uploadPayload = bindTrustedId(uploadPayload, uploadTool.inputSchema, uploadUrlCandidates, mediaAsset.url, 'video source URL');
      } else if (!remoteUrls.length) {
        throw new TikTokAdsError('SCHEMA_INCOMPATIBLE', 'Schema upload-ului nu permite legarea URL-ului media validat.');
      }
      const step = await this.invokeSingle({ request, capability: 'CREATIVE_UPLOAD', payload: uploadPayload, tools, operationClassOverride: 'SPEND_AFFECTING', operationId });
      if (step.created) created.push(step.created);
      videoId = step.created?.resourceId || null;
      await updateOperation(request.organizationId, operationId, { currentStep: 'video_uploaded', createdResourceIds: created });
    }
    if (!videoId) throw new TikTokAdsError('INVALID_REQUEST', 'Workflow-ul Ads Only necesită un video nou sau un video upload recuperabil.');
    await registerMediaMapping({ organizationId: request.organizationId, advertiserId: request.advertiserId, mediaAssetId, videoId, propertyId: request.propertyId, operationId });

    const ad = request.payload.ad;
    if (!ad || typeof ad !== 'object' || Array.isArray(ad)) throw new TikTokAdsError('INVALID_REQUEST', 'ad este obligatoriu.');
    const adTool = findToolForCapability('AD_CREATE', tools);
    if (!adTool) throw new TikTokAdsError('CAPABILITY_UNAVAILABLE', 'Tool-ul de creare ad lipsește.');
    let adPayload = { ...(ad as Record<string, unknown>) };
    if (adgroupId) adPayload = bindTrustedId(adPayload, adTool.inputSchema, ['adgroup_id', 'ad_group_id', 'adgroupId'], adgroupId, 'adgroup_id');
    adPayload = bindTrustedId(adPayload, adTool.inputSchema, ['video_id', 'videoId'], videoId, 'video_id');
    adPayload = bindTrustedId(adPayload, adTool.inputSchema, ['identity_id', 'identityId', 'tiktok_account_id'], tiktokAccountId, 'TikTok account identity');
    const adStep = await this.invokeSingle({ request, capability: 'AD_CREATE', payload: adPayload, tools, operationClassOverride: 'SPEND_AFFECTING', operationId });
    if (adStep.created) created.push(adStep.created);
    await updateOperation(request.organizationId, operationId, { currentStep: 'ad_created', createdResourceIds: created });
    return { result: adStep.result, created };
  }

  private async executeExistingPost(request: TikTokOperationRequest, tools: TikTokMcpTool[], operationId: string) {
    if (!request.advertiserId) throw new TikTokAdsError('INVALID_REQUEST', 'advertiserId este obligatoriu.');
    const tiktokAccountId = typeof request.payload.tiktokAccountId === 'string' ? request.payload.tiktokAccountId : '';
    if (!tiktokAccountId) throw new TikTokAdsError('INVALID_REQUEST', 'tiktokAccountId este obligatoriu pentru Spark Existing Post.');
    const permissionToolInput = request.payload.permissionToolInput;
    if (permissionToolInput && typeof permissionToolInput === 'object' && !Array.isArray(permissionToolInput)) {
      await this.reconcilePermissions(request, tools, permissionToolInput as Record<string, unknown>, tiktokAccountId);
    }
    const permission = await getTikTokAccountPermission(request.organizationId, request.advertiserId, tiktokAccountId);
    assertFreshTikTokAccountPermissions(permission, 'existing_post');
    const ad = request.payload.ad;
    if (!ad || typeof ad !== 'object' || Array.isArray(ad)) throw new TikTokAdsError('INVALID_REQUEST', 'ad este obligatoriu pentru Spark Existing Post.');
    if (!collectIds(ad, [], 'request').some((item) => item.type === 'tiktok_post')) throw new TikTokAdsError('INVALID_REQUEST', 'Spark Existing Post necesită un tiktok_item_id descoperit și autorizat.');
    const adTool = findToolForCapability('AD_CREATE', tools);
    if (!adTool) throw new TikTokAdsError('CAPABILITY_UNAVAILABLE', 'Tool-ul de creare ad lipsește.');
    const adPayload = bindTrustedId(ad as Record<string, unknown>, adTool.inputSchema, ['identity_id', 'identityId', 'tiktok_account_id'], tiktokAccountId, 'TikTok account identity');
    const invoked = await this.invokeSingle({ request, capability: 'AD_CREATE', payload: adPayload, tools, operationClassOverride: 'SPEND_AFFECTING', operationId });
    return { result: invoked.result, created: invoked.created ? [invoked.created] : [] };
  }

  private effectiveCapability(capability: TikTokCapability, payload: Record<string, unknown>): TikTokCapability {
    if (capability === 'TARGETING_UPDATE' || capability === 'BID_UPDATE') return 'ADGROUP_UPDATE';
    if (capability === 'BUDGET_UPDATE') {
      return collectIds(payload, [], 'request').some((item) => item.type === 'campaign') ? 'CAMPAIGN_UPDATE' : 'ADGROUP_UPDATE';
    }
    if (capability === 'SCHEDULE_UPDATE') {
      return collectIds(payload, [], 'request').some((item) => item.type === 'campaign') ? 'CAMPAIGN_UPDATE' : 'ADGROUP_UPDATE';
    }
    return capability;
  }

  private async postProcessRead(request: TikTokOperationRequest, result: unknown, operationId: string) {
    if (!request.advertiserId) return result;
    if (['ADVERTISER_STATUS', 'BILLING_READINESS', 'ACCOUNT_REVIEW_READ'].includes(request.capability)) {
      const current = await getAdvertiser(request.organizationId, request.advertiserId);
      const records = extractObjects(result);
      const matching = records.find((record) => providerId(record, ['advertiser_id', 'advertiserId']) === request.advertiserId) || records[0] || {};
      const billingStatus = text(matching, ['billing_status', 'payment_status', 'billing_readiness']);
      const explicitBillingReady = typeof matching.is_billing_ready === 'boolean' ? matching.is_billing_ready : null;
      let billingReadiness = current.billingReadiness || 'unknown';
      if (request.capability === 'BILLING_READINESS') {
        if (explicitBillingReady === true || billingStatus && /^(ready|active|valid)$/i.test(billingStatus)) billingReadiness = 'ready';
        else if (explicitBillingReady === false || billingStatus && /not.?configured/i.test(billingStatus)) billingReadiness = 'not_configured';
        else if (billingStatus && /action|required|overdue|insufficient/i.test(billingStatus)) billingReadiness = 'action_required';
        else billingReadiness = 'unknown';
      }
      const precisionRaw = matching.currency_precision ?? matching.currencyPrecision;
      await upsertAdvertiser({
        ...current,
        name: text(matching, ['advertiser_name', 'account_name', 'name']) || current.name,
        currency: text(matching, ['currency']) || current.currency,
        currencyPrecision: typeof precisionRaw === 'number' && Number.isInteger(precisionRaw) ? precisionRaw : current.currencyPrecision,
        timezone: text(matching, ['timezone', 'timezone_name']) || current.timezone,
        status: text(matching, ['status', 'operation_status']) || current.status,
        reviewStatus: text(matching, ['review_status', 'audit_status', 'verification_status']) || current.reviewStatus,
        billingReadiness,
        lastReconciledAt: new Date().toISOString(),
        version: current.version + 1,
      });
    }
    if (request.capability === 'LEAD_READ') {
      const leads = extractObjects(result)
        .filter((record) => !text(record, ['advertiser_id']) || text(record, ['advertiser_id']) === request.advertiserId)
        .map((record) => ({ remoteLeadId: providerId(record, ['lead_id']), data: record }))
        .filter((entry): entry is { remoteLeadId: string; data: Record<string, unknown> } => Boolean(entry.remoteLeadId));
      const deduped = Array.from(new Map(leads.map((lead) => [lead.remoteLeadId, lead])).values()).slice(0, 10_000);
      const ingestion = await persistLeadRecords({ organizationId: request.organizationId, advertiserId: request.advertiserId, leads: deduped });
      return { ingestion };
    }
    if (request.capability === 'REPORT_READ') {
      const rows = extractObjects(result)
        .filter((record) => !text(record, ['advertiser_id']) || text(record, ['advertiser_id']) === request.advertiserId)
        .filter((record) => Object.keys(record).some((key) => ['spend', 'impressions', 'reach', 'clicks', 'conversions', 'leads', 'video_views'].includes(key)));
      const advertiser = await getAdvertiser(request.organizationId, request.advertiserId);
      const reporting = await persistReportingRows({ organizationId: request.organizationId, advertiserId: request.advertiserId, rows, reportingTimezone: advertiser.timezone });
      return { reporting };
    }
    const syncTypes: Partial<Record<TikTokCapability, TikTokResourceType[]>> = {
      CAMPAIGN_READ: ['campaign'],
      ADGROUP_READ: ['adgroup', 'campaign'],
      AD_READ: ['ad', 'adgroup', 'campaign', 'creative', 'video', 'identity', 'tiktok_post'],
      ASSET_DISCOVERY: ['creative', 'video', 'identity', 'tiktok_post'],
      LEAD_FORM_READ: ['form'],
      AD_REVIEW_READ: ['ad', 'adgroup'],
      TIKTOK_ACCOUNT_AUTHORIZE: ['identity'],
    };
    const allowedTypes = syncTypes[request.capability];
    if (allowedTypes?.length) {
      const seen = new Set<string>();
      const resources = collectIds(result)
        .filter((item) => {
          const key = `${item.type}:${item.id}`;
          if (!allowedTypes.includes(item.type) || seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 10_000)
        .map((item) => ({
          organizationId: request.organizationId,
          advertiserId: request.advertiserId!,
          resourceType: item.type,
          resourceId: item.id,
          propertyId: request.propertyId || null,
          operationId,
        }));
      await registerResources(resources);
    }
    return result;
  }

  async execute(request: TikTokOperationRequest): Promise<TikTokOperationResult> {
    assertKillSwitches(request.capability);
    assertActorPolicy(request.actor, request.capability);
    if (CAPABILITY_CLASSIFICATION[request.capability] === 'CURRENTLY_UNSUPPORTED') {
      throw new TikTokAdsError('CAPABILITY_UNAVAILABLE', `${request.capability} nu este oferit oficial în prezent.`);
    }
    if (!request.advertiserId && !['ADVERTISER_DISCOVERY', 'ADVERTISER_PROVISION', 'EVENT_SUBSCRIBE'].includes(request.capability)) {
      throw new TikTokAdsError('INVALID_REQUEST', 'advertiserId este obligatoriu pentru această operație TikTok Ads.');
    }
    const advertiser = request.advertiserId ? await getAdvertiser(request.organizationId, request.advertiserId) : null;
    assertCapabilityPayloadBoundaries(request.capability, request.payload);
    if (advertiser && OPERATION_CLASS[request.capability] !== 'READ_ONLY') {
      assertAdvertiserWriteEligibility(advertiser);
      if (request.expectedVersion != null && request.expectedVersion !== advertiser.version) {
        throw new TikTokAdsError('CONFLICT', 'Advertiser-ul TikTok s-a modificat între citire și această operație. Reîncarcă statusul și încearcă din nou.');
      }
      validateMoneyPayload(request.payload, advertiser);
      assertSignificantChangeSafeguard(request.capability, request.payload, advertiser.currencyPrecision ?? 0, advertiser.timezone);
      if (OPERATION_CLASS[request.capability] === 'SPEND_AFFECTING' && advertiser.billingReadiness !== 'ready') {
        throw new TikTokAdsError('BILLING_NOT_READY', 'Advertiser-ul TikTok nu este confirmat billing ready.');
      }
    }

    const isReadOnly = OPERATION_CLASS[request.capability] === 'READ_ONLY';
    const shouldAudit = !isReadOnly || ['TIKTOK_PERMISSION_READ', 'TIKTOK_PERMISSION_RECONCILE', 'ADVERTISER_STATUS', 'BILLING_READINESS', 'ACCOUNT_REVIEW_READ', 'LEAD_READ'].includes(request.capability);
    const begun = isReadOnly
      ? { record: { operationId: `read_${randomUUID()}`, retryCount: 0, createdResourceIds: [] as Array<{ resourceType: string; resourceId: string }> }, cachedResult: null }
      : await beginOperation(request);
    if (begun.cachedResult) return begun.cachedResult;
    const operationId = begun.record.operationId;
    let release: () => Promise<unknown> = async () => undefined;
    try {
      if (OPERATION_CLASS[request.capability] === 'SPEND_AFFECTING' && !('spendAuthorizedAt' in begun.record && begun.record.spendAuthorizedAt)) {
        await consumeSpendAuthorization(request);
        await updateOperation(request.organizationId, operationId, { spendAuthorizedAt: new Date().toISOString() });
      }
      const resolutions = await this.discoverCapabilities(request.organizationId);
      const resolution = resolutions.find((item) => item.capability === request.capability);
      if (!resolution?.executionAllowed || resolution.schemaStatus !== 'compatible') {
        throw new TikTokAdsError('SCHEMA_INCOMPATIBLE', resolution?.reason || 'Capability-ul nu este disponibil după discovery.');
      }
      const tools = await this.tools(request.organizationId);
      if (request.advertiserId && OPERATION_CLASS[request.capability] !== 'READ_ONLY') {
        const target = mutationTarget(request.capability, request.payload);
        const lockResource = target ? `${target.type}:${target.id}` : request.propertyId ? `property:${request.propertyId}` : null;
        release = await acquireMutationLock({ organizationId: request.organizationId, advertiserId: request.advertiserId, capability: request.capability, resourceId: lockResource, owner: operationId });
      }
      if (shouldAudit) {
        await appendAudit({ organizationId: request.organizationId, actorUid: request.actor.uid, operation: request.capability, targetType: 'advertiser', targetId: request.advertiserId, outcome: 'attempted', correlationId: request.correlationId });
      }
      let remoteResult: unknown;
      let created = [...begun.record.createdResourceIds];
      if (request.capability === 'SPARK_NEW_VIDEO_AD_ONLY') {
        const workflow = await this.executeAdsOnly(request, tools, operationId, created);
        remoteResult = workflow.result;
        created = workflow.created;
      } else if (request.capability === 'SPARK_EXISTING_POST') {
        const existingAd = created.find((item) => item.resourceType === 'ad');
        const workflow = existingAd
          ? { result: { recoveredAdId: existingAd.resourceId }, created: [] }
          : await this.executeExistingPost(request, tools, operationId);
        remoteResult = workflow.result;
        created.push(...workflow.created);
      } else if (request.capability === 'TIKTOK_PERMISSION_RECONCILE' || request.capability === 'TIKTOK_PERMISSION_READ') {
        remoteResult = await this.reconcilePermissions(request, tools, request.payload);
      } else {
        const createType = CREATE_RESOURCE[request.capability];
        const recovered = createType ? created.find((item) => item.resourceType === createType) : null;
        if (recovered) {
          remoteResult = { recoveredResourceId: recovered.resourceId, recoveredResourceType: recovered.resourceType };
        } else {
          const invoked = await this.invokeSingle({ request, capability: this.effectiveCapability(request.capability, request.payload), payload: request.payload, tools, operationId });
          remoteResult = await this.postProcessRead(request, invoked.result, operationId);
          if (invoked.created) created.push(invoked.created);
        }
      }
      const result: TikTokOperationResult = { operationId, capability: request.capability, status: 'succeeded', remoteResult, createdResourceIds: created, correlationId: request.correlationId };
      if (!isReadOnly) {
        await updateOperation(request.organizationId, operationId, { status: 'succeeded', currentStep: 'completed', result, createdResourceIds: created, recoverable: false, lastErrorCode: null });
      }
      if (shouldAudit) {
        await appendAudit({ organizationId: request.organizationId, actorUid: request.actor.uid, operation: request.capability, targetType: 'advertiser', targetId: request.advertiserId, outcome: 'succeeded', correlationId: request.correlationId, safeMetadata: { operationId, createdResourceCount: created.length } });
      }
      return result;
    } catch (error) {
      if (error instanceof TikTokAdsError && error.code === 'SCHEMA_INCOMPATIBLE') {
        await markCapabilityIncompatible(request.organizationId, request.capability, 'Contractul MCP runtime nu mai corespunde schemei validate.').catch(() => undefined);
        console.error(JSON.stringify({ event: 'tiktok_mcp_schema_incompatible', organizationId: request.organizationId, capability: request.capability, correlationId: request.correlationId }));
      }
      const latest = isReadOnly ? null : await getOperation(request.organizationId, operationId).catch(() => null);
      const created = latest?.createdResourceIds || begun.record.createdResourceIds;
      const partial = created.length > 0;
      const errorCode = error instanceof TikTokAdsError ? error.code : 'PROVIDER_UNAVAILABLE';
      const remoteOutcomeUnknown = !isReadOnly && ['TIMEOUT', 'PROVIDER_UNAVAILABLE', 'PARTIAL_FAILURE', 'RATE_LIMITED'].includes(errorCode);
      if (!isReadOnly) {
        await updateOperation(request.organizationId, operationId, {
          status: partial || remoteOutcomeUnknown ? 'pending_recovery' : 'failed',
          currentStep: partial || remoteOutcomeUnknown ? 'recovery_required' : 'failed',
          recoverable: partial || remoteOutcomeUnknown,
          remoteOutcomeUnknown,
          lastErrorCode: errorCode,
        });
      }
      if (shouldAudit) {
        await appendAudit({ organizationId: request.organizationId, actorUid: request.actor.uid, operation: request.capability, targetType: 'advertiser', targetId: request.advertiserId, outcome: partial || remoteOutcomeUnknown ? 'partial' : 'failed', correlationId: request.correlationId, safeMetadata: { operationId, errorCode, remoteOutcomeUnknown } });
      }
      throw error;
    } finally {
      await release();
    }
  }

  async synchronizeAdvertisers(organizationId: string, actorUid: string) {
    const tools = await this.tools(organizationId);
    const tool = findToolForCapability('ADVERTISER_DISCOVERY', tools);
    if (!tool) throw new TikTokAdsError('CAPABILITY_UNAVAILABLE', 'TikTok MCP nu a expus advertiser discovery.');
    const { accessToken, connection } = await getValidTikTokMcpAccessToken(organizationId);
    const release = await acquireTenantProviderSlot(organizationId);
    let result: unknown;
    try {
      result = await new TikTokMcpClient(connection.resourceUrl, accessToken).callToolPaginated(tool, {}, `advertisers-${organizationId}`);
    } finally {
      await release();
    }
    const existing = await listAdvertisers(organizationId);
    const selectedId = existing.find((item) => item.selected)?.advertiserId || null;
    const seen = new Set<string>();
    const discovered = extractObjects(result).flatMap((record) => {
      const advertiserId = providerId(record, ['advertiser_id', 'account_id', 'advertiserId']);
      if (!advertiserId || seen.has(advertiserId)) return [];
      seen.add(advertiserId);
      return [{ advertiserId, record }];
    });
    const autoSelectedId = selectedId && seen.has(selectedId) ? selectedId : (discovered.length === 1 ? discovered[0].advertiserId : null);
    for (const { advertiserId, record } of discovered) {
      const precisionRaw = record.currency_precision ?? record.currencyPrecision;
      const advertiser: TikTokAdvertiserRecord = {
        organizationId,
        advertiserId,
        name: text(record, ['advertiser_name', 'account_name', 'name']),
        currency: text(record, ['currency']),
        currencyPrecision: typeof precisionRaw === 'number' && Number.isInteger(precisionRaw) ? precisionRaw : null,
        timezone: text(record, ['timezone', 'timezone_name']),
        status: text(record, ['status', 'operation_status']),
        reviewStatus: text(record, ['review_status', 'audit_status']),
        billingReadiness: 'unknown',
        authorized: true,
        selected: autoSelectedId === advertiserId,
        discoveredAt: new Date().toISOString(),
        lastReconciledAt: new Date().toISOString(),
        version: (existing.find((item) => item.advertiserId === advertiserId)?.version || 0) + 1,
      };
      await upsertAdvertiser(advertiser);
    }
    for (const missing of existing.filter((advertiser) => !seen.has(advertiser.advertiserId))) {
      await upsertAdvertiser({
        ...missing,
        authorized: false,
        selected: false,
        status: 'removed_access',
        lastReconciledAt: new Date().toISOString(),
        version: missing.version + 1,
      });
    }
    if (autoSelectedId) {
      await selectAdvertiser(organizationId, autoSelectedId);
    } else {
      await clearSelectedAdvertiser(organizationId);
    }
    await appendAudit({ organizationId, actorUid, operation: 'ADVERTISER_DISCOVERY', outcome: 'succeeded', correlationId: `advertisers-${organizationId}`, safeMetadata: { count: seen.size } });
    return listAdvertisers(organizationId);
  }
}
