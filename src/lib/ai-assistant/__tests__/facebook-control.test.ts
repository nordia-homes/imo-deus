import { describe, expect, it } from 'vitest';
import { assertFacebookControlState, verifiedFacebookRunnerControl } from '@/lib/facebook-job-control';
import { facebookControlRequest, requestedFacebookControl, facebookControlReceipt, facebookControlExecutionPrompt } from '../facebook-control';
const job = { id: 'job', agencyId: 'a', ownerUid: 'u', propertyId: 'p', connectionId: 'c', status: 'scheduled', groups: [{ url: 'https://facebook.com/groups/a', status: 'queued' }], scheduledAt: '2030-01-01T06:00:00.000Z' };
describe('Facebook job control contracts', () => {
  it('resolves a multiple-job selection only for the pending bulk command', () => {
    const input = 'Joburi Facebook: job, second';
    const history: any[] = [{ role: 'assistant', cards: [{ source: 'facebookControlRequest', rows: [{ prompt: 'Mută toate joburile selectate cu o oră mai târziu.' }] }] }];
    expect(facebookControlExecutionPrompt(input, history)).toContain('Mută toate');
    history[0].cards[0].rows[0].prompt = 'Anulează jobul dacă fluxul suportă anularea.';
    expect(facebookControlExecutionPrompt(input, history)).toBe(input);
    expect(facebookControlRequest('Nu muta toate joburile selectate cu o oră mai târziu.')).toBeNull();
  });
  it.each(['running', 'completed', 'queued', 'cooldown', 'error'])('does not reschedule %s', status => expect(() => assertFacebookControlState({ ...job, status }, false)).toThrow());
  it.each([{ actualStartedAt: 'now' }, { leaseToken: 'leased' }, { groups: [{ status: 'submitted' }] }])('does not reset started work %j', extra => expect(() => assertFacebookControlState({ ...job, ...extra }, false)).toThrow());
  it('does not overwrite a completed job as cancelled', () => expect(() => assertFacebookControlState({ ...job, status: 'completed' }, true)).toThrow());
  it.each(['id', 'agencyId', 'ownerUid', 'propertyId', 'connectionId', 'scheduledAt', 'status'])('rejects runner mismatches in %s', key => expect(() => verifiedFacebookRunnerControl({ ...job, [key]: 'different' }, job, 'job', job, false)).toThrow());
  it('projects only the requested patch from runner responses', () => expect(verifiedFacebookRunnerControl({ ...job, leaseToken: 'secret' }, job, 'job', { scheduledAt: job.scheduledAt, groups: job.groups }, false)).not.toHaveProperty('leaseToken'));
  it.each(['Nu muta jobul selectat la ora 08:00.', 'Mută jobul selectat la ora 25:00.', 'Arată-mi joburile.'])('does not authorize %s', prompt => expect(facebookControlRequest(prompt)).toBeNull());
  it('requires requested time for automatic execution', () => {
    const action: any = { kind: 'existing_operation', operation: 'facebook_job_update', params: { jobId: 'job' }, query: {}, body: { connectionId: 'c', groupUrls: ['https://facebook.com/groups/a'], scheduledAt: job.scheduledAt, expectedUpdatedAt: job.scheduledAt } };
    expect(requestedFacebookControl(action, 'Mută jobul selectat la ora 08:00.')).toBe(true);
    expect(requestedFacebookControl(action, 'Mută jobul selectat la ora 09:00.')).toBe(false);
  });
  it('requires a matching committed receipt', () => expect(() => facebookControlReceipt('facebook_job_remove', { job }, {}, 'job')).toThrow());
  it('continues only the latest pending selection', () => {
    const history: any[] = [{ role: 'assistant', cards: [{ source: 'facebookControlRequest', rows: [{ prompt: 'Anulează jobul dacă fluxul suportă anularea.' }] }] }];
    expect(facebookControlExecutionPrompt('Job Facebook: job', history)).toContain('Anulează');
    history.push({ role: 'assistant', cards: [] }); expect(facebookControlExecutionPrompt('Job Facebook: job', history)).toBe('Job Facebook: job');
  });
});
