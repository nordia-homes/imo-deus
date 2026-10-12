import { afterEach, expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ readResource: vi.fn() }));
import { readResource, type AssistantContext } from '../access';
import { readOutreachHistory } from '../outreach-history';
const ctx = {} as AssistantContext;
afterEach(() => vi.resetAllMocks());

it('keeps tied latest timestamps explicit and never mistakes newer schedules for results', async () => {
  vi.mocked(readResource).mockResolvedValue({ complete: true, nextCursor: null, rows: [
    { id: 'a', status: 'completed', startedAt: '2026-10-12T04:30:00Z' },
    { id: 'b', status: 'calling', providerErrorCode: 'vapi_create_unknown', createdAt: '2026-10-12T04:30:00Z' },
    { id: 'c', status: 'scheduled', createdAt: '2026-10-14T04:30:00Z' },
  ] });
  const result = await readOutreachHistory(ctx, { mode: 'latest_result' });
  expect(result.rows.map(row => row.id)).toEqual(['a', 'b']);
  expect(result.rows[1]).toMatchObject({ uncertain: true, callLocal: '2026-10-12 07:30 (ora București)' });
});

it('does not certify a latest result when the bounded scan is incomplete', async () => {
  vi.mocked(readResource).mockResolvedValue({ rows: Array.from({ length: 100 }, (_, i) => ({ id: String(i), status: 'completed', createdAt: '2026-01-01T10:00:00Z' })), complete: false, nextCursor: 'next' });
  const result = await readOutreachHistory(ctx, { mode: 'latest_result' });
  expect(result).toMatchObject({ complete: false, latestVerified: false, scanned: 5000, matchingCount: 5000, tiesTruncated: true });
  expect(result.rows).toHaveLength(30);
  expect(readResource).toHaveBeenCalledTimes(50);
});

it('keeps canceled, uncertain-running and scheduled records out of the failed-only list', async () => {
  vi.mocked(readResource).mockResolvedValue({ complete: true, nextCursor: null, rows: ['failed', 'canceled', 'scheduled', 'calling'].map(status => ({ id: status, status })) });
  expect((await readOutreachHistory(ctx, { mode: 'failed' })).rows.map(row => row.id)).toEqual(['failed']);
});
