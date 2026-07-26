import crypto from 'node:crypto';
import dotenv from 'dotenv';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

const EXPECTED_PROJECT_ID = 'studio-652232171-42fb6';
const WRITE = process.argv.includes('--write');
const RESET_FRONTIER = process.argv.includes('--reset-frontier');
const REDIRECT_CONCURRENCY = 6;

function adminApp() {
  if (getApps().length) return getApps()[0];
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId !== EXPECTED_PROJECT_ID) {
    throw new Error(`Proiect refuzat: ${projectId || '(lipsa)'}. Scriptul accepta doar ${EXPECTED_PROJECT_ID}.`);
  }
  if (!clientEmail || !privateKey) {
    throw new Error('Lipsesc credentialele Firebase Admin din .env.local.');
  }

  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId });
}

const db = getFirestore(adminApp());

function text(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeUrl(value) {
  const raw = text(value);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_|fbclid|gclid|ref|source)/i.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString();
  } catch {
    return raw;
  }
}

function isImoradarUrl(value) {
  try {
    return /(?:^|\.)imoradar24\.ro$/i.test(new URL(value).hostname);
  } catch {
    return false;
  }
}

function isListingSpecificExternalUrl(value) {
  const normalized = normalizeUrl(value);
  if (!normalized || isImoradarUrl(normalized)) return false;
  try {
    const path = new URL(normalized).pathname.replace(/\/+$/, '');
    return Boolean(path && path !== '/');
  } catch {
    return false;
  }
}

function portalLabelFromUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, '');
    if (/(?:^|\.)imobiliare\.ro$/.test(hostname)) return 'Imobiliare.ro';
    if (/(?:^|\.)olx\.ro$/.test(hostname)) return 'OLX';
    if (/(?:^|\.)publi24\.ro$/.test(hostname)) return 'Publi24';
    if (/(?:^|\.)storia\.ro$/.test(hostname)) return 'Storia';
    if (/(?:^|\.)autovit\.ro$/.test(hostname)) return 'Autovit';
    if (/(?:^|\.)imovirtual\.ro$/.test(hostname)) return 'Imovirtual';
    if (/(?:^|\.)anuntul\.ro$/.test(hostname)) return 'Anuntul.ro';
    if (/(?:^|\.)lajumate\.ro$/.test(hostname)) return 'LaJumate.ro';
    if (/(?:^|\.)homezz\.ro$/.test(hostname)) return 'HomeZZ.ro';
    if (/(?:^|\.)romimo\.ro$/.test(hostname)) return 'Romimo.ro';
    return hostname;
  } catch {
    return '';
  }
}

function canonicalIdentity(row, id) {
  const origin = normalizeUrl(row.originSourceUrl);
  if (isListingSpecificExternalUrl(origin)) return `url:${origin}`;

  const link = normalizeUrl(row.link);
  if (isListingSpecificExternalUrl(link)) return `url:${link}`;

  return `content:${row.dedupeSignature || row.fingerprint || link || id}`;
}

function groupId(identity) {
  return crypto.createHash('sha256').update(identity).digest('hex');
}

function isPortalRootIdentity(identity) {
  if (!identity.startsWith('url:')) return false;
  const value = identity.slice('url:'.length);
  try {
    const path = new URL(value).pathname.replace(/\/+$/, '');
    return !path || path === '/';
  } catch {
    return false;
  }
}

async function resolveExternalRedirect(link) {
  if (!/\/link-extern\/\d+/i.test(text(link))) return '';

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(link, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      const finalUrl = response.url || '';
      await response.body?.cancel().catch(() => undefined);
      if (isListingSpecificExternalUrl(finalUrl)) return finalUrl;
      return '';
    } catch (error) {
      if (attempt === 3) {
        console.warn(`Redirect nerecuperat pentru ${link}: ${error instanceof Error ? error.message : String(error)}`);
        return '';
      }
    } finally {
      clearTimeout(timeout);
    }
  }
  return '';
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(items[index], index);
      }
    })
  );
  return results;
}

function createWriter() {
  let batch = db.batch();
  let size = 0;
  let committed = 0;

  return {
    async set(ref, value, options = { merge: true }) {
      batch.set(ref, value, options);
      size += 1;
      if (size >= 400) {
        await batch.commit();
        committed += size;
        batch = db.batch();
        size = 0;
      }
    },
    async close() {
      if (size) {
        await batch.commit();
        committed += size;
      }
      return committed;
    },
  };
}

