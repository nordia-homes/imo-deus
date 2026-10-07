import { isDeepStrictEqual } from 'node:util';
import { safeData } from './contracts';

// Compare creative inputs, not render telemetry: rendering legitimately changes
// status, output IDs, leases and timestamps without changing the saved project.
const contentFields = ['propertyId', 'version', 'title', 'mode', 'sourceAssetIds', 'script', 'voiceId', 'voiceProfile', 'subtitleStyle', 'creativePreset', 'hook', 'caption', 'captionVariants', 'hashtags', 'storyboard', 'timeline', 'qualityScore', 'brandKit', 'repurposeVariants', 'scheduledAt', 'aspectRatio', 'settings'] as const;
const content = (project: Record<string, any>) => safeData(Object.fromEntries(contentFields.map(field => [field, project[field] ?? null])));

export function tikTokProjectOutcome(projectId: string, body: Record<string, unknown>, project: Record<string, any>, original: Record<string, any>) {
  const snapshot = original.project;
  const sourceIds = Array.isArray(body.sourceAssetIds) ? [...new Set(body.sourceAssetIds.map(id => String(id || '').trim()).filter(Boolean))] : [];
  const confirmed = Boolean(snapshot && snapshot.id === projectId
    && snapshot.agencyId === project.agencyId && snapshot.ownerUid === project.ownerUid
    && typeof body.propertyId === 'string' && body.propertyId === project.propertyId
    && (body.projectId === undefined || body.projectId === projectId)
    && Number.isSafeInteger(project.version) && project.version > 0
    && (body.expectedVersion === undefined || project.version === Number(body.expectedVersion) + 1)
    && isDeepStrictEqual(project.sourceAssetIds, sourceIds)
    && project.script === (typeof body.script === 'string' ? body.script.trim() : '')
    && ['draft', 'queued', 'rendering', 'ready', 'error'].includes(project.status)
    && isDeepStrictEqual(content(snapshot), content(project)));
  return {
    executionState: confirmed ? 'succeeded' : 'unknown', completionSatisfied: confirmed,
    businessStatus: String(project.status || 'unknown'), evidenceSource: 'current_domain_state',
    verifiedAt: new Date().toISOString(), watchable: false,
    note: confirmed
      ? 'Proiectul salvat corespunde versiunii și conținutului verificat. Aceasta confirmă salvarea proiectului, nu finalizarea randării.'
      : 'Versiunea sau conținutul proiectului nu poate fi confirmat din rezultatul salvării. Reconcilierea este necesară înainte de pasul următor.',
  };
}
