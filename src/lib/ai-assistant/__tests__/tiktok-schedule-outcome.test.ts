import { describe, expect, it } from 'vitest';
import { tikTokScheduleRevision } from '@/lib/tiktok-schedule-revision';
import { tikTokScheduleOutcome } from '../tiktok-schedule-outcome';

function fixture() {
  const actor = { agencyId: 'a', uid: 'u' };
  const runAt = '2030-01-01T10:00:00.000Z';
  const draft: Record<string, any> = { agencyId: 'a', createdByUid: 'u', description: 'Apartament', videoTourUrl: 'https://example.test/video.mp4', scheduledAt: runAt, scheduleStatus: 'scheduled', status: 'draft' };
  const body: Record<string, unknown> = { runAt, expectedDraftRevision: tikTokScheduleRevision(draft) };
  const job: Record<string, any> = { kind: 'publish', agencyId: 'a', uid: 'u', draftId: 'd', runAt, draftRevision: body.expectedDraftRevision, status: 'queued' };
  return { draft, body, job, read: () => tikTokScheduleOutcome(actor, 'd', body, draft, job) };
}

describe('TikTok schedule evidence across worker transitions', () => {
  it.each([
    ['queued', 'scheduled', 'draft'], ['running', 'scheduled', 'draft'],
    ['running', 'scheduled', 'publishing'], ['running', 'scheduled', 'processing'],
    ['completed', 'sent', 'processing'], ['completed', 'sent', 'published'],
    ['running', 'sent', 'published'],
  ])('confirms the schedule for %s/%s/%s without claiming publication', (jobStatus, scheduleStatus, status) => {
    const f = fixture();
    Object.assign(f.job, { status: jobStatus });
    Object.assign(f.draft, { scheduleStatus, status, publishId: status === 'published' ? 'receipt' : null });
    expect(f.read()).toMatchObject({ executionState: 'succeeded', completionSatisfied: true, publicationConfirmed: false, watchable: false });
  });
  it.each(['failed', 'canceled', 'unexpected'])('does not confirm stopped or unrecognized job %s even with a provider ID', status => {
    const f = fixture();
    Object.assign(f.job, { status });
    Object.assign(f.draft, { status: 'published', publishId: 'receipt' });
    expect(f.read()).toMatchObject({ completionSatisfied: false, publicationConfirmed: false, watchable: false });
  });
  it.each([
    ['queued', 'sent'], ['running', 'sent'], ['running', 'error'], ['completed', 'scheduled'], ['completed', 'none'],
  ])('rejects inconsistent %s/%s states', (status, scheduleStatus) => {
    const f = fixture(); f.job.status = status; f.draft.scheduleStatus = scheduleStatus;
    expect(f.read().completionSatisfied).toBe(false);
  });
  it.each([
    ['job', 'uid', 'other'], ['job', 'agencyId', 'other'], ['job', 'draftId', 'other'], ['job', 'kind', 'render'],
    ['draft', 'createdByUid', 'other'], ['draft', 'agencyId', 'other'], ['draft', 'description', 'Changed'],
    ['draft', 'videoTourUrl', 'https://example.test/changed.mp4'], ['job', 'draftRevision', undefined],
    ['body', 'expectedDraftRevision', 'stale'], ['body', 'runAt', 'invalid'], ['job', 'runAt', 'invalid'],
    ['draft', 'scheduledAt', null], ['job', 'runAt', '2030-01-01T11:00:00Z'],
    ['draft', 'scheduledAt', '2030-01-01T11:00:00Z'],
  ])('rejects mismatched %s.%s', (target, key, value) => {
    const f = fixture(); f[target as 'draft' | 'job' | 'body'][key as string] = value;
    expect(f.read()).toMatchObject({ executionState: 'unknown', completionSatisfied: false });
  });
  it('compares instants across timezone representations', () => {
    const f = fixture(); f.body.runAt = '2030-01-01T12:00:00+02:00';
    expect(f.read().completionSatisfied).toBe(true);
  });
  it('reads legacy plans without an approved hash but still requires the job revision', () => {
    const f = fixture(); delete f.body.expectedDraftRevision;
    expect(f.read().completionSatisfied).toBe(true);
    delete f.job.draftRevision;
    expect(f.read().completionSatisfied).toBe(false);
  });
});
