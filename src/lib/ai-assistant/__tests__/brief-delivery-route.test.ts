import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('../access', () => ({ assistantContext: vi.fn(async () => ({ uid: 'u', agencyId: 'a' })), readResource: vi.fn(), readRelated: vi.fn() }));
vi.mock('../brief-delivery', () => ({ readBriefDelivery: vi.fn() }));
import { readResource, readRelated } from '../access';
import { readBriefDelivery } from '../brief-delivery';
import { GET } from '@/app/api/ai-assistant/automations/route';
beforeEach(() => { vi.resetAllMocks(); vi.mocked(readBriefDelivery).mockResolvedValue({ status: 'delivered', completionSatisfied: true, note: 'Livrat', verifiedAt: '2026-10-07T00:00:00Z' }); });
it('adds live delivery evidence without replacing the automation schedule status', async () => {
  vi.mocked(readResource).mockResolvedValue({ rows: [{ id: 'a', status: 'active', automation: { type: 'daily_sales_brief' }, lastResult: { status: 'queued', receiptId: 'r' } }, { id: 'b', automation: { type: 'followup_task' } }], nextCursor: 'b', complete: false } as any);
  const response = await GET(new NextRequest('https://example.test/api/ai-assistant/automations'));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ nextCursor: 'b', complete: false, rows: [{ status: 'active', lastResult: { status: 'queued' }, deliveryEvidence: { status: 'delivered' } }, { id: 'b' }] });
  expect(readBriefDelivery).toHaveBeenCalledTimes(1);
});
it('adds receipt verification to an audit entry without rewriting its original result', async () => {
  vi.mocked(readRelated).mockResolvedValue({ rows: [{ id: 'run', status: 'active', result: { status: 'unknown', receiptId: 'r' } }], complete: true, nextCursor: null } as any);
  const response = await GET(new NextRequest('https://example.test/api/ai-assistant/automations?id=automation'));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ rows: [{ result: { status: 'unknown' }, deliveryEvidence: { status: 'delivered' } }] });
});
