import type { Property, MetaMarketingCampaignDraft, MetaMarketingIntegrationPublicStatus } from './types';
export function buildDefaultCampaignContent(property: Property) {
  const location = [property.city, property.zone].filter(Boolean).join(', ') || property.location || property.address;
  const targetingLocation = property.city || property.location?.split(',')[0]?.trim() || property.address;
  const price = Number.isFinite(property.price) ? `${new Intl.NumberFormat('ro-RO').format(property.price)} EUR` : 'pret disponibil la cerere';
  const headline = property.title || `${property.propertyType || 'Proprietate'} in ${location}`;
  const defaultText = [
    property.title,
    `${price}. ${property.squareFootage || property.totalSurface || ''} mp${property.nearMetro ? ', aproape de metrou' : ''}.`,
    'Vezi fotografii, detalii si programeaza o discutie cu agentul ImoDeus.',
  ].filter(Boolean).join(' ');
  const primaryText = (property.description || defaultText).replace(/\r\n/g, '\n').trim();

  return {
    headline,
    primaryText,
    locationLabel: targetingLocation || '',
  };
}


export type MetaDraftOptions = { agencyId: string; propertyId: string; requestedByUid: string; objective?: MetaMarketingCampaignDraft['objective']; budgetAmount?: number; budgetType?: MetaMarketingCampaignDraft['budgetType']; durationDays?: number };
export function buildMetaCampaignDraft(params: MetaDraftOptions, property: Property, integration: MetaMarketingIntegrationPublicStatus, destinationUrl: string, campaignId: string, now: string): MetaMarketingCampaignDraft {
 const content = buildDefaultCampaignContent(property);
  const coverImage = property.images?.find((image) => image?.url) || null;
  const propertyMediaItems = (property.images || [])
    .filter((image) => image?.url)
    .slice(0, 10)
    .map((image) => ({
      url: image.url,
      type: 'image' as const,
      alt: image.alt || property.title || null,
      name: null,
      source: 'property' as const,
    }));


  const draft: MetaMarketingCampaignDraft = {
    id: campaignId,
    agencyId: params.agencyId,
    propertyId: params.propertyId,
    createdAt: now,
    updatedAt: now,
    createdByUid: params.requestedByUid,
    status: 'draft',
    campaignName: `Promovare ${property.title || 'proprietate'}`.slice(0, 120),
    adSetName: `${content.locationLabel || property.location || 'Housing'} - 7 zile`.slice(0, 120),
    adName: `${property.title || 'Proprietate'} - principal`.slice(0, 120),
    objective: params.objective || 'leads',
    budgetType: params.budgetType || 'daily',
    budgetAmount: params.budgetAmount || 50,
    currency: (integration.selectedAdAccount?.currency as MetaMarketingCampaignDraft['currency']) || 'RON',
    durationDays: params.durationDays || 7,
    startsAt: null,
    endsAt: null,
    startMode: 'now',
    locationLabel: content.locationLabel,
    radiusKm: 25,
    headline: content.headline,
    primaryText: content.primaryText,
    creativeFormat: 'single_image',
    creativeAspectRatio: '1:1',
    previewDevice: 'mobile',
    placements: ['facebook_feed', 'instagram_feed'],
    optimizationGoal: 'leads',
    billingEvent: 'impressions',
    abTestEnabled: false,
    creativeVariants: [],
    imageUrl: coverImage?.url || null,
    imageAlt: coverImage?.alt || property.title || null,
    mediaItems: propertyMediaItems,
    videoUrl: null,
    videoThumbnailUrl: null,
    destinationUrl,
    destinationType: 'property_page',
    utmEnabled: true,
    utmSource: 'meta',
    utmMedium: 'paid_social',
    utmCampaign: `property_${params.propertyId}`,
    utmContent: 'main_creative',
    callToAction: 'LEARN_MORE',
    specialAdCategory: 'HOUSING',
    metaCampaignId: null,
    metaAdSetId: null,
    metaAdId: null,
    metaCreativeId: null,
    lastPublishError: null,
    insights: null,
  };

 return draft;
}
