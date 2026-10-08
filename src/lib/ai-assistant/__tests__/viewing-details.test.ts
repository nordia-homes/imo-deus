import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({}));
import { viewingCandidates, viewingDetailsSchema } from '../viewing-details';
const now = new Date('2026-10-08T10:00:00Z');
const row = (id: string, viewingDate: string, extra = {}) => ({ id, viewingDate, agentId: 'agent', status: 'scheduled', ...extra });
it('selects Bucharest hour and day, excluding cancelled and other agents', () => {
  const rows = [row('correct', '2026-10-08T14:00:00Z'), row('tomorrow', '2026-10-09T14:00:00Z'), row('cancelled', '2026-10-08T14:00:00Z', { status: 'cancelled' }), row('other', '2026-10-08T14:00:00Z', { agentId: 'other' })];
  expect(viewingCandidates(rows, { mode: 'at_time', time: '17:00' }, 'agent', now).map(r => r.id)).toEqual(['correct']);
});
it('orders actual instants across ISO offsets and retains ties', () => {
  const rows = [row('later', '2026-10-08T12:00:00Z'), row('first', '2026-10-08T14:00:00+03:00'), row('tie', '2026-10-08T11:00:00Z'), row('past', '2026-10-08T09:00:00Z'), row('bad', 'invalid')];
  expect(viewingCandidates(rows, { mode: 'next' }, 'agent', now).map(r => r.id)).toEqual(['first', 'tie']);
});
it('does not choose between the two occurrences of a Bucharest DST hour', () => {
  const rows = [row('summer', '2026-10-25T00:30:00Z'), row('winter', '2026-10-25T01:30:00Z')];
  expect(viewingCandidates(rows, { mode: 'at_time', date: '2026-10-25', time: '03:30' }, 'agent', now)).toHaveLength(2);
});
it.each([{ mode: 'selected' }, { mode: 'selected', viewingId: 'v', agentId: 'a' }, { mode: 'at_time' }, { mode: 'at_time', time: '17:00', date: '2026-10-08', dayOffset: 0 }, { mode: 'next', dayOffset: 0 }, { mode: 'next', viewingId: 'v' }])('rejects conflicting or missing selectors: %j', input => {
  expect(viewingDetailsSchema.safeParse(input).success).toBe(false);
});
