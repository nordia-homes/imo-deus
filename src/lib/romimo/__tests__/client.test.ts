import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseToken, readArticleState, romimoRequest, safeListingUrl } from '../client';

afterEach(() => vi.unstubAllGlobals());
describe('Romimo transport and response boundaries', () => {
  it('sends API v2 and Bearer headers, with no redirect or automatic mutation retry', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await romimoRequest('/api/Article', { method: 'POST', token: 'secret', body: { ad: {} } });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'POST', redirect: 'error', cache: 'no-store', headers: { 'x-api-version': '2', Authorization: 'Bearer secret' } });
  });
  it('never leaks credentials from fetch errors or upstream response bodies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('https://services.romimo.ro/api/Token?ApiKey=VERY_SECRET')));
    await expect(romimoRequest('/api/Token', { method: 'POST', query: { ApiKey: 'VERY_SECRET' } })).rejects.not.toThrow('VERY_SECRET');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('VERY_SECRET', { status: 401 })));
    await expect(romimoRequest('/api/Token')).rejects.toMatchObject({ remoteStatus: 401 });
    await expect(romimoRequest('/api/Token')).rejects.not.toThrow('VERY_SECRET');
  });
  it('fails closed on unsupported token formats', () => {
    expect(parseToken('abc.def.ghi')).toBe('abc.def.ghi');
    expect(parseToken({ access_token: 'abc.def.ghi' })).toBe('abc.def.ghi');
    expect(() => parseToken({ success: true })).toThrow(/Formatul tokenului/);
  });
  it('only confirms a matching explicit active flag; unknown responses remain pending', () => {
    expect(readArticleState({ ad: { externalid: 'ref', active: true }, url: 'https://www.romimo.ro/anunt/test' }, 'ref')).toMatchObject({ state: 'published', remoteUrl: 'https://www.romimo.ro/anunt/test' });
    expect(readArticleState({ externalId: 'ref', active: false }, 'ref').state).toBe('unpublished');
    for (const data of [{ success: true }, { status: 1 }, 'OK', { externalid: 'other', active: true }, { externalid: 'ref', active: 'true' }]) {
      expect(readArticleState(data, 'ref').state).toBe('pending');
    }
  });
  it('rejects hostile listing URLs and arbitrary request origins', async () => {
    expect(safeListingUrl('javascript:alert(1)')).toBeNull();
    expect(safeListingUrl('https://romimo.ro.evil.test/')).toBeNull();
    expect(safeListingUrl('https://user:pass@romimo.ro/test')).toBeNull();
    await expect(romimoRequest('https://other.test/api/Article')).rejects.toThrow(/neacceptată/);
  });
});
