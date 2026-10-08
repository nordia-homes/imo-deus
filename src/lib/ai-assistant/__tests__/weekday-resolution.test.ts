import { expect, it } from 'vitest';
import { resolveDatetime } from '../datetime';
import { datetimeSchema } from '../deterministic-contracts';

it.each([
  ['2026-10-08T10:00:00Z', '2026-10-09T07:00:00.000Z'],
  ['2026-10-09T06:00:00Z', '2026-10-09T07:00:00.000Z'],
  ['2026-10-09T07:00:00Z', '2026-10-16T07:00:00.000Z'],
  ['2026-10-09T08:00:00Z', '2026-10-16T07:00:00.000Z'],
  ['2026-12-31T23:30:00Z', '2027-01-01T08:00:00.000Z'],
])('resolves Friday from Bucharest date and clock: %s', (now, expected) => {
  expect(resolveDatetime({ weekday: 'friday', time: '10:00' }, new Date(now)).iso).toBe(expected);
});
it('preserves DST failures and explicit offsets for weekday requests', () => {
  const autumn = new Date('2026-10-24T10:00:00Z');
  expect(() => resolveDatetime({ weekday: 'sunday', time: '03:30' }, autumn)).toThrow('ambiguă');
  expect(resolveDatetime({ weekday: 'sunday', time: '03:30', utcOffsetMinutes: 120 }, autumn).iso).toBe('2026-10-25T01:30:00.000Z');
  expect(() => resolveDatetime({ weekday: 'sunday', time: '03:30' }, new Date('2026-03-28T10:00:00Z'))).toThrow('nu există');
});
it('requires exactly one calendar selector', () => {
  for (const input of [{ time: '10:00' }, { weekday: 'friday', dayOffset: 1, time: '10:00' }, { weekday: 'friday', date: '2026-10-09', time: '10:00' }]) expect(() => datetimeSchema.parse(input)).toThrow();
});
