import { z } from 'zod';
import { idSchema } from './contracts';
import type { AssistantContext } from './access';
import { insightConditionSchema } from './insight-relevance';
import { insightFeedbackRef, savedFeedbackSchema } from './insight-feedback';
import { matchingConditionSchema } from './matching-notifications';
import { ownerWatchConditionSchema } from './owner-watch-notifications';
import { watchFeedbackRef } from './watch-feedback';

export const notificationFeedbackSchema = z.object({ notificationId: idSchema, value: z.enum(['useful', 'not_useful']), expectedRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1) }).strict();

export async function saveNotificationFeedback(ctx: AssistantContext, input: unknown) {
  const { notificationId, value, expectedRevision } = notificationFeedbackSchema.parse(input);
  const ref = ctx.adminDb.collection('users').doc(ctx.uid).collection('notifications').doc(notificationId);
  return ctx.adminDb.runTransaction(async tx => {
    const member = await tx.get(ctx.adminDb.collection('users').doc(ctx.uid));
    if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw Object.assign(new Error('Accesul la notificări s-a schimbat.'), { status: 403 });
    const row = (await tx.get(ref)).data();
    const conditions = row && [row.insightCondition, row.matchingCondition, row.ownerWatchCondition].filter(condition => condition !== undefined);
    const insight = insightConditionSchema.safeParse(row?.insightCondition);
    const matching = matchingConditionSchema.safeParse(row?.matchingCondition);
    const owner = ownerWatchConditionSchema.safeParse(row?.ownerWatchCondition);
    const supported = insight.success || matching.success || owner.success;
    if (!row || row.recipientId !== ctx.uid || row.agencyId !== ctx.agencyId || row.type !== 'ai_assistant' || !row.automationId || conditions?.length !== 1 || !supported) throw Object.assign(new Error('Alerta nu este disponibilă pentru feedback.'), { status: 404 });
    // Feedback concerns the delivered alert, including one since withdrawn. It changes no business state.
    const prior = row.feedback === undefined ? null : savedFeedbackSchema.parse(row.feedback);
    if (prior?.value === value && (prior.revision === expectedRevision || prior.revision === expectedRevision + 1)) return { notificationId, feedback: prior };
    if ((prior?.revision || 0) !== expectedRevision) throw Object.assign(new Error('Feedbackul s-a schimbat. Reîncarcă notificările înainte de a încerca din nou.'), { status: 409 });
    const feedback = { value, revision: expectedRevision + 1, updatedAt: new Date().toISOString() };
    tx.update(ref, { feedback });
    // Watch projections only annotate future results; they never participate in ranking.
    if (insight.success) tx.set(insightFeedbackRef(ctx, insight.data), { actorId: ctx.uid, notificationId, feedback });
    else if (matching.success) tx.set(watchFeedbackRef(ctx, ['matching', matching.data.contactId, matching.data.propertyId]), { actorId: ctx.uid, notificationId, feedback });
    else if (owner.success) tx.set(watchFeedbackRef(ctx, ['owner', owner.data.listingId]), { actorId: ctx.uid, notificationId, feedback });
    return { notificationId, feedback };
  });
}
