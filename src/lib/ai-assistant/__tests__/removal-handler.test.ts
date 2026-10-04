import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: vi.fn() }));
vi.mock('@/lib/property-removal/service', () => ({ removeProperty: vi.fn() }));
vi.mock('@/lib/collaboration/server', () => ({ notifyUser: vi.fn() }));
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { removeProperty } from '@/lib/property-removal/service';
import { POST } from '@/app/api/properties/remove/route';
afterEach(() => vi.clearAllMocks());
describe('existing removal handler consumed by Jarvis', () => {
  it('confirms an authenticated removal with a valid DB and completes collaboration lookup', async () => {
    const collection = vi.fn(() => ({ where: () => ({ get: async () => ({ docs: [] }) }) }));
    const db = { collection };
    vi.mocked(requireAgencyUserFromBearerToken).mockResolvedValue({ agencyId: 'a', uid: 'u', role: 'agent', adminDb: db, runtimeMode: 'real' } as any);
    vi.mocked(removeProperty).mockResolvedValue({ complete: true, outcome: 'deleted', portals: [] } as any);
    const response = await POST(new NextRequest('http://localhost/api/properties/remove', { method: 'POST', headers: { Authorization: 'Bearer fixture' }, body: JSON.stringify({ propertyId: 'p1', reason: 'not_interesting', agentMessage: 'Retragere' }) }));
    expect(response.status).toBe(200); expect(collection).toHaveBeenCalledWith('collaborationLinks');
    expect(removeProperty).toHaveBeenCalledWith(expect.objectContaining({ agencyId: 'a', uid: 'u', db }), expect.objectContaining({ propertyId: 'p1' }));
  });
});
