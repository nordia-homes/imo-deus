import { isDeepStrictEqual } from 'node:util';
import { assertRecipientRevision } from '@/lib/communications/recipient-revision';

// Compare the immutable outbound job input, including template parameters and
// attachment identity. Never use matching text alone as a delivery receipt.
export function messageOutcome(actor: { uid: string; agencyId: string }, conversationId: string, body: Record<string, unknown>, conversation: Record<string, any>, job: Record<string, any> | undefined, message: Record<string, any>) {
  const evidence = (executionState: string, businessStatus: string, completionSatisfied: boolean, watchable: boolean, note: string) => ({ executionState, businessStatus, completionSatisfied, watchable, note, evidenceSource: 'current_domain_state', verifiedAt: new Date().toISOString() });
  const template = (value: any) => value ? { name: value.name, language: value.language, parameters: value.parameters || [] } : null;
  if (body.sendApproval !== undefined && !isDeepStrictEqual(body.sendApproval, job?.input?.sendApproval)) return evidence('unknown', 'message_identity_unconfirmed', false, false, 'Condițiile aprobate nu corespund jobului de trimitere. Mesajul nu este retrimis automat.');
  if (body.expectedRecipientRevision !== undefined) {
    try {
      assertRecipientRevision(conversation, body.expectedRecipientRevision);
      if (job?.recipientRevision !== body.expectedRecipientRevision || job?.input?.expectedRecipientRevision !== body.expectedRecipientRevision) throw new Error('Recipient mismatch');
    } catch { return evidence('unknown', 'message_identity_unconfirmed', false, false, 'Identitatea destinatarului aprobat nu mai poate fi confirmată. Mesajul nu este retrimis automat.'); }
  }
  const identityMatches = job?.agencyId === actor.agencyId && job?.uid === actor.uid && job?.conversationId === conversationId && job?.connectionId === conversation.connectionId && message.agencyId === actor.agencyId && message.conversationId === conversationId && message.authorId === actor.uid && message.direction === 'sent' && message.origin === 'imodeus';
  const inputMatches = identityMatches && job?.input && job.input.text === (typeof body.text === 'string' ? body.text.trim() : '') && (job.input.attachmentId || null) === (body.attachmentId || null) && isDeepStrictEqual(template(job.input.template), template(body.template));
  if (!inputMatches) return evidence('unknown', 'message_identity_unconfirmed', false, false, 'Mesajul nu poate fi legat de conversația, autorul și conținutul aprobate. Nu se retrimite automat.');
  const status = String(message.status || 'unknown');
  if (['delivered', 'read'].includes(status) && typeof message.externalId === 'string' && message.externalId.length > 0) return evidence('succeeded', status, true, false, status === 'read' ? 'Canalul confirmă citirea mesajului identificat.' : 'Canalul confirmă livrarea mesajului identificat; citirea nu este confirmată.');
  if (status === 'failed') return evidence('failed', status, false, false, 'Trimiterea a eșuat. Mesajul nu este retrimis automat.');
  if (['queued', 'sending', 'accepted', 'unknown'].includes(status)) return evidence(['queued', 'accepted'].includes(status) ? 'queued' : status === 'sending' ? 'running' : 'unknown', status, false, true, 'Mesajul este în procesare sau acceptat de canal; livrarea nu este încă verificată.');
  return evidence('unknown', status, false, false, 'Nu există o dovadă verificabilă de livrare pentru mesajul aprobat.');
}
