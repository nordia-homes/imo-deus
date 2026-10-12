import { bucharestInputFromIso } from '@/lib/bucharest-time';
// Uses committed executor receipts, never the model's proposed actions.
export function executionConfirmation(results: Record<string, unknown>[]): string {
  return results.map(step => {
    if (['schedule_viewing', 'update_viewing'].includes(String(step.kind))) return viewingConfirmation([step]);
    const receipt = step.result as Record<string, unknown> | undefined;
    if (step.kind === 'stop_prospect_followups' && receipt?.executionState === 'succeeded' && Array.isArray(receipt.canceledCallIds) && Array.isArray(receipt.removedTaskIds) && Array.isArray(receipt.activeCallIds)) return receipt.refusalVerified === true
      ? `Pentru prospectul ${receipt.listingId}: ${receipt.canceledCallIds.length} apeluri AI anulate, ${receipt.removedTaskIds.length} taskuri de apel/follow-up eliminate și păstrate în arhivă. Au fost incluse numai taskurile pe care le poți opri.${receipt.activeCallIds.length ? ` ${receipt.activeCallIds.length} apeluri ajunse sau posibil ajunse la furnizor nu au fost oprite.` : ''}`
      : 'Nu există un refuz înregistrat pentru acest prospect. Nu am oprit apeluri sau taskuri.';
    if (step.kind === 'existing_operation' && receipt?.operation === 'outreach_start') return outreachConfirmation(receipt);
    if (step.kind === 'existing_operation' && receipt?.operation === 'outreach_settings_update' && receipt.executionState === 'succeeded' && receipt.settings && typeof receipt.settings === 'object') {
      const settings = receipt.settings as Record<string, unknown>;
      return `Setările apelurilor AI au fost salvate.${typeof settings.maxDailyCalls === 'number' ? ` Limita zilnică: ${settings.maxDailyCalls} apeluri.` : ''}${typeof settings.callWindowStart === 'string' && typeof settings.callWindowEnd === 'string' ? ` Interval: ${settings.callWindowStart}–${settings.callWindowEnd}, ora Bucureștiului.` : ''}`;
    }
    if (step.kind === 'update_prospect' && receipt?.executionState === 'succeeded' && typeof receipt.listingId === 'string' && receipt.listingId) {
      const state = receipt.state === 'taken' && typeof receipt.takenByAgentId === 'string' && receipt.takenByAgentId ? 'preluat' : 'actualizat';
      const details = [receipt.contactOutcome === 'negative' ? 'Rezultat apel: negativ.' : receipt.contactOutcome === 'follow_up' ? 'Rezultat apel: de revenit.' : '', receipt.collaborationStatus === 'collaborates' ? 'Colaborează.' : receipt.collaborationStatus === 'does_not_collaborate' ? 'Nu colaborează.' : '', typeof receipt.appendedNote === 'string' ? `Notă adăugată: „${receipt.appendedNote}”.` : ''].filter(Boolean).join(' ');
      return `Prospect ${state}. ID: ${receipt.listingId}.${details ? ` ${details}` : ''}`;
    }
    if (step.kind === 'existing_operation' && receipt?.operation === 'owner_prospect' && receipt.businessStatus === 'added_to_prospecting' && receipt.executionState === 'succeeded' && receipt.active === true && typeof receipt.listingId === 'string' && receipt.listingId) return `Anunț adăugat în lista de prospectare. ID: ${receipt.listingId}.`;
    if (step.kind === 'delete_task' && receipt?.deleted === true && typeof receipt.id === 'string' && receipt.id) return `Task șters. ID: ${receipt.id}.`;
    if (step.kind === 'delete_viewing' && receipt?.deleted === true && typeof receipt.id === 'string' && receipt.id) return `Vizionare ștearsă. ID: ${receipt.id}.`;
    if (!['create_task', 'update_task'].includes(String(step.kind)) || !receipt || typeof receipt.taskId !== 'string' || !receipt.taskId) return '';
    const verb = receipt.alreadyExists === true ? 'deja existent' : step.kind === 'create_task' ? 'creat' : receipt.status === 'completed' ? 'finalizat' : 'actualizat';
    const date = typeof receipt.dueDate === 'string' ? receipt.dueDate.includes('T') ? bucharestInputFromIso(receipt.dueDate).date : receipt.dueDate : '';
    const relation = [typeof receipt.ownerListingId === 'string' ? `Prospect: ${receipt.ownerListingTitle || receipt.ownerListingId}. ID prospect: ${receipt.ownerListingId}.` : '', typeof receipt.propertyId === 'string' ? `Proprietate: ${receipt.propertyTitle || receipt.propertyId}.` : '', typeof receipt.contactId === 'string' ? `Client: ${receipt.contactName || receipt.contactId}.` : '', typeof receipt.participantName === 'string' && receipt.participantName ? `Participant: ${receipt.participantName}.` : ''].filter(Boolean).join(' ');
    return `Task ${verb}${typeof receipt.description === 'string' ? `: „${receipt.description}”` : ''}.${date ? ` Data: ${date}${typeof receipt.startTime === 'string' && receipt.startTime ? `, ${receipt.startTime}, ora Bucureștiului` : ''}.` : ''}${relation ? ` ${relation}` : ''} ID: ${receipt.taskId}.`;
  }).filter(Boolean).join('\n');
}

