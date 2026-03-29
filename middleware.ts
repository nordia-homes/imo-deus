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
    pathname.startsWith('/__public')
  );
}

export function middleware(request: NextRequest) {
  const hostHeader = request.headers.get('host');
  const hostname = normalizeDomain(hostHeader);
  const { pathname, search } = request.nextUrl;

  if (!hostname || shouldBypass(pathname) || isPlatformHost(hostname)) {
    return NextResponse.next();
  }

  const rewriteUrl = request.nextUrl.clone();
  rewriteUrl.pathname = `/__public/${hostname}${pathname}`;
  rewriteUrl.search = search;

  return NextResponse.rewrite(rewriteUrl);
}

export const config = {
  matcher: '/:path*',
};
