import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { notificationReconciliationHealth } from '../notification-health';
const now = Date.parse('2026-10-07T12:00:00Z');
const recent = new Date(now - 1000).toISOString();
function fixture(scan: any = {}, worker: any = {}) {
  const get = vi.fn(async (id: string) => ({ data: () => id === 'notificationSweep' ? scan : worker }));
  return { get, ctx: { adminDb: { collection: () => ({ doc: (id: string) => ({ get: () => get(id) }) }) } } as any };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv('AI_ASSISTANT_WORKER_SECRET', 'synthetic'); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
it('does not read storage when the worker is unconfigured', async () => {
  vi.stubEnv('AI_ASSISTANT_WORKER_SECRET', ''); const f = fixture();
  expect(await notificationReconciliationHealth(f.ctx)).toMatchObject({ status: 'unconfigured' }); expect(f.get).not.toHaveBeenCalled();
});
it('separates a recent successful batch from completeness and redacts global data', async () => {
  const f = fixture({ lastFinishedAt: recent, failed: 0, cursor: 'users/private/notifications/secret', token: 'private-token', scanned: 25, withdrawn: 20, cycleComplete: false });
  const result = await notificationReconciliationHealth(f.ctx);
  expect(result).toEqual({ status: 'current', running: false, lastFinishedAt: recent, lastCycle: null, note: expect.stringContaining('ultimul lot') });
  expect(JSON.stringify(result)).not.toMatch(/private|secret|scanned|withdrawn|cycleComplete/);
});
it.each([
  [{}, {}, 'unknown'],
  [{ lastFinishedAt: recent, failed: 1 }, {}, 'degraded'],
  [{ lastFinishedAt: recent, failed: 0, lastFailedAt: new Date(now).toISOString() }, {}, 'degraded'],
  [{ lastFinishedAt: recent, failed: 0 }, { lastNotificationSweepFailureAt: new Date(now).toISOString() }, 'degraded'],
  [{ lastFinishedAt: recent, failed: 0, lastFailedAt: new Date(now - 2000).toISOString() }, {}, 'current'],
  [{ lastFinishedAt: new Date(now - 900000).toISOString(), failed: 0 }, {}, 'stale'],
  [{ lastFinishedAt: new Date(now + 1000).toISOString(), failed: 0 }, {}, 'unknown'],
  [{ lastFinishedAt: 'invalid', failed: 0 }, {}, 'unknown'],
  [{ lastFinishedAt: recent, failed: -1 }, {}, 'unknown'],
  [{ lastFinishedAt: recent }, {}, 'unknown'],
])('classifies evidence %j / %j as %s', async (scan, worker, status) => {
  expect(await notificationReconciliationHealth(fixture(scan, worker).ctx)).toMatchObject({ status });
});
it('does not let an active lease erase a recorded failure', async () => {
  expect(await notificationReconciliationHealth(fixture({ lastFinishedAt: recent, failed: 1, leaseUntil: now + 30000 }).ctx)).toMatchObject({ status: 'degraded', running: true });
});
it('reports unavailable storage without exception contents', async () => {
  const f = fixture(); f.get.mockRejectedValue(new Error('private-storage-path'));
  const result = await notificationReconciliationHealth(f.ctx);
  expect(result.status).toBe('unavailable'); expect(JSON.stringify(result)).not.toContain('private-storage-path');
});
it.each([
  [{ coverageKnown: true, hadFailures: false }, 'current'],
  [{ coverageKnown: true, hadFailures: true }, 'degraded'],
  [{ coverageKnown: false, hadFailures: false }, 'unknown'],
  [{ coverageKnown: true, hadFailures: 0 }, 'unknown'],
  [{ coverageKnown: true, hadFailures: false, startedAt: new Date(now - 1000000).toISOString(), finishedAt: new Date(now - 900000).toISOString() }, 'stale'],
])('reports cycle evidence separately from a successful last batch: %j', async (patch, status) => {
  const lastCycle = { startedAt: new Date(now - 10000).toISOString(), finishedAt: recent, ...patch };
  const result = await notificationReconciliationHealth(fixture({ lastFinishedAt: recent, failed: 0, lastCycle }).ctx);
  expect(result).toMatchObject({ status: 'current', lastCycle: { status, startedAt: lastCycle.startedAt, finishedAt: lastCycle.finishedAt } });
  expect(JSON.stringify(result.lastCycle)).not.toMatch(/coverageKnown|hadFailures/);
});
it.each([
  { startedAt: recent, finishedAt: new Date(now + 1000).toISOString() },
  { startedAt: recent, finishedAt: new Date(now - 2000).toISOString() },
  { startedAt: 'invalid', finishedAt: recent },
])('does not certify invalid cycle times: %j', async lastCycle => {
  expect(await notificationReconciliationHealth(fixture({ lastFinishedAt: recent, failed: 0, lastCycle: { ...lastCycle, coverageKnown: true, hadFailures: false } }).ctx)).toMatchObject({ lastCycle: null });
});
