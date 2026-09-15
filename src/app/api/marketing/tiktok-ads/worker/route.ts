import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const { drainTikTokAdsJobs, isValidTikTokWorkerSecret } = await import('@/lib/tiktok-ads/jobs');
    if (!isValidTikTokWorkerSecret(request.headers.get('x-tiktok-ads-worker-secret'))) {
      return NextResponse.json({ message: 'Unauthorized.' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const result = await drainTikTokAdsJobs({
      limit: typeof body.limit === 'number' ? body.limit : undefined,
      concurrency: typeof body.concurrency === 'number' ? body.concurrency : undefined,
      maxRuntimeMs: typeof body.maxRuntimeMs === 'number' ? body.maxRuntimeMs : undefined,
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ message: 'Drain-ul TikTok Ads a eșuat.' }, { status: 500 });
  }
}
