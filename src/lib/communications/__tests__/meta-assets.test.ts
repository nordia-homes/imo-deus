import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listAuthorizedPages } from '../meta';

beforeEach(() => vi.stubEnv('META_APP_ID', 'test-app'));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Meta page discovery', () => {
  it('finds a granted Page and linked Instagram account omitted from /me/accounts', async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const path = new URL(String(input)).pathname;
      const body = path.endsWith('/me/accounts')
        ? { data: [{ id: '111', name: 'ImoDeus', access_token: 'page-one' }] }
        : path.endsWith('/debug_token')
          ? { data: { app_id: 'test-app', is_valid: true, granular_scopes: [{ scope: 'pages_show_list', target_ids: ['111', '222'] }] } }
          : { id: '222', name: 'Nordia', access_token: 'page-two', instagram_business_account: { id: '333', username: 'nordia_homes' } };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const pages = await listAuthorizedPages('user-token');

    expect(pages.map(page => page.name)).toEqual(['ImoDeus', 'Nordia']);
    expect(pages[1].instagram_business_account?.username).toBe('nordia_homes');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not trust granted targets reported for another app', async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const path = new URL(String(input)).pathname;
      const body = path.endsWith('/me/accounts')
        ? { data: [{ id: '111', name: 'ImoDeus', access_token: 'page-one' }] }
        : { data: { app_id: 'other-app', is_valid: true, granular_scopes: [{ scope: 'pages_show_list', target_ids: ['222'] }] } };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    expect((await listAuthorizedPages('user-token')).map(page => page.id)).toEqual(['111']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});