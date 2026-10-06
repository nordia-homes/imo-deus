import { expect, it } from 'vitest';
import { bindVerifiedOutputs } from '../verified-outputs';
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
