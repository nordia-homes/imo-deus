import { describe, expect, it } from 'vitest';
import { facebookJobSummary, facebookMonitorRequest, tomorrowBucharest } from '../facebook-monitor';
describe('Facebook persisted job reporting', () => {
  it.each([['2026-03-28T22:30:00Z', '2026-03-30'], ['2026-10-24T21:30:00Z', '2026-10-26'], ['2026-12-31T22:30:00Z', '2027-01-02']])('uses Bucharest calendar tomorrow at %s', (now, expected) => expect(tomorrowBucharest(new Date(now))).toBe(expected));
  it.each(['completed', 'running', 'error', 'cancelled', 'unexpected'])('never equates %s with publication', status => {
    const result = facebookJobSummary('job', { status, leaseToken: 'secret', errorMessage: 'secret', groups: [{ name: 'A', status: 'submitted', errorMessage: 'secret' }, { name: 'B', status: 'pending_approval' }, { name: 'C', status: 'error' }, null] });
    expect(result.publicationConfirmed).toBe(false); expect(result.counts).toMatchObject({ submitted: 1, pending_approval: 1, error: 1, unknown: 1 });
    expect(JSON.stringify(result)).not.toContain('secret'); expect(result.groups.every(group => !group.publicationConfirmed)).toBe(true);
  });
  it('recognizes the original truthfulness instruction', () => expect(facebookMonitorRequest('Nu spune „publicat peste tot” dacă un grup a eșuat.')).toBe('truth'));
});
