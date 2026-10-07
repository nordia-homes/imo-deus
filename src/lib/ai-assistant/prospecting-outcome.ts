import { normalizeRomanianPhone } from '@/lib/owner-listings/phone';

// Check only the approved operation's effect. Adding a listing never proves
// phone retrieval, owner consent, contact or import into the property portfolio.
export function prospectingOutcome(action: unknown, receipt: Record<string, unknown>, row: Record<string, unknown>) {
  const evidence = (executionState: string, businessStatus: string, completionSatisfied: boolean, watchable: boolean, note: string) => ({ executionState, businessStatus, completionSatisfied, watchable, note, verifiedAt: new Date().toISOString(), evidenceSource: 'current_domain_state' });
  if (!['add', 'remove', 'retry'].includes(String(action)) || typeof receipt.active !== 'boolean' || receipt.active !== (action !== 'remove')) {
    return evidence('unknown', 'unconfirmed_receipt', false, false, 'Lipsește confirmarea operației cerute. Starea curentă singură nu dovedește execuția; comanda nu se repetă automat.');
  }
  if (action === 'remove') return row.isFavoriteActive === false
    ? evidence('succeeded', 'removed_from_prospecting', true, false, 'Anunțul este inactiv în lista de prospectare. Aceasta nu confirmă anularea unui efect extern deja pornit.')
    : evidence('unknown', 'prospecting_state_changed', false, false, 'Eliminarea nu mai este confirmată în lista curentă de prospectare.');
  if (row.isFavoriteActive !== true) return evidence('unknown', 'prospecting_inactive', false, false, 'Anunțul nu mai este activ în prospectare. Nu este readăugat automat.');
  if (action === 'add') return evidence('succeeded', 'added_to_prospecting', true, false, 'Anunțul este activ în lista agenției. Adăugarea nu confirmă preluarea telefonului, acordul sau contactarea proprietarului.');
  const status = String(row.phoneExtractionStatus || 'unknown');
  if (status === 'available' && normalizeRomanianPhone(row.ownerPhone)) return evidence('succeeded', 'phone_available', true, false, 'Telefonul este disponibil în prospectare; acordul și contactarea proprietarului nu sunt confirmate.');
  if (['queued', 'pending', 'processing', 'running', 'retrying'].includes(status)) return evidence('queued', 'phone_pending', false, true, 'Preluarea telefonului este în așteptare. Se verifică starea fără a retrimite comanda.');
  if (['failed', 'error', 'cancelled', 'unavailable'].includes(status)) return evidence('failed', 'phone_unavailable', false, false, 'Preluarea telefonului a eșuat sau a fost oprită. Nu se reia automat.');
  return evidence('unknown', status === 'awaiting_connection' ? 'connection_required' : 'phone_unconfirmed', false, false, 'Telefonul nu este confirmat. Verifică starea și conexiunea în modulul de prospectare.');
}
