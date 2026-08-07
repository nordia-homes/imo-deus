

export type PromotionStatus = {
  status: 'unpublished' | 'pending' | 'published' | 'error';
  lastSync?: string;
  link?: string;
  views?: number;
  remoteId?: number | string;
  remoteAdId?: number | string | null;
  errorMessage?: string;
  remoteState?: string;
}

export type ImobiliarePromotionSettings = {
  status?: 'draft' | 'online';
  imoradarStatus?: 'draft' | 'online';
  promotions?: {
    special?: boolean;
    top_listing?: boolean;
    top_listing_s?: boolean;
    promo?: boolean;
    promo_zones?: string[];
    pole_position?: boolean;
    promote_imoradar?: boolean;
    bonus?: boolean;
    energy?: number;
    properties_of_the_month?: boolean;
    similar_properties?: boolean;
  };
};

export type ImobiliareMediaLink = {
  type: 'video' | 'virtual_tour';
  link: string;
};

export type CanonicalLocationRef = {
  provider: 'imobiliare';
  locationId: number;
  oldId?: number | null;
  depth: 2 | 3;
  county: string;
  locality: string;
  zone?: string | null;
  display: string;
  searchText?: string;
};

export type BuyerLocationPreference = {
  preference: 'preferred' | 'acceptable' | 'excluded';
  scope: 'location' | 'locality';
  location?: CanonicalLocationRef | null;
  locality?: string | null;
  source?: 'manual' | 'legacy_zone' | 'legacy_city' | 'legacy_general_zone' | 'legacy_text' | 'migration';
  sourceText?: string | null;
  weight?: number;
};

export type PropertyLocationProfile = {
  primary: CanonicalLocationRef | null;
  publishLocationId?: number | null;
  source: 'manual' | 'derived' | 'migrated';
  confidence?: number | null;
};

export type ImobiliarePortalProfile = {
  enabled?: boolean;
  customReference?: string;
  titleOverride?: string;
  descriptionOverride?: string;
  categoryApi?: number | null;
  locationId?: number | null;
  locationLabel?: string | null;
  remoteAgentId?: number | null;
  priceCurrency?: 'EUR' | 'RON' | 'USD';
  streetName?: string;
  streetNumber?: string;
  block?: string;
  entrance?: string;
  apartmentNumber?: string;
  mapMarkerType?: 'pin' | 'square_area';
  gridId?: string;
  dataPropertiesOverrides?: Record<string, unknown>;
  mediaLinks?: ImobiliareMediaLink[];
  performanceReportEmail?: string;
  promotionSettings?: ImobiliarePromotionSettings;
  lastValidationError?: string | null;
  lastPublishedAt?: string | null;
  lastPayloadHash?: string | null;
  lastPublishAuditHistory?: Array<{
    attemptedAt: string;
    stage?: string | null;
    responseStatus?: number | null;
    errorMessage?: string | null;
  }> | null;
};

export type ImobiliareSyncJobSummary = {
  startedAt: string;
  finishedAt: string;
  scanned: number;
  updated: number;
  published: number;
  unpublished: number;
  pending: number;
  errors: number;
  failed: number;
  retried?: number;
};

export type ImobiliareAgentMapping = {
  localAgentId: string;
  localAgentName?: string | null;
  localAgentEmail?: string | null;
  remoteAgentId: number;
  remoteAgentName?: string | null;
  remoteAgentEmail?: string | null;
  source: 'manual' | 'matched_by_email' | 'matched_by_name' | 'created_remote' | 'fallback';
  updatedAt: string;
};

export type ImobiliareAnalyticsSummary = {
  totalProperties: number;
  published: number;
  unpublished: number;
  pending: number;
  errors: number;
  totalViews: number;
  lastSyncAt?: string | null;
  topListings: Array<{
    propertyId: string;
    title: string;
    views: number;
    status: PromotionStatus['status'];
  }>;
};

export type PortalIntegrationPublicStatus = {
  connected: boolean;
  username?: string | null;
  connectedAt?: string | null;
  lastTokenRefreshAt?: string | null;
  lastError?: string | null;
  remoteAccountName?: string | null;
  remoteAgentCount?: number;
  acpUrl?: string | null;
  performanceReportEmail?: string | null;
  defaultPromotionSettings?: ImobiliarePromotionSettings | null;
  lastReconcileAt?: string | null;
  lastReconcileSummary?: ImobiliareSyncJobSummary | null;
  lastRetryAt?: string | null;
  lastRetrySummary?: ImobiliareSyncJobSummary | null;
  agentMappings?: ImobiliareAgentMapping[] | null;
  analytics?: ImobiliareAnalyticsSummary | null;
  scope?: string | null;
  hasVasScopes?: boolean;
  hasLeadScopes?: boolean;
};

export type ImobiliareIntegrationPrivate = {
  provider: 'imobiliare';
  agencyId: string;
  username: string;
  accessToken: string;
  accessTokenExpiresAt: string | null;
  refreshToken: string | null;
  connectedAt: string;
  updatedAt: string;
  remoteAgentCount?: number;
  remoteAccountName?: string | null;
  acpUrl?: string | null;
  performanceReportEmail?: string | null;
  defaultPromotionSettings?: ImobiliarePromotionSettings | null;
  agentMappings?: ImobiliareAgentMapping[] | null;
};

export type StoriaPortalProfile = {
  enabled?: boolean;
  customReference?: string;
  titleOverride?: string;
  descriptionOverride?: string;
  categoryUrn?: string | null;
  market?: 'primary' | 'secondary' | null;
  remoteUuid?: string | null;
  remoteAdId?: string | number | null;
  remoteUrl?: string | null;
  locationExact?: boolean;
  promotionSettings?: StoriaPromotionSettings | null;
  promotionRequests?: StoriaPromotionRequest[] | null;
  promotionRequestTransactionIds?: string[] | null;
  promotionRequestVasUuids?: string[] | null;
  activePromotions?: StoriaActivePromotion[] | null;
  lastPromotionSyncAt?: string | null;
  lastPromotionError?: string | null;
  lastValidationError?: string | null;
  lastPublishedAt?: string | null;
  lastPayloadHash?: string | null;
  lastTransactionId?: string | null;
  lastPublishAuditHistory?: Array<{
    attemptedAt: string;
    stage?: string | null;
    responseStatus?: number | null;
    errorMessage?: string | null;
  }> | null;
};

