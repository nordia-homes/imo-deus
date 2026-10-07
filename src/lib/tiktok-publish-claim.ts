import type { Firestore } from 'firebase-admin/firestore';
import type { TikTokPostDraft } from './types';
import { assertTikTokSchedule } from './tiktok-schedule-revision';

export type TikTokPublishInput = { agencyId: string; draftId: string; requestedByUid: string; fromSchedule?: boolean; scheduleOwner?: string };

/** Claim the concrete content before any provider or media request. */
export async function claimTikTokPublication(db: Firestore, input: TikTokPublishInput): Promise<TikTokPostDraft> {
  const ref = db.collection('agencies').doc(input.agencyId).collection('tiktokPostDrafts').doc(input.draftId);
  return db.runTransaction(async tx => {
    const [snapshot, member] = await Promise.all([tx.get(ref), tx.get(db.collection('users').doc(input.requestedByUid))]);
    if (!snapshot.exists) throw new Error('Draftul TikTok nu a fost gasit.');
    const current = { ...snapshot.data(), id: snapshot.id } as TikTokPostDraft;
    if (member.data()?.agencyId !== input.agencyId || current.agencyId !== input.agencyId || current.createdByUid !== input.requestedByUid) throw new Error('Accesul autorului la postarea TikTok nu mai este valid.');
    if (input.fromSchedule) {
      const job = await tx.get(db.collection('tiktokStudioJobs').doc(`publish_${input.agencyId}_${input.draftId}`));
      assertTikTokSchedule(current, job.data(), { agencyId: input.agencyId, uid: input.requestedByUid, draftId: input.draftId, owner: input.scheduleOwner || '' });
    }
    if (current.scheduleStatus === 'scheduled' && !input.fromSchedule) throw new Error('Postarea este programată. Anulează programarea înainte de publicarea manuală.');
    if (current.publishId || current.publishOutcomeUnknown || current.manualReviewRequired || ['publishing', 'processing', 'published'].includes(current.status)) throw new Error('Publicarea a fost deja inițiată. Verifică starea fără a retrimite.');
    if (!current.description?.trim() || !current.videoTourUrl || !current.consentedAt) throw new Error('Completează postarea și confirmă acordul pentru publicare.');
    if (current.brandContent && current.privacyLevel === 'SELF_ONLY') throw new Error('Parteneriatul plătit nu poate fi publicat privat.');
    const now = new Date().toISOString();
    tx.update(ref, { status: 'publishing', updatedAt: now, lastStatusCheckedAt: now });
    return current;
  });
}
