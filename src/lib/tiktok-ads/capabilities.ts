import { createHash } from 'node:crypto';
import type {
  JsonSchema,
  TikTokCapability,
  TikTokCapabilityClassification,
  TikTokCapabilityResolution,
  TikTokMcpTool,
  TikTokOperationClass,
} from './types';
import { TIKTOK_CAPABILITIES } from './types';
import { isJsonSchemaCompilable } from './mcp-client';

type Matcher = {
  include: string[][];
  exclude?: string[];
};

const EXACT_TOOL_NAMES: Partial<Record<TikTokCapability, RegExp[]>> = {
  ADVERTISER_DISCOVERY: [/(?:^|\/)oauth2\/advertiser\/get$/, /(?:^|\/)advertiser\/get$/],
  ADVERTISER_STATUS: [/(?:^|\/)advertiser\/info(?:\/get)?$/],
  BILLING_READINESS: [/(?:^|\/)advertiser\/balance\/get$/, /(?:^|\/)bc\/balance\/get$/],
  TIKTOK_ACCOUNT_AUTHORIZE: [/(?:^|\/)bc\/asset\/account\/authorization$/],
  TIKTOK_PERMISSION_READ: [/(?:^|\/)identity\/get$/],
  ASSET_DISCOVERY: [/(?:^|\/)identity\/video\/get$/],
  CREATIVE_UPLOAD: [/(?:^|\/)file\/video\/ad\/upload$/, /(?:^|\/)video\/upload$/],
  CAMPAIGN_READ: [/(?:^|\/)campaign\/get$/],
  CAMPAIGN_CREATE: [/(?:^|\/)campaign\/create$/],
  CAMPAIGN_UPDATE: [/(?:^|\/)campaign\/update$/],
  CAMPAIGN_ACTIVATE: [/(?:^|\/)campaign\/status\/update$/],
  CAMPAIGN_PAUSE: [/(?:^|\/)campaign\/status\/update$/],
  CAMPAIGN_RESUME: [/(?:^|\/)campaign\/status\/update$/],
  ADGROUP_READ: [/(?:^|\/)adgroup\/get$/, /(?:^|\/)ad\/group\/get$/],
  ADGROUP_CREATE: [/(?:^|\/)adgroup\/create$/, /(?:^|\/)ad\/group\/create$/],
  ADGROUP_UPDATE: [/(?:^|\/)adgroup\/update$/, /(?:^|\/)ad\/group\/update$/],
  ADGROUP_PAUSE: [/(?:^|\/)adgroup\/status\/update$/, /(?:^|\/)ad\/group\/status\/update$/],
  ADGROUP_RESUME: [/(?:^|\/)adgroup\/status\/update$/, /(?:^|\/)ad\/group\/status\/update$/],
  AD_READ: [/(?:^|\/)ad\/get$/],
  AD_CREATE: [/(?:^|\/)ad\/create$/],
  AD_UPDATE: [/(?:^|\/)ad\/update$/],
  AD_PAUSE: [/(?:^|\/)ad\/status\/update$/],
  AD_RESUME: [/(?:^|\/)ad\/status\/update$/],
  AD_REVIEW_READ: [/(?:^|\/)ad\/review\/(?:info|get)$/],
  TARGETING_READ: [/(?:^|\/)tool\/targeting\/(?:search|get)$/],
  REPORT_READ: [/(?:^|\/)report\/integrated\/get$/],
  LEAD_FORM_READ: [/(?:^|\/)page(?:\/library)?\/get$/],
  LEAD_READ: [/(?:^|\/)lead\/(?:get|download)$/],
};

const SPECIALIZED_CREATE_NAMESPACE = /(?:^|\/)(?:smart\/plus|gmv\/max|business\/spark\/ad|tto|split\/test)(?:\/|$)/;

