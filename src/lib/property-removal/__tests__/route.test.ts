import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/properties/remove/route';

const mocks = vi.hoisted(() => ({ auth: vi.fn(), remove: vi.fn(), db: { collection: vi.fn(() => ({ where: () => ({ get: async () => ({ docs: [] }) }) })) } }));
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: mocks.auth }));
vi.mock('../service', () => ({ removeProperty: mocks.remove }));
const body = { propertyId: 'p1', reason: 'not_interesting', agentMessage: 'Retragere' };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ agencyId: 'a', uid: 'u', role: 'agent', adminDb: mocks.db, runtimeMode: 'real' });
  mocks.remove.mockResolvedValue({ complete: true, outcome: 'deleted', portals: [] });
});
const post = (data: unknown) => POST(new NextRequest('http://localhost/api/properties/remove', { method: 'POST', headers: { Authorization: 'Bearer test' }, body: JSON.stringify(data) }));

describe('property removal route', () => {
  it('derives the agency, database and role exclusively from authentication', async () => {
    expect((await post(body)).status).toBe(200);
    expect(mocks.remove).toHaveBeenCalledWith({ agencyId: 'a', uid: 'u', role: 'agent', db: mocks.db, demo: false, propertyId: 'p1' }, body);
    expect((await post({ ...body, agencyId: 'other' })).status).toBe(400);
    expect((await post({ ...body, propertyId: '../p1' })).status).toBe(400);
    expect(mocks.remove).toHaveBeenCalledTimes(1);
  });
  it('returns safe authentication errors and rejects unknown roles', async () => {
    mocks.auth.mockRejectedValueOnce({ status: 401, message: 'PRIVATE' });
    const response = await post(body); expect(response.status).toBe(401); expect(await response.text()).not.toContain('PRIVATE');
    mocks.auth.mockResolvedValueOnce({ agencyId: 'a', role: 'unknown' });
    expect((await post(body)).status).toBe(403); expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('returns per-portal pending results without reporting success', async () => {
    mocks.remove.mockResolvedValue({ complete: false, portals: [{ portal: 'storia', state: 'pending', message: 'Pending' }] });
    const response = await post(body); expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ complete: false, portals: [{ state: 'pending' }] });
  });
  it('isolates demo databases even if an agency does not have the demo prefix', async () => {
    mocks.auth.mockResolvedValue({ agencyId: 'a', uid: 'u', role: 'agent', adminDb: { demo: true }, runtimeMode: 'demo' });
    await post(body); expect(mocks.remove).toHaveBeenCalledWith(expect.objectContaining({ db: { demo: true }, demo: true }), body);
  });
  it('rejects oversized requests and invalid sale details before any mutation', async () => {
    expect((await post({ ...body, agentMessage: 'a'.repeat(20001) })).status).toBe(413);
    expect((await post({ ...body, reason: 'sold', soldPrice: -1 })).status).toBe(400);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
