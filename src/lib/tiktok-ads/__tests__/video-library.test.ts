import { describe, expect, it } from 'vitest';
import type { Property, TikTokStudioAsset } from '../../types';
import { buildTikTokVideoLibrary } from '../../tiktok-video-library';
const property = {
  id: 'home', title: 'Proprietate test', images: [{ url: 'photo.jpg', alt: 'Fotografie' }],
  videoTour: { status: 'ready', url: 'ai.mp4', generatedAt: '2026-09-17', format: 'portrait', style: 'social' },
  uploadedVideo: { url: 'uploaded.mp4', fileName: 'Video', mimeType: 'video/mp4', uploadedAt: '2026-09-18' },
} as Property;
const asset = { id: 'studio', propertyId: 'home', type: 'video', url: 'studio.mp4', updatedAt: '2026-09-16', status: 'ready' } as TikTokStudioAsset;
describe('Property video library', () => {
  it('includes AI, uploaded property videos and Studio videos', () => {
    const videos = buildTikTokVideoLibrary('agency', [property], [asset, { ...asset, id: 'photo', type: 'image', url: 'photo.jpg' }]);
    expect(videos.map(video => video.url)).toEqual(['uploaded.mp4', 'ai.mp4', 'studio.mp4']);
    expect(videos.every(video => video.type === 'video')).toBe(true);
    expect(videos[0].propertyId).toBe('home');
  });
  it('prefers the persisted asset when a property video is already imported', () => {
    const videos = buildTikTokVideoLibrary('agency', [property], [{ ...asset, url: 'ai.mp4' }]);
    expect(videos).toHaveLength(2);
    expect(videos.find(video => video.url === 'ai.mp4')).toMatchObject({ id: 'studio', requiresImport: false });
  });
  it('does not show unfinished AI output or unassociated media', () => {
    const videos = buildTikTokVideoLibrary('agency', [{ ...property, uploadedVideo: null, videoTour: { ...property.videoTour!, status: 'processing' } }], [{ ...asset, propertyId: null }]);
    expect(videos).toEqual([]);
  });
  it('includes uploaded videos even when a property has no photos', () => {
    expect(buildTikTokVideoLibrary('agency', [{ ...property, images: [], videoTour: null }], []).map(video => video.url)).toEqual(['uploaded.mp4']);
  });
  it('does not merge the same video across different properties', () => {
    expect(buildTikTokVideoLibrary('agency', [{ ...property, videoTour: null }, { ...property, id: 'other', videoTour: null }], [])).toHaveLength(2);
  });
});
