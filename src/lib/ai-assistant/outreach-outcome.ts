import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';

// Read-only evidence: never retry a call based on an uncertain provider status.
export function outreachOutcome(actor: { uid: string; agencyId: string }, callId: string | undefined, body: Record<string, any>, current: Record<string, any> | undefined, original: Record<string, any>, now = Date.now()) {
  const evidence = (executionState: string, completionSatisfied: boolean, watchable: boolean, note: string) => ({ executionState, completionSatisfied, watchable, businessStatus: String(current?.status || 'unknown'), evidenceSource: 'current_domain_state', verifiedAt: new Date(now).toISOString(), note });
  const unknown = () => evidence('unknown', false, false, 'Identitatea sau programarea apelului nu poate fi confirmată. Verifică apelul în modulul dedicat; nu a fost retrimis.');
  const snapshot = original.call;
  const phone = normalizeRomanianPhone(snapshot?.ownerPhone);
  const instant = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
  if (!callId || !snapshot || !current || !phone
    || ![snapshot, current].every(row => row.id === callId && row.agencyId === actor.agencyId && row.agentId === actor.uid && row.createdBy === actor.uid && row.ownerListingId === body.ownerListing?.id)
    || typeof body.ownerListing?.id !== 'string'
    || normalizeRomanianPhone(current.ownerPhone) !== phone
    || (snapshot.vapiCallId && snapshot.vapiCallId !== current.vapiCallId)) return unknown();
  const scheduled = body.scheduledAt != null;
  const requestedAt = instant(body.scheduledAt);
  if (scheduled ? requestedAt === null || instant(snapshot.scheduledAt) !== requestedAt || instant(current.scheduledAt) !== requestedAt : snapshot.scheduledAt != null || current.scheduledAt != null) return unknown();
  if (scheduled && current.startedAt != null && (instant(current.startedAt) === null || instant(current.startedAt)! < requestedAt!)) return unknown();
  if (current.status === 'failed' || current.status === 'canceled') return evidence(current.status === 'failed' ? 'failed' : 'cancelled', false, false, 'Apelul a eșuat sau a fost anulat. Nu a fost retrimis.');
  const endedAt = instant(current.endedAt);
  const ended = current.status === 'completed' && typeof current.vapiCallId === 'string' && current.vapiCallId.trim().length > 0
    && endedAt !== null && endedAt <= now && (!scheduled || endedAt >= requestedAt!) && (typeof current.lastWebhookType === 'string' && current.lastWebhookType.includes('end') || typeof current.endedReason === 'string' && current.endedReason.trim().length > 0);
  if (ended) return evidence('succeeded', true, false, 'Încheierea apelului identificat este înregistrată prin webhook. Aceasta nu confirmă acordul proprietarului, colaborarea sau o vânzare.');
  if (current.providerErrorCode === 'vapi_create_unknown') return evidence('unknown', false, true, 'Lansarea apelului este incertă; urmăresc dovezile existente fără să retrimit apelul.');
  if (scheduled && current.status === 'scheduled' && requestedAt! > now) return evidence('succeeded', true, false, 'Programarea apelului este salvată pentru momentul cerut. Apelul nu este încă efectuat și rezultatul conversației nu este confirmat.');
  if (['queued', 'calling', 'scheduled'].includes(current.status)) return evidence(current.status === 'calling' ? 'running' : 'queued', false, true, 'Apelul este în așteptare sau în curs; încheierea conversației nu este confirmată.');
  return evidence('unknown', false, false, 'Lipsește dovada verificabilă de încheiere a apelului. Nu a fost retrimis.');
}