function outreachConfirmation(receipt: Record<string, unknown>): string {
  const call = receipt.call as Record<string, unknown> | undefined;
  if (!call || typeof receipt.callId !== 'string' || !receipt.callId.trim() || call.id !== receipt.callId) return '';
  const reference = ` ID apel: ${receipt.callId}.`;
  if (receipt.executionState === 'unknown' || call.providerErrorCode === 'vapi_create_unknown') return `Lansarea apelului AI este incertă. Verifică starea apelului înainte de o nouă încercare.${reference}`;
  if (receipt.executionState === 'cancelled' && call.status === 'canceled') return `Apelul AI a fost anulat.${reference}`;
  if (receipt.executionState === 'failed' && call.status === 'failed') return `Apelul AI a eșuat.${reference}`;
  if (receipt.executionState === 'running' && call.status === 'calling' && typeof call.vapiCallId === 'string' && call.vapiCallId.trim()) return `Furnizorul a acceptat apelul AI. Rezultatul conversației este încă în așteptare.${reference}`;
  if (receipt.executionState === 'queued' && call.status === 'scheduled' && typeof call.scheduledAt === 'string' && Number.isFinite(Date.parse(call.scheduledAt)) && Date.parse(call.scheduledAt) > Date.now()) {
    const when = new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(call.scheduledAt));
    return `Apelul AI este programat pentru ${when}, ora Bucureștiului. Apelul nu a fost încă efectuat.${reference}`;
  }
  return '';
}

export function viewingConfirmation(results: Record<string, unknown>[]): string {
  const confirmations: string[] = [];
  for (const step of results) {
    const receipt = step.result as Record<string, unknown> | undefined;
    if (!['schedule_viewing', 'update_viewing'].includes(String(step.kind)) || !receipt || typeof receipt.viewingId !== 'string' || !receipt.viewingId || typeof receipt.viewingDate !== 'string' || !Number.isFinite(Date.parse(receipt.viewingDate))) continue;
    if (typeof receipt.appendedNote === 'string' && receipt.appendedNote.trim()) confirmations.push(`Notă adăugată la vizionare: „${receipt.appendedNote}”.`);
    const when = new Intl.DateTimeFormat('ro-RO', { timeZone: 'Europe/Bucharest', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(receipt.viewingDate));
    confirmations.push(`Vizionare ${step.kind === 'schedule_viewing' ? 'programată' : receipt.status === 'completed' ? 'efectuată' : receipt.status === 'cancelled' ? 'anulată' : 'actualizată'}${typeof receipt.propertyTitle === 'string' ? ` pentru „${receipt.propertyTitle}”` : ''}${typeof receipt.contactName === 'string' ? ` cu ${receipt.contactName}` : ''}: ${when}, ora Bucureștiului. ID: ${receipt.viewingId}.`);
  }
  return confirmations.join('\n');
}
