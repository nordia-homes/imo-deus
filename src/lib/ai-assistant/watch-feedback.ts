import { createHash } from 'node:crypto';
import type { AssistantContext } from './access';
import { idSchema } from './contracts';
import { savedFeedbackSchema } from './insight-feedback';

type WatchIdentity = ['owner', string] | ['matching', string, string];
export function watchFeedbackRef(ctx: AssistantContext, identity: WatchIdentity) {
  identity.slice(1).forEach(id => idSchema.parse(id));
  const hash = createHash('sha256').update(JSON.stringify([ctx.uid, ...identity])).digest('hex');
  return ctx.adminDb.collection('agencies').doc(ctx.agencyId).collection('assistantNotificationState').doc(`watch-feedback-${hash}`);
}

// Called only for authorized result rows, never for candidate selection or notification delivery.
export async function annotateWatchFeedback<T extends Record<string, unknown>>(ctx: AssistantContext, rows: T[], contactId?: string): Promise<T[]> {
  if (!rows.length) return rows;
  return ctx.adminDb.runTransaction(async tx => {
    const member = await tx.get(ctx.adminDb.collection('users').doc(ctx.uid));
    if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw Object.assign(new Error('Accesul la rezultate s-a schimbat.'), { status: 403 });
    return Promise.all(rows.map(async row => {
      const id = idSchema.parse(row.id);
      const identity: WatchIdentity = contactId === undefined ? ['owner', id] : ['matching', contactId, id];
      const snapshot = await tx.get(watchFeedbackRef(ctx, identity));
      if (!snapshot.exists) return row;
      const data = snapshot.data()!;
      if (data.actorId !== ctx.uid) throw new Error('Evaluarea alertei nu poate fi verificată.');
      const feedback = savedFeedbackSchema.parse(data.feedback);
      return { ...row, previousAlertFeedback: feedback.value, alertFeedbackUpdatedAt: feedback.updatedAt,
        feedbackNote: `Ai evaluat o alertă anterioară pentru ${contactId === undefined ? 'acest anunț' : 'această pereche client–proprietate'} ca ${feedback.value === 'useful' ? 'utilă' : 'neutilă'} (${feedback.updatedAt}). Este evaluarea alertei de atunci; nu evaluează oferta actuală și nu schimbă scorul, ordinea rezultatelor sau frecvența alertelor.` };
    }));
  });
}
