import { createHash } from 'node:crypto';
import type { Transaction } from 'firebase-admin/firestore';
import type { AssistantContext } from './access';
import { insightCooldownMinutesSchema } from './insight-notification-policy';

export async function readWatchCooldown(ctx: AssistantContext, tx: Transaction, identity: ['owner', string] | ['matching', string, string], requestedMinutes = 1440) {
  const cooldownMinutes = insightCooldownMinutesSchema.parse(requestedMinutes);
  const key = createHash('sha256').update(JSON.stringify([ctx.uid, ...identity])).digest('hex');
  const ref = ctx.adminDb.collection('agencies').doc(ctx.agencyId).collection('assistantNotificationState').doc(`watch-cooldown-${key}`);
  const snapshot = await tx.get(ref), row = snapshot.data(), now = Date.now();
  if (snapshot.exists && (row?.actorId !== ctx.uid || !Number.isSafeInteger(row.lastDeliveredAt) || row.lastDeliveredAt < 0 || row.lastDeliveredAt > now)) throw new Error('Pauza dintre alerte nu poate fi verificată.');
  // A shorter new configuration must not bypass the pause promised by the previous delivery.
  const effectiveMinutes = snapshot.exists ? Math.max(cooldownMinutes, insightCooldownMinutesSchema.parse(row!.cooldownMinutes)) : cooldownMinutes;
  const next = snapshot.exists ? row!.lastDeliveredAt + effectiveMinutes * 60000 : 0;
  return {
    skipped: next > now ? { status: 'skipped', reasonCode: 'cooldown', nextEligibleAt: new Date(next).toISOString(), cooldownMinutes: effectiveMinutes } : null,
    consume() { const value = { actorId: ctx.uid, lastDeliveredAt: now, cooldownMinutes }; if (snapshot.exists) tx.update(ref, value); else tx.create(ref, value); },
  };
}
