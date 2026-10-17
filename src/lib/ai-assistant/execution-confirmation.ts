import { bucharestInputFromIso } from '@/lib/bucharest-time';
// Uses committed executor receipts, never the model's proposed actions.
export function executionConfirmation(results: Record<string, unknown>[]): string {
  return results.map(step => {
    if (['schedule_viewing', 'update_viewing'].includes(String(step.kind))) return viewingConfirmation([step]);
    const receipt = step.result as Record<string, unknown> | undefined;
    if (receipt?.operation === 'social_publish' && receipt.schedulingConfirmed === true && typeof receipt.scheduledAt === 'string') {
      const when = bucharestInputFromIso(receipt.scheduledAt);
      return 'Postarea socială ' + receipt.postId + ' este programată pentru ' + when.date + ' la ' + when.time + ', ora Bucureștiului. Aceeași oră este salvată în postare și în coada automată. Publicarea efectivă nu este încă confirmată.';
    }
    if (receipt?.operation === 'social_create' && receipt.executionState === 'succeeded' && receipt.businessStatus === 'draft') return 'Ciorna socială ' + receipt.postId + ' a fost salvată pentru proprietatea ' + receipt.propertyId + ', cu descrierea și fotografiile din CRM. Postarea nu este publicată.';
    if (receipt?.operation === 'social_like' && receipt.executionState === 'succeeded') return 'Meta a confirmat aprecierea comentariului ' + receipt.commentId + '.';
    if (receipt?.operation === 'social_reply' && receipt.executionState === 'succeeded') return 'Meta a confirmat răspunsul la comentariul ' + receipt.commentId + '. ID răspuns: ' + receipt.replyId + '.';
    if (receipt?.operation === 'facebook_job_create' && ['succeeded', 'queued', 'running'].includes(String(receipt.executionState)) && receipt.scheduledAt === null) return 'Jobul Facebook ' + receipt.jobId + ' a fost creat pentru publicare fără programare amânată. Automatizarea folosește descrierea și pozele din CRM. Publicarea efectivă nu este încă confirmată.';
    if (receipt?.operation === 'facebook_job_create' && receipt.schedulingConfirmed === true && typeof receipt.scheduledAt === 'string') {
      const when = bucharestInputFromIso(receipt.scheduledAt);
      return 'Jobul Facebook ' + receipt.jobId + ' a fost creat și programat pentru ' + when.date + ' la ' + when.time + ', ora Bucureștiului. Publicarea nu este încă confirmată.';
    }
    if (receipt?.executionState === 'succeeded' && receipt.operation === 'facebook_job_remove') return 'Jobul Facebook ' + receipt.jobId + ' a fost anulat. Postările deja trimise nu sunt retrase; un pas aflat în execuție la runner poate avea deja efect extern.';
    if (receipt?.executionState === 'succeeded' && receipt.operation === 'facebook_job_update' && typeof receipt.scheduledAt === 'string') {
      const when = bucharestInputFromIso(receipt.scheduledAt);
      return 'Jobul Facebook ' + receipt.jobId + ' a fost reprogramat pentru ' + when.date + ' la ' + when.time + ', ora Bucureștiului. Publicarea nu este încă confirmată.';
    }
    if (receipt?.retry === true) {
      if (receipt.retryBlocked === true) return 'Mesajul ' + receipt.messageId + ' nu a fost repus în coadă: verificările actuale nu permit confirmarea reluării.';
      if (receipt.requeued === true) return 'Mesajul ' + receipt.messageId + ' a fost repus în coadă o singură dată. Livrarea este încă în așteptare.';
      return 'Reluarea mesajului ' + receipt.messageId + ' a fost deja procesată; nu am creat o trimitere suplimentară.';
    }
    if (receipt?.reconciliation === true) return 'Reconciliere: ' + receipt.reconciled + ' mesaje actualizate din confirmările existente; ' + receipt.unresolved + ' rămân cu rezultat necunoscut. Nu am retrimis mesaje.';
    if (receipt?.operation === 'message_send' && receipt.duplicate === true) return 'Proprietatea era deja pusă în coadă pentru client. Nu am creat o nouă trimitere.';
    if (receipt?.operation === 'conversation_sync') {
      if (receipt.status === 'completed' && receipt.complete === true) return 'Sincronizarea s-a încheiat. Mesaje procesate în această rulare: ' + receipt.processed + '. Mesajele deja existente nu au fost duplicate.';
      if (receipt.status === 'partial') return 'Sincronizare parțială. Progresul este salvat; reia sincronizarea pentru paginile rămase.';
      if (receipt.status === 'throttled') return 'Sincronizarea este deja în curs sau a fost cerută prea recent. Nu confirm un import nou.';
      if (receipt.status === 'webhook_only') return 'Canalul primește istoricul prin webhook; nu s-a executat un import manual.';
    }
    if (['conversation_note', 'conversation_update'].includes(String(receipt?.operation)) && receipt?.executionState === 'succeeded' && typeof receipt.conversationId === 'string') {
      if (receipt.state === 'note' && typeof receipt.noteId === 'string') return `Nota internă a fost salvată în conversația ${receipt.conversationId}.`;
      if (receipt.state === 'assigned' && typeof receipt.assigneeId === 'string') return `Conversația ${receipt.conversationId} a fost atribuită agentului ${receipt.assigneeId}.`;
      if (receipt.state === 'property_linked' && typeof receipt.propertyId === 'string') return `Conversația ${receipt.conversationId} a fost asociată proprietății ${receipt.propertyId}.`;
    }
    if (receipt?.operation === 'conversation_update' && receipt.executionState === 'succeeded' && typeof receipt.conversationId === 'string' && ['read', 'open', 'resolved'].includes(String(receipt.state))) return `Conversația ${receipt.conversationId} a fost ${receipt.state === 'read' ? 'marcată citită' : receipt.state === 'resolved' ? 'închisă' : 'redeschisă'}.`;
    if (receipt?.operation === 'message_send' && receipt.queueOutcome === 'not_queued') return `Mesaj nepus în coadă (${receipt.conversationId}): ${receipt.reason}`;
    if (step.kind === 'stop_prospect_followups' && receipt?.executionState === 'succeeded' && Array.isArray(receipt.canceledCallIds) && Array.isArray(receipt.removedTaskIds) && Array.isArray(receipt.activeCallIds)) return receipt.refusalVerified === true
      ? `Pentru prospectul ${receipt.listingId}: ${receipt.canceledCallIds.length} apeluri AI anulate, ${receipt.removedTaskIds.length} taskuri de apel/follow-up eliminate și păstrate în arhivă. Au fost incluse numai taskurile pe care le poți opri.${receipt.activeCallIds.length ? ` ${receipt.activeCallIds.length} apeluri ajunse sau posibil ajunse la furnizor nu au fost oprite.` : ''}`
      : 'Nu există un refuz înregistrat pentru acest prospect. Nu am oprit apeluri sau taskuri.';
    if (step.kind === 'existing_operation' && receipt?.operation === 'message_send' && typeof receipt.messageId === 'string' && receipt.messageId) {
      if (receipt.executionState === 'queued') return `Mesaj pus în coada de trimitere. Livrarea este încă în așteptare. ID: ${receipt.messageId}.`;
      if (receipt.businessStatus === 'accepted') return `Furnizorul a acceptat mesajul; livrarea nu este încă confirmată. ID: ${receipt.messageId}.`;
    }
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
