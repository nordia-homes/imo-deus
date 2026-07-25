import type { OwnerListingSource } from '@/lib/owner-listings/types';
import type { OwnerListingPropertyType, OwnerListingTransactionType } from '@/lib/owner-listings/types';
import type { AiOutreachOutcome, AiOutreachStatus } from '@/lib/ai-outreach/types';

export type PropertyTypeFilter = 'all' | 'apartamente' | 'case' | 'terenuri' | 'spatii-comerciale';
export type TransactionTypeFilter = 'all' | 'sale' | 'rent';
export type SourceFilterValue = OwnerListingSource | 'imobiliare';
export type CollaborationStatus = 'collaborates' | 'does_not_collaborate';
export type OwnerListingContactOutcome = 'negative' | 'follow_up';

export type OwnerListing = {
  id: string;
  scopeKey?: string;
  scopeCity?: string;
  source: OwnerListingSource;
  sourceLabel: string;
  originSourceUrl?: string;
  originSourceLabel?: string;
  isNew?: boolean;
  isBaselineListing?: boolean;
  newUntilAt?: number;
  firstDiscoveredAt?: number;
  discoveredCycleNumber?: number;
  title: string;
  price: string;
  link: string;
  area: string;
  location: string;
  postedAt: number;
  rooms?: number | string;
  image?: string;
  imageUrl?: string;
  constructionYear?: number | string;
  year?: number | string;
  description?: string;
  ownerPhone?: string;
  latestAiCallId?: string;
  aiOutreachStatus?: AiOutreachStatus;
  aiOutreachOutcome?: AiOutreachOutcome;
  aiOutreachUpdatedAt?: string;
  aiCollaborationStatus?: string;
  aiAcceptedCommissionValue?: string | null;
  aiNextFollowUpAt?: string | null;
  aiDoNotCall?: boolean;
  propertyType?: OwnerListingPropertyType;
  transactionType?: OwnerListingTransactionType;
  categoryConfidence?: number;
  enrichmentStatus?: string;
};

export type OwnerListingFavorite = {
  id: string;
  ownerListingId: string;
  isFavoriteActive?: boolean;
  wasRemovedFromFavorites?: boolean;
  removedAt?: string | null;
  removedBy?: string | null;
  removedByName?: string | null;
  collaborationStatus?: CollaborationStatus | null;
  reservedByAgentId?: string | null;
  reservedByAgentName?: string | null;
  reservedAt?: string | null;
  calledByAgentId?: string | null;
  calledByAgentName?: string | null;
  calledAt?: string | null;
  takenByAgentId?: string | null;
  takenByAgentName?: string | null;
  takenAt?: string | null;
  contactOutcome?: OwnerListingContactOutcome | null;
  contactOutcomeAt?: string | null;
  contactOutcomeByAgentId?: string | null;
  contactOutcomeByAgentName?: string | null;
  commissionValue?: string;
  propertyAddress?: string;
  notes?: string;
  ownerPhone?: string;
  phoneExtractionStatus?:
    | 'available'
    | 'awaiting_connection'
    | 'queued'
    | 'processing'
    | 'retrying'
    | 'unavailable'
    | 'failed'
    | 'not_required';
  phoneExtractionMessage?: string | null;
  phoneExtractionRequestedAt?: string | null;
  phoneExtractionRequestedBy?: string | null;
  phoneExtractionRequestedByName?: string | null;
  phoneExtractionLastAttemptAt?: string | null;
  phoneExtractionNextAttemptAt?: string | null;
  phoneExtractionCompletedAt?: string | null;
  phoneExtractionError?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
};
