import { randomUUID } from 'node:crypto';
import type { AssistantContext } from '@/lib/ai-assistant/access';

export function authProfileOutbox(ctx: AssistantContext, userId: string) { return ctx.adminDb.collection('authProfileSync').doc(userId); }
export function pendingAuthProfile(ctx: AssistantContext, userId: string, revision: string, previous?: Record<string, any>) {
  return { userId, agencyId: ctx.agencyId, requestedBy: ctx.uid, revision, status: previous?.status === 'running' && previous.leaseUntil > Date.now() ? 'running' : 'pending', ...(previous?.status === 'running' && previous.leaseUntil > Date.now() ? { claimId: previous.claimId, leaseUntil: previous.leaseUntil } : {}), updatedAt: revision, errorCategory: null };
}
// CRM has committed already. Auth is a separate system: failures remain durable.
export async function syncAuthProfile(ctx: AssistantContext, userId: string) {
  const ref = authProfileOutbox(ctx, userId), claimId = randomUUID();
  const claim = await ctx.adminDb.runTransaction(async tx => {
    const [outbox, user] = await Promise.all([tx.get(ref), tx.get(ctx.adminDb.collection('users').doc(userId))]);
    const row = outbox.data();
    if (!row || row.status === 'completed' || row.status === 'running' && row.leaseUntil > Date.now()) return null;
    if (user.data()?.agencyId !== row.agencyId || !['agent', 'admin'].includes(user.data()?.role)) return null;
    tx.update(ref, { status: 'running', claimId, leaseUntil: Date.now() + 300000 });
    return { revision: row.revision, name: String(user.data()?.name || '') };
  });
  if (!claim) return 'pending';
  let status = 'completed', errorCategory: string | null = null;
  try { await ctx.adminAuth.updateUser(userId, { displayName: claim.name }); }
  catch { status = 'pending'; errorCategory = 'auth_profile_update_failed'; }
  await ctx.adminDb.runTransaction(async tx => {
    const fresh = await tx.get(ref);
    if (fresh.data()?.claimId === claimId) tx.update(ref, { status: fresh.data()?.revision === claim.revision ? status : 'pending', errorCategory, leaseUntil: 0, attemptedAt: new Date().toISOString() });
    // A newer edit invalidates the claim; its pending job remains untouched.
  });
  return status;
}

export async function deleteAuthAccount(ctx: AssistantContext, userId: string) {
  const ref = ctx.adminDb.collection('authAccountDeletions').doc(userId), claimId = randomUUID();
  const claimed = await ctx.adminDb.runTransaction(async tx => {
    const [job, user] = await Promise.all([tx.get(ref), tx.get(ctx.adminDb.collection('users').doc(userId))]);
    if (!job.exists || job.data()?.agencyId !== ctx.agencyId || user.exists) return 'pending';
    if (job.data()?.status === 'completed') return 'completed';
    if (job.data()?.status === 'running' && job.data()?.leaseUntil > Date.now()) return 'pending';
    tx.update(ref, { status: 'running', claimId, leaseUntil: Date.now() + 300000 }); return 'claimed';
  });
  if (claimed !== 'claimed') return claimed;
  let status = 'completed';
  try { await ctx.adminAuth.deleteUser(userId); }
  catch (error) { if ((error as { code?: string }).code !== 'auth/user-not-found') status = 'pending'; }
  await ctx.adminDb.runTransaction(async tx => {
    const fresh = await tx.get(ref);
    if (fresh.data()?.claimId === claimId) tx.update(ref, { status, leaseUntil: 0, attemptedAt: new Date().toISOString(), errorCategory: status === 'pending' ? 'auth_account_delete_failed' : null });
  });
  return status;
}
