import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/firebase/admin';
import { scrapeOlxPhoneNumber } from '@/lib/owner-listings/sources/olx';
import type { OlxPhoneDrainResult, OlxPhoneQueueEntry, OwnerListingSummary } from '@/lib/owner-listings/types';

const OLX_PHONE_QUEUE_COLLECTION = 'ownerListingOlxPhoneQueue';
const PROCESSING_STALE_MS = 15 * 60 * 1000;
const RETRY_DELAY_MS = 30 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function nowIso() {
  return new Date().toISOString();
}

function isQueueEligible(entry: Partial<OlxPhoneQueueEntry> | undefined, now: Date) {
  if (!entry) {
    return false;
  }

  if (entry.status === 'pending' || entry.status === 'retry') {
    const nextAttemptAt = entry.nextAttemptAt ? new Date(entry.nextAttemptAt).getTime() : 0;
    return !Number.isFinite(nextAttemptAt) || nextAttemptAt <= now.getTime();
  }

  if (entry.status === 'processing') {
    const lockedAt = entry.lockedAt ? new Date(entry.lockedAt).getTime() : 0;
    return Number.isFinite(lockedAt) && lockedAt > 0 && now.getTime() - lockedAt >= PROCESSING_STALE_MS;
  }

  return false;
}

export async function upsertOlxPhoneQueueEntry(listingId: string, listing: OwnerListingSummary) {
  if (listing.source !== 'olx') {
    return;
  }

  const queueRef = adminDb.collection(OLX_PHONE_QUEUE_COLLECTION).doc(listingId);
  const snapshot = await queueRef.get();
  const existing = snapshot.exists ? (snapshot.data() as Partial<OlxPhoneQueueEntry>) : undefined;
  const timestamp = nowIso();

  if (listing.ownerPhone) {
    await queueRef.set(
      {
        listingId,
        source: 'olx',
        link: listing.link,
        status: 'done',
        phone: listing.ownerPhone,
        updatedAt: timestamp,
        completedAt: timestamp,
        lockedAt: FieldValue.delete(),
        lockedBy: FieldValue.delete(),
        error: FieldValue.delete(),
        nextAttemptAt: FieldValue.delete(),
      },
      { merge: true }
    );
    return;
  }

  if (existing && (existing.status === 'processing' || existing.status === 'pending' || existing.status === 'retry')) {
    await queueRef.set(
      {
        listingId,
        source: 'olx',
        link: listing.link,
        updatedAt: timestamp,
      },
      { merge: true }
    );
    return;
  }

  await queueRef.set(
    {
      listingId,
      source: 'olx',
      link: listing.link,
      status: 'pending',
      attempts: existing?.attempts || 0,
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
      nextAttemptAt: timestamp,
      phone: existing?.phone || '',
      error: FieldValue.delete(),
      lockedAt: FieldValue.delete(),
      lockedBy: FieldValue.delete(),
      completedAt: FieldValue.delete(),
    },
    { merge: true }
  );
}

async function acquireNextOlxPhoneQueueJob() {
  const snapshot = await adminDb.collection(OLX_PHONE_QUEUE_COLLECTION).orderBy('updatedAt', 'asc').limit(25).get();
  const now = new Date();

  for (const doc of snapshot.docs) {
    const entry = doc.data() as Partial<OlxPhoneQueueEntry>;
    if (!isQueueEligible(entry, now)) {
      continue;
    }

    const acquired = await adminDb.runTransaction(async (transaction) => {
      const fresh = await transaction.get(doc.ref);
      if (!fresh.exists) {
        return null;
      }

      const latest = fresh.data() as Partial<OlxPhoneQueueEntry>;
      if (!isQueueEligible(latest, now)) {
        return null;
      }

      const attempts = (latest.attempts || 0) + 1;
      const timestamp = nowIso();

      transaction.set(
        doc.ref,
        {
          status: 'processing',
          attempts,
          lastAttemptAt: timestamp,
          lockedAt: timestamp,
          lockedBy: 'olx-phone-drain',
          updatedAt: timestamp,
          error: FieldValue.delete(),
        },
        { merge: true }
      );

      return {
        id: fresh.id,
        entry: {
          ...latest,
          listingId: latest.listingId || fresh.id,
          source: 'olx',
          link: latest.link || '',
          status: 'processing' as const,
          attempts,
          updatedAt: timestamp,
          createdAt: latest.createdAt || timestamp,
          lastAttemptAt: timestamp,
          lockedAt: timestamp,
          lockedBy: 'olx-phone-drain',
        } satisfies OlxPhoneQueueEntry,
      };
    });

    if (acquired) {
      return acquired;
    }
  }

  return null;
}

export async function drainNextOlxPhoneQueueItem(): Promise<OlxPhoneDrainResult> {
  const job = await acquireNextOlxPhoneQueueJob();
  if (!job) {
    return { status: 'empty', reason: 'Nu exista joburi OLX phone eligibile.' };
  }

  const queueRef = adminDb.collection(OLX_PHONE_QUEUE_COLLECTION).doc(job.id);
  const listingRef = adminDb.collection('ownerListings').doc(job.entry.listingId);

  try {
    const phone = await scrapeOlxPhoneNumber(job.entry.link);
    const timestamp = nowIso();

    if (phone) {
      await Promise.all([
        listingRef.set(
          {
            ownerPhone: phone,
            updatedAt: timestamp,
            firestoreUpdatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        ),
        queueRef.set(
          {
            status: 'done',
            phone,
            updatedAt: timestamp,
            completedAt: timestamp,
            lockedAt: FieldValue.delete(),
            lockedBy: FieldValue.delete(),
            error: FieldValue.delete(),
            nextAttemptAt: FieldValue.delete(),
          },
          { merge: true }
        ),
      ]);

      return {
        status: 'processed',
        queueId: job.id,
        listingId: job.entry.listingId,
        phone,
        attempts: job.entry.attempts,
      };
    }

    const nextStatus = job.entry.attempts >= MAX_ATTEMPTS ? 'failed' : 'retry';
    const nextAttemptAt = new Date(Date.now() + RETRY_DELAY_MS).toISOString();
    await queueRef.set(
      {
        status: nextStatus,
        updatedAt: timestamp,
        nextAttemptAt,
        lockedAt: FieldValue.delete(),
        lockedBy: FieldValue.delete(),
        error: 'Numarul de telefon nu a putut fi extras din OLX.',
      },
      { merge: true }
    );

    return {
      status: 'skipped',
      queueId: job.id,
      listingId: job.entry.listingId,
      attempts: job.entry.attempts,
      reason: 'Numarul de telefon nu a fost disponibil la aceasta rulare.',
    };
  } catch (error) {
    const timestamp = nowIso();
    const nextStatus = job.entry.attempts >= MAX_ATTEMPTS ? 'failed' : 'retry';
    const nextAttemptAt = new Date(Date.now() + RETRY_DELAY_MS).toISOString();

    await queueRef.set(
      {
        status: nextStatus,
        updatedAt: timestamp,
        nextAttemptAt,
        lockedAt: FieldValue.delete(),
        lockedBy: FieldValue.delete(),
        error: error instanceof Error ? error.message : 'OLX phone drain a esuat.',
      },
      { merge: true }
    );

    throw error;
  }
}
