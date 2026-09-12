import { describe, expect, it } from 'vitest';
import type { Property } from '@/lib/types';
import { buildPropertySalesAnalysis } from '@/lib/property-sales-recommendations';
import type { PropertySalesContext } from '@/lib/property-sales-context';

function property(overrides: Partial<Property> = {}): Property {
  return {
    id: 'property-1',
    title: 'Apartament modern cu 3 camere în Pipera',
    address: 'Bulevardul Pipera 1',
    location: 'Pipera',
    price: 180000,
    rooms: 3,
    bathrooms: 2,
    squareFootage: 82,
    description: 'A'.repeat(500),
    images: Array.from({ length: 14 }, (_, index) => ({ url: `/photo-${index}.jpg`, alt: `Camera ${index + 1}` })),
    propertyType: 'Apartament',
    transactionType: 'Vânzare',
    constructionYear: 2022,
    floor: '3',
    totalFloors: 8,
    comfort: 'Lux',
    partitioning: 'Decomandat',
    lift: 'Da',
    interiorState: 'Nou',
    furnishing: 'Complet',
    heatingSystem: 'Centrală proprie',
    parking: 'Subteran',
    orientation: 'Sud',
    latitude: 44.49,
    longitude: 26.12,
    createdAt: '2026-09-01T10:00:00.000Z',
    promotions: { imobiliare: { status: 'published' } },
    advertisingCosts: { facebook: 100, currency: 'RON' },
    ...overrides,
  };
}

function context(overrides: Partial<PropertySalesContext> = {}): PropertySalesContext {
  return {
    generatedAt: '2026-09-12T10:00:00.000Z',
    publicStats: { available: true, views: 20, favorites: 2, favoriteAdds: 2, updatedAt: '2026-09-12T09:55:00.000Z' },
    viewings: { scheduled: 1, completed: 0, cancelled: 0, latestAt: '2026-09-13T10:00:00.000Z' },
    buyers: { totalMatches: 2, strongMatches: 1, topMatches: [{ id: 'buyer-1', name: 'Ana', matchScore: 82, budget: 200000 }] },
    facebook: { syncStatus: 'stored', totalJobs: 1, latestStatus: 'completed', latestAt: '2026-09-12T09:00:00.000Z', submittedGroups: 10, failedGroups: 0, pendingGroups: 0 },
    metaAds: { available: true, syncStatus: 'live', campaignCount: 1, activeCampaigns: 1, errorCampaigns: 0, spend: 100, impressions: 900, clicks: 25, leads: 2, currency: 'RON', insightsUpdatedAt: '2026-09-12T09:55:00.000Z' },
    portals: { published: ['imobiliare'], pending: [], errors: [], latestSyncAt: '2026-09-12T09:00:00.000Z' },
    ...overrides,
  };
}

describe('buildPropertySalesAnalysis', () => {
  it('detects a conversion and price problem when traffic does not create intent', () => {
    const result = buildPropertySalesAnalysis({
      property: property(),
      stats: { views: 120, favorites: 0, favoriteAdds: 0 },
      now: new Date('2026-09-12T10:00:00.000Z'),
    });

    expect(result.recommendations[0]?.id).toBe('price-test');
    expect(result.recommendations[0]?.priority).toBe('critical');
    expect(result.score).toBeLessThan(100);
  });

  it('prioritizes turning favorites into viewings', () => {
    const result = buildPropertySalesAnalysis({
      property: property(),
      stats: { views: 80, favorites: 7, favoriteAdds: 7 },
      scheduledViewings: 0,
      completedViewings: 0,
      now: new Date('2026-09-12T10:00:00.000Z'),
    });

    expect(result.recommendations.some((item) => item.id === 'favorite-to-viewing')).toBe(true);
  });

  it('does not invent problems for a complete, newly promoted listing', () => {
    const result = buildPropertySalesAnalysis({
      property: property(),
      stats: { views: 20, favorites: 2, favoriteAdds: 2 },
      scheduledViewings: 1,
      now: new Date('2026-09-05T10:00:00.000Z'),
    });

    expect(result.score).toBe(100);
    expect(result.recommendations).toHaveLength(0);
  });

  it('uses real channel failures and prioritizes them', () => {
    const result = buildPropertySalesAnalysis({
      property: property(),
      context: context({
        portals: { published: [], pending: [], errors: ['storia'], latestSyncAt: '2026-09-12T09:00:00.000Z' },
        facebook: { syncStatus: 'stored', totalJobs: 1, latestStatus: 'error', latestAt: '2026-09-12T09:00:00.000Z', submittedGroups: 2, failedGroups: 4, pendingGroups: 0 },
      }),
      now: new Date('2026-09-12T10:00:00.000Z'),
    });

    expect(result.recommendations.some((item) => item.id === 'portal-errors')).toBe(true);
    expect(result.recommendations.some((item) => item.id === 'facebook-error')).toBe(true);
  });

  it('detects paid traffic that does not produce leads', () => {
    const result = buildPropertySalesAnalysis({
      property: property(),
      context: context({
        metaAds: { available: true, syncStatus: 'live', campaignCount: 1, activeCampaigns: 1, errorCampaigns: 0, spend: 250, impressions: 2500, clicks: 35, leads: 0, currency: 'RON', insightsUpdatedAt: '2026-09-12T09:55:00.000Z' },
      }),
      now: new Date('2026-09-12T10:00:00.000Z'),
    });

    expect(result.recommendations.some((item) => item.id === 'meta-landing-conversion')).toBe(true);
  });
});
