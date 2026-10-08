import { expect, it } from 'vitest';
import { shiftDatetime } from '../datetime';
it.each([
  ['2026-10-09T14:00:00Z', 60, '2026-10-09T15:00:00.000Z', '2026-10-09 18:00'],
  ['2026-10-09T14:00:00Z', 30, '2026-10-09T14:30:00.000Z', '2026-10-09 17:30'],
  ['2026-10-25T00:30:00Z', 60, '2026-10-25T01:30:00.000Z', '2026-10-25 03:30'],
  ['2026-03-29T00:30:00Z', 60, '2026-03-29T01:30:00.000Z', '2026-03-29 04:30'],
  ['2026-10-09T14:00:00+03:00', -30, '2026-10-09T10:30:00.000Z', '2026-10-09 13:30'],
])('shifts an actual instant across offsets and DST', (iso, minutes, expected, local) => {
  expect(shiftDatetime({ iso, minutes })).toEqual({ iso: expected, local, timezone: 'Europe/Bucharest' });
});
it('rejects unzoned dates and fractional minutes', () => {
  expect(() => shiftDatetime({ iso: '2026-10-09T14:00:00', minutes: 30 })).toThrow();
  expect(() => shiftDatetime({ iso: '2026-10-09T14:00:00Z', minutes: 0.5 })).toThrow();
});
