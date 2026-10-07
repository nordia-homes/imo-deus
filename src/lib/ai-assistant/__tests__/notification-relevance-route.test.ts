import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('../access', () => ({ assistantContext: vi.fn() }));
vi.mock('../notification-relevance', () => ({ reconcileRuleNotifications: vi.fn() }));
import { assistantContext } from '../access';
import { reconcileRuleNotifications } from '../notification-relevance';
import { POST } from '@/app/api/notifications/reconcile/route';
beforeEach(() => { vi.resetAllMocks(); vi.mocked(assistantContext).mockResolvedValue({ uid: 'u', agencyId: 'a' } as any); });
it('reconciles through the authenticated context without caching', async () => {
  vi.mocked(reconcileRuleNotifications).mockResolvedValue({ checked: 1, withdrawn: 1 });
  const response = await POST(new NextRequest('https://example.test/api/notifications/reconcile', { method: 'POST', body: JSON.stringify({ ids: ['n'] }) }));
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(await response.json()).toEqual({ checked: 1, withdrawn: 1 });
  expect(reconcileRuleNotifications).toHaveBeenCalledWith({ uid: 'u', agencyId: 'a' }, { ids: ['n'] });
});
it('refuses unauthenticated calls before reading or mutating notifications', async () => {
  vi.mocked(assistantContext).mockRejectedValue(Object.assign(new Error('Authentication required'), { status: 401 }));
  const response = await POST(new NextRequest('https://example.test/api/notifications/reconcile', { method: 'POST', body: '{}' }));
  expect(response.status).toBe(401);
  expect(reconcileRuleNotifications).not.toHaveBeenCalled();
});
it('rejects malformed JSON', async () => {
  const response = await POST(new NextRequest('https://example.test/api/notifications/reconcile', { method: 'POST', body: '{' }));
  expect(response.status).toBe(400);
  expect(reconcileRuleNotifications).not.toHaveBeenCalled();
});
