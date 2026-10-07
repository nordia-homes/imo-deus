import { expect, it } from 'vitest';
import { tikTokProjectOutcome } from '../tiktok-project-outcome';

const body = { propertyId: 'p', sourceAssetIds: ['photo1', 'photo2'], script: 'Scenariu.' };
const project = { id: 'project', agencyId: 'a', ownerUid: 'u', propertyId: 'p', version: 1, status: 'draft', sourceAssetIds: body.sourceAssetIds, script: body.script, title: 'Titlu', mode: 'photo_to_video', aspectRatio: '9:16', settings: { music: true, volume: 0.5 }, timeline: [{ assetId: 'photo1', duration: 3 }] };
const check = (patch = {}, request: Record<string, unknown> = body, receipt: any = { project }) => tikTokProjectOutcome('project', request, { ...project, ...patch }, receipt);

it.each(['draft', 'queued', 'rendering', 'ready', 'error'])('confirms saved content independently of render status %s', status => {
  expect(check({ status, outputAssetId: 'output', updatedAt: 'later', renderLeaseOwner: 'worker' })).toMatchObject({ completionSatisfied: true, businessStatus: status, watchable: false });
});
it.each([
  { version: 2 }, { sourceAssetIds: ['photo2', 'photo1'] }, { sourceAssetIds: ['photo1'] },
  { script: 'Alt scenariu' }, { title: 'Alt titlu' }, { aspectRatio: '16:9' },
  { voiceId: 'different' }, { settings: { music: false, volume: 0.5 } },
  { timeline: [{ assetId: 'photo2', duration: 3 }] }, { propertyId: 'other' },
  { version: undefined }, { status: 'unknown' }, { ownerUid: 'other' }, { agencyId: 'other' },
])('refuses changed or incomplete project evidence: %j', patch => {
  expect(check(patch)).toMatchObject({ completionSatisfied: false, executionState: 'unknown', watchable: false });
});
it('normalizes source IDs and script as the save handler does, preserving photo order', () => {
  expect(check({}, { ...body, sourceAssetIds: [' photo1 ', 'photo2', 'photo1', ''], script: ' Scenariu. ' }).completionSatisfied).toBe(true);
});
it('compares nested objects independently of key order', () => {
  expect(check({ settings: { volume: 0.5, music: true } }).completionSatisfied).toBe(true);
});
it.each([{}, { project: { ...project, id: 'different' } }])('requires the actual save snapshot: %j', receipt => {
  expect(check({}, body, receipt).completionSatisfied).toBe(false);
});
it.each([{ sourceAssetIds: ['photo2'] }, { script: 'Other' }, { expectedVersion: 2 }, { projectId: 'other' }])('checks the requested inputs as well as the snapshot: %j', patch => {
  expect(check({}, { ...body, ...patch }).completionSatisfied).toBe(false);
});