export type StoriaIntegrationPrivate = {
  provider: 'storia';
  agencyId: string;
  accessToken: string;
  accessTokenExpiresAt: string | null;
  refreshToken: string | null;
  scope?: string | null;
  hasVasScopes?: boolean;
  hasLeadScopes?: boolean;
  connectedAt: string;
  updatedAt: string;
  authorizationState?: string | null;
  lastAuthorizedByUid?: string | null;
  lastAuthorizedAt?: string | null;
};

export type StoriaInboxMessage = {
  id: string;
  createdAt: string;
  direction: 'received' | 'sent';
  text: string;
  senderName?: string | null;
  senderEmail?: string | null;
  senderPhone?: string | number | null;
  transactionId?: string | null;
};

export type StoriaInboxLead = {
  id: string;
  agencyId: string;
  provider: 'storia';
  source: 'storia_incoming_message';
  conversationId: string;
  remoteAdId?: string | number | null;
  remoteAdvertUuid?: string | null;
  propertyId?: string | null;
  propertyTitle?: string | null;
  propertyUrl?: string | null;
  propertyImageUrl?: string | null;
  senderName: string;
  senderEmail?: string | null;
  senderPhone?: string | number | null;
  firstMessage: string;
  latestMessage: string;
  firstMessageAt: string;
  lastMessageAt: string;
  unread: boolean;
  status: 'nou' | 'in_lucru' | 'raspuns' | 'inchis';
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  messages: StoriaInboxMessage[];
  rawLastPayload?: Record<string, unknown> | null;
};

export type StoriaPromotionOption = {
  promotionCode: string;
  displayName?: string | null;
  description?: string | null;
  durationDays?: number[];
  accountType?: string[];
  showDurationSelector?: boolean;
};

export type StoriaPromotionSelection = {
  promotionCode: string;
  durationDays?: number | null;
};

export type StoriaPromotionSettings = {
  selections: StoriaPromotionSelection[];
};

export type StoriaPromotionRequest = {
  transactionId: string;
  promotionCode: string;
  durationDays?: number | null;
  vasUuid?: string | null;
  status: 'requested' | 'applied' | 'error' | 'unknown';
  createdAt: string;
  updatedAt: string;
  errorMessage?: string | null;
};

export type StoriaActivePromotion = {
  vasUuid?: string | null;
  promotionCode: string;
  durationDays?: number | null;
  status: string;
  expiresAt?: string | null;
  url?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  errorMessage?: string | null;
};

export type FacebookGroup = {
  name: string;
  url: string;
};

export type FacebookPromotionJob = {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyDescription: string;
  propertyImages: { url: string; alt: string }[];
  createdAt: string;
  createdBy: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  groups: Array<FacebookGroup & { status: 'pending' | 'opened' | 'posted' | 'skipped' }>;
};

export type FacebookPromotionSession = {
  jobId: string;
  propertyId: string;
  propertyTitle: string;
  propertyDescription: string;
  propertyImages: { url: string; alt: string }[];
  groups: Array<FacebookGroup & { status: 'pending' | 'opened' | 'posted' | 'skipped' }>;
  currentGroupIndex: number;
  startedAt: string;
};

export type FacebookCloudConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'needs_reauthentication'
  | 'error'
  | 'disconnected';

export type FacebookCloudConnection = {
  id: string;
  agencyId: string;
  ownerUid: string;
  label: string;
  displayName?: string | null;
  facebookUserId?: string | null;
  status: FacebookCloudConnectionStatus;
  currentUrl?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt?: string | null;
  runnerMode?: 'cloud' | 'local';
  deviceId?: string | null;
  deletedAt?: string | null;
  localProfileDeleteRequestedAt?: string | null;
  localProfileDeletedAt?: string | null;
};

export type FacebookLocalRunnerDevice = {
  id: string;
  agencyId: string;
  ownerUid: string;
  name: string;
  platform: 'windows';
  appVersion?: string | null;
  timezone: 'Europe/Bucharest';
  status: 'online' | 'offline' | 'on_battery' | 'error';
  isPrimary: boolean;
  lastSeenAt?: string | null;
  lastError?: string | null;
  nextWakeAt?: string | null;
  powerSource?: 'ac' | 'battery' | 'unknown';
  wakeTimersEnabled?: boolean | null;
  createdAt: string;
  updatedAt: string;
};

export type FacebookCloudGroupJobStatus =
  | 'queued'
  | 'publishing'
  | 'submitted'
  | 'pending_approval'
  | 'needs_reauthentication'
  | 'error'
  | 'skipped'
  | 'uncertain';

export type FacebookCloudPublishingJob = {
  id: string;
  agencyId: string;
  ownerUid: string;
  connectionId: string;
  connectionLabel?: string | null;
  propertyId: string;
  propertyTitle: string;
  status:
    | 'scheduled'
    | 'queued'
    | 'running'
    | 'cooldown'
    | 'completed'
    | 'cancelled'
    | 'needs_reauthentication'
    | 'error';
  groups: Array<FacebookGroup & {
    status: FacebookCloudGroupJobStatus;
    startedAt?: string | null;
    submittedAt?: string | null;
    failedAt?: string | null;
    errorMessage?: string | null;
  }>;
  currentGroupIndex: number;
  scheduledAt?: string | null;
  nextRunAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  runnerMode?: 'cloud' | 'local';
  deviceId?: string | null;
  leaseToken?: string | null;
  leaseExpiresAt?: string | null;
  claimedAt?: string | null;
  actualStartedAt?: string | null;
};

export type MetaMarketingIntegrationPublicStatus = {
  provider: 'meta';
  connected: boolean;
  connectedAt?: string | null;
  updatedAt?: string | null;
  lastError?: string | null;
  lastAuthorizedByUid?: string | null;
  metaUserId?: string | null;
  metaUserName?: string | null;
  scopes?: string[];
  selectedBusiness?: {
    id: string;
    name: string;
  } | null;
  selectedAdAccount?: {
    id: string;
    accountId?: string | null;
    name: string;
    currency?: string | null;
    timezoneName?: string | null;
  } | null;
  selectedPage?: {
    id: string;
    name: string;
  } | null;
  selectedInstagramAccount?: {
    id: string;
    username?: string | null;
    name?: string | null;
  } | null;
  accessTier?: 'development' | 'standard' | 'advanced' | 'unknown';
};

