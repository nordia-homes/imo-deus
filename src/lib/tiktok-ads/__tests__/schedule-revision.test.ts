import { expect, it } from 'vitest';
import { assertTikTokSchedule, tikTokScheduleRevision } from '@/lib/tiktok-schedule-revision';
const draft = { agencyId: 'a', createdByUid: 'u', status: 'draft', scheduleStatus: 'scheduled', scheduledAt: '2020-01-01T00:00:00Z', description: 'Approved', videoTourUrl: 'https://example.test/video.mp4' };
const identity = { agencyId: 'a', uid: 'u', draftId: 'd', owner: 'claim' };
const job = () => ({ ...identity, kind: 'publish', status: 'running', runAt: draft.scheduledAt, leaseUntil: new Date(Date.now() + 60000).toISOString(), draftRevision: tikTokScheduleRevision(draft) });
it('accepts the same draft and ignores operational telemetry', () => {
  expect(() => assertTikTokSchedule({ ...draft, updatedAt: 'later', publishLog: [] }, job(), identity)).not.toThrow();
});
it.each(['description', 'videoTourUrl', 'targetOpenId', 'privacyLevel', 'hashtags', 'consentedAt', 'coverTimestampMs', 'brandContent', 'disableComment'])('rejects changed %s', field => {
  expect(() => assertTikTokSchedule({ ...draft, [field]: 'changed' }, job(), identity)).toThrow('s-a schimbat');
});
it.each([{ owner: 'other' }, { status: 'queued' }, { kind: 'render' }, { draftRevision: undefined }, { leaseUntil: 'bad' }, { leaseUntil: '2020-01-01' }, { runAt: '2099-01-01' }, { agencyId: 'other' }, { uid: 'other' }, { draftId: 'other' }])('rejects a stale or invalid scheduling claim %j', patch => {
  expect(() => assertTikTokSchedule(draft, { ...job(), ...patch }, identity)).toThrow();
});
it('rejects canceled schedules and a draft already being published', () => {
  expect(() => assertTikTokSchedule({ ...draft, scheduleStatus: 'none' }, job(), identity)).toThrow();
  expect(() => assertTikTokSchedule({ ...draft, status: 'publishing' }, job(), identity)).toThrow();
});
