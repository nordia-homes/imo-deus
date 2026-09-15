import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';
import { TikTokAdsError } from '@/lib/tiktok-ads/errors';

export const runtime = 'nodejs';

const bodySchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('sync') }).strict(),
  z.object({ action: z.literal('select'), advertiserId: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/) }).strict(),
]);

export async function GET(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { listTikTokAdvertisers }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-ads'),
    ]);
    const { agencyId } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    return NextResponse.json({ advertisers: await listTikTokAdvertisers(agencyId) });
  } catch (error) {
    const { formatTikTokAdsError } = await import('@/lib/tiktok-ads');
    const formatted = formatTikTokAdsError(error);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyAdminFromBearerToken }, ads] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-ads'),
    ]);
    const { agencyId, uid } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) return createDemoBlockedResponse('Administrarea advertiserilor TikTok este blocată în demo.');
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new TikTokAdsError('INVALID_REQUEST', 'Acțiunea pentru advertiser nu este validă.');
    if (parsed.data.action === 'sync') return NextResponse.json({ advertisers: await ads.synchronizeTikTokAdvertisers(agencyId, uid) });
    await ads.selectTikTokAdvertiser(agencyId, parsed.data.advertiserId, uid);
    return NextResponse.json({ advertisers: await ads.listTikTokAdvertisers(agencyId) });
  } catch (error) {
    const { formatTikTokAdsError } = await import('@/lib/tiktok-ads');
    const formatted = formatTikTokAdsError(error);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
