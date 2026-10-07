import { describe, expect, it } from 'vitest';
import { insightQuietDeferral } from '../insight-notification-policy';
import { automationSchema } from '../contracts';

const hours = { timezone: 'Europe/Bucharest', start: '22:00', end: '08:00' };
describe('insight quiet hours over real instants', () => {
  it.each([
    ['2026-10-07T18:59:59Z', null],
    ['2026-10-07T19:00:00Z', '2026-10-08T05:00:00.000Z'],
    ['2026-10-08T04:59:59Z', '2026-10-08T05:00:00.000Z'],
    ['2026-10-08T05:00:00Z', null],
  ])('checks the boundaries at %s', (at, expected) => {
    expect(insightQuietDeferral(hours, Date.parse(at))?.deferredUntil || null).toBe(expected);
  });
  it('supports a same-day interval and an explicitly disabled interval', () => {
    const at = Date.parse('2026-10-07T09:30:00Z');
    expect(insightQuietDeferral({ ...hours, start: '12:00', end: '13:00' }, at)?.deferredUntil).toBe('2026-10-07T10:00:00.000Z');
    expect(insightQuietDeferral({ ...hours, start: '12:00', end: '12:00' }, at)).toBeNull();
    expect(insightQuietDeferral(undefined, at)).toBeNull();
  });
  it('resumes at the first allowed instant when the spring end minute does not exist', () => {
    expect(insightQuietDeferral({ ...hours, end: '03:30' }, Date.parse('2026-03-29T00:00:00Z'))?.deferredUntil).toBe('2026-03-29T01:00:00.000Z');
  });
  it('respects each actual occurrence of a repeated autumn hour', () => {
    expect(insightQuietDeferral({ ...hours, end: '03:30' }, Date.parse('2026-10-25T00:15:00Z'))?.deferredUntil).toBe('2026-10-25T00:30:00.000Z');
    expect(insightQuietDeferral({ ...hours, end: '03:30' }, Date.parse('2026-10-25T00:45:00Z'))).toBeNull();
    expect(insightQuietDeferral({ ...hours, end: '03:30' }, Date.parse('2026-10-25T01:15:00Z'))?.deferredUntil).toBe('2026-10-25T01:30:00.000Z');
  });
  it('validates timezone and clock inputs without changing legacy definitions', () => {
    const base = { type: 'insight_report', nextRunAt: '2030-01-01T00:00:00Z' };
    expect(automationSchema.parse(base)).not.toHaveProperty('quietHours');
    expect(automationSchema.parse({ ...base, quietHours: hours })).toMatchObject({ quietHours: hours });
    for (const invalid of [{ ...hours, start: '24:00' }, { ...hours, end: '8:00' }, { ...hours, timezone: 'Invalid/Zone' }]) expect(automationSchema.safeParse({ ...base, quietHours: invalid }).success).toBe(false);
  });
});
