import { describe, it, expect } from 'vitest';
import { facebookImmediateRequest, facebookImmediateExecutionPrompt, facebookImmediateAction } from '../facebook-immediate';
import { explicitlyRequestedSafeAction } from '../autonomy';
import { executionConfirmation } from '../execution-confirmation';
const prompt = 'Publică proprietatea acum în grupurile selectate.';
const action: any = { kind: 'existing_operation', operation: 'facebook_job_create', params: {}, query: {}, body: { propertyId: 'p', connectionId: 'c', groupUrls: ['https://www.facebook.com/groups/g'], scheduledAt: null } };
describe('immediate Facebook creation', () => {
  it('only authorizes explicit creation commands', () => {
    expect(facebookImmediateRequest(prompt)).toBe(true); expect(explicitlyRequestedSafeAction(action, prompt)).toBe(true);
    expect(explicitlyRequestedSafeAction(action, 'Arată-mi grupurile Facebook')).toBe(false);
    expect(facebookImmediateRequest('Nu publica proprietatea acum în grupurile selectate.')).toBe(false);
  });
  it('does not accept content overrides or scheduled jobs as immediate creation', () => {
    expect(facebookImmediateAction({ ...action, body: { ...action.body, postDraft: 'new text' } })).toBe(false);
    expect(facebookImmediateAction({ ...action, body: { ...action.body, scheduledAt: '2027-01-01T00:00:00Z' } })).toBe(false);
  });
  it('restores intent only from the latest pending selection', () => {
    const selection = 'Grupuri Facebook: abc123';
    const history: any[] = [{ role: 'assistant', cards: [{ source: 'facebookImmediateRequest', rows: [{ prompt }] }] }];
    expect(facebookImmediateExecutionPrompt(selection, history)).toBe(prompt);
    expect(facebookImmediateExecutionPrompt(selection, [...history, { role: 'assistant', cards: [] }] as any)).toBe(selection);
  });
  it('confirms queue creation without claiming publication', () => {
    const text = executionConfirmation([{ result: { operation: 'facebook_job_create', jobId: 'j', scheduledAt: null, executionState: 'queued' } }]);
    expect(text).toContain('a fost creat'); expect(text).toContain('nu este încă confirmată');
    expect(executionConfirmation([{ result: { operation: 'facebook_job_create', scheduledAt: null, executionState: 'unknown' } }])).not.toContain('a fost creat');
  });
});
