import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
const OAUTH_BINDING_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-imodeus_tiktok_ads_oauth' : 'imodeus_tiktok_ads_oauth';

function redirect(request: NextRequest, path: string, params: Record<string, string>) {
  const url = new URL(path, request.url);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = NextResponse.redirect(url);
  response.cookies.set(OAUTH_BINDING_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: new Date(0) });
  return response;
}

export async function GET(request: NextRequest) {
  const authCode = request.nextUrl.searchParams.get('auth_code') || request.nextUrl.searchParams.get('code') || '';
  const state = request.nextUrl.searchParams.get('state') || '';
  const error = request.nextUrl.searchParams.get('error') || request.nextUrl.searchParams.get('error_description') || '';
  if (error) return redirect(request, '/properties', { tiktokAds: 'error', message: 'Autorizarea TikTok Ads a fost refuzată sau anulată.' });
  if (!authCode || !state) return redirect(request, '/properties', { tiktokAds: 'error', message: 'Callback TikTok Ads incomplet.' });

  try {
    const { finalizeTikTokAdsAuthorization } = await import('@/lib/tiktok-ads');
    const callbackBinding = request.cookies.get(OAUTH_BINDING_COOKIE)?.value || '';
    const result = await finalizeTikTokAdsAuthorization({ authCode, state, callbackBinding });
    return redirect(request, result.returnTo, { tiktokAds: 'connected' });
  } catch (error) {
    return redirect(request, '/properties', {
      tiktokAds: 'error',
      message: error && typeof error === 'object' && 'code' in error && error.code === 'UNAUTHORIZED'
        ? 'Sesiunea de autorizare TikTok Ads este invalidă sau expirată.'
        : 'Conectarea TikTok Ads a eșuat în siguranță.',
    });
  }
}