export const CAPABILITY_CLASSIFICATION: Record<TikTokCapability, TikTokCapabilityClassification> = {
  ADVERTISER_DISCOVERY: 'MCP_NATIVE',
  ADVERTISER_PROVISION: 'EXTERNAL_APPROVAL_REQUIRED',
  ADVERTISER_STATUS: 'MCP_NATIVE',
  BILLING_READINESS: 'MCP_NATIVE',
  TIKTOK_ACCOUNT_AUTHORIZE: 'MCP_NATIVE',
  TIKTOK_PERMISSION_READ: 'MCP_NATIVE',
  TIKTOK_PERMISSION_RECONCILE: 'MCP_NATIVE',
  ASSET_DISCOVERY: 'MCP_NATIVE',
  SPARK_EXISTING_POST: 'MCP_NATIVE',
  SPARK_NEW_VIDEO_AD_ONLY: 'MCP_NATIVE',
  CREATIVE_UPLOAD: 'MCP_NATIVE',
  CAMPAIGN_READ: 'MCP_NATIVE',
  CAMPAIGN_CREATE: 'MCP_NATIVE',
  CAMPAIGN_UPDATE: 'MCP_NATIVE',
  CAMPAIGN_ACTIVATE: 'MCP_NATIVE',
  CAMPAIGN_PAUSE: 'MCP_NATIVE',
  CAMPAIGN_RESUME: 'MCP_NATIVE',
  ADGROUP_READ: 'MCP_NATIVE',
  ADGROUP_CREATE: 'MCP_NATIVE',
  ADGROUP_UPDATE: 'MCP_NATIVE',
  ADGROUP_PAUSE: 'MCP_NATIVE',
  ADGROUP_RESUME: 'MCP_NATIVE',
  AD_READ: 'MCP_NATIVE',
  AD_CREATE: 'MCP_NATIVE',
  AD_UPDATE: 'MCP_NATIVE',
  AD_PAUSE: 'MCP_NATIVE',
  AD_RESUME: 'MCP_NATIVE',
  AD_REVIEW_READ: 'MCP_NATIVE',
  TARGETING_READ: 'MCP_NATIVE',
  TARGETING_UPDATE: 'MCP_NATIVE',
  BUDGET_UPDATE: 'MCP_NATIVE',
  BID_UPDATE: 'MCP_NATIVE',
  SCHEDULE_UPDATE: 'MCP_NATIVE',
  REPORT_READ: 'MCP_NATIVE',
  LEAD_FORM_READ: 'MCP_NATIVE',
  // The current official MCP/API tool library exposes form libraries and fields,
  // but not an official server-side Instant Form creation operation.
  LEAD_FORM_CREATE: 'CURRENTLY_UNSUPPORTED',
  LEAD_READ: 'MCP_NATIVE',
  EVENT_SUBSCRIBE: 'MCP_NATIVE',
  ACCOUNT_REVIEW_READ: 'MCP_NATIVE',
};

export const OPERATION_CLASS: Record<TikTokCapability, TikTokOperationClass> = {
  ADVERTISER_DISCOVERY: 'READ_ONLY',
  ADVERTISER_PROVISION: 'NON_FINANCIAL_WRITE',
  ADVERTISER_STATUS: 'READ_ONLY',
  BILLING_READINESS: 'READ_ONLY',
  TIKTOK_ACCOUNT_AUTHORIZE: 'NON_FINANCIAL_WRITE',
  TIKTOK_PERMISSION_READ: 'READ_ONLY',
  TIKTOK_PERMISSION_RECONCILE: 'READ_ONLY',
  ASSET_DISCOVERY: 'READ_ONLY',
  // Both workflows force campaign/ad group/ad creation to DISABLE. They become
  // spend-affecting only when the separately authorized resume/activate calls run.
  SPARK_EXISTING_POST: 'NON_FINANCIAL_WRITE',
  SPARK_NEW_VIDEO_AD_ONLY: 'NON_FINANCIAL_WRITE',
  CREATIVE_UPLOAD: 'NON_FINANCIAL_WRITE',
  CAMPAIGN_READ: 'READ_ONLY',
  CAMPAIGN_CREATE: 'NON_FINANCIAL_WRITE',
  CAMPAIGN_UPDATE: 'NON_FINANCIAL_WRITE',
  CAMPAIGN_ACTIVATE: 'SPEND_AFFECTING',
  CAMPAIGN_PAUSE: 'NON_FINANCIAL_WRITE',
  CAMPAIGN_RESUME: 'SPEND_AFFECTING',
  ADGROUP_READ: 'READ_ONLY',
  ADGROUP_CREATE: 'NON_FINANCIAL_WRITE',
  ADGROUP_UPDATE: 'NON_FINANCIAL_WRITE',
  ADGROUP_PAUSE: 'NON_FINANCIAL_WRITE',
  ADGROUP_RESUME: 'SPEND_AFFECTING',
  AD_READ: 'READ_ONLY',
  AD_CREATE: 'NON_FINANCIAL_WRITE',
  AD_UPDATE: 'NON_FINANCIAL_WRITE',
  AD_PAUSE: 'NON_FINANCIAL_WRITE',
  AD_RESUME: 'SPEND_AFFECTING',
  AD_REVIEW_READ: 'READ_ONLY',
  TARGETING_READ: 'READ_ONLY',
  TARGETING_UPDATE: 'NON_FINANCIAL_WRITE',
  BUDGET_UPDATE: 'SPEND_AFFECTING',
  BID_UPDATE: 'SPEND_AFFECTING',
  SCHEDULE_UPDATE: 'SPEND_AFFECTING',
  REPORT_READ: 'READ_ONLY',
  LEAD_FORM_READ: 'READ_ONLY',
  LEAD_FORM_CREATE: 'NON_FINANCIAL_WRITE',
  LEAD_READ: 'READ_ONLY',
  EVENT_SUBSCRIBE: 'NON_FINANCIAL_WRITE',
  ACCOUNT_REVIEW_READ: 'READ_ONLY',
};

