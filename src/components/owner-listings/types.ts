import type { OwnerListingSource } from '@/lib/owner-listings/types';

export type PropertyTypeFilter = 'apartamente' | 'case' | 'terenuri' | 'spatii-comerciale';
export type SourceFilterValue = OwnerListingSource | 'imobiliare';
export type CollaborationStatus = 'collaborates' | 'does_not_collaborate';

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
  propertyType?: string;
};

export type OwnerListingFavorite = {
  id: string;
  ownerListingId: string;
  collaborationStatus?: CollaborationStatus | null;
  commissionValue?: string;
  propertyAddress?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string | null;
  updatedBy?: string | null;
};
