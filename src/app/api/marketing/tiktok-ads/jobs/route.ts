import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';
import { TIKTOK_CAPABILITIES } from '@/lib/tiktok-ads/types';
import { TikTokAdsError } from '@/lib/tiktok-ads/errors';

export const runtime = 'nodejs';

const id = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/);
const schema = z.object({
  kind: z.enum(['advertiser_discovery', 'capability_discovery', 'capability_read']),
  capability: z.enum(TIKTOK_CAPABILITIES).nullish(),
  advertiserId: id.nullish(),
  propertyId: id.nullish(),
  payload: z.record(z.unknown()).default({}),
  recurrenceMinutes: z.number().int().min(5).max(1440).nullish(),
  runAt: z.string().datetime({ offset: true }).nullish(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyAdminFromBearerToken }, { enqueueTikTokAdsJob }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-ads/jobs'),
    ]);
    const { agencyId, uid, adminDb } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) return createDemoBlockedResponse('Job-urile TikTok Ads sunt blocate în demo.');
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new TikTokAdsError('INVALID_REQUEST', 'Configurația job-ului TikTok nu este validă.');
    if (parsed.data.propertyId) {
      const property = await adminDb.collection('agencies').doc(agencyId).collection('properties').doc(parsed.data.propertyId).get();
      if (!property.exists) throw new TikTokAdsError('RESOURCE_NOT_OWNED', 'Proprietatea nu aparține organizației curente.');
    }
    const job = await enqueueTikTokAdsJob({ organizationId: agencyId, createdByUid: uid, ...parsed.data });
    return NextResponse.json(job, { status: 202 });
  } catch (error) {
    const { formatTikTokAdsError } = await import('@/lib/tiktok-ads');
    const formatted = formatTikTokAdsError(error);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
