import { getResource, type AssistantContext } from './access';
import { checkWhatsAppRecipient } from './whatsapp-recipient-check';
import { invokeOperation } from './operations';

export type WhatsAppTemplateRow = {
  id: string; name: string; language: string; status: string; category: string;
  bodyParameterCount: number; bodyText: string; supported: boolean; approvedAndSupported: boolean;
};

export async function checkWhatsAppTemplates(ctx: AssistantContext, conversationId: string) {
  const recipient = await checkWhatsAppRecipient(ctx, conversationId);
  const consent = recipient.rows[0].consent;
  const common = { conversationId, consent, sendAuthorized: false, complete: true,
    note: 'Citire de șabloane, fără trimitere sau înregistrare de acord. Costul și eligibilitatea mesajului concret necesită previzualizare.' };
  if (recipient.blocked || !['service', 'marketing'].some(scope => consent[scope] === 'granted')) {
    return { ...common, rows: [], status: recipient.blocked ? 'blocked' : 'consent_missing',
      reason: recipient.blocked ? 'Destinatarul a retras acordul WhatsApp.' : 'Nu există acord înregistrat pentru serviciu sau marketing. Expresia „după acord” nu înregistrează acordul.' };
  }
  const conversation = await getResource(ctx, 'conversations', conversationId);
  const result = await invokeOperation(ctx, { operation: 'whatsapp_templates', params: { connectionId: conversation.connectionId }, query: {}, body: {} });
  if (!Array.isArray(result.data)) throw new Error('Lista șabloanelor nu a fost confirmată.');
  // The domain handler computes support for parameters/components; Meta owns approval.
  const rows: WhatsAppTemplateRow[] = result.data.map((template: Record<string, any>) => ({
    id: `${template.name}:${template.language}`, name: template.name, language: template.language,
    status: template.status, category: template.category, bodyParameterCount: template.bodyParameterCount,
    bodyText: String(template.components?.find((component: Record<string, any>) => component.type?.toUpperCase() === 'BODY')?.text || ''),
    supported: template.sendable === true,
    approvedAndSupported: template.status === 'APPROVED' && template.sendable === true,
  }));
  return { ...common, rows, status: 'checked', connectionId: conversation.connectionId,
    availableCount: rows.filter((row: { approvedAndSupported: boolean }) => row.approvedAndSupported).length };
}
