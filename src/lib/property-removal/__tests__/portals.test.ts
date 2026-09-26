import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Property } from '@/lib/types';
import { withdrawImobiliareForRemoval } from '@/lib/imobiliare';
import { withdrawStoriaForRemoval } from '@/lib/storia';

vi.mock('@/firebase/admin', () => ({ adminDb: {
  collection: () => ({ doc: () => ({ get: async () => ({ exists: true, data: () => ({ accessToken: 'test-token', accessTokenExpiresAt: null }) }) }) }),
} }));
const fetchMock = vi.fn<typeof fetch>();
const property = { id: 'p1', portalProfiles: { storia: { remoteUuid: 'remote-uuid' }, imobiliare: { customReference: 'reference' } } } as Property;
const response = (data: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(data), { status });
beforeEach(() => {
  vi.clearAllMocks(); fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('STORIA_CLIENT_ID', 'test'); vi.stubEnv('STORIA_CLIENT_SECRET', 'test'); vi.stubEnv('STORIA_API_KEY', 'test');
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('remote withdrawal confirmation', () => {
  it('confirms Imobiliare only after a fresh GET reports draft', async () => {
    fetchMock.mockResolvedValueOnce(response({ data: { state: 'online' } })).mockResolvedValueOnce(response({})).mockResolvedValueOnce(response({ data: { state: 'draft' } }));
    expect(await withdrawImobiliareForRemoval('a', property)).toBe(true);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ status: 'draft' }) });
    expect(fetchMock.mock.calls[2][0]).toContain('/listings/reference');
  });
  it('does not treat accepted, missing or unrecognized Imobiliare responses as confirmed', async () => {
    fetchMock.mockResolvedValueOnce(response({ data: { state: 'online' } })).mockResolvedValueOnce(response({})).mockResolvedValueOnce(response({ data: {} }));
    expect(await withdrawImobiliareForRemoval('a', property)).toBe(false);
    fetchMock.mockResolvedValueOnce(response({}, 404));
    expect(await withdrawImobiliareForRemoval('a', property)).toBe(false);
  });
  it('does not deactivate twice when Imobiliare already reports draft', async () => {
    fetchMock.mockResolvedValueOnce(response({ data: { state: 'draft' } }));
    expect(await withdrawImobiliareForRemoval('a', property)).toBe(true); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('confirms Storia metadata rather than the deactivate HTTP response', async () => {
    fetchMock.mockResolvedValueOnce(response({ data: { state: { code: 'active' } } })).mockResolvedValueOnce(response({}, 204)).mockResolvedValueOnce(response({ data: { state: { code: 'active' } } }));
    expect(await withdrawStoriaForRemoval('a', property)).toBe(false);
    expect(fetchMock.mock.calls[1][0]).toContain('/remote-uuid/deactivate');
    fetchMock.mockResolvedValueOnce(response({ data: { state: { code: 'removed_by_user' } } }));
    expect(await withdrawStoriaForRemoval('a', property)).toBe(true); expect(fetchMock).toHaveBeenCalledTimes(4);
  });
  it('refuses Storia removal without a saved remote identifier', async () => {
    await expect(withdrawStoriaForRemoval('a', { id: 'p1' } as Property)).rejects.toThrow(/UUID/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
