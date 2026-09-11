import { NextRequest, NextResponse } from 'next/server';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const [{ requireAgencyAdminFromBearerToken }, { createTikTokAdsAuthorization }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/tiktok-ads'),
    ]);
    const { agencyId, uid } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) return createDemoBlockedResponse('Conectarea TikTok Ads este blocată în demo.');

    const returnTo = request.nextUrl.searchParams.get('returnTo') || undefined;
    return NextResponse.json(await createTikTokAdsAuthorization({ agencyId, requestedByUid: uid, returnTo }));
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' ? error.status : 500;
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Nu am putut conecta TikTok Ads.' }, { status });
  }
}