export type MetaMarketingIntegrationPrivate = MetaMarketingIntegrationPublicStatus & {
  agencyId: string;
  encryptedAccessToken: string;
  accessTokenExpiresAt?: string | null;
  tokenEncryptionVersion: 1;
};

export type MetaMarketingCampaignDraft = {
  id: string;
  agencyId: string;
  propertyId: string;
  createdAt: string;
  updatedAt: string;
  createdByUid: string;
  status: 'draft' | 'ready' | 'publishing' | 'published' | 'paused' | 'completed' | 'deleted' | 'error';
  campaignName?: string | null;
  adSetName?: string | null;
  adName?: string | null;
  objective: 'leads' | 'messages' | 'traffic' | 'calls';
  budgetType: 'daily' | 'lifetime';
  budgetAmount: number;
  currency: 'RON' | 'EUR' | 'USD';
  durationDays: number;
  startsAt?: string | null;
  endsAt?: string | null;
  startMode?: 'now' | 'scheduled';
  locationLabel: string;
  radiusKm?: number | null;
  headline: string;
  primaryText: string;
  creativeFormat?: 'single_image' | 'carousel' | 'video';
  creativeAspectRatio?: '1:1' | '4:5' | 'original';
  previewDevice?: 'mobile' | 'desktop';
  placements?: Array<'facebook_feed' | 'instagram_feed' | 'facebook_story' | 'instagram_story'> | null;
  optimizationGoal?: 'leads' | 'landing_page_views' | 'messages';
  billingEvent?: 'impressions';
  abTestEnabled?: boolean;
  creativeVariants?: Array<{
    headline: string;
    primaryText: string;
  }> | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  mediaItems?: Array<{
    url: string;
    type: 'image' | 'video';
    alt?: string | null;
    name?: string | null;
    thumbnailUrl?: string | null;
    source?: 'property' | 'upload';
  }> | null;
  videoUrl?: string | null;
  videoThumbnailUrl?: string | null;
  destinationUrl?: string | null;
  destinationType?: 'property_page' | 'lead_form' | 'whatsapp' | 'messenger' | 'phone_call';
  phoneNumber?: string | null;
  utmEnabled?: boolean;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  callToAction: 'LEARN_MORE' | 'SEND_MESSAGE' | 'CONTACT_US' | 'CALL_NOW';
  specialAdCategory: 'HOUSING';
  metaCampaignId?: string | null;
  metaAdSetId?: string | null;
  metaAdId?: string | null;
  metaCreativeId?: string | null;
  metaImageHash?: string | null;
  metaVideoId?: string | null;
  publishAttempts?: number;
  lastPublishAttemptAt?: string | null;
  lastPublishError?: string | null;
  publishLog?: Array<{
    at: string;
    status: 'ready' | 'publishing' | 'published' | 'paused' | 'deleted' | 'error';
    message: string;
    metaObjectId?: string | null;
  }> | null;
  insights?: {
    spend: number;
    impressions: number;
    reach: number;
    clicks: number;
    leads: number;
    costPerLead: number | null;
    updatedAt: string;
  } | null;
};

export type MetaFacebookPagePost = {
  status: 'publishing' | 'published' | 'error';
  pageId: string;
  pageName?: string | null;
  postId?: string | null;
  permalinkUrl?: string | null;
  photoIds?: string[];
  message: string;
  imageCount: number;
  createdByUid?: string | null;
  publishedAt?: string | null;
  updatedAt: string;
  errorMessage?: string | null;
};

export type TikTokMarketingIntegrationPublicStatus = {
  provider: 'tiktok';
  connected: boolean;
  connectedAt?: string | null;
  updatedAt?: string | null;
  lastError?: string | null;
  lastAuthorizedByUid?: string | null;
  openId?: string | null;
  unionId?: string | null;
  displayName?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
  scopes?: string[];
  accessTokenExpiresAt?: string | null;
  refreshTokenExpiresAt?: string | null;
  privateModeOnly?: boolean;
};

export type TikTokMarketingIntegrationPrivate = TikTokMarketingIntegrationPublicStatus & {
  agencyId: string;
  uid: string;
  encryptedAccessToken: string;
  encryptedRefreshToken?: string | null;
  tokenEncryptionVersion: 1;
};

export type TikTokPostDraft = {
  id: string;
  agencyId: string;
  propertyId?: string | null;
  sourceType?: 'property_video_tour' | 'studio_asset' | 'studio_project';
  studioAssetId?: string | null;
  studioProjectId?: string | null;
  videoTourUrl: string;
  videoTourThumbnailUrl?: string | null;
  propertyTitle: string;
  createdAt: string;
  updatedAt: string;
  createdByUid: string;
  status: 'draft' | 'ready' | 'publishing' | 'processing' | 'published' | 'error';
  description: string;
  hashtags: string[];
  privacyLevel: string;
  disableComment: boolean;
  disableDuet: boolean;
  disableStitch: boolean;
  aiGeneratedContent: boolean;
  coverTimestampMs?: number | null;
  scheduledAt?: string | null;
  scheduleStatus?: 'none' | 'scheduled' | 'sent' | 'error';
  repurposeVariant?: TikTokStudioRepurposeVariant | null;
  publishId?: string | null;
  publishedAt?: string | null;
  lastStatusCheckedAt?: string | null;
  lastPublishAttemptAt?: string | null;
  lastPublishError?: string | null;
  publishLog?: Array<{
    at: string;
    status: TikTokPostDraft['status'];
    message: string;
    tiktokObjectId?: string | null;
  }> | null;
};

export type TikTokStudioAsset = {
  id: string;
  agencyId: string;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
  type: 'video' | 'image';
  name: string;
  url: string;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  durationSeconds?: number | null;
  source: 'upload' | 'ai_generated' | 'property_video_tour';
  studioProjectId?: string | null;
  status: 'ready' | 'processing' | 'error';
  editorState?: {
    aspectRatio?: '9:16' | '1:1' | '4:5' | '16:9';
    trimStartSeconds?: number;
    trimEndSeconds?: number | null;
    headline?: string | null;
    description?: string | null;
    hashtags?: string[] | null;
    voiceId?: string | null;
    subtitleStyle?: TikTokStudioSubtitlePreset;
    repurposeVariant?: TikTokStudioRepurposeVariant | null;
  } | null;
  errorMessage?: string | null;
};

