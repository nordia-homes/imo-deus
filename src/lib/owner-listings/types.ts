export type OwnerListingSource = 'olx' | 'imoradar24' | 'publi24';

export type OwnerListingSummary = {
  scopeKey?: string;
  scopeCity?: string;
  source: OwnerListingSource;
  sourceLabel: string;
  originSourceUrl?: string;
  originSourceLabel?: string;
  isNew?: boolean;
  isBaselineListing?: boolean;
  discoveredCycleNumber?: number;
  firstDiscoveredAt?: number;
  newUntilAt?: number;
  externalId: string;
  title: string;
  price: string;
  link: string;
  area: string;
  location: string;
  postedAt: number;
  postedAtText?: string;
  rooms?: number | string;
  constructionYear?: number | string;
  year?: number | string;
  image?: string;
  imageUrl?: string;
  description?: string;
  fingerprint: string;
  ownerType: 'owner';
  ownerName?: string;
  ownerPhone?: string;
  ownerConfidence?: number;
  scrapedAt: number;
  lastSeenAt: number;
};

export type OwnerListingDetail = OwnerListingSummary & {
  fullDescription?: string;
  images: string[];
  constructionYear?: number | string;
  year?: number | string;
  bathrooms?: number;
  propertyType?: string;
  transactionType?: string;
  floor?: string;
  contactName?: string;
  contactPhone?: string;
};

export type OwnerListingSyncResult = {
  scanned: number;
  accepted: number;
  stored: number;
  skipped: number;
  errors: Array<{ source: OwnerListingSource; message: string }>;
};

export type SourceScrapeOptions = {
  maxPages?: number | null;
  maxListingsPerSource?: number | null;
  hardPageLimit?: number;
  startPage?: number;
  maxAgeDays?: number | null;
  scopeKey: string;
  scopeCity: string;
  searchKeywords: string[];
  searchUrls: string[];
};

export type OwnerListingSourcePageResult = {
  listings: OwnerListingSummary[];
  reachedEnd: boolean;
};

export type OlxPhoneQueueStatus = 'pending' | 'processing' | 'done' | 'retry' | 'failed';

export type OlxPhoneQueueEntry = {
  listingId: string;
  source: 'olx';
  link: string;
  status: OlxPhoneQueueStatus;
  attempts: number;
  phone?: string;
  error?: string;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  lockedAt?: string;
  lockedBy?: string;
  updatedAt: string;
  createdAt: string;
  completedAt?: string;
};

export type OlxPhoneDrainResult = {
  status: 'processed' | 'skipped' | 'empty';
  queueId?: string;
  listingId?: string;
  phone?: string;
  attempts?: number;
  reason?: string;
};

export type OwnerListingSourceSyncResult = OwnerListingSyncResult & {
  source: OwnerListingSource;
  page: number;
  reachedEnd: boolean;
};

export type OwnerListingSyncCycleStatus = 'idle' | 'running' | 'cooldown' | 'failed';
export type OwnerListingSyncCycleJobStatus = 'pending' | 'running' | 'done' | 'failed';
export type OwnerListingBaselineStatus = 'pending' | 'running' | 'completed';

export type OwnerListingSyncCycleState = {
  scopeKey: string;
  scopeLabel: string;
  cycleNumber: number;
  baselineStatus: OwnerListingBaselineStatus;
  baselineCycleNumber?: number;
  baselineCompletedAt?: string;
  status: OwnerListingSyncCycleStatus;
  sourcesOrder: OwnerListingSource[];
  currentSourceIndex: number;
  currentSource: OwnerListingSource | null;
  cycleStartedAt?: string;
  cycleFinishedAt?: string;
  cooldownUntil?: string;
  lastHeartbeatAt?: string;
  lastError?: string;
  lockedAt?: string;
  lockExpiresAt?: string;
  lockedBy?: string;
  hardPageLimit: number;
  maxAgeDays: number;
  maxListingsPerSource?: number | null;
  maxPagesPerTick: number;
  maxRuntimeMs: number;
  createdAt: string;
  updatedAt: string;
};

export type OwnerListingSyncCycleJob = {
  scopeKey: string;
  cycleNumber: number;
  source: OwnerListingSource;
  status: OwnerListingSyncCycleJobStatus;
  nextPage: number;
  pagesProcessed: number;
  scanned: number;
  accepted: number;
  stored: number;
  skipped: number;
  errors: number;
  lastRunAt?: string;
  lastSuccessAt?: string;
  startedAt?: string;
  finishedAt?: string;
  lastError?: string;
  updatedAt: string;
  createdAt: string;
};

export type OwnerListingSyncRun = {
  scopeKey: string;
  cycleNumber: number;
  source: OwnerListingSource;
  page: number;
  scanned: number;
  accepted: number;
  stored: number;
  skipped: number;
  errors: number;
  reachedEnd: boolean;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  errorMessages: string[];
};

export type OwnerListingSyncTickScopeResult = {
  scopeKey: string;
  scopeLabel: string;
  cycleNumber: number;
  baselineStatus: OwnerListingBaselineStatus;
  status: OwnerListingSyncCycleStatus;
  currentSource: OwnerListingSource | null;
  pagesProcessed: number;
  cooldownUntil?: string;
  summary: {
    scanned: number;
    accepted: number;
    stored: number;
    skipped: number;
    errors: number;
  };
  message: string;
};

export type OwnerListingSyncTickResult = {
  startedAt: string;
  finishedAt: string;
  scopes: OwnerListingSyncTickScopeResult[];
};
