export type OwnerListingSource = 'olx' | 'imoradar24' | 'publi24';

export type OwnerListingSummary = {
  scopeKey?: string;
  scopeCity?: string;
  source: OwnerListingSource;
  sourceLabel: string;
  externalId: string;
  title: string;
  price: string;
  link: string;
  area: string;
  location: string;
  postedAt: number;
  postedAtText?: string;
  rooms?: number | string;
  constructionYear?: number;
  year?: number;
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
  constructionYear?: number;
  year?: number;
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
  maxAgeDays?: number | null;
  scopeKey: string;
  scopeCity: string;
  searchKeywords: string[];
  searchUrls: string[];
};
