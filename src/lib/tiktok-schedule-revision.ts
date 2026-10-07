import { createHash } from 'node:crypto';

// Only publication inputs: status/telemetry updates must not change approval.
export function tikTokScheduleRevision(draft: Record<string, any>) {
  const fields = ['agencyId', 'createdByUid', 'propertyId', 'videoTourUrl', 'videoOwnerUid', 'targetOpenId', 'description', 'hashtags', 'privacyLevel', 'disableComment', 'disableDuet', 'disableStitch', 'aiGeneratedContent', 'brandOrganic', 'brandContent', 'consentedAt', 'coverTimestampMs'];
  return createHash('sha256').update(JSON.stringify(fields.map(field => [field, draft[field] ?? null]))).digest('hex');
}

export function assertTikTokSchedule(draft: Record<string, any>, job: Record<string, any> | undefined, identity: { agencyId: string; uid: string; draftId: string; owner: string }) {
  if (!job || job.kind !== 'publish' || job.status !== 'running' || job.owner !== identity.owner || !identity.owner || job.agencyId !== identity.agencyId || job.uid !== identity.uid || job.draftId !== identity.draftId || draft.agencyId !== identity.agencyId || draft.createdByUid !== identity.uid || draft.scheduleStatus !== 'scheduled' || draft.status !== 'draft' || !Number.isFinite(Date.parse(job.leaseUntil)) || Date.parse(job.leaseUntil) <= Date.now() || !Number.isFinite(Date.parse(job.runAt)) || Date.parse(job.runAt) > Date.now() || Date.parse(draft.scheduledAt) !== Date.parse(job.runAt) || job.draftRevision !== tikTokScheduleRevision(draft)) throw new Error('Programarea sau conținutul TikTok s-a schimbat. Verifică draftul și programează din nou; publicarea nu a pornit.');
}
