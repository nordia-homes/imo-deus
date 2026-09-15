import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { TikTokAdsError } from '@/lib/tiktok-ads/errors';

export const runtime = 'nodejs';

const optionalId = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/).nullish();

export async function GET(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { getTikTokAdsWorkspace }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-ads'),
    ]);
    const { agencyId, role } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const advertiserId = request.nextUrl.searchParams.get('advertiserId');
    const propertyId = request.nextUrl.searchParams.get('propertyId');
    if (!optionalId.safeParse(advertiserId).success || !optionalId.safeParse(propertyId).success) {
      throw new TikTokAdsError('INVALID_REQUEST', 'Filtrele workspace-ului TikTok Ads nu sunt valide.');
    }
    return NextResponse.json({
      ...(await getTikTokAdsWorkspace(agencyId, { advertiserId, propertyId })),
      role,
    });
  } catch (error) {
    const { formatTikTokAdsError } = await import('@/lib/tiktok-ads');
    const formatted = formatTikTokAdsError(error);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