export type TikTokStudioCreativePreset =
  | 'luxury_real_estate'
  | 'modern_urban'
  | 'fast_tiktok_hook'
  | 'warm_family_home'
  | 'investor_deal'
  | 'new_development';

export type TikTokStudioSubtitlePreset =
  | 'heygen_pink'
  | 'tiktok_bold'
  | 'luxury_white'
  | 'minimal_premium'
  | 'high_contrast'
  | 'clean_white'
  | 'luxury';

export type TikTokStudioVoiceProfile =
  | 'warm_feminine'
  | 'young_social'
  | 'luxury_calm'
  | 'energetic'
  | 'professional';

export type TikTokStudioRepurposeVariant =
  | 'tiktok_9_16'
  | 'reels_9_16'
  | 'story_9_16'
  | 'shorts_9_16'
  | 'no_subtitles'
  | 'alternate_cta';

export type TikTokStudioBrandKit = {
  name?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  fontFamily?: string | null;
  watermarkText?: string | null;
  defaultCallToAction?: string | null;
  defaultVoiceProfile?: TikTokStudioVoiceProfile | null;
  defaultVoiceId?: string | null;
  defaultSubtitlePreset?: TikTokStudioSubtitlePreset | null;
  phone?: string | null;
  agentName?: string | null;
};

export type TikTokStudioStoryboardScene = {
  id: string;
  assetId?: string | null;
  title: string;
  visualIntent: string;
  voiceoverLine: string;
  overlayText?: string | null;
  durationSeconds: number;
  motion: 'slow_push' | 'pull_back' | 'pan_left' | 'pan_right' | 'detail_zoom';
  safeZone?: 'center' | 'upper' | 'lower';
  mediaType?: 'exterior' | 'living' | 'kitchen' | 'bedroom' | 'bathroom' | 'balcony' | 'view' | 'detail' | 'other';
  qualityNote?: string | null;
  missingShotRecommendation?: string | null;
  crop?: {
    x: number;
    y: number;
    scale: number;
  } | null;
};

export type TikTokStudioQualityScore = {
  score: number;
  label: 'slab' | 'bun' | 'foarte_bun' | 'premium';
  strengths: string[];
  improvements: string[];
  checks: Array<{
    id: string;
    label: string;
    passed: boolean;
    impact: 'low' | 'medium' | 'high';
  }>;
};

export type TikTokStudioCreativeBrief = {
  preset: TikTokStudioCreativePreset;
  title: string;
  hooks: string[];
  selectedHook: string;
  script: string;
  caption: string;
  captionVariants?: string[];
  hashtags: string[];
  storyboard: TikTokStudioStoryboardScene[];
  voiceProfile: TikTokStudioVoiceProfile;
  recommendedDurationSeconds: number;
  qualityScore: TikTokStudioQualityScore;
  missingShots?: string[];
  weakPhotos?: Array<{ assetId?: string | null; reason: string }>;
  brandKit?: TikTokStudioBrandKit | null;
};

export type TikTokStudioProject = {
  id: string;
  agencyId: string;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  status: 'draft' | 'rendering' | 'ready' | 'error';
  mode: 'photo_to_video' | 'video_editor';
  sourceAssetIds: string[];
  outputAssetId?: string | null;
  script?: string | null;
  voiceId?: string | null;
  voiceProfile?: TikTokStudioVoiceProfile | null;
  subtitleStyle?: TikTokStudioSubtitlePreset;
  creativePreset?: TikTokStudioCreativePreset;
  hook?: string | null;
  caption?: string | null;
  captionVariants?: string[] | null;
  hashtags?: string[] | null;
  storyboard?: TikTokStudioStoryboardScene[] | null;
  timeline?: TikTokStudioStoryboardScene[] | null;
  qualityScore?: TikTokStudioQualityScore | null;
  brandKit?: TikTokStudioBrandKit | null;
  repurposeVariants?: TikTokStudioRepurposeVariant[] | null;
  scheduledAt?: string | null;
  aspectRatio: '9:16' | '1:1' | '4:5' | '16:9';
  settings?: Record<string, unknown> | null;
  errorMessage?: string | null;
};

export type PropertyVideoTour = {
  status: 'ready' | 'processing' | 'error';
  url?: string | null;
  thumbnailUrl?: string | null;
  fileName?: string | null;
  format: 'landscape' | 'portrait' | 'square';
  style: 'cinematic' | 'luxury' | 'social';
  quality?: 'standard' | 'premium' | null;
  targetDurationSeconds?: number | null;
  hasMusic?: boolean | null;
  hasAgencyBranding?: boolean | null;
  hasAiPresenter?: boolean | null;
  aiPresenterAvatar?: 'business' | 'luxury' | 'casual' | null;
  aiPresenterVoice?: string | null;
  aiPresenterPosition?: 'bottom-right' | 'bottom-left' | null;
  aiPresenterSize?: 'small' | 'medium' | 'large' | null;
  aiPresenterScript?: string | null;
  aiPresenterAudioUrl?: string | null;
  aiPresenterVideoUrl?: string | null;
  engine?: 'browser-canvas' | 'cloud-renderer' | null;
  mimeType?: string | null;
  durationSeconds?: number | null;
  imageCount?: number | null;
  generatedAt?: string | null;
  generatedByUid?: string | null;
  errorMessage?: string | null;
};

export type PropertyVideoTourJob = {
  id: string;
  agencyId: string;
  propertyId: string;
  propertyTitle?: string | null;
  status: 'queued' | 'processing' | 'completed' | 'error';
  engine: 'ffmpeg-cloud';
  format: 'landscape' | 'portrait' | 'square';
  style: 'cinematic' | 'luxury' | 'social';
  quality: 'standard' | 'premium';
  targetDurationSeconds?: number | null;
  includeText: boolean;
  includeBranding: boolean;
  includeMusic: boolean;
  includeAiPresenter?: boolean | null;
  aiPresenterAvatar?: 'business' | 'luxury' | 'casual' | null;
  aiPresenterVoice?: string | null;
  aiPresenterPosition?: 'bottom-right' | 'bottom-left' | null;
  aiPresenterSize?: 'small' | 'medium' | 'large' | null;
  aiPresenterScript?: string | null;
  aiPresenterAudioUrl?: string | null;
  aiPresenterVideoUrl?: string | null;
  images: Array<{ url: string; alt?: string | null }>;
  progress: number;
  stage?: string | null;
  attempts: number;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  durationSeconds?: number | null;
  errorMessage?: string | null;
  lockedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  failedAt?: string | null;
  requestedByUid?: string | null;
};