const MATCHERS: Partial<Record<TikTokCapability, Matcher>> = {
  ADVERTISER_DISCOVERY: { include: [['advertiser', 'ad account'], ['get', 'list', 'authorized']], exclude: ['create', 'update', 'disable'] },
  ADVERTISER_PROVISION: { include: [['ad account'], ['create', 'provision']] },
  ADVERTISER_STATUS: { include: [['ad account', 'advertiser'], ['detail', 'info', 'status']], exclude: ['report'] },
  BILLING_READINESS: { include: [['balance', 'billing', 'payment'], ['get', 'read']] },
  TIKTOK_ACCOUNT_AUTHORIZE: { include: [['tiktok account'], ['authorization', 'authorize'], ['delivery', 'link']] },
  TIKTOK_PERMISSION_READ: { include: [['tiktok account', 'identity'], ['permission', 'binding', 'linked', 'authorization'], ['get', 'list', 'status']] },
  ASSET_DISCOVERY: { include: [['identity', 'video', 'asset', 'post'], ['get', 'list', 'search']], exclude: ['upload', 'create', 'delete'] },
  CREATIVE_UPLOAD: { include: [['video'], ['upload']], exclude: ['catalog', 'message'] },
  CAMPAIGN_READ: { include: [['campaign'], ['get', 'list']], exclude: ['report', 'create', 'update', 'copy'] },
  CAMPAIGN_CREATE: { include: [['campaign'], ['create']], exclude: ['report', 'copy task', 'smart+', 'smart plus', 'gmv max', 'spark ad in one step'] },
  CAMPAIGN_UPDATE: { include: [['campaign'], ['update']], exclude: ['status', 'budget', 'report'] },
  CAMPAIGN_ACTIVATE: { include: [['campaign'], ['status', 'enable', 'activate']] },
  CAMPAIGN_PAUSE: { include: [['campaign'], ['status', 'disable', 'pause']] },
  CAMPAIGN_RESUME: { include: [['campaign'], ['status', 'enable', 'resume']] },
  ADGROUP_READ: { include: [['ad group', 'adgroup'], ['get', 'list']], exclude: ['report', 'review', 'diagnos'] },
  ADGROUP_CREATE: { include: [['ad group', 'adgroup'], ['create']], exclude: ['report', 'smart+', 'smart plus', 'gmv max'] },
  ADGROUP_UPDATE: { include: [['ad group', 'adgroup'], ['update']], exclude: ['status', 'budget'] },
  ADGROUP_PAUSE: { include: [['ad group', 'adgroup'], ['status', 'pause', 'disable']] },
  ADGROUP_RESUME: { include: [['ad group', 'adgroup'], ['status', 'resume', 'enable']] },
  AD_READ: { include: [[' ad ', ' ads ', '/ad/', 'ad_get', 'get ads'], ['get', 'list']], exclude: ['group', 'report', 'review', 'account'] },
  AD_CREATE: { include: [[' ad ', ' ads ', '/ad/', 'ad_create', 'create ads'], ['create']], exclude: ['group', 'account', 'report', 'smart+', 'smart plus', 'gmv max', 'aco'] },
  AD_UPDATE: { include: [[' ad ', ' ads ', '/ad/', 'ad_update', 'update ads'], ['update']], exclude: ['group', 'account', 'status', 'report'] },
  AD_PAUSE: { include: [[' ad ', ' ads ', '/ad/'], ['status', 'pause', 'disable']], exclude: ['group', 'account'] },
  AD_RESUME: { include: [[' ad ', ' ads ', '/ad/'], ['status', 'resume', 'enable']], exclude: ['group', 'account'] },
  AD_REVIEW_READ: { include: [['ad'], ['review'], ['get', 'info']] },
  TARGETING_READ: { include: [['target', 'location', 'interest', 'behavior', 'audience'], ['get', 'list', 'search', 'estimate']], exclude: ['update', 'create', 'delete'] },
  REPORT_READ: { include: [['report'], ['get', 'run', 'request']], exclude: ['create campaign'] },
  LEAD_FORM_READ: { include: [['form', 'page library', 'instant form'], ['get', 'field', 'library']], exclude: ['lead get', 'mock'] },
  LEAD_READ: { include: [['lead'], ['get', 'download', 'retrieve']], exclude: ['mock', 'create', 'delete'] },
  EVENT_SUBSCRIBE: { include: [['subscription', 'webhook'], ['create', 'subscribe']] },
  ACCOUNT_REVIEW_READ: { include: [['verification', 'review', 'ad account'], ['status', 'detail', 'get']], exclude: ['submit', 'upload', 'appeal'] },
};

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, stable(child)]));
  }
  return value;
}

