import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from '@/proxy';

function request(path: string, forwardedHost: string) {
  return new NextRequest(`http://0.0.0.0${path}`, {
    headers: {
      host: 'studio-552699648501.us-central1.run.app',
      'x-forwarded-host': forwardedHost,
    },
  });
}

describe('custom domain proxy', () => {
  it('rewrites a Firebase-forwarded custom domain to its public site route', () => {
    const response = proxy(request('/properties?city=brasov', 'nordia.ro'));
    expect(response.headers.get('x-middleware-rewrite')).toBe('http://0.0.0.0/domains/nordia.ro/properties?city=brasov');
  });

  it('does not rewrite the ImoDeus platform host or API routes', () => {
    expect(proxy(request('/', 'imodeus.ro')).headers.get('x-middleware-next')).toBe('1');
    expect(proxy(request('/api/health', 'nordia.ro')).headers.get('x-middleware-next')).toBe('1');
  });

  it('redirects legacy agency paths to the custom-domain equivalent', () => {
    const response = proxy(request('/agencies/agency-id/properties/listing-id?ref=legacy', 'nordia.ro'));
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('http://0.0.0.0/properties/listing-id?ref=legacy');
  });
});
