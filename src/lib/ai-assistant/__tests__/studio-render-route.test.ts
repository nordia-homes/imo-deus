import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ enqueue: vi.fn() }));
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: async () => ({ agencyId: 'agency', uid: 'user' }) }));
vi.mock('@/lib/tiktok-studio-jobs', () => ({ enqueueStudioRender: mocks.enqueue }));
import { POST } from '@/app/api/marketing/tiktok/studio-projects/[projectId]/render/route';
beforeEach(() => { mocks.enqueue.mockReset(); mocks.enqueue.mockResolvedValue({ jobId: 'job', status: 'queued' }); });
const request = (body: unknown) => POST(new NextRequest('https://fixture.test/api/render', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ projectId: 'project' }) });
it('passes the approved version to the shared queue service', async () => {
  expect((await request({ expectedVersion: 3 })).status).toBe(202);
  expect(mocks.enqueue).toHaveBeenCalledExactlyOnceWith('agency', 'user', 'project', 3);
});
it.each([null, '1', 0, -1, 1.5])('refuses invalid expectedVersion %j before calling the queue', async expectedVersion => {
  expect((await request({ expectedVersion })).status).toBe(400);
  expect(mocks.enqueue).not.toHaveBeenCalled();
});
it('preserves the existing manual endpoint when no version is supplied', async () => {
  expect((await request({})).status).toBe(202);
  expect(mocks.enqueue).toHaveBeenCalledWith('agency', 'user', 'project', undefined);
});
it('returns a version conflict without hiding it as a server error', async () => {
  mocks.enqueue.mockRejectedValue(Object.assign(new Error('Proiectul s-a modificat.'), { status: 409 }));
  expect((await request({ expectedVersion: 1 })).status).toBe(409);
});
