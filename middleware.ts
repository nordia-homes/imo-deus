import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isPlatformHost, normalizeDomain } from '@/lib/domain-routing';

function shouldBypass(pathname: string) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/robots.txt') ||
    pathname.startsWith('/sitemap') ||
    pathname.startsWith('/manifest') ||
    pathname.startsWith('/icons') ||
    pathname.startsWith('/images') ||
    pathname.startsWith('/domains')
  );
}

export function middleware(request: NextRequest) {
  const hostHeader = request.headers.get('host');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const requestHostname = normalizeDomain(request.nextUrl.hostname);
  const hostname = normalizeDomain(forwardedHost || hostHeader || request.nextUrl.hostname);
  const { pathname, search } = request.nextUrl;

  const isDefinitelyPlatformHost =
    isPlatformHost(hostname) ||
    isPlatformHost(requestHostname) ||
    requestHostname.endsWith('.hosted.app') ||
    requestHostname.endsWith('.web.app') ||
    requestHostname.endsWith('.firebaseapp.com') ||
    hostname.endsWith('.hosted.app') ||
    hostname.endsWith('.web.app') ||
    hostname.endsWith('.firebaseapp.com');

  if (!hostname || shouldBypass(pathname) || isDefinitelyPlatformHost) {
    return NextResponse.next();
  }

  const rewriteUrl = request.nextUrl.clone();
  const pathnameSegments = pathname.split('/').filter(Boolean);
  const isLegacyAgencyPath = pathnameSegments[0] === 'agencies' && pathnameSegments.length >= 2;

  if (isLegacyAgencyPath) {
    const strippedPath = pathnameSegments.slice(2).join('/');
    rewriteUrl.pathname = `/domains/${hostname}${strippedPath ? `/${strippedPath}` : ''}`;
  } else {
    rewriteUrl.pathname = `/domains/${hostname}${pathname}`;
  }
  rewriteUrl.search = search;

  return NextResponse.rewrite(rewriteUrl);
}

export const config = {
  matcher: '/:path*',
};
