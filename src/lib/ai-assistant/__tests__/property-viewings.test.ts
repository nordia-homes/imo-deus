import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({}));
import { completedViewings, propertyViewingsSchema } from '../property-viewings';
it('counts only confirmed visits that actually lie in the past', () => {
  const now = new Date('2026-10-08T10:00:00Z');
  const rows = [
    { id: 'done', status: 'completed', viewingDate: '2026-10-08T12:00:00+03:00' },
    { id: 'future', status: 'completed', viewingDate: '2026-10-08T14:00:00+03:00' },
    { id: 'old-unconfirmed', status: 'scheduled', viewingDate: '2026-10-07T10:00:00Z' },
    { id: 'cancelled', status: 'cancelled', viewingDate: '2026-10-07T10:00:00Z' },
    { id: 'invalid', status: 'completed', viewingDate: 'invalid' },
  ];
  expect(completedViewings(rows, now).map(row => row.id)).toEqual(['done']);
});
it.each(['latest_completed', 'count_completed'])('rejects cursor for aggregate mode %s', mode => {
  expect(propertyViewingsSchema.safeParse({ propertyId: 'p', mode, cursor: 'v' }).success).toBe(false);
});
