import { z } from 'zod';
export const emailTemplateOverrideSchema = z.object({
  name: z.string().trim().min(1).max(160), description: z.string().max(500),
  recipientRole: z.enum(['buyer', 'owner', 'notary', 'collaborator']),
  stage: z.enum(['any', 'preparing', 'reservation', 'precontract', 'contract', 'completed', 'blocked', 'cancelled']),
  subject: z.string().trim().min(1).max(500), body: z.string().trim().min(1).max(30000),
  bodyHtml: z.string().max(60000), defaultCc: z.array(z.string().email()).max(20),
  defaultQuestions: z.array(z.string().max(2000)).max(20),
}).strict();
