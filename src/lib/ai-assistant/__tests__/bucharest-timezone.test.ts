import { expect, it } from 'vitest';
import { timezoneSchema } from '../timezone';
import { datetimeSchema } from '../deterministic-contracts';
import { queryRecordsSchema, automationSchema } from '../contracts';
import { briefSettingsSchema } from '../daily-brief-contract';
import { storedPreference, validatePreference } from '../preferences';
import { preferredTimezone } from '../context';
import { buildInstructions } from '../policy';
import { resolveDatetime } from '../datetime';

it.each(['UTC', 'America/New_York', 'Europe/Paris', 'Europe/London'])('rejects %s across assistant entry points', timezone => {
  expect(() => timezoneSchema.parse(timezone)).toThrow();
  expect(() => datetimeSchema.parse({ date: '2026-10-07', time: '10:00', timezone })).toThrow();
  expect(() => resolveDatetime({ date: '2026-10-07', time: '10:00', timezone })).toThrow();
  expect(() => queryRecordsSchema.parse({ resource: 'tasks', timezone })).toThrow();
  expect(() => briefSettingsSchema.parse({ timezone, deliveryTime: '09:00', daysOfWeek: [1] })).toThrow();
  for (const type of ['owner_watch', 'matching_watch', 'insight_report']) {
    expect(() => automationSchema.parse({ type, nextRunAt: '2026-10-08T10:00:00Z', ...(type === 'owner_watch' ? { search: {} } : type === 'matching_watch' ? { contactId: 'c' } : {}), quietHours: { timezone, start: '22:00', end: '08:00' } })).toThrow();
  }
  expect(() => validatePreference('preferred_timezone', timezone)).toThrow();
  expect(storedPreference({ ownerId: 'u', key: 'preferred_timezone', value: timezone, expiresAt: Date.now() + 10000 }, 'preferred_timezone', 'u')).toBeNull();
});
it('ignores legacy timezone memories in the planner and resolver without reading agency settings', async () => {
  const ctx = { uid: 'u', agencyId: 'a', role: 'agent', adminDb: { collection: () => { throw new Error('Unexpected settings lookup'); } } } as any;
  expect(await preferredTimezone(ctx)).toBe('Europe/Bucharest');
  const instructions = buildInstructions(ctx, { readiness: {}, memory: [{ key: 'preferred_timezone', value: 'America/New_York' }] });
  expect(JSON.parse(instructions.split('\n').at(-1)!).timezone).toBe('Europe/Bucharest');
});
it('uses Romanian summer and winter offsets without a fixed UTC offset', () => {
  expect(resolveDatetime({ date: '2026-07-10', time: '09:00' }).iso).toBe('2026-07-10T06:00:00.000Z');
  expect(resolveDatetime({ date: '2026-12-10', time: '09:00' }).iso).toBe('2026-12-10T07:00:00.000Z');
});
