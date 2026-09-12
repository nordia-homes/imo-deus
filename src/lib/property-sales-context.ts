export type SalesBuyerMatchSummary = {
  id: string;
  name: string;
  matchScore: number;
  budget: number | null;
};

export type PropertySalesContext = {
  generatedAt: string;
  publicStats: {
    available: boolean;
    views: number;
    favorites: number;
    favoriteAdds: number;
    updatedAt: string | null;
  };
  viewings: {
    scheduled: number;
    completed: number;
    cancelled: number;
    latestAt: string | null;
  };
  buyers: {
    totalMatches: number;
    strongMatches: number;
    topMatches: SalesBuyerMatchSummary[];
  };
  facebook: {
    syncStatus: 'live' | 'stored';
    totalJobs: number;
    latestStatus: string | null;
    latestAt: string | null;
    submittedGroups: number;
    failedGroups: number;
    pendingGroups: number;
  };
  metaAds: {
    available: boolean;
    syncStatus: 'live' | 'stored' | 'unavailable';
    campaignCount: number;
    activeCampaigns: number;
    errorCampaigns: number;
    spend: number;
    impressions: number;
    clicks: number;
    leads: number;
    currency: 'RON' | 'EUR' | 'USD';
    insightsUpdatedAt: string | null;
  };
  portals: {
    published: string[];
    pending: string[];
    errors: string[];
    latestSyncAt: string | null;
  };
};
