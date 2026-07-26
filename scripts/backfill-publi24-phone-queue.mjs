import dotenv from 'dotenv';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

const WRITE = process.argv.includes('--write');
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
if (!projectId || !clientEmail || !privateKey) {
  throw new Error('Lipsesc credentialele Firebase Admin.');
}

const app =
  getApps()[0] ||
  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
const db = getFirestore(app);
const timestamp = new Date().toISOString();

function hasPhone(value) {
  return String(value || '').replace(/\D/g, '').length >= 8;
}

function queueId(listingId) {
  return `${listingId}_phone`.replace(/[^a-zA-Z0-9_-]+/g, '_');
}

function chunks(values, size) {
  return Array.from(
    { length: Math.ceil(values.length / size) },
    (_, index) => values.slice(index * size, (index + 1) * size)
  );
}

const listingSnapshot = await db
  .collection('ownerListings')
  .where('source', '==', 'publi24')
  .select(
    'ownerPhone',
    'publicationStatus',
    'link',
    'title',
    'isNew',
    'createdAt'
  )
  .get();
const candidates = listingSnapshot.docs.filter((document) => {
  const data = document.data();
  return (
    data.publicationStatus === 'ready' &&
    !hasPhone(data.ownerPhone) &&
    /^https:\/\/(?:www\.)?publi24\.ro\//i.test(String(data.link || ''))
  );
});
const candidateById = new Map(candidates.map((document) => [document.id, document]));

const favoriteSnapshot = await db
  .collectionGroup('ownerListingFavorites')
  .select(
    'ownerListingId',
    'isFavoriteActive',
    'phoneExtractionRequestedBy',
    'phoneExtractionRequestedByName',
    'createdBy',
    'reservedByAgentId',
    'reservedByAgentName'
  )
  .get();
const favoritesByListingId = new Map();
for (const favorite of favoriteSnapshot.docs) {
  const data = favorite.data();
  if (data.isFavoriteActive === false) continue;
  const listingId = String(data.ownerListingId || favorite.id);
  if (!candidateById.has(listingId)) continue;
  const values = favoritesByListingId.get(listingId) || [];
  values.push(favorite);
  favoritesByListingId.set(listingId, values);
}

const queueByListingId = new Map();
for (const batch of chunks(candidates, 250)) {
  const snapshots = await db.getAll(
    ...batch.map((listing) =>
      db.collection('ownerListingEnrichmentQueue').doc(queueId(listing.id))
    )
  );
  for (let index = 0; index < snapshots.length; index += 1) {
    if (snapshots[index].exists) {
      queueByListingId.set(batch[index].id, snapshots[index].data());
    }
  }
}

const metrics = {
  mode: WRITE ? 'write' : 'dry-run',
  publi24ReadyWithoutPhone: candidates.length,
  existingPhoneJobs: queueByListingId.size,
  existingDoneWithoutPhone: 0,
  prioritizedProspectingListings: favoritesByListingId.size,
  prospectingFavoriteDocuments: [...favoritesByListingId.values()].reduce(
    (sum, values) => sum + values.length,
    0
  ),
  queued: 0,
  skippedActiveProcessing: 0,
};

if (WRITE) {
  const writer = db.bulkWriter();
  writer.onWriteError((error) => error.failedAttempts < 3);

  for (const listingDocument of candidates) {
    const listing = listingDocument.data();
    const existing = queueByListingId.get(listingDocument.id) || {};
    if (existing.status === 'done') metrics.existingDoneWithoutPhone += 1;
    const lockedAt = existing.lockedAt
      ? new Date(existing.lockedAt).getTime()
      : 0;
    const activeProcessing =
      existing.status === 'processing' &&
      Number.isFinite(lockedAt) &&
      lockedAt > Date.now() - 15 * 60 * 1000;
    if (activeProcessing) {
      metrics.skippedActiveProcessing += 1;
      continue;
    }

    const prospectingFavorites = favoritesByListingId.get(listingDocument.id) || [];
    const primaryFavorite = prospectingFavorites[0];
    const primaryFavoriteData = primaryFavorite?.data() || {};
    const agencyId = primaryFavorite?.ref.parent.parent?.id || '';
    const requestedByUid = String(
      primaryFavoriteData.phoneExtractionRequestedBy ||
        primaryFavoriteData.createdBy ||
        primaryFavoriteData.reservedByAgentId ||
        ''
    );
    const requestedByName = String(
      primaryFavoriteData.phoneExtractionRequestedByName ||
        primaryFavoriteData.reservedByAgentName ||
        ''
    );

    writer.set(
      db.collection('ownerListingEnrichmentQueue').doc(queueId(listingDocument.id)),
      {
        listingId: listingDocument.id,
        source: 'publi24',
        link: listing.link,
        title: listing.title || '',
        taskType: 'phone',
        status: 'pending',
        priority: prospectingFavorites.length ? 3000 : listing.isNew ? 1120 : 520,
        attempts: 0,
        trigger: prospectingFavorites.length ? 'prospecting' : 'discovery',
        ...(agencyId ? { agencyId } : {}),
        ...(requestedByUid ? { requestedByUid } : {}),
        ...(requestedByName ? { requestedByName } : {}),
        createdAt: prospectingFavorites.length
          ? timestamp
          : existing.createdAt || listing.createdAt || timestamp,
        updatedAt: timestamp,
        nextAttemptAt: timestamp,
        lockedAt: FieldValue.delete(),
        lockedBy: FieldValue.delete(),
        completedAt: FieldValue.delete(),
        error: FieldValue.delete(),
        outcome: FieldValue.delete(),
        supersededBy: FieldValue.delete(),
        firestoreUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    metrics.queued += 1;

    for (const favorite of prospectingFavorites) {
      const favoriteData = favorite.data();
      const favoriteRequestedBy = String(
        favoriteData.phoneExtractionRequestedBy ||
          favoriteData.createdBy ||
          favoriteData.reservedByAgentId ||
          ''
      );
      writer.set(
        favorite.ref,
        {
          phoneExtractionStatus: 'queued',
          phoneExtractionMessage:
            'Anuntul asteapta preluarea automata a numarului Publi24.',
          phoneExtractionError: null,
          phoneExtractionNextAttemptAt: timestamp,
          ...(favoriteRequestedBy
            ? { phoneExtractionRequestedBy: favoriteRequestedBy }
            : {}),
          updatedAt: timestamp,
          firestoreUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
  }

  await writer.close();
} else {
  metrics.existingDoneWithoutPhone = candidates.filter(
    (document) => queueByListingId.get(document.id)?.status === 'done'
  ).length;
  metrics.queued = candidates.length;
}

console.log(JSON.stringify(metrics, null, 2));
