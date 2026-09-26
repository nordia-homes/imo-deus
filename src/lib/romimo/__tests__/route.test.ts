import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/romimo/[action]/route';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), status: vi.fn(), connect: vi.fn(), preview: vi.fn(), publish: vi.fn(), disconnect: vi.fn(), check: vi.fn(), listings: vi.fn() }));
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: mocks.auth }));
vi.mock('../service', () => ({ connectionStatus: mocks.status, connect: mocks.connect, preview: mocks.preview, publish: mocks.publish, disconnect: mocks.disconnect, checkOrUnpublish: mocks.check, listManagedArticles: mocks.listings }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ role: 'agent', agencyId: 'agency-a', uid: 'user-a', adminDb: {} });
  mocks.preview.mockResolvedValue({ issues: [] });
  mocks.listings.mockResolvedValue({ items: [], nextCursor: null });
});
async function post(action: string, body: unknown) {
  return POST(new NextRequest(`http://localhost/api/romimo/${action}`, { method: 'POST', body: JSON.stringify(body), headers: { Authorization: 'Bearer test' } }), { params: Promise.resolve({ action }) });
}
describe('Romimo API authorization', () => {
  it('requires administrator access for account changes', async () => {
    expect((await post('connect', { apiKey: 'secret', email: 'a@example.com' })).status).toBe(403);
    expect((await post('disconnect', {})).status).toBe(403);
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(mocks.disconnect).not.toHaveBeenCalled();
  });
  it('uses only the verified agency and database, never request-supplied tenancy', async () => {
    expect((await post('preview', { propertyId: 'p1' })).status).toBe(200);
    expect(mocks.preview).toHaveBeenCalledWith({ db: {}, agencyId: 'agency-a', uid: 'user-a' }, 'p1', undefined);
    expect((await post('preview', { propertyId: 'p1', agencyId: 'victim' })).status).toBe(400);
    expect((await post('preview', { propertyId: '../victim' })).status).toBe(400);
  });
  it('blocks external access from demo agencies and invalid sessions', async () => {
    mocks.auth.mockResolvedValue({ role: 'admin', agencyId: 'demo-test', uid: 'u', adminDb: {} });
    expect((await post('connect', { apiKey: 'secret', email: 'a@example.com' })).status).toBe(403);
    expect(mocks.connect).not.toHaveBeenCalled();
    mocks.auth.mockRejectedValue({ status: 401, message: 'secret error detail' });
    const result = await GET(new NextRequest('http://localhost/api/romimo/status'), { params: Promise.resolve({ action: 'status' }) });
    expect(result.status).toBe(401);
    expect(await result.text()).not.toContain('secret error detail');
  });
  it('isolates listing pages and rejects oversized request streams', async () => {
    const response = await GET(new NextRequest('http://localhost/api/romimo/listings?cursor=p005&agencyId=other'), { params: Promise.resolve({ action: 'listings' }) });
    expect(response.status).toBe(200);
    expect(mocks.listings).toHaveBeenCalledWith({ db: {}, agencyId: 'agency-a', uid: 'user-a' }, 'p005');
    expect((await post('preview', { propertyId: 'p1', padding: 'x'.repeat(100001) })).status).toBe(413);
  });
});
