import { z } from 'zod';
import { idSchema } from './contracts';
export const matchingRecipientSchema = z.object({ resultSetId: idSchema, messageId: idSchema.optional(), position: z.number().int().min(1).max(100), conversationId: idSchema.optional(), channel: z.enum(['whatsapp', 'messenger', 'instagram']).optional() }).strict();
