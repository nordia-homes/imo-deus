import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('../access', () => ({ assistantContext: vi.fn() }));
vi.mock('../notification-feedback', () => ({ saveNotificationFeedback: vi.fn() }));
import { assistantContext } from '../access';
import { saveNotificationFeedback } from '../notification-feedback';
import { POST } from '@/app/api/notifications/feedback/route';
beforeEach(() => { vi.resetAllMocks(); vi.mocked(assistantContext).mockResolvedValue({ uid: 'u', agencyId: 'a' } as any); });
it('uses authenticated context and disables caching', async () => {
  const body = { notificationId: 'n', value: 'useful', expectedRevision: 0 };
  vi.mocked(saveNotificationFeedback).mockResolvedValue({ notificationId: 'n', feedback: { value: 'useful', revision: 1, updatedAt: '2026-10-07T10:00:00Z' } });
  const response = await POST(new NextRequest('https://example.test/api/notifications/feedback', { method: 'POST', body: JSON.stringify(body) }));
  expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(saveNotificationFeedback).toHaveBeenCalledWith({ uid: 'u', agencyId: 'a' }, body);
});
it('refuses unauthenticated calls before any mutation', async () => {
  vi.mocked(assistantContext).mockRejectedValue(Object.assign(new Error('Authentication required'), { status: 401 }));
  expect((await POST(new NextRequest('https://example.test/api/notifications/feedback', { method: 'POST', body: '{}' }))).status).toBe(401);
  expect(saveNotificationFeedback).not.toHaveBeenCalled();
});
it('returns a revision conflict', async () => {
  vi.mocked(saveNotificationFeedback).mockRejectedValue(Object.assign(new Error('Reload'), { status: 409 }));
  expect((await POST(new NextRequest('https://example.test/api/notifications/feedback', { method: 'POST', body: '{}' }))).status).toBe(409);
});
it('rejects malformed JSON before mutation', async () => {
  expect((await POST(new NextRequest('https://example.test/api/notifications/feedback', { method: 'POST', body: '{' }))).status).toBe(400);
  expect(saveNotificationFeedback).not.toHaveBeenCalled();
});
