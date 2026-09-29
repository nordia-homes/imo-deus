import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const { drainTikTokAdsJobs, isValidTikTokWorkerSecret } = await import('@/lib/tiktok-ads/jobs');
    if (!isValidTikTokWorkerSecret(request.headers.get('x-tiktok-ads-worker-secret'))) {
      return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const ads = drainTikTokAdsJobs({
      limit: typeof body.limit === 'number' ? body.limit : undefined,
      concurrency: typeof body.concurrency === 'number' ? body.concurrency : undefined,
      maxRuntimeMs: typeof body.maxRuntimeMs === 'number' ? body.maxRuntimeMs : undefined,
    });
    const { drainStudioRenders, drainTikTokPostStatuses } = await import('@/lib/tiktok-studio-jobs');
    const [adsResult, studioResult, organicStatus] = await Promise.allSettled([ads, drainStudioRenders(), drainTikTokPostStatuses()]);
    const failed = [adsResult, studioResult, organicStatus].filter(item => item.status === 'rejected').length;
    return NextResponse.json({
      ads: adsResult.status === 'fulfilled' ? adsResult.value : { error: 'Ads worker failed' },
      studio: studioResult.status === 'fulfilled' ? studioResult.value : { error: 'Studio worker failed' },
      organicStatus: organicStatus.status === 'fulfilled' ? organicStatus.value : { error: 'Organic status worker failed' },
    }, { status: failed ? 503 : 200 });
  } catch {
    return NextResponse.json({ message: 'Drain-ul TikTok Ads a eșuat.' }, { status: 500 });
  }
}