export type Property = {
  id: string;
  title: string;
  address: string;
  location: string;
  price: number;
  rooms: number;
  bathrooms: number;
  squareFootage: number; // Suprafata Utila
  totalSurface?: number; // Suprafata Construita
  description?: string;
  images: { url: string; alt: string; }[];
  amenities?: string[];
  agent?: {
    name: string;
    avatarUrl: string;
  };
  latitude?: number;
  longitude?: number;

  // New detailed fields
  propertyType: string; // Apartament, Casa, etc.
  transactionType: string; // Vanzare, Inchiriere
  constructionYear?: number;
  floor?: string; // Parter, 1, 2...
  totalFloors?: number;
  orientation?: string;
  comfort?: string; // e.g. 'Lux'
  interiorState?: string; // Renovat, Buna, etc.
  furnishing?: string; // Complet, Partial, Nemobilat
  heatingSystem?: string; // Centrala proprie, Termoficare
  parking?: string; // Garaj, Exterior
  keyFeatures?: string; // Used for AI, comma separated
  nearMetro?: boolean;
  
  // New fields from user request
  buildingState?: string;
  seismicRisk?: string;
  balconyTerrace?: string;
  partitioning?: string;
  kitchen?: string;
  lift?: string;
  city?: string;
  zone?: string;
  cadastralNumber?: string;

  // For compatibility with existing components that might use these
  tagline?: string;
  createdAt?: string;
  promotions?: {
    [portalName: string]: PromotionStatus;
  };
  agentId?: string | null;
  agentName?: string | null;
  status?: 'Activ' | 'Inactiv' | 'Vândut' | 'Închiriat' | 'Rezervat';
  featured?: boolean;
  statusUpdatedAt?: string;
  notes?: string;
  salesScore?: 'Scăzut' | 'Mediu' | 'Ridicată';
  ownerName?: string;
  ownerPhone?: string;
  rlvUrl?: string;
  portalProfiles?: {
    imobiliare?: ImobiliarePortalProfile;
    storia?: StoriaPortalProfile;
  };
  metaFacebookPost?: MetaFacebookPagePost | null;
  videoTour?: PropertyVideoTour | null;
  locationProfile?: PropertyLocationProfile | null;
  defaultFacebookConnectionId?: string | null;

  // Commission fields
  commissionType?: 'percentage' | 'fixed';
  commissionValue?: number;
  soldPrice?: number | null;
};

export type PropertyDeletionReason =
  | 'not_interesting'
  | 'collaboration_ended'
  | 'sold';

export type PropertyDeletionEvent = {
  id: string;
  agencyId: string;
  propertyId: string;
  deletedAt: string;
  reason: PropertyDeletionReason;
  reasonLabel: string;
  agentMessage: string;
  soldPrice?: number | null;
  listingPriceAtDeletion: number;
  marketAnalysisEligible: boolean;
  propertySnapshot: Property;
};

export type PropertyStatusChangeReason =
  | 'reservation_offer_accepted'
  | 'reservation_financing_pending'
  | 'reservation_documents_pending'
  | 'sale_completed'
  | 'sale_cash'
  | 'sale_financed';

export type PropertyStatusEvent = {
  id: string;
  agencyId: string;
  propertyId: string;
  changedAt: string;
  previousStatus?: Property['status'] | null;
  nextStatus: 'Rezervat' | 'Vândut';
  reason: PropertyStatusChangeReason;
  reasonLabel: string;
  agentMessage: string;
  soldPrice?: number | null;
  marketAnalysisEligible: boolean;
  propertySnapshot: Property;
};

export type ZoneDebugBreakdown = {
  exact: number;
  semanticExact?: number;
  adjacent: number;
  cluster: number;
  macro: number;
  penalty: number;
  conflict?: number;
};

export type MatchedProperty = Property & {
  matchScore: number;
  reasoning: string;
  zoneReasoning?: string | null;
  zoneDebug?: ZoneDebugBreakdown | null;
};
export type MatchedBuyer = Contact & {
  matchScore: number;
  reasoning: string;
  zoneReasoning?: string | null;
  zoneDebug?: ZoneDebugBreakdown | null;
};

export type ContactPreferences = {
    desiredPriceRangeMin: number;
    desiredPriceRangeMax: number;
    desiredRooms: number;
    desiredBathrooms: number;
    desiredSquareFootageMin: number;
    desiredSquareFootageMax: number;
    desiredFeatures: string;
    locationPreferences: string;
}

export type Interaction = {
    id: string;
    type: 'Apel telefonic' | 'Email' | 'Întâlnire' | 'Vizionare' | 'Ofertă' | 'WhatsApp' | 'Notiță';
    date: string;
    notes: string;
    agent?: {
      name: string;
    }
}

export type Offer = {
  id: string;
  propertyId: string;
  propertyTitle: string;
  price: number;
  status: 'În așteptare' | 'Acceptată' | 'Refuzată';
  date: string;
}

export type FinancialStatus = 'Neprecalificat' | 'Credit Pre-aprobat' | 'Credit Aprobat' | 'Cash';

export type ThemePreset = 'classic' | 'forest' | 'agentfinder';

export type SaleStage =
  | 'preparing'
  | 'reservation'
  | 'precontract'
  | 'contract'
  | 'completed'
  | 'blocked'
  | 'cancelled';

export type LegacySaleStage =
  | 'documents'
  | 'notary_scheduling'
  | 'ready_to_sign';

export type SaleParticipantRole = 'buyer' | 'owner' | 'notary' | 'collaborator';

export type SaleParticipant = {
  id: string;
  role: SaleParticipantRole;
  contactId?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  preferredChannel?: 'email' | 'phone' | 'whatsapp';
};

