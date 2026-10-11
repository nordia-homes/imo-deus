import { describe, expect, it } from 'vitest';
import { taskScheduleDetails } from '../task-schedule';

describe('CRM task local time', () => {
  it.each(['2026-01-15', '2026-07-15', '2026-10-25'])('preserves wall-clock time on %s without applying an offset', dueDate => {
    expect(taskScheduleDetails({ dueDate, startTime: '07:30', duration: 45 })).toEqual({ startTime: '07:30', duration: 45, taskLocal: '07:30 (ora București)' });
  });
  it('does not invent a time for a date-only task', () => {
    expect(taskScheduleDetails({ dueDate: '2026-10-26' })).toEqual({ startTime: null, duration: null, taskLocal: null });
  });
  it.each(['25:00', '2026-10-26T07:30:00Z'])('does not label malformed wall-clock values as local: %s', startTime => {
    expect(taskScheduleDetails({ startTime }).taskLocal).toBeNull();
  });
});
