import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), photo: vi.fn(), updateAuth: vi.fn(), rows: new Map<string, any>(), committed: [] as any[] }));
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyAdminFromBearerToken: mocks.auth, requireAgencyUserFromBearerToken: vi.fn() }));
vi.mock('@/lib/crm/agent-photo', () => ({ prepareAgentPhoto: mocks.photo }));
import { PATCH } from '@/app/api/agency/agents/[agentId]/route';
const revision = '2026-10-06T10:00:00.000Z';
beforeEach(() => {
  vi.clearAllMocks(); mocks.rows = new Map([['users/admin', { role: 'admin', agencyId: 'a' }], ['users/agent', { role: 'agent', agencyId: 'a', name: 'Original agent', phone: '0722334455', photoUrl: 'https://example.test/avatar', updatedAt: revision }]]); mocks.committed = [];
  const ref = (path: string): any => ({ path, doc: (id: string) => ref(path + '/' + id), collection: (id: string) => ref(path + '/' + id), get: async () => ({ exists: mocks.rows.has(path), data: () => structuredClone(mocks.rows.get(path)) }) });
  mocks.auth.mockResolvedValue({ uid: 'admin', role: 'admin', agencyId: 'a', adminAuth: { updateUser: mocks.updateAuth }, adminDb: { collection: ref, runTransaction: async (work: any) => {
    const writes: any[] = [];
    const result = await work({ get: async (target: any) => { if (writes.length) throw new Error('Read after write'); return target.get(); }, set: (target: any, data: any) => writes.push({ target, data }), create: (target: any, data: any) => writes.push({ target, data }) });
    writes.forEach(({ target, data }) => mocks.rows.set(target.path, { ...mocks.rows.get(target.path), ...data })); mocks.committed.push(...writes); return result;
  } } });
  mocks.updateAuth.mockResolvedValue({});
  mocks.photo.mockResolvedValue({ key: 'asset', uploadId: '524a76ae-caa2-4f6e-aebc-7d0c1dcaf2d0', agentId: 'agent', imageUrl: 'https://example.test/private-image', ledger: ref('agencies/a/assistantExecutions/asset') });
});
const call = (body: any = { name: 'Updated agent', expectedUpdatedAt: revision }) => PATCH(new NextRequest('https://crm.example/agent', { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ agentId: 'agent' }) });
it('preserves omitted phone/photo fields and commits the private/public profile and audit together', async () => {
  expect((await call()).status).toBe(200);
  expect(mocks.rows.get('users/agent')).toMatchObject({ name: 'Updated agent', phone: '0722334455', photoUrl: 'https://example.test/avatar' });
  expect(mocks.rows.get('publicAgentProfiles/agent')).toMatchObject({ phone: '0722334455', photoUrl: 'https://example.test/avatar' });
  expect(mocks.committed).toHaveLength(3);
});
it('applies the prepared photo only as part of the profile transaction with its receipt', async () => {
  expect((await call({ name: 'Updated agent', expectedUpdatedAt: revision, photoUploadId: '524a76ae-caa2-4f6e-aebc-7d0c1dcaf2d0' })).status).toBe(200);
  expect(mocks.rows.get('users/agent').photoUrl).toBe('https://example.test/private-image');
  expect(mocks.rows.get('agencies/a/assistantExecutions/asset')).toMatchObject({ status: 'completed', result: { agentId: 'agent' } });
  expect(mocks.committed).toHaveLength(4);
});
it('refuses a stale displayed revision and revalidates the administrator before any profile write', async () => {
  expect((await call({ name: 'Updated agent', expectedUpdatedAt: null })).status).toBe(409);
  mocks.rows.set('users/admin', { role: 'agent', agencyId: 'a' });
  expect((await call()).status).toBe(403);
  expect(mocks.committed).toEqual([]); expect(mocks.updateAuth).not.toHaveBeenCalled();
});
it('rejects foreign targets and conflicting image sources', async () => {
  expect((await call({ name: 'Updated agent', photoUrl: 'https://example.test/image', photoUploadId: '524a76ae-caa2-4f6e-aebc-7d0c1dcaf2d0' })).status).toBe(400);
  mocks.rows.set('users/agent', { role: 'agent', agencyId: 'other' });
  expect((await call()).status).toBe(403);
  expect(mocks.committed).toEqual([]); expect(mocks.photo).not.toHaveBeenCalled();
});
