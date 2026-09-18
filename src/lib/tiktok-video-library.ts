import type { Property, TikTokStudioAsset } from './types';

export type LibraryVideo = TikTokStudioAsset & { propertyTitle?: string; requiresImport?: boolean };

/** Property videos and Studio renders, never the source photographs. */
export function buildTikTokVideoLibrary(agencyId: string, properties: Property[], studioAssets: TikTokStudioAsset[]): LibraryVideo[] {
  const videos = new Map<string, LibraryVideo>();
  const key = (propertyId: string, url: string) => JSON.stringify([propertyId, url]);
  for (const property of properties) {
    const add = (kind: 'ai' | 'upload', url: string, date: string, ownerUid: string, thumbnailUrl: string | null, mimeType?: string | null, sizeBytes?: number | null, durationSeconds?: number | null) => {
      videos.set(key(property.id, url), {
        id: `property-${property.id}-${kind}`, agencyId, ownerUid, propertyId: property.id, propertyTitle: property.title,
        name: `${property.title} · ${kind === 'ai' ? 'Video AI' : 'Video încărcat'}`,
        type: 'video', url, thumbnailUrl, mimeType, sizeBytes, durationSeconds,
        createdAt: date, updatedAt: date, source: kind === 'ai' ? 'property_video_tour' : 'upload',
        status: 'ready', requiresImport: true,
      });
    };
    if (property.videoTour?.status === 'ready' && property.videoTour.url) {
      const tour = property.videoTour;
      add('ai', tour.url!, tour.generatedAt || '', tour.generatedByUid || '', tour.thumbnailUrl || property.images?.[0]?.url || null, tour.mimeType, null, tour.durationSeconds);
    }
    if (property.uploadedVideo?.url) {
      const uploaded = property.uploadedVideo;
      add('upload', uploaded.url, uploaded.uploadedAt, uploaded.uploadedByUid || '', null, uploaded.mimeType, uploaded.sizeBytes);
    }
  }
  for (const asset of studioAssets) {
    if (asset.type !== 'video' || !asset.propertyId) continue;
    const existing = videos.get(key(asset.propertyId, asset.url));
    videos.set(key(asset.propertyId, asset.url), {
      ...asset, propertyTitle: existing?.propertyTitle || properties.find(property => property.id === asset.propertyId)?.title,
      requiresImport: false,
    });
  }
  return [...videos.values()].sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0));
}
