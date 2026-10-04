import { AsyncLocalStorage } from 'node:async_hooks';
import type { AssistantContext } from './access';
const principal = new AsyncLocalStorage<AssistantContext>();
export const INTERNAL_PRINCIPAL_HEADER = 'Bearer jarvis-service-principal';
export function withAssistantPrincipal<T>(ctx: AssistantContext, work: () => Promise<T>) { return principal.run(ctx, work); }
export async function assistantPrincipal(header: string | null | undefined) {
  if (header !== INTERNAL_PRINCIPAL_HEADER) return null;
  const ctx = principal.getStore(); if (!ctx) return null;
  const member = (await ctx.adminDb.collection('users').doc(ctx.uid).get()).data();
  if (member?.agencyId !== ctx.agencyId || member?.role !== ctx.role || !['agent', 'admin'].includes(ctx.role || '')) throw new Error('Principal revoked');
  return ctx;
}
