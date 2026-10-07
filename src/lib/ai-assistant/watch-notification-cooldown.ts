import { createHash } from 'node:crypto';
import type { Transaction } from 'firebase-admin/firestore';
import type { AssistantContext } from './access';

export async function readWatchCooldown(ctx: AssistantContext, tx: Transaction, identity: ['owner', string] | ['matching', string, string]) {
  const key = createHash('sha256').update(JSON.stringify([ctx.uid, ...identity])).digest('hex');
  const ref = ctx.adminDb.collection('agencies').doc(ctx.agencyId).collection('assistantNotificationState').doc(`watch-cooldown-${key}`);
  const snapshot = await tx.get(ref), row = snapshot.data(), now = Date.now();
  if (snapshot.exists && (row?.actorId !== ctx.uid || !Number.isSafeInteger(row.lastDeliveredAt) || row.lastDeliveredAt < 0 || row.lastDeliveredAt > now)) throw new Error('Pauza dintre alerte nu poate fi verificată.');
  const next = snapshot.exists ? row!.lastDeliveredAt + 86400000 : 0;
  return {
    skipped: next > now ? { status: 'skipped', reasonCode: 'cooldown', nextEligibleAt: new Date(next).toISOString(), cooldownMinutes: 1440 } : null,
    consume() { const value = { actorId: ctx.uid, lastDeliveredAt: now }; if (snapshot.exists) tx.update(ref, value); else tx.create(ref, value); },
  };
}
