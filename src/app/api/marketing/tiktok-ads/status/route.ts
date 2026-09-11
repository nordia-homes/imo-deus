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
    const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' ? error.status : 500;
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Nu am putut verifica TikTok Ads.' }, { status });
  }
}
