import { z } from 'zod';
import { collectionFor, type AssistantContext } from './access';
import { stableId } from '@/lib/communications/crypto';
import { recipientRevision } from '@/lib/communications/recipient-revision';
import { canReadConversation, type Conversation } from '@/lib/communications/model';
import { messageOutcome } from './message-outcome';

export const briefDeliverySchema = z.object({
  conversationId: z.string().regex(/^[A-Za-z0-9_.:-]{1,180}$/), requestId: z.string().uuid(),
  messageId: z.string().regex(/^[a-f0-9]{64}$/), recipientRevision: z.string().regex(/^[a-f0-9]{64}$/),
  template: z.object({ name: z.string(), language: z.string(), parameters: z.array(z.string()) }),
});
export async function readBriefDelivery(ctx: AssistantContext, receiptId: string) {
  const unknown = () => ({ status: 'unknown', completionSatisfied: false, note: 'Livrarea brief-ului nu poate fi confirmată. Nu se retrimite automat.', verifiedAt: new Date().toISOString() });
  if (!/^[a-f0-9]{64}$/.test(receiptId)) return unknown();
  return ctx.adminDb.runTransaction(async tx => {
    const receipt = (await tx.get(collectionFor(ctx, 'assistantArtifacts').doc(`brief-${receiptId}`))).data();
    const member = (await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
    if (!receipt || receipt.actorId !== ctx.uid || member?.agencyId !== ctx.agencyId || member?.role !== ctx.role) return unknown();
    if (receipt.channel === 'app') {
      const notification = (await tx.get(ctx.adminDb.collection('users').doc(ctx.uid).collection('notifications').doc(receiptId))).data();
      if (notification?.agencyId !== ctx.agencyId || notification?.recipientId !== ctx.uid || notification?.eventId !== receiptId) return unknown();
      return { status: 'delivered', completionSatisfied: true, note: 'Brief-ul este disponibil în notificările aplicației.', verifiedAt: new Date().toISOString() };
    }
    const parsed = briefDeliverySchema.safeParse(receipt.delivery);
    if (receipt.channel !== 'whatsapp' || !parsed.success) return unknown();
    const delivery = parsed.data;
    if (stableId(ctx.agencyId, delivery.requestId) !== delivery.messageId) return unknown();
    const conversationRef = collectionFor(ctx, 'conversations').doc(delivery.conversationId);
    const raw = (await tx.get(conversationRef)).data();
    const conversation = { ...raw, id: delivery.conversationId, collaboratorIds: Array.isArray(raw?.collaboratorIds) ? raw.collaboratorIds : [] } as Conversation;
    if (!canReadConversation(ctx, conversation) || conversation.channel !== 'whatsapp') return unknown();
    try { if (recipientRevision(conversation) !== delivery.recipientRevision) return unknown(); } catch { return unknown(); }
    const job = (await tx.get(ctx.adminDb.collection('communicationOutboundJobs').doc(delivery.messageId))).data();
    const message = (await tx.get(conversationRef.collection('messages').doc(delivery.messageId))).data();
    if (!message || job?.recipientRevision !== delivery.recipientRevision || job?.input?.requestId !== delivery.requestId) return unknown();
    const outcome = messageOutcome(ctx, delivery.conversationId, { template: delivery.template }, conversation, job, message);
    const status = outcome.completionSatisfied || (outcome.businessStatus !== 'message_identity_unconfirmed' && ['queued', 'sending', 'accepted', 'failed', 'unknown'].includes(outcome.businessStatus)) ? outcome.businessStatus : 'unknown';
    return { status, completionSatisfied: outcome.completionSatisfied, note: outcome.note, verifiedAt: outcome.verifiedAt };
  });
}
