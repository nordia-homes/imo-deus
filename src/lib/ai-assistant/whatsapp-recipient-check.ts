import { getResource, type AssistantContext } from './access';
import { stableId } from '@/lib/communications/crypto';
import { withinResponseWindow } from '@/lib/communications/model';

export async function checkWhatsAppRecipient(ctx: AssistantContext, conversationId: string) {
  const conversation = await getResource(ctx, 'conversations', conversationId);
  if (conversation.channel !== 'whatsapp') throw new Error('Selectează o conversație WhatsApp.');
  if (!conversation.connectionId || !conversation.externalParticipantId) throw new Error('Identitatea destinatarului este incompletă.');
  const consents = ctx.adminDb.collection('agencies').doc(ctx.agencyId).collection('communicationConsents');
  const states = await Promise.all(['all', 'service', 'marketing'].map(async scope => {
    const row = await consents.doc(stableId(conversation.connectionId, conversation.externalParticipantId, scope)).get();
    const status = row.data()?.status;
    return [scope, status === 'granted' || status === 'revoked' ? status : 'unknown'] as const;
  }));
  const consent = Object.fromEntries(states);
  const blocked = consent.all === 'revoked';
  const humanConsent = { url: '/inbox?conversationId=' + encodeURIComponent(conversationId), panel: 'Consimțământ WhatsApp', requiredRole: 'agent_or_admin', canRecord: ['agent', 'admin'].includes(ctx.role || ''), evidenceRequired: true, recordedByJarvis: false };
  return { rows: [{ id: conversationId, name: conversation.name || null, channel: 'whatsapp', consent, humanConsent, withinWindow: withinResponseWindow(conversation.lastInboundAt), status: blocked ? 'blocked' : 'needs_message_preview' }], complete: true, blocked, sendAuthorized: false,
    reason: blocked ? 'Destinatarul a cerut oprirea mesajelor WhatsApp. Nu trimite.' : 'Fără refuz global înregistrat. Eligibilitatea depinde de mesaj, categoria șablonului, acordul corespunzător, conexiune și cost; este necesară previzualizarea mesajului concret.',
    note: 'Verificare locală, fără trimitere sau înregistrare de acord. Numărul public nu dovedește acordul. unknown nu înseamnă granted. Chiar dacă există acord, această cerere nu autorizează trimiterea.' };
}
