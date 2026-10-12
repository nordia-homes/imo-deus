import { randomUUID } from 'node:crypto';
import { queueMessage } from '@/lib/communications/outbound';
import { sendApprovalSchema } from '@/lib/communications/send-approval';
import type { AssistantContext } from './access';
import { recordProspectingConsent } from './prospecting-consent';

export async function prepareMessage(ctx: AssistantContext, conversationId: string, body: Record<string, unknown>) {
  // The quote is derived by the domain service, never accepted from model input.
  const { sendApproval: _supplied, prospectingListingId, prospectingConsentReceiptId: _receipt, ...content } = body;
  // Explicit contact requests attest prior phone consent even if the later quote fails.
  const receipt = prospectingListingId !== undefined && content.template
    ? await recordProspectingConsent(ctx, conversationId, String(prospectingListingId), String(content.expectedRecipientRevision || '')) : undefined;
  const preview = await queueMessage(ctx.adminDb, ctx, conversationId, { ...content, requestId: randomUUID() }, true);
  if (!('estimate' in preview) || !preview.estimate) throw new Error('Previzualizarea mesajului nu a fost confirmată.');
  if (receipt && preview.estimate.category !== 'marketing') throw new Error('Prospectarea necesită un șablon aprobat din categoria marketing.');
  const sendApproval = sendApprovalSchema.parse({ ...preview.estimate, renderedText: preview.renderedText, expiresAt: Date.now() + 3600000 });
  return { ...content, sendApproval, ...(receipt ? { prospectingConsentReceiptId: receipt } : {}) };
}
