import { createHash } from 'node:crypto';
export function saleEmailContentHash(message: Record<string, any>) {
  return createHash('sha256').update(JSON.stringify({ saleId: message.saleId, to: message.to, cc: message.cc || [], bcc: message.bcc || [], subject: message.subject, bodyText: message.bodyText, bodyHtml: message.bodyHtml || '', questions: message.questions || [], documentIds: message.documentIds || [], attachmentRefs: message.attachmentRefs || [], handoffJobId: message.handoffJobId })).digest('hex');
}
