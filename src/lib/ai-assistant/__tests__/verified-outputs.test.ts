import { expect, it } from 'vitest';
import { bindVerifiedOutputs, restoreVerifiedOutputs } from '../verified-outputs';
import { resolveAction } from '../dependencies';
import { actionSchema } from '../contracts';

it('binds verified output separately from a queued receipt and rejects subsequent replacement', () => {
  const original = [{ step: 1, result: { jobId: 'job', executionState: 'queued' } }];
  const bound = bindVerifiedOutputs(original, [{ step: 1, completionSatisfied: true, outputs: { assetId: 'asset' } }]);
  expect(bound[0]).toEqual({ ...original[0], outputs: { assetId: 'asset' } });
  expect(original[0]).not.toHaveProperty('outputs');
  expect(() => bindVerifiedOutputs(bound, [{ step: 1, completionSatisfied: true, outputs: { assetId: 'replacement' } }])).toThrow('schimbat');
  expect(bindVerifiedOutputs(original, [{ step: 1, completionSatisfied: false, outputs: { assetId: 'asset' } }])).toEqual(original);
});
it('allows the verified video URL only in the Studio import URL field', () => {
  const action = actionSchema.parse({ kind: 'existing_operation', operation: 'tiktok_studio_asset_create', params: {}, query: {}, body: { url: '@step:1:videoUrl', name: '@step:1:videoUrl' } });
  const bound = bindVerifiedOutputs([{ result: { jobId: 'job' } }], [{ step: 1, completionSatisfied: true, outputs: { videoUrl: 'https://storage.example/video.mp4' } }]);
  expect(resolveAction(action, bound)).toMatchObject({ body: { url: 'https://storage.example/video.mp4', name: '@step:1:videoUrl' } });
  expect(() => resolveAction(action, [{ result: { videoUrl: 'https://unverified.example/video.mp4' } }])).toThrow('verificat');
  expect(() => bindVerifiedOutputs([], [])).not.toThrow();
  expect(() => bindVerifiedOutputs([{ result: {} }], [{ step: 1, completionSatisfied: true, outputs: { videoUrl: 'file:///secret' } }])).toThrow();
});
it('rejects a receipt ID conflicting with the verified asset instead of importing the wrong material', () => {
  const action = actionSchema.parse({ kind: 'existing_operation', operation: 'tiktok_post_draft', body: { assetId: '@step:1:assetId' } });
  expect(resolveAction(action, [{ result: { assetId: 'asset' }, outputs: { assetId: 'asset' } }])).toMatchObject({ body: { assetId: 'asset' } });
  expect(() => resolveAction(action, [{ result: { assetId: 'other' }, outputs: { assetId: 'asset' } }])).toThrow('diferă');
});
it('restores verified media only alongside the same ledger receipt without mutating it', () => {
  const recovered = [{ step: 1, kind: 'existing_operation', result: { jobId: 'job', executionState: 'queued' } }];
  const previous = [{ ...recovered[0], result: { executionState: 'queued', jobId: 'job' }, outputs: { videoUrl: 'https://fixture.example/video.mp4' } }];
  expect(restoreVerifiedOutputs(recovered, previous)[0]).toEqual({ ...recovered[0], outputs: previous[0].outputs });
  expect(recovered[0]).not.toHaveProperty('outputs');
});
it.each([
  [],
  [{ step: 1, kind: 'existing_operation', result: { jobId: 'different' } }],
  [{ step: 2, kind: 'existing_operation', result: { jobId: 'job' } }],
  [{ step: 1, kind: 'other', result: { jobId: 'job' } }],
].map(recovered => ({ recovered })))('does not transfer existing evidence to an absent or changed receipt: %j', ({ recovered }) => {
  const previous = [{ step: 1, kind: 'existing_operation', result: { jobId: 'job' }, outputs: { assetId: 'asset' } }];
  expect(() => restoreVerifiedOutputs(recovered, previous)).toThrow('reconciliere');
});
it('rejects duplicate evidence and malformed media instead of silently dropping it', () => {
  const step = { step: 1, kind: 'existing_operation', result: { jobId: 'job' } };
  const previous = { ...step, outputs: { assetId: 'asset' } };
  expect(() => restoreVerifiedOutputs([step], [previous, previous])).toThrow();
  expect(() => restoreVerifiedOutputs([step, step], [previous])).toThrow();
  expect(() => restoreVerifiedOutputs([step], [{ ...step, outputs: { videoUrl: 'file:///private' } }])).toThrow();
  expect(restoreVerifiedOutputs([step], [{ ...step, result: { jobId: 'old' } }])).toEqual([step]);
});
