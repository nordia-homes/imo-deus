import { afterEach, expect, it, vi } from 'vitest';
import { safeSocialAssets, socialAssetsRequest } from '../social-assets';
import { discoverAuthorizedPages } from '@/lib/communications/meta';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it('recognizes social refresh and projects only public asset identifiers', () => {
  expect(socialAssetsRequest('Reîmprospătează asseturile Meta pentru publicarea socială.')).toBe(true);
  expect(socialAssetsRequest('Selectează contul pentru reclame.')).toBe(false);
  const rows = safeSocialAssets([{ id: '1', name: 'Page', access_token: 'SECRET', instagram_business_account: { id: '2', username: 'Name', access_token: 'SECRET' } }]);
  expect(rows).toEqual([{ id: '1', name: 'Page', channel: 'messenger', instagramId: '2', instagramUsername: 'Name' }]); expect(JSON.stringify(rows)).not.toContain('SECRET');
});
it('uses encoded cursors on a fixed Meta endpoint and deduplicates pages', async () => {
  vi.stubEnv('META_APP_ID', 'test-app');
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: '1', name: 'One' }], paging: { next: 'https://untrusted.invalid/SECRET', cursors: { after: 'a&b=1' } } }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: '1', name: 'One' }, { id: '2', name: 'Two' }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: { is_valid: true, app_id: 'test-app' } })));
  vi.stubGlobal('fetch', fetch); const report = await discoverAuthorizedPages('test-token');
  expect(report.complete).toBe(true); expect(report.pages).toHaveLength(2); expect(fetch.mock.calls[1][0]).toContain('&after=a%26b%3D1'); expect(fetch.mock.calls.every(([url]) => String(url).startsWith('https://graph.facebook.com/'))).toBe(true);
});
it('does not swallow authorization loss as an optional diagnostic error', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }))); vi.stubGlobal('fetch', fetch);
  const authorize = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValue(new Error('Revoked'));
  await expect(discoverAuthorizedPages('test-token', authorize)).rejects.toThrow('Revoked'); expect(fetch).toHaveBeenCalledTimes(1);
});
it('marks a repeated cursor incomplete instead of claiming complete discovery', async () => {
  vi.stubEnv('META_APP_ID', 'test-app');
  const page = { data: [{ id: '1', name: 'One' }], paging: { next: 'more', cursors: { after: 'repeat' } } };
  const fetch = vi.fn().mockImplementation(async (url: string) => new Response(JSON.stringify(url.includes('/debug_token') ? { data: { is_valid: true, app_id: 'test-app' } } : page))); vi.stubGlobal('fetch', fetch);
  const report = await discoverAuthorizedPages('test-token'); expect(report.complete).toBe(false); expect(report.pages).toHaveLength(1); expect(fetch).toHaveBeenCalledTimes(3);
});