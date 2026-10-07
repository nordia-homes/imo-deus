import { z } from 'zod';
import { idSchema } from './contracts';
import type { AssistantContext } from './access';
import { insightConditionSchema } from './insight-relevance';

const feedbackSchema = z.object({ value: z.enum(['useful', 'not_useful']), revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER), updatedAt: z.string().datetime() }).strict();
export const notificationFeedbackSchema = z.object({ notificationId: idSchema, value: z.enum(['useful', 'not_useful']), expectedRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER - 1) }).strict();

export async function saveNotificationFeedback(ctx: AssistantContext, input: unknown) {
  const { notificationId, value, expectedRevision } = notificationFeedbackSchema.parse(input);
  const ref = ctx.adminDb.collection('users').doc(ctx.uid).collection('notifications').doc(notificationId);
  return ctx.adminDb.runTransaction(async tx => {
    const member = await tx.get(ctx.adminDb.collection('users').doc(ctx.uid));
    if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw Object.assign(new Error('Accesul la notificări s-a schimbat.'), { status: 403 });
    const row = (await tx.get(ref)).data();
    if (!row || row.recipientId !== ctx.uid || row.agencyId !== ctx.agencyId || row.type !== 'ai_assistant' || !row.automationId || !insightConditionSchema.safeParse(row.insightCondition).success) throw Object.assign(new Error('Alerta nu este disponibilă pentru feedback.'), { status: 404 });
    // Feedback concerns the delivered alert, including one since withdrawn. It changes no business state.
    const prior = row.feedback === undefined ? null : feedbackSchema.parse(row.feedback);
    if (prior?.value === value && (prior.revision === expectedRevision || prior.revision === expectedRevision + 1)) return { notificationId, feedback: prior };
    if ((prior?.revision || 0) !== expectedRevision) throw Object.assign(new Error('Feedbackul s-a schimbat. Reîncarcă notificările înainte de a încerca din nou.'), { status: 409 });
    const feedback = { value, revision: expectedRevision + 1, updatedAt: new Date().toISOString() };
    tx.update(ref, { feedback });
    return { notificationId, feedback };
  });
}