export function hashToolSchema(tool: TikTokMcpTool) {
  return createHash('sha256').update(JSON.stringify(stable({ input: tool.inputSchema, output: tool.outputSchema || null }))).digest('hex');
}

function searchable(tool: TikTokMcpTool) {
  return ` ${tool.name} ${tool.title || ''} ${tool.description || ''} `.toLowerCase().replace(/[_-]+/g, ' ');
}

function normalizedToolName(tool: TikTokMcpTool) {
  return tool.name.toLowerCase().replace(/[^a-z0-9]+/g, '/').replace(/^\/+|\/+$/g, '');
}

function exactToolNameScore(capability: TikTokCapability, tool: TikTokMcpTool) {
  const name = normalizedToolName(tool);
  if (['CAMPAIGN_CREATE', 'ADGROUP_CREATE', 'AD_CREATE'].includes(capability) && SPECIALIZED_CREATE_NAMESPACE.test(name)) return null;
  const index = EXACT_TOOL_NAMES[capability]?.findIndex((pattern) => pattern.test(name)) ?? -1;
  return index < 0 ? null : 200 - index;
}

function schemaFieldNames(schema: JsonSchema, fields = new Set<string>(), required = new Set<string>()) {
  for (const [key, child] of Object.entries(schema.properties || {})) {
    fields.add(key.replace(/[^a-z0-9]/gi, '').toLowerCase());
    schemaFieldNames(child, fields, required);
  }
  for (const key of schema.required || []) required.add(key.replace(/[^a-z0-9]/gi, '').toLowerCase());
  if (schema.items) schemaFieldNames(schema.items, fields, required);
  for (const variant of [...(schema.anyOf || []), ...(schema.oneOf || []), ...(schema.allOf || [])]) {
    schemaFieldNames(variant, fields, required);
  }
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    schemaFieldNames(schema.additionalProperties, fields, required);
  }
  return { fields, required };
}

function schemaContractScore(capability: TikTokCapability, tool: TikTokMcpTool) {
  const toolName = normalizedToolName(tool);
  if (['CAMPAIGN_CREATE', 'ADGROUP_CREATE', 'AD_CREATE'].includes(capability) && SPECIALIZED_CREATE_NAMESPACE.test(toolName)) return -1;
  const { fields, required } = schemaFieldNames(tool.inputSchema);
  const has = (...names: string[]) => names.some((name) => fields.has(name));
  const requires = (...names: string[]) => names.some((name) => required.has(name));

  if (capability === 'ADVERTISER_DISCOVERY') {
    return requires('advertiserid', 'advertiserids', 'adaccountid', 'adaccountids') ? -1 : 5;
  }
  if (capability === 'CREATIVE_UPLOAD') {
    if (has('musicscene', 'searchtype', 'filtering', 'carouselimageindex', 'catalogauthorizedbcid')) return -1;
    return has('uploadtype', 'videofile', 'videourl', 'sourceurl', 'fileurl', 'filename', 'videosignature') ? 15 : -1;
  }
  if (capability === 'CAMPAIGN_CREATE') {
    if (requires('campaignid', 'campaignids')) return -1;
    return has('campaignname') && has('objectivetype', 'objective', 'advertisingobjective') ? 15 : -1;
  }
  if (capability === 'ADGROUP_CREATE') {
    if (requires('adgroupid', 'adgroupids')) return -1;
    return has('campaignid') && has('adgroupname') ? 15 : -1;
  }
  if (capability === 'AD_CREATE') {
    if (requires('adid', 'adids')) return -1;
    return has('adgroupid') && has('adname', 'creatives', 'creative', 'creativeinfo', 'videoinfo', 'videoid', 'adtext', 'adtextlist') ? 15 : -1;
  }
  return 0;
}

