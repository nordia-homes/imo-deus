import { expect, it } from 'vitest';
import { confirmedStudioRender } from '@/lib/tiktok-render-evidence';
const input = { agencyId: 'a', uid: 'u', projectId: 'project', version: 1 };
const project = { agencyId: 'a', ownerUid: 'u', propertyId: 'p', version: 1, status: 'ready' };
const asset = { agencyId: 'a', ownerUid: 'u', propertyId: 'p', studioProjectId: 'project', version: 1, type: 'video', status: 'ready', url: 'https://media.example/video.mp4' };
it('confirms the exact ready video and supports a legacy project with implicit version one', () => {
  expect(confirmedStudioRender(input, project, asset)).toBe(true);
  expect(confirmedStudioRender(input, { ...project, version: undefined }, asset)).toBe(true);
});
it.each(['https://', 'https://user:secret@media.example/video.mp4', 'http://media.example/video.mp4', 'file:///video.mp4', 'not-a-url', ''])('rejects unusable media URL %s', url => {
  expect(confirmedStudioRender(input, project, { ...asset, url })).toBe(false);
});
it.each([{ propertyId: 'other' }, { propertyId: undefined }, { studioProjectId: 'other' }, { version: 2 }, { agencyId: 'other' }, { ownerUid: 'other' }, { type: 'image' }, { status: 'error' }])('rejects unrelated or incomplete material %j', patch => {
  expect(confirmedStudioRender(input, project, { ...asset, ...patch })).toBe(false);
});
it.each([{ propertyId: '' }, { version: 2 }, { version: 0 }, { status: 'rendering' }, { agencyId: 'other' }, { ownerUid: 'other' }])('rejects inconsistent project %j', patch => {
  expect(confirmedStudioRender(input, { ...project, ...patch }, asset)).toBe(false);
});
it.each([undefined, 0, -1, 1.5])('never confirms an invalid job version %s', version => {
  expect(confirmedStudioRender({ ...input, version }, project, asset)).toBe(false);
});