export type SaleChecklistStatus =
  | 'required'
  | 'requested'
  | 'received_needs_review'
  | 'verified'
  | 'rejected'
    | 'expired';

export type SaleDocumentScanStatus =
  | 'pending'
  | 'safe_by_policy'
  | 'safe'
  | 'infected'
  | 'unsupported'
  | 'error';

export type SaleDocumentOcrStatus = 'not_requested' | 'pending' | 'completed' | 'low_quality' | 'error';

export type SaleDocumentReviewStatus = 'unreviewed' | 'needs_attention' | 'approved' | 'rejected';

export type SaleChecklistStage = Extract<SaleStage, 'reservation' | 'precontract' | 'contract'>;

  export type SaleChecklistItem = {
  id: string;
  label: string;
  participantRole: 'buyer' | 'owner';
  stage?: SaleChecklistStage;
  status: SaleChecklistStatus;
  required: boolean;
  requestedAt?: string | null;
  receivedAt?: string | null;
  verifiedAt?: string | null;
  fileName?: string | null;
  downloadUrl?: string | null;
    notes?: string | null;
    storagePath?: string | null;
    contentType?: string | null;
    sizeBytes?: number | null;
    checksumSha256?: string | null;
    scanStatus?: SaleDocumentScanStatus;
    scanProvider?: string | null;
    scanMessage?: string | null;
    ocrStatus?: SaleDocumentOcrStatus;
    extractedTextPreview?: string | null;
    classificationConfidence?: number | null;
    qualityScore?: number | null;
    reviewStatus?: SaleDocumentReviewStatus;
    reviewedByUid?: string | null;
    reviewedAt?: string | null;
    expiresAt?: string | null;
    revokedAt?: string | null;
    version?: number;
    duplicateOfDocumentId?: string | null;
  };

export type SaleQuestionStatus = 'pending' | 'answered' | 'partial' | 'unclear' | 'confirmed';

  export type SaleEmailQuestion = {
  id: string;
  text: string;
  required: boolean;
  status: SaleQuestionStatus;
  answer?: string | null;
  evidence?: string | null;
  confidence?: number | null;
    confirmedAt?: string | null;
    reviewStatus?: 'pending_agent_review' | 'confirmed' | 'corrected' | 'needs_clarification';
    reviewedByUid?: string | null;
    reviewedAt?: string | null;
  };

  export type SaleEmailMessageStatus =
  | 'draft'
  | 'prepared'
  | 'opened_in_gmail'
  | 'sent_ui_confirmed'
  | 'sent_unconfirmed'
  | 'replied'
    | 'failed';

  export type SaleEmailSendEvidence = {
    level: 'none' | 'ui_observed' | 'agent_confirmed' | 'reply_confirmed';
    source: 'gmail_runner' | 'agent' | 'inbound_reply' | 'web_fallback';
    observedAt: string;
    observedByUid?: string | null;
    details?: string | null;
  };

  export type SaleReplyReview = {
    status: 'pending' | 'confirmed' | 'corrected' | 'needs_clarification';
    reviewedByUid?: string | null;
    reviewedAt?: string | null;
    note?: string | null;
  };

export type SaleEmailMessage = {
  id: string;
  saleId: string;
  agencyId: string;
  direction: 'outbound' | 'inbound';
  status: SaleEmailMessageStatus;
  trackingCode: string;
  fromName?: string | null;
  fromEmail?: string | null;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  questions?: SaleEmailQuestion[];
  attachmentNames?: string[];
  providerMessageId?: string | null;
  createdByUid?: string | null;
  createdAt: string;
  sentAt?: string | null;
  receivedAt?: string | null;
    updatedAt?: string | null;
    sendEvidence?: SaleEmailSendEvidence | null;
    replyReview?: SaleReplyReview | null;
    relatedOutboundMessageId?: string | null;
    runnerDiagnostics?: {
      selectorProfile?: string | null;
      completedFields?: string[];
      missingFields?: string[];
      attempt?: number;
      canRetry?: boolean;
    } | null;
  };

export type SaleTransaction = {
  id: string;
  agencyId: string;
  trackingCode: string;
  propertyId: string;
  propertyTitle: string;
  propertyAddress: string;
  propertyImageUrl?: string | null;
  agentId: string;
  agentName: string;
  collaboratorIds?: string[];
  stage: SaleStage;
  agreedPrice?: number | null;
  financingType?: 'cash' | 'credit' | 'unknown';
  participants: SaleParticipant[];
  checklist?: SaleChecklistItem[];
  notary?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    appointmentAt?: string | null;
  } | null;
  nextAction?: string | null;
  nextActionAt?: string | null;
  lastCommunicationAt?: string | null;
  unreadReplyCount?: number;
  receivedDocumentCount?: number;
  requiredDocumentCount?: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  cancelledAt?: string | null;
    source?: 'accepted_offer' | 'reserved_property' | 'sold_property' | 'manual';
    setupStatus?: 'incomplete' | 'ready';
    setupCompletedAt?: string | null;
    setupCompletedByUid?: string | null;
    pendingReviewCount?: number;
    overdueActionCount?: number;
    reminderPolicy?: {
      enabled: boolean;
      digestMode: 'instant' | 'daily';
      remindBeforeHours: number;
    } | null;
    retentionPolicy?: {
      attachmentRetentionDays: number;
      completedSaleRetentionDays: number;
    } | null;
    dataRetentionState?: 'active' | 'redacted';
    dataRedactedAt?: string | null;
    retentionLastRunAt?: string | null;
  };

