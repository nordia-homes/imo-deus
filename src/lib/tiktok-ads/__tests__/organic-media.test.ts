import { describe, expect, it, vi } from 'vitest';

vi.mock('@/firebase/admin', () => ({ adminStorage: { bucket: () => ({ name: 'imodeus.firebasestorage.app' }) } }));
import { planTikTokVideoChunks, storagePathFromTikTokVideoUrl } from '@/lib/tiktok-organic-media';

describe('TikTok organic media boundary', () => {
  it('keeps small videos whole and merges a trailing remainder into the last chunk', () => {
    const small = planTikTokVideoChunks(4_000_000);
    expect([small.chunkSize, small.count, small.chunkLength(0)]).toEqual([4_000_000, 1, 4_000_000]);
    const large = planTikTokVideoChunks(50_000_123, 10_000_000);
    expect(large.count).toBe(1); // Videos below 64 MB are sent in one request.
    const chunked = planTikTokVideoChunks(70_000_123, 10_000_000);
    expect(chunked.count).toBe(7);
    expect(chunked.chunkLength(6)).toBe(10_000_123);
    expect(Array.from({ length: chunked.count }, (_, i) => chunked.chunkLength(i)).reduce((a, b) => a + b, 0)).toBe(70_000_123);
    const maxConfigured = planTikTokVideoChunks(65_000_000, 64_000_000);
    expect(maxConfigured.count).toBeGreaterThan(1);
    expect(maxConfigured.chunkLength(0)).toBeLessThanOrEqual(64_000_000);
  });

  it('accepts only Firebase objects owned by the agency or user', () => {
    const make = (object: string) => `https://firebasestorage.googleapis.com/v0/b/imodeus.firebasestorage.app/o/${encodeURIComponent(object)}?alt=media&token=x`;
    expect(storagePathFromTikTokVideoUrl(make('agencies/agency/properties/home/video-tours/tour.mp4'), 'agency', 'user')).toContain('video-tours');
    expect(storagePathFromTikTokVideoUrl(make('users/user/tiktok-studio/video.mp4'), 'agency', 'user')).toContain('tiktok-studio');
    expect(() => storagePathFromTikTokVideoUrl(make('agencies/other/video.mp4'), 'agency', 'user')).toThrow();
    expect(() => storagePathFromTikTokVideoUrl(make('users/other/tiktok-studio/video.mp4'), 'agency', 'user')).toThrow();
    expect(() => storagePathFromTikTokVideoUrl('http://127.0.0.1/latest', 'agency', 'user')).toThrow();
  });
});
