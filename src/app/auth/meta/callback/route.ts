import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function buildRedirect(request: NextRequest, params: Record<string, string>) {
  const url = new URL('/marketing', request.url);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code') || '';
  const state = request.nextUrl.searchParams.get('state') || '';
  const error = request.nextUrl.searchParams.get('error') || '';
  const errorDescription = request.nextUrl.searchParams.get('error_description') || '';

  if (error) {
    return NextResponse.redirect(buildRedirect(request, {
      meta: 'error',
      message: errorDescription || error,
    }));
  }

  if (!code || !state) {
    return NextResponse.redirect(buildRedirect(request, {
      meta: 'error',
      message: 'Callback-ul Meta nu contine code si state.',
    }));
  }

  try {
    const { finalizeMetaAuthorization } = await import('@/lib/meta-marketing');
    await finalizeMetaAuthorization({ code, state });
    return NextResponse.redirect(buildRedirect(request, { meta: 'connected' }));
  } catch (callbackError) {
    return NextResponse.redirect(buildRedirect(request, {
      meta: 'error',
      message: callbackError instanceof Error ? callbackError.message : 'Conectarea Meta a esuat.',
    }));
  }
}