export type SalesEmailTemplate = {
  id: string;
  name: string;
  description: string;
  recipientRole: SaleParticipantRole;
  stage: SaleStage | 'any';
  subject: string;
  body: string;
  bodyHtml?: string | null;
  defaultCc?: string[];
  defaultQuestions?: string[];
  isSystem?: boolean;
  isActive?: boolean;
  createdAt?: string;
    updatedAt?: string;
    version?: number;
    locale?: 'ro' | 'en';
    approvalStatus?: 'draft' | 'pending_approval' | 'approved' | 'rejected';
    createdByUid?: string | null;
    updatedByUid?: string | null;
    approvedByUid?: string | null;
    approvedAt?: string | null;
    signatureMode?: 'agent' | 'agency' | 'none';
    variables?: string[];
  };

  export type SalesEmailTemplateOverride = Pick<
    SalesEmailTemplate,
    | 'name'
    | 'description'
    | 'recipientRole'
    | 'stage'
    | 'subject'
    | 'body'
    | 'bodyHtml'
    | 'defaultCc'
    | 'defaultQuestions'
    | 'signatureMode'
    | 'variables'
  > & {
    id: string;
    baseTemplateId: string;
    baseVersion?: number;
    updatedAt: string;
    updatedByUid: string;
  };

  export type SalesEmailSettings = {
    id: 'default';
    inboundProvider: 'generic' | 'mailgun' | 'sendgrid';
    attachmentRetentionDays: number;
    completedSaleRetentionDays: number;
    ocrEnabled: boolean;
    malwareScanRequired: boolean;
    dailyDigestHour: number;
    updatedAt: string;
    updatedByUid: string;
  };

  export type SalesAuditEvent = {
    id: string;
    agencyId: string;
    saleId: string;
    actorUid: string | null;
    actorType: 'agent' | 'system' | 'inbound';
    action: string;
    entityType: 'sale' | 'message' | 'document' | 'template' | 'settings';
    entityId: string;
    summary: string;
    metadata?: Record<string, string | number | boolean | null>;
    createdAt: string;
    expiresAt?: string | null;
  };


export type Contact = {
    id: string;
    name: string;
    phone: string;
    email: string;
    source: string;
    budget?: number;
    status: 'Nou' | 'Contactat' | 'Vizionare' | 'În negociere' | 'Câștigat' | 'Pierdut';
    description?: string;
    contactType: 'Cumparator' | 'Client' | 'Partener';
    interactionHistory?: Interaction[];
    preferences?: Partial<ContactPreferences>;
    city?: string;
    zones?: string[];
    leadScore?: number;
    leadScoreReason?: string;
    createdAt?: string;
    agentId?: string | null;
    agentName?: string | null;
    priority?: 'Scăzută' | 'Medie' | 'Ridicată';
    portalId?: string | null;
    tags?: string[];
    sourcePropertyId?: string | null;
    offers?: Offer[];
    financialStatus?: FinancialStatus;
    recommendationHistory?: { [propertyId: string]: PortalRecommendation };
    photoUrl?: string;
    address?: string;
    personalNumericCode?: string;
    identityDocumentSeries?: string;
    identityDocumentNumber?: string;
    entityType?: 'individual' | 'company';
    legalCompanyName?: string;
    companyTaxId?: string;
    tradeRegisterNumber?: string;
    registeredOffice?: string;
    legalRepresentative?: string;
    preferencesLinkId?: string;
    preferencesChatHistory?: { role: 'user' | 'model'; content: string; }[];
    generalZone?: 'Nord' | 'Sud' | 'Est' | 'Vest' | 'Central' | 'Oricare' | 'all' | null;
    locationPreferencesV2?: BuyerLocationPreference[] | null;
    archivedAt?: string | null;
    archivedByAge?: boolean;
};

export type SalesData = {
  month: string;
  sales: number;
};

export type BuyerSourceData = {
  source: string;
  count: number;
  fill: string;
};

export type LeadSourceData = {
  source: string;
  count: number;
  fill: string;
}

export type ConversionData = {
  date: string;
  vizionari: number;
  tranzactii: number;
};

export type ActiveBuyersEvolutionData = {
  date: string;
  count: number;
};

export type Task = {
  id: string;
  description: string;
  dueDate: string;
  status: 'open' | 'completed';
  contactId?: string | null;
  contactName?: string | null;
  propertyId?: string | null;
  propertyTitle?: string | null;
  participantName?: string | null;
  participantPhone?: string | null;
  startTime?: string;
  duration?: number;
  agentId?: string | null;
  agentName?: string | null;
};

export type Agency = {
    id: string;
    name: string;
    ownerId: string;
    billingProvider?: 'stripe';
    billingPlan?: 'esential' | 'avansat' | 'profesional';
    billingStatus?: 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';
    billingInterval?: 'month';
    billingCurrency?: 'EUR';
    purchasedSeats?: number;
    seatUsageCount?: number;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    stripeSubscriptionItemId?: string;
    billingEmail?: string;
    billingCompanyName?: string;
    billingTaxId?: string;
    billingAddress?: string;
    billingLastSyncAt?: string;
    billingCurrentPeriodStart?: string;
    billingCurrentPeriodEnd?: string;
    billingCancelAtPeriodEnd?: boolean;
    billingDefaultPaymentMethodBrand?: string;
    billingDefaultPaymentMethodLast4?: string;
    smartbillCustomerId?: string;
    smartbillLastDocumentNumber?: string;
    themePreset?: ThemePreset;
    agencyDescription?: string;
  facebookGroups?: FacebookGroup[];
  shareImageUrl?: string;
  legalCompanyName?: string;
  companyTaxId?: string;
  tradeRegisterNumber?: string;
  registeredOffice?: string;
  legalRepresentative?: string;
  termsAndConditions?: string;
  privacyPolicy?: string;
  customDomain?: string;
  customDomainStatus?: 'pending' | 'connected' | 'error';
  customDomainAliases?: string[];
  customDomainResourceNames?: string[];
  customDomainLastCheckedAt?: string;
  logoUrl?: string;
  primaryColor?: string;
  agentIds?: string[];
  city?: string;
  address?: string;
  phone?: string;
  email?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  linkedinUrl?: string;
}

export type ContractTemplateCategory =
  | 'reservation'
  | 'collaboration'
  | 'exclusivity'
  | 'custom';

export type ContractTemplateFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'checkbox';

