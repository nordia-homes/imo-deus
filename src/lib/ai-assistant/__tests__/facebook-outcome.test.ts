import { expect, it } from 'vitest';
import { facebookOutcome } from '../facebook-outcome';
const actor = { uid: 'u', agencyId: 'a' }, urls = ['https://facebook.com/groups/one', 'https://facebook.com/groups/two'];
const body = { propertyId: 'p', connectionId: 'c', groupUrls: urls, scheduledAt: '2030-01-01T07:00:00+02:00' };
const job = { id: 'j', agencyId: 'a', ownerUid: 'u', propertyId: 'p', connectionId: 'c', scheduledAt: '2030-01-01T05:00:00Z', status: 'scheduled', groups: urls.map(url => ({ url, status: 'queued' })) };
it.each(['scheduled', 'queued', 'running', 'cooldown', 'completed'])('confirms scheduling separately from publication for %s', status => {
  expect(facebookOutcome(actor, 'j', body, { ...job, status })).toMatchObject({ completionSatisfied: true, watchable: false, groupResults: [{ publicationConfirmed: false }, { publicationConfirmed: false }] });
});
it.each(['id', 'agencyId', 'ownerUid', 'propertyId', 'connectionId'])('rejects mismatched %s', field => {
  expect(facebookOutcome(actor, 'j', body, { ...job, [field]: 'other' })).toMatchObject({ executionState: 'unknown', completionSatisfied: false, watchable: false });
});
it.each([[], [{ url: urls[0] }], [{ url: urls[0] }, { url: urls[0] }], [{ url: urls[0] }, { url: 'extra' }], [null, {}]].map(groups => ({ groups })))('rejects incomplete, duplicate and malformed groups %j', ({ groups }) => {
  expect(facebookOutcome(actor, 'j', body, { ...job, groups }).completionSatisfied).toBe(false);
});
it('normalizes approved duplicates like the creation handler but refuses duplicate saved groups', () => {
  expect(facebookOutcome(actor, 'j', { ...body, groupUrls: [...urls, urls[0]] }, job).completionSatisfied).toBe(true);
  expect(facebookOutcome(actor, 'j', { ...body, groupUrls: [urls[0], urls[0]] }, job).completionSatisfied).toBe(false);
  expect(facebookOutcome(actor, 'j', body, { ...job, groups: [...job.groups].reverse() }).completionSatisfied).toBe(true);
});
it.each(['bad', null, '2030-01-01T07:00:00Z'])('rejects changed or invalid saved time %s', scheduledAt => {
  expect(facebookOutcome(actor, 'j', body, { ...job, scheduledAt }).completionSatisfied).toBe(false);
});
it.each(['error', 'cancelled', 'needs_reauthentication', 'unknown'])('does not confirm an active schedule in %s', status => {
  expect(facebookOutcome(actor, 'j', body, { ...job, status })).toMatchObject({ completionSatisfied: false, watchable: false });
});
it('reports per-group submission states without exposing runner errors or claiming publication', () => {
  const result = facebookOutcome(actor, 'j', { ...body, scheduledAt: null }, { ...job, scheduledAt: null, status: 'completed', groups: [{ url: urls[0], status: 'submitted', errorMessage: 'private detail' }, { url: urls[1], status: 'pending_approval' }] });
  expect(result).toMatchObject({ executionState: 'accepted_unverified', completionSatisfied: false, watchable: false, groupResults: [{ status: 'submitted' }, { status: 'pending_approval' }] });
  expect(JSON.stringify(result)).not.toContain('private detail');
});
it.each(['queued', 'running', 'cooldown'])('watches an immediate %s job without resending', status => {
  expect(facebookOutcome(actor, 'j', { ...body, scheduledAt: null }, { ...job, scheduledAt: null, status })).toMatchObject({ completionSatisfied: false, watchable: true });
});
it('rejects rescheduling of an immediate approved send', () => {
  expect(facebookOutcome(actor, 'j', { ...body, scheduledAt: null }, job)).toMatchObject({ executionState: 'unknown', completionSatisfied: false, watchable: false });
});
