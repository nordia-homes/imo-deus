import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

const apply = process.argv.includes('--apply');
const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
const app = getApps()[0] || initializeApp(
  process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT
    ? { credential: applicationDefault(), projectId }
    : {
        credential: cert({
          projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      }
);
const db = getFirestore(app);

function normalizeRomanianPhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('0040') && digits.length === 13) digits = digits.slice(3);
  else if (digits.startsWith('40') && digits.length === 11) digits = `0${digits.slice(2)}`;
  if (/^0[237]\d{8}$/.test(digits)) return digits;
  if (/^[237]\d{8}$/.test(digits)) return `0${digits}`;
  if (/^[237]\d{7}$/.test(digits)) return digits;
  return '';
}

function queueHash(agencyId, listingId) {
  return createHash('sha256').update(`${agencyId}:${listingId}`).digest('hex');
}

function sourceUrl(listing, hostname) {
  for (const candidate of [listing.link, listing.originSourceUrl, listing.sourceUrl]) {
    try {
      const parsed = new URL(String(candidate || ''));
      if (parsed.protocol === 'https:' && new RegExp(`(^|\\.)${hostname.replace('.', '\\.')}$`, 'i').test(parsed.hostname)) {
        return parsed.toString();
      }
    } catch {
      // Continue.
    }
  }
  return '';
}

async function commitMutations(mutations) {
  for (let index = 0; index < mutations.length; index += 400) {
    const batch = db.batch();
    for (const mutation of mutations.slice(index, index + 400)) {
      batch.set(mutation.ref, mutation.data, { merge: true });
    }
    await batch.commit();
  }
}

const [listingSnapshot, favoriteSnapshot] = await Promise.all([
  db.collection('ownerListings').select(
    'ownerPhone',
    'source',
    'link',
    'originSourceUrl',
    'sourceUrl',
    'title'
  ).get(),
  db.collectionGroup('ownerListingFavorites').get(),
]);

const listings = new Map(listingSnapshot.docs.map((document) => [document.id, document.data()]));
const globalPhones = new Map(
  listingSnapshot.docs
    .filter((document) => String(document.data().ownerPhone || '').trim())
    .map((document) => [document.id, String(document.data().ownerPhone)])
);
const mutations = [];
const stats = {
  mode: apply ? 'apply' : 'dry-run',
  globalPhoneFields: globalPhones.size,
  globalInvalidPhones: 0,
  activeFavorites: 0,
  phonesCopiedToActiveProspecting: 0,
  invalidFavoritePhonesCleared: 0,
  publi24JobsQueued: 0,
  olxJobsQueued: 0,
  mutations: 0,
};

for (const [listingId, rawPhone] of globalPhones) {
  if (!normalizeRomanianPhone(rawPhone)) stats.globalInvalidPhones += 1;
  mutations.push({
    ref: db.collection('ownerListings').doc(listingId),
    data: {
      ownerPhone: FieldValue.delete(),
      phoneResolvedAt: FieldValue.delete(),
      phoneResolvedBy: FieldValue.delete(),
      phoneExtractionAttemptedAt: FieldValue.delete(),
      phonePrivacyMigratedAt: new Date().toISOString(),
      firestoreUpdatedAt: FieldValue.serverTimestamp(),
    },
  });
}

for (const favoriteDocument of favoriteSnapshot.docs) {
  const favorite = favoriteDocument.data();
  const listingId = String(favorite.ownerListingId || favoriteDocument.id);
  const pathSegments = favoriteDocument.ref.path.split('/');
  const agencyId = pathSegments[1] || '';
  const active = favorite.isFavoriteActive !== false;
  if (active) stats.activeFavorites += 1;

  const favoritePhoneRaw = String(favorite.ownerPhone || '');
  const phone = normalizeRomanianPhone(favoritePhoneRaw) || normalizeRomanianPhone(globalPhones.get(listingId));
  if (active && phone) {
    mutations.push({
      ref: favoriteDocument.ref,
      data: {
        ownerPhone: phone,
        phoneExtractionStatus: 'available',
        phoneExtractionMessage: 'Numarul proprietarului este disponibil in Prospectare.',
        phoneExtractionError: null,
        updatedAt: new Date().toISOString(),
        firestoreUpdatedAt: FieldValue.serverTimestamp(),
      },
    });
    stats.phonesCopiedToActiveProspecting += 1;
    continue;
  }

  if (favoritePhoneRaw && !normalizeRomanianPhone(favoritePhoneRaw)) {
    mutations.push({
      ref: favoriteDocument.ref,
      data: {
        ownerPhone: FieldValue.delete(),
        phoneExtractionStatus: active ? 'queued' : favorite.phoneExtractionStatus || null,
        phoneExtractionMessage: active
          ? 'Valoarea invalida a fost eliminata. Telefonul va fi preluat din nou.'
          : favorite.phoneExtractionMessage || null,
        updatedAt: new Date().toISOString(),
        firestoreUpdatedAt: FieldValue.serverTimestamp(),
      },
    });
    stats.invalidFavoritePhonesCleared += 1;
  }

  if (!active || phone || !agencyId) continue;
  const listing = listings.get(listingId);
  if (!listing) continue;
  const requestedByUid = String(favorite.phoneExtractionRequestedBy || favorite.createdBy || '');
  if (!requestedByUid) continue;
  const timestamp = new Date().toISOString();
  const publi24Url = sourceUrl(listing, 'publi24.ro');
  const olxUrl = sourceUrl(listing, 'olx.ro');

  if (publi24Url) {
    mutations.push({
      ref: db.collection('ownerListingEnrichmentQueue').doc(
        `prospecting_${queueHash(agencyId, listingId)}_phone`
      ),
      data: {
        listingId,
        source: 'publi24',
        link: publi24Url,
        title: listing.title || '',
        taskType: 'phone',
        status: 'pending',
        priority: 3000,
        attempts: 0,
        trigger: 'prospecting',
        agencyId,
        requestedByUid,
        requestedByName: favorite.phoneExtractionRequestedByName || '',
        createdAt: timestamp,
        updatedAt: timestamp,
        nextAttemptAt: timestamp,
        lockedAt: FieldValue.delete(),
        lockedBy: FieldValue.delete(),
        error: FieldValue.delete(),
        firestoreUpdatedAt: FieldValue.serverTimestamp(),
      },
    });
    stats.publi24JobsQueued += 1;
  } else if (olxUrl) {
    mutations.push({
      ref: db.collection('ownerListingOlxPhoneQueue').doc(queueHash(agencyId, listingId)),
      data: {
        listingId,
        source: 'olx',
        link: olxUrl,
        title: listing.title || '',
        agencyId,
        requestedByUid,
        requestedByName: favorite.phoneExtractionRequestedByName || '',
        trigger: 'prospecting',
        lane: 'prospecting',
        priority: 3000,
        status: 'pending',
        attempts: 0,
        phone: '',
        createdAt: timestamp,
        updatedAt: timestamp,
        nextAttemptAt: timestamp,
        lockedAt: FieldValue.delete(),
        lockedBy: FieldValue.delete(),
        error: FieldValue.delete(),
      },
    });
    stats.olxJobsQueued += 1;
  }
}

stats.mutations = mutations.length;
if (apply) await commitMutations(mutations);
console.log(JSON.stringify(stats, null, 2));
