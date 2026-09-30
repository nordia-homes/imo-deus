import { createHash } from 'node:crypto';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) initializeApp();
const db = getFirestore();

/** Withdraw a shared listing as soon as its CRM property stops being available. */
export const collaborationPropertyWritten = onDocumentWritten(
  { document: 'agencies/{agencyId}/properties/{propertyId}', region: 'us-central1', retry: true },
  async event => {
    const before = event.data?.before.exists ? event.data.before.data() : null;
    const after = event.data?.after.exists ? event.data.after.data() : null;
    if (!before || (after?.status === 'Activ' && before.agentId === after.agentId)) return;

    const listingId = createHash('sha256').update(`${event.params.agencyId}:${event.params.propertyId}`).digest('hex');
    const listingRef = db.collection('collaborationListings').doc(listingId);
    const listing = await db.runTransaction(async tx => {
      const snapshot = await tx.get(listingRef);
      if (!snapshot.exists || snapshot.data()?.status !== 'active') return null;
      tx.update(listingRef, { status: 'closed', updatedAt: new Date().toISOString(), closedReason: after ? 'property_changed' : 'property_removed' });
      return snapshot.data();
    });
    if (!listing) return;

    const links = await db.collection('collaborationLinks').where('listingId', '==', listingId).get();
    const collaboratorUids = [...new Set(links.docs.filter(doc => doc.data().status === 'active').map(doc => String(doc.data().collaboratorUid)))];
    for (const uid of collaboratorUids) {
      const notificationId = createHash('sha256').update(`${event.id}:${uid}`).digest('hex');
      await db.collection('users').doc(uid).collection('notifications').doc(notificationId).set({
        eventId: event.id, recipientId: uid, agencyId: '', type: 'collaboration', category: 'inboxMessages', priority: 'action_required',
        title: 'Proprietate retrasă din colaborare', body: `${String(listing.title || 'Proprietatea')} nu mai este disponibilă.`,
        actionUrl: '/collaboration', entityType: 'collaboration', entityId: listingId, isRead: false, createdAt: new Date().toISOString(),
      });
    }
  },
);

export const collaborationRateLimitCleanup = onSchedule(
  { schedule: 'every 60 minutes', region: 'us-central1', timeoutSeconds: 540 },
  async () => {
    const expiredBefore = new Date().toISOString();
    for (let page = 0; page < 20; page++) {
      const expired = await db.collection('collaborationRateLimits').where('expiresAt', '<', expiredBefore).limit(400).get();
      if (expired.empty) break;
      const batch = db.batch();
      expired.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      if (expired.size < 400) break;
    }
  },
);
