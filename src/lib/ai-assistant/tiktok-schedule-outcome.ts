import { tikTokScheduleRevision } from '@/lib/tiktok-schedule-revision';

// Scheduler evidence confirms the approved schedule, never a provider publication.
export function tikTokScheduleOutcome(actor: { agencyId: string; uid: string }, draftId: string, body: Record<string, unknown>, draft: Record<string, any>, job: Record<string, any>) {
  const result = (executionState: string, completionSatisfied: boolean, note: string) => ({
    executionState, completionSatisfied, businessStatus: String(job.status || 'unknown'),
    watchable: false, evidenceSource: 'current_domain_state', verifiedAt: new Date().toISOString(),
    publicationConfirmed: false, note,
  });
  const identity = job.kind === 'publish' && job.agencyId === actor.agencyId && job.uid === actor.uid && job.draftId === draftId && draft.agencyId === actor.agencyId && draft.createdByUid === actor.uid;
  const revision = job.draftRevision === tikTokScheduleRevision(draft) && (body.expectedDraftRevision === undefined || body.expectedDraftRevision === job.draftRevision);
  const requested = Date.parse(String(body.runAt)), saved = Date.parse(String(job.runAt)), scheduled = Date.parse(String(draft.scheduledAt));
  if (!identity || !revision || !Number.isFinite(requested) || !Number.isFinite(saved) || !Number.isFinite(scheduled) || requested !== saved || scheduled !== saved) {
    return result('unknown', false, 'Datele curente nu corespund draftului, conținutului și orei aprobate. Programarea nu este confirmată și nu a fost retrimisă.');
  }
  // A provider status refresh can mark the draft sent before the worker closes its job.
  const refreshedBeforeCompletion = job.status === 'running' && draft.scheduleStatus === 'sent' && draft.status === 'published' && typeof draft.publishId === 'string' && draft.publishId.length > 0;
  if ((['queued', 'running'].includes(job.status) && draft.scheduleStatus === 'scheduled') || (job.status === 'completed' && draft.scheduleStatus === 'sent') || refreshedBeforeCompletion) {
    return result('succeeded', true, 'Programarea pentru draftul, conținutul și ora aprobate este confirmată. Pornirea sau încheierea jobului nu confirmă publicarea la TikTok; aceasta se verifică separat.');
  }
  return result(job.status === 'failed' ? 'failed' : job.status === 'canceled' ? 'cancelled' : 'unknown', false, 'Programarea este oprită sau stările salvate nu sunt coerente. Acest rezultat nu stabilește dacă postarea a fost publicată la TikTok și nu declanșează retrimiterea.');
}
