import { NextRequest, NextResponse } from 'next/server';
import type {
  Contact,
  FacebookCloudPublishingJob,
  MetaMarketingCampaignDraft,
  Property,
  Viewing,
} from '@/lib/types';
import type { PropertySalesContext } from '@/lib/property-sales-context';

export const runtime = 'nodejs';

function safeCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function newestIso(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0] || null;
}

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number'
      ? (error as { status: number }).status
      : 500;
    return { status, message: error instanceof Error ? error.message : 'Analiza nu a putut fi actualizată.' };
  }
  return { status: 500, message: error instanceof Error ? error.message : 'Analiza nu a putut fi actualizată.' };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ propertyId: string }> }
) {
  try {
    const [{ propertyId }, auth, matching, meta, facebook] = await Promise.all([
      params,
      import('@/lib/firebase-app-hosting'),
      import('@/lib/matching-engine'),
      import('@/lib/meta-marketing'),
      import('@/lib/facebook-cloud-server'),
    ]);
    const { agencyId, uid, adminDb } = await auth.requireAgencyUserFromBearerToken(
      request.headers.get('authorization')
    );
    const agencyRef = adminDb.collection('agencies').doc(agencyId);
    const propertyRef = agencyRef.collection('properties').doc(propertyId);

    const [
      propertySnapshot,
      statsSnapshot,
      viewingsSnapshot,
      contactsSnapshot,
      facebookJobsSnapshot,
      metaCampaignsResult,
    ] = await Promise.all([
      propertyRef.get(),
      agencyRef.collection('propertyPublicStats').doc(propertyId).get(),
      agencyRef.collection('viewings').where('propertyId', '==', propertyId).get(),
      agencyRef.collection('contacts').get(),
      agencyRef.collection('facebookCloudPublishingJobs').where('propertyId', '==', propertyId).get(),
      meta.listPropertyMetaCampaigns(agencyId, propertyId).catch(() => null),
    ]);

    if (!propertySnapshot.exists) {
      return NextResponse.json({ message: 'Proprietatea nu a fost găsită.' }, { status: 404 });
    }

    const property = { id: propertySnapshot.id, ...propertySnapshot.data() } as Property;
    let metaCampaigns = (metaCampaignsResult || []) as MetaMarketingCampaignDraft[];
    const statsData = statsSnapshot.data() || {};
    const viewings = viewingsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Viewing);
    const contacts = contactsSnapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Contact);
    const matches = matching.getDeterministicMatchedBuyers(property, contacts, 20);
    let facebookJobs = facebookJobsSnapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }) as FacebookCloudPublishingJob)
      .filter((job) => job.ownerUid === uid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const activeCloudJobs = facebookJobs.filter((job) => (
      job.runnerMode !== 'local'
      && ['scheduled', 'queued', 'running', 'cooldown', 'needs_reauthentication'].includes(job.status)
    ));
    const facebookRefreshResults = await Promise.allSettled(activeCloudJobs.map(async (job) => {
      const result = await facebook.facebookRunnerRequest<{ job: FacebookCloudPublishingJob }>(`/v1/jobs/${job.id}`);
      await agencyRef.collection('facebookCloudPublishingJobs').doc(job.id).set(result.job, { merge: true });
      return { ...job, ...result.job };
    }));
    const refreshedFacebookJobs = new Map(
      facebookRefreshResults
        .filter((result): result is PromiseFulfilledResult<FacebookCloudPublishingJob> => result.status === 'fulfilled')
        .map((result) => [result.value.id, result.value])
    );
    facebookJobs = facebookJobs.map((job) => refreshedFacebookJobs.get(job.id) || job);

    const staleMetaCampaigns = metaCampaigns.filter((campaign) => {
      if (!campaign.metaCampaignId || !['publishing', 'published'].includes(campaign.status)) return false;
      const updatedAt = campaign.insights?.updatedAt ? new Date(campaign.insights.updatedAt).getTime() : 0;
      return !updatedAt || Date.now() - updatedAt > 15 * 60_000;
    });
    const metaRefreshResults = await Promise.allSettled(
      staleMetaCampaigns.map((campaign) => meta.refreshMetaCampaignInsights(agencyId, campaign.id))
    );
    const refreshedMetaCampaigns = new Map(
      metaRefreshResults
        .filter((result): result is PromiseFulfilledResult<MetaMarketingCampaignDraft> => result.status === 'fulfilled')
        .map((result) => [result.value.id, result.value])
    );
    metaCampaigns = metaCampaigns.map((campaign) => refreshedMetaCampaigns.get(campaign.id) || campaign);
    const latestFacebookJob = facebookJobs[0] || null;
    const facebookGroups = facebookJobs.flatMap((job) => job.groups || []);
    const portalEntries = Object.entries(property.promotions || {});

    const metaTotals = metaCampaigns.reduce((totals, campaign) => {
      totals.spend += Math.max(0, Number(campaign.insights?.spend) || 0);
      totals.impressions += Math.max(0, Number(campaign.insights?.impressions) || 0);
      totals.clicks += Math.max(0, Number(campaign.insights?.clicks) || 0);
      totals.leads += Math.max(0, Number(campaign.insights?.leads) || 0);
      return totals;
    }, { spend: 0, impressions: 0, clicks: 0, leads: 0 });

    const context: PropertySalesContext = {
      generatedAt: new Date().toISOString(),
      publicStats: {
        available: true,
        views: safeCount(statsData.views),
        favorites: safeCount(statsData.favorites),
        favoriteAdds: safeCount(statsData.favoriteAdds),
        updatedAt: typeof statsData.updatedAt === 'string' ? statsData.updatedAt : null,
      },
      viewings: {
        scheduled: viewings.filter((viewing) => viewing.status === 'scheduled').length,
        completed: viewings.filter((viewing) => viewing.status === 'completed').length,
        cancelled: viewings.filter((viewing) => viewing.status === 'cancelled').length,
        latestAt: newestIso(viewings.map((viewing) => viewing.viewingDate || viewing.createdAt)),
      },
      buyers: {
        totalMatches: matches.length,
        strongMatches: matches.filter((match) => match.matchScore >= 70).length,
        topMatches: matches.slice(0, 3).map((match) => ({
          id: match.id,
          name: match.name || 'Cumpărător fără nume',
          matchScore: match.matchScore,
          budget: typeof match.budget === 'number' ? match.budget : null,
        })),
      },
      facebook: {
        syncStatus: activeCloudJobs.length > 0 && facebookRefreshResults.some((result) => result.status === 'fulfilled') ? 'live' : 'stored',
        totalJobs: facebookJobs.length,
        latestStatus: latestFacebookJob?.status || null,
        latestAt: latestFacebookJob?.updatedAt || latestFacebookJob?.createdAt || null,
        submittedGroups: facebookGroups.filter((group) => ['submitted', 'pending_approval'].includes(group.status)).length,
        failedGroups: facebookGroups.filter((group) => ['error', 'needs_reauthentication'].includes(group.status)).length,
        pendingGroups: facebookGroups.filter((group) => ['queued', 'publishing'].includes(group.status)).length,
      },
      metaAds: {
        available: metaCampaignsResult !== null,
        syncStatus: metaCampaignsResult === null
          ? 'unavailable'
          : metaCampaigns.some((campaign) => {
            const updatedAt = campaign.insights?.updatedAt ? new Date(campaign.insights.updatedAt).getTime() : 0;
            return updatedAt > 0 && Date.now() - updatedAt <= 30 * 60_000;
          }) ? 'live' : 'stored',
        campaignCount: metaCampaigns.length,
        activeCampaigns: metaCampaigns.filter((campaign) => ['publishing', 'published'].includes(campaign.status)).length,
        errorCampaigns: metaCampaigns.filter((campaign) => campaign.status === 'error').length,
        ...metaTotals,
        currency: metaCampaigns.find((campaign) => campaign.currency)?.currency || property.advertisingCosts?.currency || 'RON',
        insightsUpdatedAt: newestIso(metaCampaigns.map((campaign) => campaign.insights?.updatedAt)),
      },
      portals: {
        published: portalEntries.filter(([, promotion]) => promotion?.status === 'published').map(([name]) => name),
        pending: portalEntries.filter(([, promotion]) => promotion?.status === 'pending').map(([name]) => name),
        errors: portalEntries.filter(([, promotion]) => promotion?.status === 'error').map(([name]) => name),
        latestSyncAt: newestIso(portalEntries.map(([, promotion]) => promotion?.lastSync)),
      },
    };

    return NextResponse.json(context, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
