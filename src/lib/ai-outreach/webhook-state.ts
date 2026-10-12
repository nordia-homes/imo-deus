import type { DocumentReference, Firestore } from 'firebase-admin/firestore';

// Provider events may arrive twice or out of order. A later event without a
// refusal is not evidence that the owner has withdrawn an earlier refusal.
export async function persistOutreachWebhook(db: Firestore, callRef: DocumentReference, update: Record<string, any>) {
  const identity = await db.runTransaction(async tx => {
    const call = await tx.get(callRef);
    if (!call.exists) return null;
    const current = call.data()!;
    const agencyId = callRef.parent.parent?.id;
    if (!agencyId || current.agencyId !== agencyId || typeof current.ownerListingId !== 'string') throw new Error('Invalid outreach call identity');
    const ownerRef = db.collection('agencies').doc(agencyId).collection('aiOutreachOwnerListingStatuses').doc(current.ownerListingId);
    const owner = await tx.get(ownerRef);
    const refused = owner.data()?.aiDoNotCall === true || current.result?.doNotCall === true || current.outcome === 'do_not_call' || update.result?.doNotCall === true;
    const lateStart = update.status === 'calling' && ['completed', 'canceled', 'failed'].includes(current.status);
    if (!lateStart) {
      const patch = { ...update };
      if (current.result?.doNotCall === true || current.outcome === 'do_not_call') {
        if (patch.result) patch.result = { ...patch.result, doNotCall: true };
        patch.outcome = 'do_not_call';
      }
      tx.set(callRef, patch, { merge: true });
      if (!owner.data()?.latestAiCallId || owner.data()?.latestAiCallId === callRef.id) tx.set(ownerRef, {
        agencyId, ownerListingId: current.ownerListingId, latestAiCallId: callRef.id,
        ...(patch.status ? { aiOutreachStatus: patch.status, aiOutreachOutcome: patch.outcome } : {}),
        aiOutreachUpdatedAt: update.updatedAt, updatedAt: update.updatedAt,
        ...(patch.result ? { aiCollaborationStatus: patch.result.collaborationStatus, aiAcceptedCommissionValue: patch.result.acceptedCommissionValue || null } : {}),
      }, { merge: true });
    }
    if (refused) tx.set(ownerRef, { aiDoNotCall: true, aiNextFollowUpAt: null, updatedAt: update.updatedAt }, { merge: true });
    return { agencyId, ownerListingId: current.ownerListingId, refused };
  });
  if (!identity?.refused) return;
  const agency = db.collection('agencies').doc(identity.agencyId);
  const ownerRef = agency.collection('aiOutreachOwnerListingStatuses').doc(identity.ownerListingId);
  const pending = await agency.collection('aiOutreachCalls').where('ownerListingId', '==', identity.ownerListingId).get();
  for (const doc of pending.docs) {
    if (!['queued', 'scheduled'].includes(doc.data().status)) continue;
    await db.runTransaction(async tx => {
      const [call, owner] = await Promise.all([tx.get(doc.ref), tx.get(ownerRef)]);
      const row = call.data();
      if (!owner.data()?.aiDoNotCall || !row || !['queued', 'scheduled'].includes(row.status) || row.providerDispatchStartedAt || row.vapiCallId) return;
      const updatedAt = new Date().toISOString();
      tx.update(doc.ref, { status: 'canceled', outcome: 'uncalled', providerErrorCode: 'owner_do_not_call', providerErrorMessage: 'Proprietarul a refuzat contactarea. Follow-up-ul AI a fost oprit.', updatedAt });
      if (owner.data()?.latestAiCallId === doc.id) tx.set(ownerRef, { aiOutreachStatus: 'canceled', aiOutreachOutcome: 'uncalled', aiOutreachUpdatedAt: updatedAt, updatedAt }, { merge: true });
    });
  }
}