export type ContractTemplateFieldSource =
  | 'manual'
  | 'contract.number'
  | 'contract.city'
  | 'property.cadastralNumber'
  | 'property.commissionPercent'
  | 'reservation.amount'
  | 'reservation.currency'
  | 'reservation.expiryDate'
  | 'buyer.name'
  | 'buyer.address'
  | 'buyer.personalNumericCode'
  | 'buyer.identityDocumentSeries'
  | 'buyer.identityDocumentNumber'
  | 'buyer.legalCompanyName'
  | 'buyer.companyTaxId'
  | 'buyer.tradeRegisterNumber'
  | 'buyer.registeredOffice'
  | 'buyer.legalRepresentative'
  | 'buyer.phone'
  | 'buyer.email'
  | 'owner.name'
  | 'owner.address'
  | 'owner.personalNumericCode'
  | 'owner.identityDocumentSeries'
  | 'owner.identityDocumentNumber'
  | 'owner.legalCompanyName'
  | 'owner.companyTaxId'
  | 'owner.tradeRegisterNumber'
  | 'owner.registeredOffice'
  | 'owner.legalRepresentative'
  | 'owner.bankAccount'
  | 'owner.bankAccountHolder'
  | 'owner2.name'
  | 'owner2.address'
  | 'owner2.personalNumericCode'
  | 'owner2.identityDocumentSeries'
  | 'owner2.identityDocumentNumber'
  | 'owner2.legalCompanyName'
  | 'owner2.companyTaxId'
  | 'owner2.tradeRegisterNumber'
  | 'owner2.registeredOffice'
  | 'owner2.legalRepresentative'
  | 'owner.phone'
  | 'owner.email'
  | 'property.address'
  | 'property.price'
  | 'property.city'
  | 'property.zone'
  | 'property.title'
  | 'agency.name'
  | 'agency.legalCompanyName'
  | 'agency.companyTaxId'
  | 'agency.tradeRegisterNumber'
  | 'agency.registeredOffice'
  | 'agency.legalRepresentative'
  | 'agency.phone'
  | 'agency.email'
  | 'agent.name'
  | 'agent.email'
  | 'agent.phone'
  | 'currentDate';

export type ContractTemplateField = {
  id: string;
  key: string;
  label: string;
  type: ContractTemplateFieldType;
  required: boolean;
  page: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize: number;
  align?: 'left' | 'center' | 'right';
  defaultValue?: string;
  placeholder?: string;
  options?: string[];
  source?: ContractTemplateFieldSource;
  multiline?: boolean;
};

export type ContractTemplate = {
  id: string;
  agencyId: string;
  name: string;
  category: ContractTemplateCategory;
  description?: string;
  sourceType?: 'document';
  content?: string;
  headerMode?: 'legacy' | 'crm_prefilled';
  sourceFormat?: 'manual' | 'docx';
  sourcePdfUrl?: string;
  sourcePdfPath?: string;
  fileName?: string;
  pageCount?: number;
  status: 'draft' | 'active';
  fields: ContractTemplateField[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
};

export type GeneratedContract = {
  id: string;
  agencyId: string;
  templateId: string;
  templateName: string;
  generatedBy: string;
  createdAt: string;
  values: Record<string, string | number | boolean | null>;
  fileName: string;
  contactId?: string | null;
  propertyId?: string | null;
};

export type CustomDomainInstructionRow = {
  action: 'ADD' | 'REMOVE' | 'UNSPECIFIED';
  type: string;
  host: string;
  value: string;
};

export type CustomDomainApiDomain = {
  domainName: string;
  resourceName: string;
  hostState?: string;
  ownershipState?: string;
  certState?: string;
  issues: string[];
  instructions: CustomDomainInstructionRow[];
};

export type CustomDomainApiResult = {
  primaryDomain: string;
  aliases: string[];
  agencyId: string;
  overallStatus: 'pending' | 'connected' | 'error';
  domains: CustomDomainApiDomain[];
};

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  agentBio?: string;
  agencyId?: string;
  role?: 'admin' | 'agent' | 'platform_admin';
  pushTokens?: string[];
  pushNotificationsEnabled?: boolean;
  pushNotificationsUpdatedAt?: string;
  enabledSalesEmailTemplateIds?: string[];
  salesEmailTemplatePreferencesUpdatedAt?: string;
};

export type Invite = {
  email: string;
  agencyId: string;
  agencyName: string;
  role: 'agent';
  invitedBy: string;
};

export type ClientPortal = {
  id: string;
  contactId: string;
  agencyId: string;
  contactName: string;
  agentName: string;
  createdAt: string;
};

export type PortalRecommendation = {
  id: string;
  propertyId: string;
  addedAt: string;
  clientFeedback: 'liked' | 'disliked' | 'none';
  clientComment?: string;
};

export type Viewing = {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyAddress: string;
  contactId: string;
  contactName: string;
  agentId: string;
  agentName?: string;
  viewingDate: string; // ISO string
  duration?: number;
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: string;
};


export type WithId<T> = T & { id: string };

// Types for CMA
export type ComparableProperty = {
    id: string;
    address: string;
    status: 'Activ' | 'Vândut' | 'Închiriat' | 'Inactiv';
    price: number;
    squareFootage: number;
    rooms: number;
    bathrooms: number;
    similarity: string;
}

export type PriceAdjustment = {
    feature: string;
    adjustment: string;
    reason: string;
}

export type CMA = {
    subjectPropertyId: string;
    subjectPropertyAddress: string;
    comparableProperties: ComparableProperty[];
    priceAdjustments: PriceAdjustment[];
    estimatedValueRange: {
        min: number;
        max: number;
    };
    notes: string;
}

export type BriefingSummaryItem = {
  label: string;
  value: number;
};

export type BriefingPriority = {
  text: string;
};

export type BriefingViewing = {
  id: string;
  time: string;
  title: string;
  contact: string;
};

export type BriefingClient = {
  id: string;
  name: string;
  reason: string;
  avatar?: string | null;
};

export type BriefingProperty = {
  id: string;
  name: string;
  reason: string;
  image?: string | null;
};

export type BriefingWhatsappDraft = {
  contactName: string;
  reason: string;
  message: string;
};

export type BriefingNextStepPlan = {
  contactName: string;
  step: string;
  reason: string;
  expectedOutcome: string;
};

export type Briefing = {
  summary: BriefingSummaryItem[];
  priorities: BriefingPriority[];
  upcomingViewings: BriefingViewing[];
  urgentClients: BriefingClient[];
  propertiesToOptimize: BriefingProperty[];
  urgentClientsAnalysis: string;
  propertiesToReviewAnalysis: string;
  executiveSummary?: string;
  dailyFocus?: string;
  opportunities?: string[];
  suggestedPrompts?: string[];
  whatsAppDrafts?: BriefingWhatsappDraft[];
  nextStepPlans?: BriefingNextStepPlan[];
};

export type BuyerPreferencesLink = {
  id: string;
  contactId: string;
  agencyId: string;
  createdAt: string;
};
