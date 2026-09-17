import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { discoverTikTokAdsCapabilities, executeTikTokAdsOperation, formatTikTokAdsError } from '@/lib/tiktok-ads';
import { getAdvertiser, getTikTokAccountPermission, loadToolCache } from '@/lib/tiktok-ads/store';
import { schemaInput, rowsFor, records } from '@/lib/tiktok-ads/workspace-model';
import type { TikTokCapability } from '@/lib/tiktok-ads/types';
import { TikTokAdsError } from '@/lib/tiktok-ads/errors';

export const runtime = 'nodejs';
export const maxDuration = 300;
const query = z.object({ advertiserId: z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/), kind: z.enum(['campaign', 'adgroup', 'ad', 'post', 'form', 'location', 'report']), identityId: z.string().optional(), search: z.string().max(100).optional(), start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });
const capabilities: Record<string, TikTokCapability> = { campaign: 'CAMPAIGN_READ', adgroup: 'ADGROUP_READ', ad: 'AD_READ', post: 'ASSET_DISCOVERY', form: 'LEAD_FORM_READ', location: 'TARGETING_READ', report: 'REPORT_READ' };

export async function GET(request: NextRequest) {
  try {
    const { agencyId, uid, role, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const params = query.parse(Object.fromEntries(request.nextUrl.searchParams));
    if (params.kind === 'report' && (!params.start || !params.end || params.start > params.end || (Date.parse(params.end) - Date.parse(params.start)) > 366 * 86400000)) throw new TikTokAdsError('INVALID_REQUEST', 'Alege un interval de raportare valid, de maximum un an.');
    if (params.kind === 'post' && !params.identityId) throw new TikTokAdsError('INVALID_REQUEST', 'Selectează profilul TikTok.');
    const advertiser = await getAdvertiser(agencyId, params.advertiserId);
    const capability = capabilities[params.kind];
    const resolutions = await discoverTikTokAdsCapabilities(agencyId);
    const resolution = resolutions.find(item => item.capability === capability);
    if (!resolution?.executionAllowed) throw new TikTokAdsError('CAPABILITY_UNAVAILABLE', 'Această funcție nu este disponibilă pentru cont. Verifică permisiunile în Conturi.');
    const tool = (await loadToolCache(agencyId)).find(item => item.name === resolution.toolName);
    const identity = params.kind === 'post' ? await getTikTokAccountPermission(agencyId, params.advertiserId, params.identityId!) : null;
    const payload = schemaInput(tool?.inputSchema, { identity_id: params.identityId, identity_type: identity?.identityType, identity_authorized_bc_id: identity?.identityAuthorizedBcId, language: 'en', search_query: params.search, keyword: params.search, query: params.search, start_date: params.start, end_date: params.end, report_type: 'BASIC', data_level: 'AUCTION_AD', dimensions: ['ad_id', 'stat_time_day'], metrics: ['spend', 'impressions', 'clicks', 'conversion'], page_size: 100 });
    const result = await executeTikTokAdsOperation({ organizationId: agencyId, actor: { uid, role, type: 'human' }, advertiserId: params.advertiserId, capability, payload, correlationId: randomUUID() });
    if (params.kind === 'report') return NextResponse.json({ rows: records(result.remoteResult).filter(row => row.spend !== undefined || row.metrics), currency: advertiser.currency, timezone: advertiser.timezone, syncedAt: new Date().toISOString() });
    const rows = rowsFor(result.remoteResult, params.kind).filter(row => params.kind !== 'location' || !params.search || row.name.toLocaleLowerCase('ro-RO').includes(params.search.toLocaleLowerCase('ro-RO')));
    const refs = await adminDb.collection('agencies').doc(agencyId).collection('tiktokResourceReferences').where('advertiserId', '==', params.advertiserId).limit(2000).get();
    const attribution = new Map(refs.docs.map(doc => [String(doc.data().resourceId), doc.data().propertyId as string | null]));
    return NextResponse.json({ rows: rows.map(row => ({ ...row, propertyId: attribution.get(row.id) || null })), syncedAt: new Date().toISOString(), currency: advertiser.currency, timezone: advertiser.timezone });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: 'Filtre invalide.' }, { status: 400 });
    const formatted = formatTikTokAdsError(error);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
