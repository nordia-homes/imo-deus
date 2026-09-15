import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { getTikTokAdsStatus }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-ads'),
    ]);
    const { agencyId, role } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    return NextResponse.json({ ...(await getTikTokAdsStatus(agencyId)), role });
  } catch (error) {
    const { formatTikTokAdsError } = await import('@/lib/tiktok-ads');
    const formatted = formatTikTokAdsError(error);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
