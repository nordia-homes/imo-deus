import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const { populate } = vi.hoisted(() => ({ populate: vi.fn(async () => ({ status: 'completed' })) }));
vi.mock('@/firebase/admin', () => ({ adminDb: {} }));
vi.mock('@/lib/public-nearby-server', () => ({ populatePublicNearbyOnce: populate }));
import { POST } from '@/app/api/internal/public-nearby/route';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('OWNER_LISTINGS_CRON_SECRET', 'test-secret');
  vi.stubEnv('GOOGLE_MAPS_API_KEY', 'test-key');
});
const request = (secret = '', agencyId = 'agency') => new NextRequest('https://example.test/api/internal/public-nearby', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'x-owner-listings-cron-secret': secret },
  body: JSON.stringify({ agencyId, propertyId: 'property' }),
});
it('public requests cannot trigger paid lookups', async () => {
  expect((await POST(request())).status).toBe(401);
  expect((await POST(request('wrong-secret'))).status).toBe(401);
  expect(populate).not.toHaveBeenCalled();
});
it('rejects path injection even for an authorized worker', async () => {
  expect((await POST(request('test-secret', '../other'))).status).toBe(400);
  expect(populate).not.toHaveBeenCalled();
});
it('accepts an authenticated creation worker', async () => {
  expect((await POST(request('test-secret'))).status).toBe(200);
  expect(populate).toHaveBeenCalledWith({}, 'agency', 'property');
});
