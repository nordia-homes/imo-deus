/** Metadata proof shared by plan verification and interrupted-job recovery.
 * This does not fetch media bytes or certify provider publication. */
export function confirmedStudioRender(input: { agencyId: string; uid: string; projectId: string; version: unknown }, project: Record<string, any> | undefined, asset: Record<string, any> | undefined): boolean {
  if (!project || !asset || !Number.isSafeInteger(input.version) || Number(input.version) < 1) return false;
  if (project.agencyId !== input.agencyId || project.ownerUid !== input.uid || (project.version ?? 1) !== input.version || project.status !== 'ready') return false;
  if (typeof project.propertyId !== 'string' || !project.propertyId.trim() || asset.propertyId !== project.propertyId) return false;
  if (asset.agencyId !== input.agencyId || asset.ownerUid !== input.uid || asset.studioProjectId !== input.projectId || asset.version !== input.version || asset.type !== 'video' || asset.status !== 'ready' || typeof asset.url !== 'string') return false;
  try {
    const url = new URL(asset.url);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}
