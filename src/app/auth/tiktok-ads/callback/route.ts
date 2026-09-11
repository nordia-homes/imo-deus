import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function redirect(request: NextRequest, path: string, params: Record<string, string>) {
  const url = new URL(path, request.url);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const authCode = request.nextUrl.searchParams.get('auth_code') || request.nextUrl.searchParams.get('code') || '';
  const state = request.nextUrl.searchParams.get('state') || '';
  const error = request.nextUrl.searchParams.get('error') || request.nextUrl.searchParams.get('error_description') || '';
  if (error) return redirect(request, '/properties', { tiktokAds: 'error', message: error });
  if (!authCode || !state) return redirect(request, '/properties', { tiktokAds: 'error', message: 'Callback TikTok Ads incomplet.' });

  try {
    const { finalizeTikTokAdsAuthorization } = await import('@/lib/tiktok-ads');
    const result = await finalizeTikTokAdsAuthorization({ authCode, state });
    return redirect(request, result.returnTo, { tiktokAds: 'connected' });
  } catch (error) {
    return redirect(request, '/properties', {
      tiktokAds: 'error',
      message: error instanceof Error ? error.message : 'Conectarea TikTok Ads a eșuat.',
    });
  }
}
