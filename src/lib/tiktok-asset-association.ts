type SourceProperty = { id: string; images: Array<{ url: string }> };
type SourceProject = { id: string; propertyId?: string | null; sourceAssetIds: string[] };
type SourceAsset = { id: string; propertyId?: string | null; url: string; studioProjectId?: string | null };

/** Only exact, unambiguous provenance. Titles are not unique identifiers. */
export function inferTikTokAssetProperty(asset: SourceAsset, properties: SourceProperty[], projects: SourceProject[]): string | null {
  if (asset.propertyId) return asset.propertyId;
  const valid = new Set(properties.map(property => property.id));
  const candidates = new Set<string>();
  for (const property of properties) {
    if (property.images.some(image => image.url === asset.url)) candidates.add(property.id);
  }
  for (const project of projects) {
    if (project.propertyId && valid.has(project.propertyId) && (project.id === asset.studioProjectId || project.sourceAssetIds.includes(asset.id))) candidates.add(project.propertyId);
  }
  return candidates.size === 1 ? [...candidates][0] : null;
}
