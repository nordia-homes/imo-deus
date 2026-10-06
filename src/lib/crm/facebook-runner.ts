import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { collectionFor, type AssistantContext } from '@/lib/ai-assistant/access';
import { CommunicationError } from '@/lib/communications/server';
export const runnerGroupSchema = z.object({ groupIndex: z.number().int().min(0).max(499), expectedStatus: z.enum(['pending', 'opened', 'posted', 'skipped']), status: z.enum(['opened', 'posted', 'skipped']) }).strict();
export const runnerSkipSchema = runnerGroupSchema.extend({ status: z.literal('skipped') });
export async function readLegacyRunner(ctx: AssistantContext, jobId: string) {
  const [member, job] = await Promise.all([ctx.adminDb.collection('users').doc(ctx.uid).get(), collectionFor(ctx, 'facebookPromotionJobs').doc(jobId).get()]);
  if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new CommunicationError('Acces revocat.', 403);
  if (!job.exists || job.data()?.createdBy !== ctx.uid) throw new CommunicationError('Sesiune Facebook inaccesibilă.', 404);
  const row = job.data()!;
  return { id: job.id, propertyId: row.propertyId, propertyTitle: row.propertyTitle, groups: row.groups, status: row.status, updatedAt: row.lastUpdatedAt || row.createdAt, evidence: 'manual_runner_state_not_provider_receipt', handoffUrl: '/facebook-promotion-runner' };
}
export async function updateLegacyRunner(ctx: AssistantContext, jobId: string, input: z.infer<typeof runnerGroupSchema>, source: 'human_callback' | 'assistant_skip') {
  if (source === 'assistant_skip' && input.status !== 'skipped') throw new CommunicationError('Deschiderea și publicarea manuală necesită confirmare pe dispozitiv.', 400);
  const ref = collectionFor(ctx, 'facebookPromotionJobs').doc(jobId), eventId = 'runner-' + randomUUID();
  return ctx.adminDb.runTransaction(async tx => {
    const [member, job] = await Promise.all([tx.get(ctx.adminDb.collection('users').doc(ctx.uid)), tx.get(ref)]);
    if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role || !['admin', 'agent'].includes(ctx.role || '')) throw new CommunicationError('Acces revocat.', 403);
    if (!job.exists || job.data()?.createdBy !== ctx.uid) throw new CommunicationError('Sesiune Facebook inaccesibilă.', 404);
    const row = job.data()!, groups = [...(row.groups || [])], group = groups[input.groupIndex];
    if (!group) throw new CommunicationError('Grupul nu mai există.', 404);
    // A repeated report must not undo a later transition.
    if (group.status === input.status) return { groups, status: row.status, evidence: 'manual_runner_state_not_provider_receipt' };
    if (group.status !== input.expectedStatus || ['posted', 'skipped'].includes(group.status)) throw new CommunicationError('Starea grupului s-a schimbat. Reîncarcă sesiunea.', 409);
    groups[input.groupIndex] = { ...group, status: input.status };
    const status = groups.every(item => ['posted', 'skipped'].includes(item.status)) ? 'completed' : groups.some(item => item.status !== 'pending') ? 'in_progress' : 'pending';
    const now = new Date().toISOString();
    tx.update(ref, { groups, status, lastUpdatedAt: now, lastAction: input.status });
    tx.create(collectionFor(ctx, 'crmEvents').doc(eventId), { id: eventId, actorId: ctx.uid, agencyId: ctx.agencyId, source, capability: 'facebook_runner_group', occurredAt: now, recordedAt: now, entities: { propertyId: row.propertyId, jobId }, result: { groupIndex: input.groupIndex, status: input.status }, evidence: input.status === 'posted' ? 'human_attestation_not_provider_receipt' : 'manual_runner_state' });
    return { groups, status, updatedAt: now, evidence: 'manual_runner_state_not_provider_receipt' };
  });
}
