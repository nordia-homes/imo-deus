// A runner submission is not a Facebook publication receipt.
export function facebookOutcome(actor: { uid: string; agencyId: string }, jobId: string, body: Record<string, unknown>, row: Record<string, any>) {
  const evidence = (executionState: string, completionSatisfied: boolean, watchable: boolean, note: string) => ({ executionState, businessStatus: String(row.status || 'unknown'), completionSatisfied, watchable, evidenceSource: 'current_domain_state', verifiedAt: new Date().toISOString(), note });
  const expected = Array.isArray(body.groupUrls) && body.groupUrls.every(url => typeof url === 'string' && url.length > 0) ? [...new Set(body.groupUrls as string[])].sort() : [];
  const groups = Array.isArray(row.groups) ? row.groups : [];
  const actual = groups.map(group => group?.url);
  const identity = row.id === jobId && row.agencyId === actor.agencyId && row.ownerUid === actor.uid && row.propertyId === body.propertyId && row.connectionId === body.connectionId;
  const sameGroups = expected.length > 0 && actual.every(url => typeof url === 'string') && new Set(actual).size === actual.length && JSON.stringify([...actual].sort()) === JSON.stringify(expected);
  if (!identity || !sameGroups) return evidence('unknown', false, false, 'Jobul sau grupurile curente nu corespund cererii aprobate. Publicarea nu a fost reluată.');
  const groupResults = groups.map(group => ({ url: group.url as string, status: String(group.status || 'unknown'), publicationConfirmed: false }));
  const result = (state: string, complete: boolean, watch: boolean, note: string) => ({ ...evidence(state, complete, watch, note), groupResults });
  if (['error', 'cancelled', 'needs_reauthentication'].includes(row.status)) return result(row.status === 'error' ? 'failed' : row.status === 'cancelled' ? 'cancelled' : 'accepted_unverified', false, false, 'Jobul este oprit sau necesită intervenție. Nu se confirmă o programare activă ori publicarea.');
  if (body.scheduledAt != null) {
    const requested = Date.parse(String(body.scheduledAt)), saved = Date.parse(String(row.scheduledAt));
    if (!Number.isFinite(requested) || !Number.isFinite(saved) || requested !== saved) return result('unknown', false, false, 'Ora salvată nu corespunde programării aprobate. Jobul nu a fost modificat sau retrimis.');
    if (['scheduled', 'queued', 'running', 'cooldown', 'completed'].includes(row.status)) return result('succeeded', true, false, 'Programarea este confirmată pentru proprietatea, contul, grupurile și momentul aprobate. Aceasta nu confirmă publicarea; stările grupurilor sunt raportate separat.');
    return result('unknown', false, false, 'Starea programării nu este recunoscută; publicarea nu este confirmată.');
  }
  if (row.scheduledAt) return result('unknown', false, false, 'Jobul a fost reprogramat față de trimiterea imediată aprobată.');
  if (['queued', 'running', 'cooldown'].includes(row.status)) return result(row.status === 'queued' ? 'queued' : 'running', false, true, 'Runnerul procesează trimiterea. Publicarea în grupuri nu este încă verificată.');
  return result('accepted_unverified', false, false, 'Procesarea runnerului nu dovedește publicarea. submitted și pending_approval sunt stări de trimitere, fără confirmarea publicării.');
}