function scoreTool(tool: TikTokMcpTool, matcher: Matcher, capability: TikTokCapability) {
  const text = searchable(tool);
  if (matcher.exclude?.some((token) => text.includes(token))) return -1;
  const exactScore = exactToolNameScore(capability, tool);
  // The full-disclosure server exposes stable API endpoint names. When such a
  // contract is known, never let prose keywords bind an unrelated one of the
  // roughly 400 tools (for example asset_bind_quota_get as AD_READ).
  if (EXACT_TOOL_NAMES[capability]?.length && exactScore == null) return -1;
  let score = exactScore ?? 0;
  if (exactScore == null) {
    for (const group of matcher.include) {
      const matches = group.filter((token) => text.includes(token));
      if (!matches.length) return -1;
      score += 10 + matches.length;
    }
  }
  const contractScore = schemaContractScore(capability, tool);
  if (contractScore < 0) return -1;
  score += contractScore;
  if (tool.annotations?.readOnlyHint) score += 1;
  return score;
}

export function isWellFormedToolSchema(schema: JsonSchema) {
  if (!schema || typeof schema !== 'object') return false;
  if (schema.type && schema.type !== 'object' && !(Array.isArray(schema.type) && schema.type.includes('object'))) return false;
  if (schema.properties && typeof schema.properties !== 'object') return false;
  if (schema.required && (!Array.isArray(schema.required) || schema.required.some((item) => typeof item !== 'string'))) return false;
  return isJsonSchemaCompilable(schema);
}

