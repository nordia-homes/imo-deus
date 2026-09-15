import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { discoverTikTokAdsCapabilities }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-ads'),
    ]);
    const { agencyId } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    return NextResponse.json({ capabilities: await discoverTikTokAdsCapabilities(agencyId, false) });
  } catch (error) {
    const { formatTikTokAdsError } = await import('@/lib/tiktok-ads');
    const formatted = formatTikTokAdsError(error);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyAdminFromBearerToken }, { discoverTikTokAdsCapabilities }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-ads'),
    ]);
    const { agencyId } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    return NextResponse.json({ capabilities: await discoverTikTokAdsCapabilities(agencyId, true) });
  } catch (error) {
    const { formatTikTokAdsError } = await import('@/lib/tiktok-ads');
    const formatted = formatTikTokAdsError(error);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
