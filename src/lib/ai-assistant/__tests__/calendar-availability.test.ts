import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: vi.fn() }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error {} }));
import { calendarAvailabilitySchema, freeCalendarIntervals, readCalendarAvailability } from '../calendar-availability';
import { collectionFor, type AssistantContext } from '../access';
import { validateActionDates } from '../temporal-policy';
const window = { start: '2030-01-02T14:00:00Z', end: '2030-01-02T20:00:00Z' }, now = new Date('2030-01-01T10:00:00Z');
it('merges overlapping blocks, respects all related participants, and keeps adjacent intervals free', () => {
  const tasks = [{ agentId: 'a', status: 'open', dueDate: '2030-01-02', startTime: '16:30', duration: 60 }, { agentId: 'a', status: 'completed', dueDate: '2030-01-02', startTime: '20:00', duration: 60 }, { agentId: 'a', status: 'open', dueDate: '2030-01-02' }];
  const viewings = [{ agentId: 'a', status: 'scheduled', viewingDate: '2030-01-02T16:00:00+02:00', duration: 60 }, { agentId: 'other', propertyId: 'p', status: 'scheduled', viewingDate: '2030-01-02T15:30:00Z', duration: 60 }, { agentId: 'other', contactId: 'c', status: 'scheduled', viewingDate: '2030-01-02T17:00:00Z', duration: 60 }, { agentId: 'a', status: 'cancelled', viewingDate: '2030-01-02T18:00:00Z', duration: 60 }];
  const all = freeCalendarIntervals(tasks, viewings, window, 1, 'a', 'c', 'p', now);
  expect(all.complete).toBe(true); expect(all.untimed).toBe(1);
  expect(all.rows.map(row => [row.startLocal, row.endLocal])).toEqual([['2030-01-02 18:30', '2030-01-02 19:00'], ['2030-01-02 20:00', '2030-01-02 22:00']]);
  expect(freeCalendarIntervals(tasks, viewings, window, 60, 'a', 'c', 'p', now).rows).toHaveLength(1);
});
it('does not certify invalid calendars, oversized windows, or contradictory dates', () => {
  expect(freeCalendarIntervals([], [{ agentId: 'a', status: 'scheduled', viewingDate: 'invalid' }], window, 60, 'a', undefined, undefined, now).complete).toBe(false);
  expect(() => freeCalendarIntervals([], [], { ...window, end: '2030-01-04T20:00:00Z' }, 60, 'a', undefined, undefined, now)).toThrow();
  expect(calendarAvailabilitySchema.safeParse({ date: '2030-01-02', dayOffset: 1, fromTime: '16:00' }).success).toBe(false);
});
it('keeps a 25-hour Bucharest day intact across the autumn clock change', () => {
  const folded = freeCalendarIntervals([], [], { start: '2026-10-24T21:00:00Z', end: '2026-10-25T22:00:00Z' }, 60, 'a', undefined, undefined, new Date('2026-10-24T00:00:00Z'));
  expect(folded.rows).toMatchObject([{ startLocal: '2026-10-25 00:00', endLocal: '2026-10-26 00:00' }]);
});
it('does not return bookable gaps from a truncated scan', async () => {
  vi.mocked(collectionFor).mockReturnValue({ orderBy: () => ({ limit: () => ({ get: async () => ({ size: 5001, docs: [] }) }) }) } as any);
  expect(await readCalendarAvailability({ uid: 'a' } as AssistantContext, window, 60)).toMatchObject({ rows: [], complete: false, status: 'partial' });
});
it('requires both bounds of a flexible booking to be verified', () => {
  const action = { kind: 'schedule_viewing' as const, contactId: 'c', propertyId: 'p', viewingDate: window.start, duration: 60, notes: '', firstAvailable: window };
  expect(() => validateActionDates([action], new Set([new Date(window.start).toISOString()]))).toThrow();
  expect(() => validateActionDates([action], new Set([window.start, window.end].map(value => new Date(value).toISOString())))).not.toThrow();
});
