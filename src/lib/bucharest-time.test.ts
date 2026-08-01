import { describe, expect, it } from 'vitest';
import {
  bucharestInputFromIso,
  bucharestLocalToIso,
  formatBucharestDateTime,
} from '@/lib/bucharest-time';

describe('Bucharest scheduling time', () => {
  it('uses the winter UTC+2 offset', () => {
    expect(bucharestLocalToIso('2026-01-15', '10:00')).toBe('2026-01-15T08:00:00.000Z');
  });

  it('uses the summer UTC+3 offset', () => {
    expect(bucharestLocalToIso('2026-07-15', '10:00')).toBe('2026-07-15T07:00:00.000Z');
  });

  it('rejects a wall-clock time skipped by daylight saving time', () => {
    expect(bucharestLocalToIso('2026-03-29', '03:30')).toBeNull();
  });

  it('round-trips an ISO time through Bucharest inputs', () => {
    const input = bucharestInputFromIso('2026-08-01T06:15:00.000Z');
    expect(input).toEqual({ date: '2026-08-01', time: '09:15' });
    expect(bucharestLocalToIso(input.date, input.time)).toBe('2026-08-01T06:15:00.000Z');
    expect(formatBucharestDateTime('invalid')).toBe('');
  });
});