async function main() {
  const listingSnapshot = await db.collection('ownerListings').where('source', '==', 'imoradar24').get();
  const originalRows = listingSnapshot.docs.map((snapshot) => ({
    id: snapshot.id,
    ref: snapshot.ref,
    data: snapshot.data(),
  }));

  const rows = await mapWithConcurrency(originalRows, REDIRECT_CONCURRENCY, async (row) => {
    const resolvedOrigin = await resolveExternalRedirect(row.data.link);
    const originSourceUrl = resolvedOrigin || text(row.data.originSourceUrl);
    const originSourceLabel = resolvedOrigin
      ? portalLabelFromUrl(resolvedOrigin)
      : text(row.data.originSourceLabel);
    const normalized = {
      ...row.data,
      ...(originSourceUrl ? { originSourceUrl } : {}),
      ...(originSourceLabel ? { originSourceLabel } : {}),
    };
    const identity = canonicalIdentity(normalized, row.id);
    return {
      ...row,
      normalized,
      identity,
      groupId: groupId(identity),
      resolvedOrigin,
    };
  });

  const grouped = new Map();
  for (const row of rows) {
    const group = grouped.get(row.groupId) || [];
    group.push(row);
    grouped.set(row.groupId, group);
  }

  const groupRefs = [...grouped.keys()].map((id) => db.collection('ownerListingCanonicalGroups').doc(id));
  const groupSnapshots = groupRefs.length ? await db.getAll(...groupRefs) : [];
  const existingGroups = new Map(groupSnapshots.map((snapshot) => [snapshot.id, snapshot]));
  const rootIdentities = new Set(
    rows
      .map((row) => text(row.data.canonicalIdentity))
      .filter((identity) => isPortalRootIdentity(identity))
  );

  const summary = {
    mode: WRITE ? 'write' : 'dry-run',
    projectId: EXPECTED_PROJECT_ID,
    listings: rows.length,
    redirectCandidates: rows.filter((row) => /\/link-extern\/\d+/i.test(text(row.data.link))).length,
    redirectsResolved: rows.filter((row) => row.resolvedOrigin).length,
    exactExternalUrls: rows.filter((row) => isListingSpecificExternalUrl(row.normalized.originSourceUrl)).length,
    canonicalGroups: grouped.size,
    canonicalDuplicates: rows.length - grouped.size,
    retiredRootIdentities: rootIdentities.size,
    resetFrontier: RESET_FRONTIER,
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!WRITE) return;

  const writer = createWriter();
  const repairedAt = new Date().toISOString();

  for (const [gid, members] of grouped) {
    const existing = existingGroups.get(gid);
    const existingPrimaryId = existing?.exists ? text(existing.data()?.primaryListingId) : '';
    const primaryListingId = existingPrimaryId || members[0].id;
    const groupRef = db.collection('ownerListingCanonicalGroups').doc(gid);
    await writer.set(groupRef, {
      identity: members[0].identity,
      primaryListingId,
      memberCount: Math.max(Number(existing?.data()?.memberCount || 0), members.length),
      lastSeenAt: Math.max(...members.map((row) => Number(row.normalized.lastSeenAt || 0))),
      updatedAt: repairedAt,
      createdAt: existing?.data()?.createdAt || repairedAt,
      repairVersion: 'imoradar24-origin-v2',
      firestoreUpdatedAt: FieldValue.serverTimestamp(),
    });

    for (const row of members) {
      await writer.set(row.ref, {
        ...(row.normalized.originSourceUrl ? { originSourceUrl: row.normalized.originSourceUrl } : {}),
        ...(row.normalized.originSourceLabel ? { originSourceLabel: row.normalized.originSourceLabel } : {}),
        canonicalIdentity: row.identity,
        canonicalListingId: primaryListingId,
        dedupeGroupId: gid,
        isCanonical: row.id === primaryListingId,
        canonicalRepairedAt: repairedAt,
        canonicalRepairVersion: 'imoradar24-origin-v2',
        firestoreUpdatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  for (const identity of rootIdentities) {
    await writer.set(db.collection('ownerListingCanonicalGroups').doc(groupId(identity)), {
      status: 'retired-root-identity',
      memberCount: 0,
      retiredAt: repairedAt,
      updatedAt: repairedAt,
      firestoreUpdatedAt: FieldValue.serverTimestamp(),
    });
  }

  if (RESET_FRONTIER) {
    const frontierSnapshot = await db.collection('ownerListingScrapeFrontier').where('source', '==', 'imoradar24').get();
    for (const job of frontierSnapshot.docs) {
      await writer.set(job.ref, {
        status: 'pending',
        nextPage: 1,
        errors: 0,
        consecutiveEmptyPages: 0,
        consecutiveDuplicateHeavyPages: 0,
        lastStoredRatio: 0,
        nextRunAt: repairedAt,
        lastError: FieldValue.delete(),
        lockedAt: FieldValue.delete(),
        lockedBy: FieldValue.delete(),
        recoveryVersion: 'imoradar24-origin-v2',
        updatedAt: repairedAt,
        firestoreUpdatedAt: FieldValue.serverTimestamp(),
      });
    }
    await writer.set(db.collection('ownerListingScrapeHealth').doc('imoradar24'), {
      source: 'imoradar24',
      status: 'recovering',
      recoveryStartedAt: repairedAt,
      lastSuccessAt: FieldValue.delete(),
      lastError: FieldValue.delete(),
      lastScanned: 0,
      lastInserted: 0,
      firestoreUpdatedAt: FieldValue.serverTimestamp(),
    });
  }

  const writes = await writer.close();
  console.log(JSON.stringify({ ...summary, writes, completedAt: new Date().toISOString() }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
