import { describe, expect, it } from 'vitest';
import { facebookJobSummary, facebookMonitorRequest, tomorrowBucharest, facebookActivityOnDay, facebookInterventionReasons, facebookScheduleVerification, facebookScheduleReceipts } from '../facebook-monitor';
describe('Facebook persisted job reporting', () => {
  it.each(['2026-01-20T05:00:00Z', '2026-07-20T04:00:00Z'])('compares actual instants and displays Bucharest time: %s', scheduledAt => {
    const job = facebookJobSummary('j', { status: 'scheduled', scheduledAt });
    const result = facebookScheduleVerification(job, scheduledAt);
    expect(result.scheduleMatches).toBe(true); expect(result.activeScheduleConfirmed).toBe(true); expect(result.text).toContain('07:00');
  });
  it.each(['cancelled', 'completed', 'error', 'unknown'])('does not confirm an active %s schedule', status => {
    const date = '2026-07-20T04:00:00Z';
    const result = facebookScheduleVerification(facebookJobSummary('j', { status, scheduledAt: date }), date);
    expect(result.scheduleMatches).toBe(true); expect(result.activeScheduleConfirmed).toBe(false);
  });
  it('distinguishes mismatch, missing comparison and invalid saved time', () => {
    const job = facebookJobSummary('j', { status: 'scheduled', scheduledAt: '2026-07-20T04:00:00Z' });
    expect(facebookScheduleVerification(job, '2026-07-20T05:00:00Z').text).toContain('DIFERĂ');
    expect(facebookScheduleVerification(job).scheduleMatches).toBeNull();
    expect(facebookScheduleVerification(facebookJobSummary('j', { scheduledAt: 'invalid' }), '2026-07-20T05:00:00Z').activeScheduleConfirmed).toBe(false);
  });
  it('ignores unconfirmed and unrelated receipts', () => {
    const result = { operation: 'facebook_job_create', jobId: 'j', scheduledAt: '2026-07-20T04:00:00Z', executionState: 'unknown' };
    expect(facebookScheduleReceipts([{ role: 'assistant', cards: [{ source: 'autonomy', rows: [{ result }] }] }] as any)).toEqual([]);
  });
  it.each(['2026-03-28T22:30:00Z', '2026-10-24T21:30:00Z'])('attributes execution after Bucharest midnight: %s', timestamp => {
    const day = timestamp.startsWith('2026-03') ? '2026-03-29' : '2026-10-25';
    expect(facebookActivityOnDay(facebookJobSummary('j', { groups: [{ status: 'submitted', submittedAt: timestamp }] }), day)).toBe(true);
    expect(facebookActivityOnDay(facebookJobSummary('j', { scheduledAt: timestamp, updatedAt: timestamp, createdAt: timestamp }), day)).toBe(false);
  });
  it.each(['scheduled', 'queued', 'running', 'cooldown', 'completed', 'cancelled'])('does not label healthy %s as requiring intervention', status => {
    expect(facebookInterventionReasons(facebookJobSummary('j', { status, groups: [{ status: 'pending_approval' }, { status: 'skipped' }] }))).toEqual([]);
  });
  it.each(['error', 'needs_reauthentication', 'uncertain', 'invalid'])('reports unresolved group %s even in a completed job', status => {
    expect(facebookInterventionReasons(facebookJobSummary('j', { status: 'completed', groups: [{ status }] }))).not.toEqual([]);
  });
  it.each(['pending', 'unknown'])('does not overlook %s cloud dispatch', dispatchState => {
    expect(facebookInterventionReasons(facebookJobSummary('j', { status: 'scheduled', dispatchState, groups: [] })).join(' ')).toContain('neconfirmată');
  });
  it.each([['2026-03-28T22:30:00Z', '2026-03-30'], ['2026-10-24T21:30:00Z', '2026-10-26'], ['2026-12-31T22:30:00Z', '2027-01-02']])('uses Bucharest calendar tomorrow at %s', (now, expected) => expect(tomorrowBucharest(new Date(now))).toBe(expected));
  it.each(['completed', 'running', 'error', 'cancelled', 'unexpected'])('never equates %s with publication', status => {
    const result = facebookJobSummary('job', { status, leaseToken: 'secret', errorMessage: 'secret', groups: [{ name: 'A', status: 'submitted', errorMessage: 'secret' }, { name: 'B', status: 'pending_approval' }, { name: 'C', status: 'error' }, null] });
    expect(result.publicationConfirmed).toBe(false); expect(result.counts).toMatchObject({ submitted: 1, pending_approval: 1, error: 1, unknown: 1 });
    expect(JSON.stringify(result)).not.toContain('secret'); expect(result.groups.every(group => !group.publicationConfirmed)).toBe(true);
  });
  it('recognizes the original truthfulness instruction', () => expect(facebookMonitorRequest('Nu spune „publicat peste tot” dacă un grup a eșuat.')).toBe('truth'));
});
