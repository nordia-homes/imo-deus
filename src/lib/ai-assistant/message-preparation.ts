import { randomUUID } from 'node:crypto';
import { queueMessage } from '@/lib/communications/outbound';
import { sendApprovalSchema } from '@/lib/communications/send-approval';
import type { AssistantContext } from './access';

export async function prepareMessage(ctx: AssistantContext, conversationId: string, body: Record<string, unknown>) {
  // The quote is derived by the domain service, never accepted from model input.
  const { sendApproval: _supplied, ...content } = body;
  const preview = await queueMessage(ctx.adminDb, ctx, conversationId, { ...content, requestId: randomUUID() }, true);
  if (!('estimate' in preview)) throw new Error('Previzualizarea mesajului nu a fost confirmată.');
  const sendApproval = sendApprovalSchema.parse({ ...preview.estimate, renderedText: preview.renderedText, expiresAt: Date.now() + 3600000 });
  return { ...content, sendApproval };
}
