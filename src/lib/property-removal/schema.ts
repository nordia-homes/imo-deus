import { z } from 'zod';

export const removalSchema = z.object({
  propertyId: z.string().regex(/^[A-Za-z0-9_-]{1,150}$/),
  reason: z.enum(['not_interesting', 'collaboration_ended', 'sold']),
  soldDisposition: z.enum(['agency', 'other_agency', 'owner']).optional(),
  soldPrice: z.number().finite().positive().max(1e12).optional(),
  agentMessage: z.string().trim().max(4000),
}).strict().superRefine((value, ctx) => {
  if (value.reason === 'sold' && (!value.soldDisposition || !value.soldPrice)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Completează prețul și autorul vânzării.' });
  }
});
export type RemovalInput = z.infer<typeof removalSchema>;
export type PortalRemovalResult = { portal: string; state: 'withdrawn' | 'pending' | 'error'; message: string };
export type RemovalResult = { complete: boolean; outcome?: 'sold' | 'deleted'; portals: PortalRemovalResult[] };
