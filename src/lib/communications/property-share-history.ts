import type { Firestore } from 'firebase-admin/firestore';
import { stableId } from './crypto';

// Historical jobs predate the per-client/property ledger. An unknown or failed
// attempt still counts: a new send command must not silently retry it.
export async function previousPropertyShare(db: Firestore, agencyId: string, contactId: string, propertyId: string) {
  const ref = db.collection('agencies').doc(agencyId).collection('communicationPropertyShares').doc(stableId(contactId, propertyId));
  const ledger = await ref.get();
  if (ledger.exists) return { messageId: String(ledger.data()!.messageId), conversationId: String(ledger.data()!.conversationId), historical: false };
  const query = db.collection('communicationOutboundJobs').where('agencyId', '==', agencyId)
    .where('input.matchingSelection.contactId', '==', contactId)
    .where('input.matchingSelection.propertyId', '==', propertyId).limit(1);
  const jobs = await query.get();
  const job = jobs.docs[0];
  return job ? { messageId: job.id, conversationId: String(job.data().conversationId), historical: true } : null;
}