import { NextRequest, NextResponse } from 'next/server';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';

export const runtime = 'nodejs';
const OAUTH_BINDING_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-imodeus_tiktok_ads_oauth' : 'imodeus_tiktok_ads_oauth';

export async function GET(request: NextRequest) {
  try {
    const [{ requireAgencyAdminFromBearerToken }, { createTikTokAdsAuthorization }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-ads'),
    ]);
    const { agencyId, uid } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) return createDemoBlockedResponse('Conectarea TikTok Ads este blocată în demo.');

    const returnTo = request.nextUrl.searchParams.get('returnTo') || undefined;
    const authorization = await createTikTokAdsAuthorization({ agencyId, requestedByUid: uid, returnTo });
    const response = NextResponse.json({ authorizationUrl: authorization.authorizationUrl });
    response.cookies.set(OAUTH_BINDING_COOKIE, authorization.callbackBinding, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    const { formatTikTokAdsError } = await import('@/lib/tiktok-ads');
    const formatted = formatTikTokAdsError(error);
    return NextResponse.json(formatted.body, { status: formatted.status });
  }
}
