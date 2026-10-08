import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({}));
import { orderTomorrow } from '../tomorrow-order';
const now = new Date('2026-10-08T10:00:00Z');
const task = { id: 'task', agentId: 'a', status: 'open', dueDate: '2026-10-09', description: 'Documente', duration: 30 };
const viewing = { id: 'view', agentId: 'a', status: 'scheduled', viewingDate: '2026-10-09T07:00:00Z', duration: 60 };
it('preserves fixed appointments and fits shortest untimed tasks in buffered gaps', () => {
  const tasks = [{ ...task, id: 'fixed', startTime: '12:00', duration: 60 }, { ...task, id: 'short', duration: 30 }, { ...task, id: 'long', duration: 60 }];
  const before = JSON.stringify([tasks, viewing]);
  const result = orderTomorrow(tasks, [viewing], 'a', now);
  expect(result.rows.map(row => [row.id, row.startLocal.slice(11, 16), row.kind])).toEqual([
    ['short', '09:00', 'suggested'], ['view', '10:00', 'fixed'], ['fixed', '12:00', 'fixed'], ['long', '13:00', 'suggested'],
  ]);
  expect(JSON.stringify([tasks, viewing])).toBe(before);
  expect(result.complete).toBe(true);
});
it('reports tasks that do not fit without splitting or moving them', () => {
  const result = orderTomorrow([{ ...task, id: 'blocked', startTime: '09:00', duration: 540 }, { ...task, id: 'flex' }], [], 'a', now);
  expect(result.unplaced.map(row => row.id)).toEqual(['flex']);
  expect(result.rows.map(row => row.id)).toEqual(['blocked']);
});
it('retains existing overlaps as explicit conflicts and keeps flexible tasks outside them', () => {
  const result = orderTomorrow([{ ...task, id: 'fixed', startTime: '10:30', duration: 60 }, { ...task, id: 'flex', duration: 120 }], [viewing], 'a', now);
  expect(result.status).toBe('existing_conflicts'); expect(result.conflicts).toHaveLength(1);
  expect(result.rows.find(row => row.id === 'flex')?.startLocal).toContain('11:30');
});
it('includes overnight carryover and fixed appointments outside the assumed work window', () => {
  const result = orderTomorrow([{ ...task, startTime: '19:00' }], [{ ...viewing, viewingDate: '2026-10-08T20:00:00Z', duration: 600 }], 'a', now);
  expect(result.rows).toHaveLength(2); expect(result.rows[0].startLocal).toContain('2026-10-08 23:00');
  expect(result.rows[1].startLocal).toContain('19:00');
});
it('distinguishes an explicit ISO deadline from an untimed date and preserves DST instants', () => {
  const result = orderTomorrow([{ ...task, dueDate: '2026-10-25T00:30:00Z', startTime: '03:30' }], [], 'a', new Date('2026-10-24T12:00:00Z'));
  expect(result.rows[0]).toMatchObject({ kind: 'fixed', at: Date.parse('2026-10-25T00:30:00Z') });
  expect(orderTomorrow([{ ...task, dueDate: '2026-10-09T10:00:00Z' }], [], 'a', now).rows[0].kind).toBe('fixed');
});
it('excludes completed, other-day and colleague records', () => {
  expect(orderTomorrow([{ ...task, status: 'completed' }, { ...task, dueDate: '2026-10-10' }, { ...task, agentId: 'b' }], [{ ...viewing, status: 'cancelled' }], 'a', now).rows).toEqual([]);
});
it('discloses default task durations and rejects invalid calendar data', () => {
  expect(orderTomorrow([{ ...task, duration: undefined }], [], 'a', now).rows[0]).toMatchObject({ duration: 30, assumedDuration: true });
  for (const row of [{ ...task, duration: -1 }, { ...task, dueDate: 'bad' }, { ...task, startTime: '25:00' }]) expect(orderTomorrow([row], [], 'a', now)).toMatchObject({ rows: [], complete: false, status: 'invalid_calendar' });
});
it('does not certify a plan beyond the bounded display budget', () => {
  expect(orderTomorrow(Array.from({ length: 101 }, (_, i) => ({ ...task, id: String(i) })), [], 'a', now)).toMatchObject({ rows: [], complete: false, status: 'partial' });
});
