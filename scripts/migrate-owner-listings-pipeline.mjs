import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldPath, FieldValue, getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

const WRITE = process.argv.includes('--write');
const PAGE_SIZE = 500;
const NOW_ISO = new Date().toISOString();
const NOW_UNIX = Math.floor(Date.now() / 1000);

function adminApp() {
  if (getApps().length) return getApps()[0];
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  if (process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT) {
    return initializeApp({ credential: applicationDefault(), projectId });
  }

  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Lipsesc credentialele Firebase Admin din .env.local.');
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const db = getFirestore(adminApp());

function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function comparable(value) {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parseNumber(value) {
  const match = text(value).replace(',', '.').match(/\d+(?:\.\d+)?/);
  const parsed = match ? Number(match[0]) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePrice(value) {
  const digits = text(value).replace(/\D/g, '');
  const parsed = digits ? Number(digits) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function parseYear(value) {
  const match = text(value).match(/^(19\d{2}|20\d{2})$/);
  const parsed = match ? Number(match[1]) : NaN;
  return Number.isFinite(parsed) && parsed <= new Date().getFullYear() + 1 ? parsed : null;
}

function inferPropertyType(row) {
  if (['apartment', 'house', 'land', 'commercial'].includes(row.propertyType)) return row.propertyType;
  const value = comparable(`${row.link} ${row.title} ${row.description}`);
  if (/\b(spatiu|spatii|comercial|birou|hala|depozit|magazin)\b/.test(value) || value.includes('spatii-comerciale')) return 'commercial';
  if (/\bteren(uri)?\b/.test(value)) return 'land';
  if (/\b(casa|case|vila|vile|duplex|triplex)\b/.test(value) || value.includes('case-de')) return 'house';
  if (/\b(apartament|apartamente|garsoniera|garsoniere|studio)\b/.test(value) || value.includes('apartamente-garsoniere')) return 'apartment';
  return 'unknown';
}

function inferTransactionType(row) {
  if (row.transactionType === 'sale' || row.transactionType === 'rent') return row.transactionType;
  const value = comparable(`${row.link} ${row.title} ${row.description}`);
  if (/\b(inchiriat|inchiriere|chirie|rent)\b/.test(value) || value.includes('de-inchiriat')) return 'rent';
  if (/\b(vanzare|vand|cumparare|sale)\b/.test(value) || value.includes('de-vanzare')) return 'sale';
  return 'unknown';
}

function normalizedUrl(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref|source)/i.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString();
  } catch {
    return raw;
  }
}

function isImoradar(value) {
  try {
    return /(^|\.)imoradar24\.ro$/i.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

function isListingSpecificExternalUrl(value) {
  const normalized = normalizedUrl(value);
  if (!normalized || isImoradar(normalized)) return false;
  try {
    const path = new URL(normalized).pathname.replace(/\/+$/, '');
    return Boolean(path && path !== '/');
  } catch {
    return false;
  }
}

function canonicalIdentity(row, id) {
  const origin = normalizedUrl(row.originSourceUrl);
  if (isListingSpecificExternalUrl(origin)) return `url:${origin}`;
  const link = normalizedUrl(row.link);
  if (isListingSpecificExternalUrl(link)) return `url:${link}`;
  const phone = text(row.ownerPhone).replace(/\D/g, '');
  if (phone.length >= 8) {
    return `phone:${phone}:${row.scopeKey || ''}:${row.propertyType || ''}:${row.transactionType || ''}`;
  }
  return `content:${row.dedupeSignature || row.fingerprint || link || id}`;
}

function groupId(identity) {
  return crypto.createHash('sha256').update(identity).digest('hex');
}

function missingFields(row) {
  const missing = [];
  if (!text(row.price)) missing.push('price');
  if (!text(row.location)) missing.push('location');
  if (!text(row.area)) missing.push('area');
  if (['apartment', 'house', 'unknown'].includes(row.propertyType) && !text(row.rooms)) missing.push('rooms');
  if (['apartment', 'house'].includes(row.propertyType) && !text(row.constructionYear ?? row.year)) missing.push('constructionYear');
  if (!text(row.description)) missing.push('description');
  if (!text(row.imageUrl || row.image)) missing.push('image');
  if (!text(row.ownerPhone)) missing.push('ownerPhone');
  return missing;
}

function qualityScore(row) {
  const fields = ['title', 'price', 'area', 'rooms', 'constructionYear', 'year', 'location', 'description', 'imageUrl', 'ownerPhone'];
  return (row.source === 'imoradar24' ? 0 : 100) + fields.reduce((score, field) => score + (text(row[field]) ? 1 : 0), 0);
}

function preferPrimary(current, incoming) {
  if (!current) return incoming;
  if (incoming.score !== current.score) return incoming.score > current.score ? incoming : current;
  if (incoming.firstDiscoveredAt !== current.firstDiscoveredAt) {
    return incoming.firstDiscoveredAt < current.firstDiscoveredAt ? incoming : current;
  }
  return incoming.id.localeCompare(current.id) < 0 ? incoming : current;
}

const MERGE_FIELDS = [
  'title', 'price', 'area', 'rooms', 'constructionYear', 'year', 'location', 'description',
  'imageUrl', 'image', 'ownerName', 'ownerPhone', 'originSourceUrl', 'originSourceLabel',
];

function mergeRicher(current, row) {
  const merged = { ...(current || {}) };
  for (const field of MERGE_FIELDS) {
    if (!text(merged[field]) && text(row[field])) merged[field] = row[field];
  }
  merged.lastSeenAt = Math.max(Number(merged.lastSeenAt || 0), Number(row.lastSeenAt || 0));
  return merged;
}

async function pagedCollection(name, visitor) {
  let cursor = null;
  let count = 0;
  while (true) {
    let query = db.collection(name).orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) break;
    await visitor(snapshot.docs);
    count += snapshot.size;
    cursor = snapshot.docs.at(-1);
    if (snapshot.size < PAGE_SIZE) break;
    if (count % 5000 === 0) console.log(`${name}: ${count} documente analizate`);
  }
  return count;
}

async function commitBatchWithRetry(batch, attempt = 0) {
  try {
    await batch.commit();
  } catch (error) {
    if (attempt >= 4) throw error;
    const delayMs = 500 * (2 ** attempt);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await commitBatchWithRetry(batch, attempt + 1);
  }
}

function createWriter() {
  let batch = db.batch();
  let pendingWrites = 0;
  let committedBatches = 0;
  const workers = Array.from({ length: 8 }, () => Promise.resolve());
  let nextWorker = 0;

  const enqueueBatch = () => {
    if (!pendingWrites) return;
    const readyBatch = batch;
    batch = db.batch();
    pendingWrites = 0;
    const workerIndex = nextWorker;
    nextWorker = (nextWorker + 1) % workers.length;
    workers[workerIndex] = workers[workerIndex].then(async () => {
      await commitBatchWithRetry(readyBatch);
      committedBatches += 1;
      if (committedBatches % 50 === 0) {
        console.log(`Scriere Firestore: ${committedBatches * 400} operatii procesate`);
      }
    });
  };

  return {
    set(ref, value, options) {
      batch.set(ref, value, options);
      pendingWrites += 1;
      if (pendingWrites >= 400) enqueueBatch();
    },
    async close() {
      enqueueBatch();
      await Promise.all(workers);
    },
  };
}

async function migrateListings() {
  const rows = [];
  const groups = new Map();
  const total = await pagedCollection('ownerListings', async (docs) => {
    for (const snapshot of docs) {
      const original = snapshot.data();
      const propertyType = inferPropertyType(original);
      const transactionType = inferTransactionType(original);
      const firstDiscoveredAt = Number(original.firstDiscoveredAt || original.postedAt || original.scrapedAt || NOW_UNIX);
      const normalized = { ...original, propertyType, transactionType };
      const identity = canonicalIdentity(normalized, snapshot.id);
      const gid = groupId(identity);
      const candidate = { id: snapshot.id, score: qualityScore(normalized), firstDiscoveredAt };
      const group = groups.get(identity) || { identity, gid, primary: null, merged: null, members: 0 };
      group.primary = preferPrimary(group.primary, candidate);
      group.merged = mergeRicher(group.merged, normalized);
      group.members += 1;
      groups.set(identity, group);
      rows.push({ ref: snapshot.ref, id: snapshot.id, normalized, identity, gid, firstDiscoveredAt });
    }
  });

  const duplicates = total - groups.size;
  console.log(`ownerListings: ${total}; grupuri canonice: ${groups.size}; duplicate: ${duplicates}`);
  if (!WRITE) return { total, groups: groups.size, duplicates };

  const writer = createWriter();
  for (const item of rows) {
    const group = groups.get(item.identity);
    const isCanonical = group.primary.id === item.id;
    const base = item.normalized;
    const publicationStatus = text(base.title) && text(base.link) && text(base.location) ? 'ready' : 'rejected';
    const patch = {
      propertyType: base.propertyType,
      transactionType: base.transactionType,
      publicationStatus,
      enrichmentStatus: base.enrichmentStatus || 'pending',
      firstDiscoveredAt: item.firstDiscoveredAt,
      missingFields: missingFields(base),
      priceValue: parsePrice(base.price),
      areaValue: parseNumber(base.area),
      roomsValue: parseNumber(base.rooms),
      constructionYearValue: parseYear(base.constructionYear) ?? parseYear(base.year),
      canonicalIdentity: item.identity,
      canonicalListingId: group.primary.id,
      dedupeGroupId: item.gid,
      isCanonical,
      updatedAt: NOW_ISO,
      firestoreUpdatedAt: FieldValue.serverTimestamp(),
    };
    if (isCanonical) Object.assign(patch, group.merged);
    writer.set(item.ref, patch, { merge: true });
  }

  for (const group of groups.values()) {
    writer.set(db.collection('ownerListingCanonicalGroups').doc(group.gid), {
      identity: group.identity,
      primaryListingId: group.primary.id,
      memberCount: group.members,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO,
      firestoreUpdatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }
  await writer.close();
  return { total, groups: groups.size, duplicates };
}

function taskRank(task) {
  const typeRank = task.taskType === 'detail' ? 100 : task.taskType === 'origin-source' ? 80 : task.taskType === 'images' ? 60 : 40;
  const statusRank = task.status === 'processing' ? 30 : task.status === 'retry' ? 20 : task.status === 'pending' ? 10 : 0;
  return typeRank + statusRank;
}

async function migrateEnrichmentQueue() {
  const tasks = [];
  const winnerByListing = new Map();
  const total = await pagedCollection('ownerListingEnrichmentQueue', async (docs) => {
    for (const snapshot of docs) {
      const task = snapshot.data();
      const listingId = text(task.listingId);
      if (!listingId) continue;
      const row = { id: snapshot.id, ref: snapshot.ref, listingId, task };
      tasks.push(row);
      const winner = winnerByListing.get(listingId);
      if (!winner || taskRank(task) > taskRank(winner.task)) winnerByListing.set(listingId, row);
    }
  });
  console.log(`enrichment queue: ${total}; joburi unice: ${winnerByListing.size}; redundante: ${tasks.length - winnerByListing.size}`);
  if (!WRITE) return { total, unique: winnerByListing.size };

  const writer = createWriter();
  for (const row of tasks) {
    const winner = winnerByListing.get(row.listingId);
    if (winner.id !== row.id) {
      if (!['done', 'failed'].includes(row.task.status)) {
        writer.set(row.ref, {
          status: 'done',
          supersededBy: winner.id,
          completedAt: NOW_ISO,
          updatedAt: NOW_ISO,
          lockedAt: FieldValue.delete(),
          lockedBy: FieldValue.delete(),
          nextAttemptAt: FieldValue.delete(),
          firestoreUpdatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      continue;
    }

    if (row.task.status === 'pending' || row.task.status === 'retry') {
      writer.set(row.ref, {
        taskType: 'detail',
        priority: Number(row.task.priority || 400),
        nextAttemptAt: row.task.nextAttemptAt || NOW_ISO,
        updatedAt: NOW_ISO,
        firestoreUpdatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }
  await writer.close();
  return { total, unique: winnerByListing.size };
}

async function migrateOlxPhoneQueue() {
  let eligible = 0;
  const writer = WRITE ? createWriter() : null;
  const total = await pagedCollection('ownerListingOlxPhoneQueue', async (docs) => {
    for (const snapshot of docs) {
      const task = snapshot.data();
      if (task.status !== 'pending' && task.status !== 'retry') continue;
      eligible += 1;
      if (writer) {
        writer.set(snapshot.ref, {
          lane: task.lane || 'backfill',
          priority: Number(task.priority || 400),
          nextAttemptAt: task.nextAttemptAt || NOW_ISO,
          updatedAt: NOW_ISO,
          firestoreUpdatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }
  });
  if (writer) await writer.close();
  console.log(`OLX phone queue: ${total}; eligibile normalizate: ${eligible}`);
  return { total, eligible };
}

console.log(WRITE ? 'MOD SCRIERE: migrarea va actualiza productia.' : 'DRY RUN: nu se efectueaza nicio scriere.');
const result = {
  listings: await migrateListings(),
  enrichment: await migrateEnrichmentQueue(),
  olxPhone: await migrateOlxPhoneQueue(),
};
console.log(JSON.stringify(result, null, 2));
