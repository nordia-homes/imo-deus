import { afterEach, expect, it, vi } from 'vitest';
import { readWatchCooldown } from '../watch-notification-cooldown';
import { automationSchema } from '../contracts';
const now = Date.parse('2026-10-07T12:00:00Z');
function fixture(row?: any) {
  vi.useFakeTimers(); vi.setSystemTime(now);
  const writes: any[] = [];
  const ref: any = { collection: () => ref, doc: () => ref };
  return { writes, ctx: { uid: 'u', agencyId: 'a', adminDb: ref } as any, tx: { get: async () => ({ exists: row !== undefined, data: () => row }), create: (_ref: any, value: any) => writes.push(value), update: (_ref: any, value: any) => writes.push(value) } as any };
}
afterEach(() => vi.useRealTimers());
it.each([['owner_watch', { search: {} }], ['matching_watch', { contactId: 'c' }]] as const)('validates configured and legacy %s cooldowns', (type, config) => {
  const input = { type, ...config, nextRunAt: '2026-10-08T12:00:00Z', intervalMinutes: 60, maxRuns: 2 };
  expect(automationSchema.parse(input)).toMatchObject({ cooldownMinutes: 1440 });
  for (const cooldownMinutes of [30, 60, 43200]) expect(automationSchema.parse({ ...input, cooldownMinutes })).toMatchObject({ cooldownMinutes });
  for (const cooldownMinutes of [0, 29, 43201, 30.5]) expect(() => automationSchema.parse({ ...input, cooldownMinutes })).toThrow();
});
it.each([[60, 30, 60], [30, 120, 120], [undefined, 30, 1440]])('respects prior %s and current %s minutes', async (prior, current, effective) => {
  const f = fixture({ actorId: 'u', lastDeliveredAt: now - 60000, ...(prior === undefined ? {} : { cooldownMinutes: prior }) });
  const result = await readWatchCooldown(f.ctx, f.tx, ['owner', 'p'], current);
  expect(result.skipped).toMatchObject({ cooldownMinutes: effective, nextEligibleAt: new Date(now - 60000 + effective! * 60000).toISOString() });
  expect(f.writes).toEqual([]);
});
it('allows the shorter next policy only after the previous pause expires', async () => {
  const f = fixture({ actorId: 'u', lastDeliveredAt: now - 60 * 60000, cooldownMinutes: 60 });
  const result = await readWatchCooldown(f.ctx, f.tx, ['matching', 'c', 'p'], 30);
  expect(result.skipped).toBeNull(); result.consume();
  expect(f.writes).toEqual([{ actorId: 'u', lastDeliveredAt: now, cooldownMinutes: 30 }]);
});
it('rejects a corrupt persisted duration without writing', async () => {
  const f = fixture({ actorId: 'u', lastDeliveredAt: now, cooldownMinutes: null });
  await expect(readWatchCooldown(f.ctx, f.tx, ['owner', 'p'], 30)).rejects.toThrow(); expect(f.writes).toEqual([]);
});
