import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ resource: vi.fn() }));
vi.mock('../access', () => ({ getResource: mocks.resource }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error { constructor(message: string, public status: number) { super(message); } } }));
import { tikTokDraftOutcome } from '../tiktok-draft-outcome';
const ctx = { uid: 'u', agencyId: 'a' } as any;
function fixture(studio = true) {
  const url = 'https://fixture.example/video.mp4';
  const draft: Record<string, any> = { id: 'd', agencyId: 'a', createdByUid: 'u', propertyId: 'p', description: 'Caption', targetOpenId: 'profile', videoTourUrl: url, status: 'draft', privacyLevel: 'SELF_ONLY', ...(studio ? { studioAssetId: 'asset', videoOwnerUid: 'u' } : {}) };
  const source: Record<string, any> = studio ? { agencyId: 'a', ownerUid: 'u', propertyId: 'p', type: 'video', status: 'ready', url } : { videoTour: { status: 'ready', url } };
  const body: Record<string, unknown> = { ...(studio ? { assetId: 'asset' } : { propertyId: 'p' }), description: ' Caption ', privacyLevel: 'SELF_ONLY' };
  const original: Record<string, any> = { draft: structuredClone(draft) };
  mocks.resource.mockImplementation(async (_ctx, resource) => resource === 'tiktokPostDrafts' ? draft : source);
  return { draft, source, body, original, read: () => tikTokDraftOutcome(ctx, 'd', body, original) };
}
beforeEach(() => vi.resetAllMocks());
it.each([true, false])('confirms the owned draft and current source (studio=%s) without claiming publication', async studio => {
  const f = fixture(studio);
  expect(await f.read()).toMatchObject({ executionState: 'succeeded', completionSatisfied: true, publicationConfirmed: false, watchable: false });
});
it.each([
  ['studioAssetId', 'different'], ['videoTourUrl', 'https://fixture.example/other.mp4'], ['propertyId', 'other'],
  ['videoOwnerUid', 'other'], ['description', 'Changed'], ['description', ''], ['targetOpenId', ''],
  ['targetOpenId', 'different-profile'], ['status', 'publishing'], ['privacyLevel', 'PUBLIC_TO_EVERYONE'],
  ['hashtags', ['#changed']], ['disableComment', true],
])('rejects changed draft field %s', async (field, value) => {
  const f = fixture(); f.draft[field as string] = value;
  expect(await f.read()).toMatchObject({ completionSatisfied: false, watchable: false });
});
it.each(['createdByUid', 'agencyId'])('does not disclose a draft with different %s', async field => {
  const f = fixture(); f.draft[field] = 'other';
  await expect(f.read()).rejects.toMatchObject({ status: 403 });
});
it.each([{ url: 'https://fixture.example/other.mp4' }, { status: 'error' }, { type: 'image' }, { propertyId: 'other' }, { ownerUid: 'other' }])('rejects a changed Studio source: %j', async patch => {
  const f = fixture(); Object.assign(f.source, patch);
  expect((await f.read()).completionSatisfied).toBe(false);
});
it('rechecks the property video even when the draft snapshot still matches', async () => {
  const f = fixture(false); f.source.videoTour.url = 'https://fixture.example/replacement.mp4';
  expect((await f.read()).completionSatisfied).toBe(false);
});
it('checks explicit settings and consent in legacy receipts without a draft snapshot', async () => {
  const f = fixture(); delete f.original.draft;
  expect((await f.read()).completionSatisfied).toBe(true);
  f.body.disableDuet = true;
  expect((await f.read()).completionSatisfied).toBe(false);
  f.draft.disableDuet = true; f.body.userConsent = true;
  expect((await f.read()).completionSatisfied).toBe(false);
  f.draft.consentedAt = '2030-01-01T10:00:00Z';
  expect((await f.read()).completionSatisfied).toBe(true);
});
it('rejects an unrelated snapshot or a conflicting explicit property', async () => {
  const f = fixture(); f.original.draft.id = 'other';
  expect((await f.read()).completionSatisfied).toBe(false);
  f.original.draft.id = 'd'; f.body.propertyId = 'other';
  expect((await f.read()).completionSatisfied).toBe(false);
});
it('accepts the handler property fallback for an empty optional asset ID', async () => {
  const f = fixture(false); f.body.assetId = '';
  expect((await f.read()).completionSatisfied).toBe(true);
});
it('rejects a legacy asset and draft that both lack a media owner', async () => {
  const f = fixture(); delete f.original.draft; delete f.source.ownerUid; delete f.draft.videoOwnerUid;
  expect((await f.read()).completionSatisfied).toBe(false);
});
it.each(['http://fixture.example/video.mp4', 'https://user:pass@fixture.example/video.mp4', 'invalid'])('rejects unverified media URL %s even in matching snapshots', async url => {
  const f = fixture(); f.source.url = url; f.draft.videoTourUrl = url; f.original.draft.videoTourUrl = url;
  expect((await f.read()).completionSatisfied).toBe(false);
});
