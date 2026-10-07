import { z } from 'zod';
export const sendApprovalSchema = z.object({ amountMicros: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), currency: z.string().regex(/^[A-Z]{3}$/), renderedText: z.string().max(10000), expiresAt: z.number().int().positive().max(Number.MAX_SAFE_INTEGER) }).strip();
export function assertSendApproval(approval: unknown, estimate: { amount: number; currency: string; renderedText: string }, now = Date.now()) {
  const parsed = sendApprovalSchema.safeParse(approval);
  if (!parsed.success || parsed.data.expiresAt <= now || estimate.currency !== parsed.data.currency || !Number.isSafeInteger(estimate.amount) || estimate.amount < 0 || estimate.amount > parsed.data.amountMicros || estimate.renderedText !== parsed.data.renderedText) throw new Error('Costul, conținutul sau valabilitatea aprobării s-a schimbat. Pregătește din nou mesajul pentru aprobare.');
}
