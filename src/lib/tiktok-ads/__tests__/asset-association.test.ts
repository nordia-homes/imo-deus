import { describe, expect, it } from 'vitest';
import { inferTikTokAssetProperty } from '../../tiktok-asset-association';
const asset = { id: 'a', url: 'https://images.test/one.jpg' };
const properties = [{ id: 'p', images: [{ url: asset.url }] }, { id: 'other', images: [] }];
describe('TikTok media provenance', () => {
  it('recovers an exact property photo', () => expect(inferTikTokAssetProperty(asset, properties, [])).toBe('p'));
  it('preserves explicit associations', () => expect(inferTikTokAssetProperty({ ...asset, propertyId: 'other' }, properties, [])).toBe('other'));
  it('does not guess shared photographs', () => expect(inferTikTokAssetProperty(asset, [...properties, { id: 'shared', images: [{ url: asset.url }] }], [])).toBeNull());
  it('recovers a rendered project video', () => expect(inferTikTokAssetProperty({ ...asset, url: 'video', studioProjectId: 'project' }, properties, [{ id: 'project', propertyId: 'p', sourceAssetIds: [] }])).toBe('p'));
  it('recovers source images from a project', () => expect(inferTikTokAssetProperty({ ...asset, url: 'old' }, properties, [{ id: 'project', propertyId: 'p', sourceAssetIds: ['a'] }])).toBe('p'));
  it('rejects conflicting project evidence', () => expect(inferTikTokAssetProperty(asset, properties, [{ id: 'project', propertyId: 'other', sourceAssetIds: ['a'] }])).toBeNull());
  it('rejects projects outside the supplied portfolio', () => expect(inferTikTokAssetProperty({ ...asset, url: 'old' }, properties, [{ id: 'project', propertyId: 'foreign', sourceAssetIds: ['a'] }])).toBeNull());
  it('leaves unknown uploads unassigned', () => expect(inferTikTokAssetProperty({ ...asset, url: 'unknown' }, properties, [])).toBeNull());
});
