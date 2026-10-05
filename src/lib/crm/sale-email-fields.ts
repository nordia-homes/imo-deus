import { z } from 'zod';
export const saleEmailFields = {
  saleId: z.string().min(1).max(180).regex(/^[^/]+$/),
  to: z.array(z.string().email()).min(1).max(20), cc: z.array(z.string().email()).max(20).default([]), bcc: z.array(z.string().email()).max(20).default([]),
  subject: z.string().trim().min(1).max(500), bodyText: z.string().trim().min(1).max(30000), bodyHtml: z.string().max(60000).optional(),
  questions: z.array(z.object({ id: z.string().min(1).max(180), text: z.string().max(2000), required: z.boolean(), status: z.literal('pending').default('pending') }).strict()).max(30).default([]),
  documentIds: z.array(z.string().min(1).max(180).regex(/^[^/]+$/)).max(20).default([]), attachmentNames: z.array(z.string().max(300)).max(20).default([]),
};
