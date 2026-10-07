import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), provider: vi.fn() }));
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyAdminFromBearerToken: mocks.auth, requireAgencyUserFromBearerToken: mocks.auth }));
vi.mock('@/lib/ai-outreach/vapi', () => ({ createVapiOutboundCall: mocks.provider, VapiDispatchError: class extends Error {} }));
import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/ai-outreach/settings/route';
import { withDefaultAiOutreachSettings } from '@/lib/ai-outreach/defaults';
import { assertCanCreateAiOutreachCall } from '@/lib/ai-outreach/server';

function fixture(calls: Record<string, any>[] = []) {
  let stored: Record<string, any> = { timezone: 'UTC', enabled: true };
  const set = vi.fn(async (value: any) => { stored = value; });
  const ref = (path: string): any => ({ collection: (id: string) => ref(`${path}/${id}`), doc: (id: string) => ref(`${path}/${id}`),
    get: async () => ({ data: () => path.endsWith('/settings') ? stored : {} }), set,
    where: (_field: string, _op: string, since: string) => ({ get: async () => ({ docs: calls.filter(call => call.createdAt >= since).map(call => ({ id: call.id, data: () => call })) }) }),
  });
  const adminDb = { collection: ref } as any;
  mocks.auth.mockResolvedValue({ agencyId: 'a', uid: 'u', adminDb });
  return { adminDb, set };
}
beforeEach(() => vi.clearAllMocks());

it.each(['UTC', 'Europe/Chisinau', 'invalid', undefined])('normalizes legacy settings %s to Bucharest', timezone => {
  expect(withDefaultAiOutreachSettings('a', { timezone, maxDailyCalls: 17 })).toMatchObject({ agencyId: 'a', timezone: 'Europe/Bucharest', maxDailyCalls: 17 });
});
it.each(['UTC', 'Europe/Chisinau', 'America/New_York'])('rejects a different configured timezone %s before writing', async timezone => {
  const f = fixture();
  const response = await POST(new NextRequest('https://fixture.test/api', { method: 'POST', body: JSON.stringify({ timezone }) }));
  expect(response.status).toBe(400); expect(f.set).not.toHaveBeenCalled(); expect(mocks.provider).not.toHaveBeenCalled();
});
it('returns Bucharest for legacy settings and persists it when updating another setting', async () => {
  const f = fixture();
  expect(await (await GET(new NextRequest('https://fixture.test/api'))).json()).toMatchObject({ settings: { timezone: 'Europe/Bucharest' } });
  expect(f.set).not.toHaveBeenCalled();
  expect((await POST(new NextRequest('https://fixture.test/api', { method: 'POST', body: JSON.stringify({ maxDailyCalls: 20 }) }))).status).toBe(200);
  expect(f.set).toHaveBeenCalledWith(expect.objectContaining({ timezone: 'Europe/Bucharest', maxDailyCalls: 20 }), { merge: true });
});
it.each(['2026-01-15T07:30:00Z', '2026-07-15T06:30:00Z'])('uses actual Bucharest seasonal time for call windows at %s', async iso => {
  const { adminDb } = fixture();
  const settings = { ...withDefaultAiOutreachSettings('a'), enabled: true, timezone: 'UTC', callWindowStart: '09:00', callWindowEnd: '10:00' };
  await expect(assertCanCreateAiOutreachCall({ adminDb, agencyId: 'a', ownerListingId: 'l', settings, now: new Date(iso) })).resolves.toBeUndefined();
  await expect(assertCanCreateAiOutreachCall({ adminDb, agencyId: 'a', ownerListingId: 'l', settings, now: new Date('2026-07-15T09:30:00Z') })).rejects.toMatchObject({ status: 409 });
  expect(mocks.provider).not.toHaveBeenCalled();
});
it('counts the first hour of the 25-hour autumn day toward the daily cap', async () => {
  const { adminDb } = fixture([{ id: 'c', ownerListingId: 'other', status: 'completed', createdAt: '2026-10-24T21:15:00.000Z' }]);
  const settings = { ...withDefaultAiOutreachSettings('a'), enabled: true, timezone: 'UTC', maxDailyCalls: 1, callWindowStart: '00:00', callWindowEnd: '00:00' };
  await expect(assertCanCreateAiOutreachCall({ adminDb, agencyId: 'a', ownerListingId: 'l', settings, now: new Date('2026-10-25T21:30:00Z') })).rejects.toThrow('Limita zilnica');
});
it('counts costs after Bucharest month midnight even while the UTC date is in the prior month', async () => {
  const { adminDb } = fixture([{ id: 'c', ownerListingId: 'other', status: 'completed', createdAt: '2026-09-30T21:30:00.000Z', cost: 2 }]);
  const settings = { ...withDefaultAiOutreachSettings('a'), enabled: true, timezone: 'UTC', monthlyBudgetCap: 1, callWindowStart: '00:00', callWindowEnd: '00:00' };
  await expect(assertCanCreateAiOutreachCall({ adminDb, agencyId: 'a', ownerListingId: 'l', settings, now: new Date('2026-10-01T07:00:00Z') })).rejects.toThrow('Bugetul lunar');
});