function resolveDirect(capability: TikTokCapability, tools: TikTokMcpTool[], now: string): TikTokCapabilityResolution {
  const classification = CAPABILITY_CLASSIFICATION[capability];
  const operationClass = OPERATION_CLASS[capability];
  if (classification === 'CURRENTLY_UNSUPPORTED') {
    return { capability, classification, operationClass, available: false, executionAllowed: false, reason: 'Documentația oficială curentă nu expune această operație.', toolName: null, schemaHash: null, schemaStatus: 'unsupported', discoveredAt: now };
  }
  const matcher = MATCHERS[capability];
  if (!matcher) {
    return { capability, classification, operationClass, available: false, executionAllowed: false, reason: 'Capabilitate compusă; se rezolvă numai după validarea dependențelor runtime.', toolName: null, schemaHash: null, schemaStatus: 'not_discovered', discoveredAt: now };
  }
  const scoredCandidates = tools
    .map((tool) => ({ tool, score: scoreTool(tool, matcher, capability) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name));
  // Full MCP can expose the same API endpoint through both a slash path and a
  // generated underscore name. Equal endpoint+schema representations are one
  // contract, not an ambiguous choice. Different schemas remain fail-closed.
  const candidates = Array.from(new Map(scoredCandidates.map((item) => [
    exactToolNameScore(capability, item.tool) == null
      ? `tool:${item.tool.name}`
      : `endpoint:${item.score}:${hashToolSchema(item.tool)}`,
    item,
  ])).values());
  const best = candidates[0];
  if (!best) {
    return { capability, classification, operationClass, available: false, executionAllowed: false, reason: 'Niciun tool MCP compatibil nu a fost descoperit.', toolName: null, schemaHash: null, schemaStatus: 'not_discovered', discoveredAt: now };
  }
  if (candidates[1] && candidates[1].score === best.score) {
    return { capability, classification, operationClass, available: false, executionAllowed: false, reason: 'Discovery-ul MCP este ambiguu; operația este dezactivată fail-closed.', toolName: null, schemaHash: null, schemaStatus: 'ambiguous', discoveredAt: now };
  }
  if (!isWellFormedToolSchema(best.tool.inputSchema) || best.tool.outputSchema && !isJsonSchemaCompilable(best.tool.outputSchema)) {
    return { capability, classification, operationClass, available: false, executionAllowed: false, reason: 'Schema MCP nu este un JSON Schema de input compatibil.', toolName: best.tool.name, schemaHash: hashToolSchema(best.tool), schemaStatus: 'changed', discoveredAt: now };
  }
  if (capability === 'EVENT_SUBSCRIBE') {
    return {
      capability,
      classification,
      operationClass,
      available: true,
      executionAllowed: false,
      reason: 'Subscription API este disponibil, dar Imodeus folosește polling până când contractul oficial de autentificare a callback-ului poate fi validat end-to-end; abonarea este blocată fail-closed.',
      toolName: best.tool.name,
      schemaHash: hashToolSchema(best.tool),
      schemaStatus: 'compatible',
      discoveredAt: now,
    };
  }
  return {
    capability,
    classification,
    operationClass,
    available: true,
    executionAllowed: classification !== 'EXTERNAL_APPROVAL_REQUIRED',
    reason: classification === 'EXTERNAL_APPROVAL_REQUIRED'
      ? 'Tool-ul există, dar necesită aprobarea și permisiunile Business Center corespunzătoare.'
      : 'Tool MCP oficial descoperit și schema de bază este validă.',
    toolName: best.tool.name,
    schemaHash: hashToolSchema(best.tool),
    schemaStatus: 'compatible',
    discoveredAt: now,
  };
}

export function resolveTikTokCapabilities(tools: TikTokMcpTool[], previous?: Map<TikTokCapability, TikTokCapabilityResolution>) {
  const now = new Date().toISOString();
  const result = new Map(TIKTOK_CAPABILITIES.map((capability) => [capability, resolveDirect(capability, tools, now)]));

  const derive = (capability: TikTokCapability, dependencies: TikTokCapability[]) => {
    const current = result.get(capability)!;
    const resolved = dependencies.map((dependency) => result.get(dependency)!);
    const available = resolved.every((item) => item.available && item.schemaStatus === 'compatible');
    result.set(capability, {
      ...current,
      available,
      executionAllowed: available,
      reason: available
        ? `Workflow MCP compus validat din: ${dependencies.join(', ')}.`
        : `Workflow indisponibil până la validarea: ${dependencies.filter((_, index) => !resolved[index].available).join(', ')}.`,
      schemaStatus: available ? 'compatible' : 'not_discovered',
      schemaHash: available
        ? createHash('sha256').update(resolved.map((item) => item.schemaHash).join(':')).digest('hex')
        : null,
    });
  };
  derive('TIKTOK_PERMISSION_RECONCILE', ['TIKTOK_PERMISSION_READ']);
  derive('SPARK_EXISTING_POST', ['ASSET_DISCOVERY', 'TIKTOK_PERMISSION_READ', 'AD_CREATE']);
  derive('SPARK_NEW_VIDEO_AD_ONLY', ['CREATIVE_UPLOAD', 'TIKTOK_PERMISSION_READ', 'AD_CREATE']);
  derive('TARGETING_UPDATE', ['ADGROUP_UPDATE', 'TARGETING_READ']);
  derive('BUDGET_UPDATE', ['CAMPAIGN_UPDATE', 'ADGROUP_UPDATE']);
  derive('BID_UPDATE', ['ADGROUP_UPDATE']);
  derive('SCHEDULE_UPDATE', ['CAMPAIGN_UPDATE', 'ADGROUP_UPDATE']);

  for (const [capability, resolution] of result) {
    const old = previous?.get(capability);
    const sameTool = Boolean(old?.toolName && resolution.toolName && old.toolName === resolution.toolName);
    const approvedSchemaHash = sameTool
      ? old?.approvedSchemaHash || (old?.schemaStatus === 'compatible' ? old.schemaHash : null) || resolution.schemaHash
      : resolution.schemaHash;
    if (sameTool && approvedSchemaHash && resolution.schemaHash && approvedSchemaHash !== resolution.schemaHash && OPERATION_CLASS[capability] !== 'READ_ONLY') {
      result.set(capability, {
        ...resolution,
        approvedSchemaHash,
        available: false,
        executionAllowed: false,
        schemaStatus: 'changed',
        reason: 'Schema unui tool cu efecte s-a schimbat; capability dezactivată fail-closed până la review.',
      });
    } else {
      result.set(capability, { ...resolution, approvedSchemaHash });
    }
  }
  return Array.from(result.values());
}

export function findToolForCapability(capability: TikTokCapability, tools: TikTokMcpTool[]) {
  const resolution = resolveDirect(capability, tools, new Date().toISOString());
  if (!resolution.toolName || !resolution.available) return null;
  return tools.find((tool) => tool.name === resolution.toolName) || null;
}
