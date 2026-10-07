import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { AssistantContext } from './access';
import { insightConditionFor, type InsightCondition } from './insight-relevance';

export const savedFeedbackSchema = z.object({ value: z.enum(['useful', 'not_useful']), revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER), updatedAt: z.string().datetime() }).strict();
export function insightFeedbackRef(ctx: AssistantContext, condition: InsightCondition) {
  const identity = JSON.stringify([ctx.uid, condition.kind, [condition.id, ...(condition.otherId ? [condition.otherId] : [])].sort()]);
  return ctx.adminDb.collection('agencies').doc(ctx.agencyId).collection('assistantNotificationState').doc(`feedback-${createHash('sha256').update(identity).digest('hex')}`);
}

// Only enrich already-authorized, selected priorities; feedback never suppresses an active issue.
export async function annotateInsightFeedback(ctx: AssistantContext, rows: Record<string, unknown>[]) {
  if (!rows.length) return rows;
  return ctx.adminDb.runTransaction(async tx => {
    const member = await tx.get(ctx.adminDb.collection('users').doc(ctx.uid));
    if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw Object.assign(new Error('Accesul la priorități s-a schimbat.'), { status: 403 });
    return Promise.all(rows.map(async row => {
      const snapshot = await tx.get(insightFeedbackRef(ctx, insightConditionFor(row)));
      if (!snapshot.exists) return row;
      const data = snapshot.data()!;
      if (data.actorId !== ctx.uid) throw new Error('Evaluarea priorității nu poate fi verificată.');
      const feedback = savedFeedbackSchema.parse(data.feedback);
      return { ...row, previousFeedback: feedback.value, feedbackUpdatedAt: feedback.updatedAt, feedbackNote: `Ai evaluat anterior o alertă pentru această prioritate ca ${feedback.value === 'useful' ? 'utilă' : 'neutilă'}. Problema este încă activă; evaluarea nu îi schimbă urgența.` };
    }));
  });
}
