export const TIKTOK_CAPABILITIES = [
  'ADVERTISER_DISCOVERY',
  'ADVERTISER_PROVISION',
  'ADVERTISER_STATUS',
  'BILLING_READINESS',
  'TIKTOK_ACCOUNT_AUTHORIZE',
  'TIKTOK_PERMISSION_READ',
  'TIKTOK_PERMISSION_RECONCILE',
  'ASSET_DISCOVERY',
  'SPARK_EXISTING_POST',
  'SPARK_NEW_VIDEO_AD_ONLY',
  'CREATIVE_UPLOAD',
  'CAMPAIGN_READ',
  'CAMPAIGN_CREATE',
  'CAMPAIGN_UPDATE',
  'CAMPAIGN_ACTIVATE',
  'CAMPAIGN_PAUSE',
  'CAMPAIGN_RESUME',
  'ADGROUP_READ',
  'ADGROUP_CREATE',
  'ADGROUP_UPDATE',
  'ADGROUP_PAUSE',
  'ADGROUP_RESUME',
  'AD_READ',
  'AD_CREATE',
  'AD_UPDATE',
  'AD_PAUSE',
  'AD_RESUME',
  'AD_REVIEW_READ',
  'TARGETING_READ',
  'TARGETING_UPDATE',
  'BUDGET_UPDATE',
  'BID_UPDATE',
  'SCHEDULE_UPDATE',
  'REPORT_READ',
  'LEAD_FORM_READ',
  'LEAD_FORM_CREATE',
  'LEAD_READ',
  'EVENT_SUBSCRIBE',
  'ACCOUNT_REVIEW_READ',
] as const;

export type TikTokCapability = (typeof TIKTOK_CAPABILITIES)[number];

export type TikTokCapabilityClassification =
  | 'MCP_NATIVE'
  | 'BUSINESS_API_REQUIRED'
  | 'EXTERNAL_APPROVAL_REQUIRED'
  | 'CURRENTLY_UNSUPPORTED';

export type TikTokOperationClass =
  | 'READ_ONLY'
  | 'NON_FINANCIAL_WRITE'
  | 'SPEND_AFFECTING'
  | 'DESTRUCTIVE';

export type JsonSchema = {
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  additionalProperties?: boolean | JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  [key: string]: unknown;
};

export type TikTokMcpTool = {
  name: string;
  title?: string;
  description?: string;
  inputSchema: JsonSchema;
  outputSchema?: JsonSchema;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
    [key: string]: unknown;
  };
};

export type TikTokCapabilityResolution = {
  capability: TikTokCapability;
  classification: TikTokCapabilityClassification;
  operationClass: TikTokOperationClass;
  available: boolean;
  executionAllowed: boolean;
  reason: string;
  toolName: string | null;
  schemaHash: string | null;
  approvedSchemaHash?: string | null;
  schemaStatus: 'not_discovered' | 'compatible' | 'changed' | 'ambiguous' | 'unsupported';
  discoveredAt: string | null;
};

export type TikTokActor = {
  uid: string;
  role: 'admin' | 'agent' | 'platform_admin' | undefined;
  type?: 'human' | 'ai' | 'system';
};

export type TikTokOperationRequest = {
  organizationId: string;
  actor: TikTokActor;
  capability: TikTokCapability;
  advertiserId?: string | null;
  propertyId?: string | null;
  payload: Record<string, unknown>;
  idempotencyKey?: string | null;
  authorizationToken?: string | null;
  expectedVersion?: number | null;
  correlationId: string;
};

export type TikTokOperationResult = {
  operationId: string;
  capability: TikTokCapability;
  status: 'succeeded' | 'partial' | 'failed' | 'pending_recovery';
  remoteResult?: unknown;
  createdResourceIds: Array<{ resourceType: string; resourceId: string }>;
  correlationId: string;
};

export type TikTokAdsPort = {
  discoverCapabilities(organizationId: string, force?: boolean): Promise<TikTokCapabilityResolution[]>;
  execute(request: TikTokOperationRequest): Promise<TikTokOperationResult>;
};

export type TikTokMcpConnection = {
  organizationId: string;
  provider: 'tiktok_ads';
  transport: 'mcp';
  connected: boolean;
  encryptedAccessToken: string;
  encryptedRefreshToken?: string | null;
  accessTokenExpiresAt?: string | null;
  refreshTokenExpiresAt?: string | null;
  scope: string[];
  clientId: string;
  authorizationServer: string;
  resourceUrl: string;
  connectedAt: string;
  updatedAt: string;
  revokedAt?: string | null;
  lastAuthorizedByUid?: string | null;
  lastErrorCode?: string | null;
  tokenEncryptionVersion: 1 | 2 | 3;
};

export type TikTokAdvertiserRecord = {
  organizationId: string;
  advertiserId: string;
  name?: string | null;
  currency?: string | null;
  currencyPrecision?: number | null;
  timezone?: string | null;
  status?: string | null;
  reviewStatus?: string | null;
  billingReadiness?: 'ready' | 'not_configured' | 'action_required' | 'unavailable' | 'unknown';
  authorized: boolean;
  selected: boolean;
  discoveredAt: string;
  lastReconciledAt?: string | null;
  version: number;
};

export type TikTokAccountPermissionRecord = {
  organizationId: string;
  advertiserId: string;
  tiktokAccountId: string;
  username?: string | null;
  identityType?: 'AUTH_CODE' | 'TT_USER' | 'BC_AUTH_TT' | 'TTS_TT' | string | null;
  identityAuthorizedBcId?: string | null;
  permissionEvidence?: 'explicit_scopes' | 'advertiser_identity' | null;
  deliverAds: boolean;
  existingPosts: boolean;
  publishAndManageNewVideos: boolean;
  onlyShowAsAds: boolean;
  grantedAt?: string | null;
  revokedAt?: string | null;
  lastVerifiedAt: string;
  verificationStatus: 'verified' | 'stale' | 'revoked' | 'unknown';
};

export type TikTokResourceType =
  | 'campaign'
  | 'adgroup'
  | 'ad'
  | 'creative'
  | 'video'
  | 'identity'
  | 'tiktok_post'
  | 'form'
  | 'lead'
  | 'audience';
