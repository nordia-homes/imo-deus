import { z } from 'zod';
export const contextSelectionSchema = z.object({
  messageId: z.string().max(180).optional(), resultSetId: z.string().max(180).optional(),
  source: z.enum(['owners', 'crm', 'properties', 'contacts', 'tasks', 'viewings', 'sales', 'conversations']).optional(),
  positions: z.array(z.number().int().min(1).max(100)).min(1).max(10),
}).strict();
