import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { initializeApp, cert, getApps, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config({ path: '.env.local' });

const args = process.argv.slice(2);
const shouldWrite = args.includes('--write');
const agencyArgIndex = args.indexOf('--agency');
const limitArgIndex = args.indexOf('--limit');
const agencyFilter = agencyArgIndex >= 0 ? args[agencyArgIndex + 1] : '';
const limit = limitArgIndex >= 0 ? Number(args[limitArgIndex + 1]) : 0;

function getAdminApp() {
  if (getApps().length) return getApps()[0];

  const isHostedRuntime = Boolean(process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT);
  if (isHostedRuntime) {
    return initializeApp({
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT,
    });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Lipsesc credentialele Firebase Admin din .env.local.');
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

const normalize = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const locationsPath = path.join(process.cwd(), 'src', 'data', 'imobiliare-locations-index.json');
const rawLocations = JSON.parse(fs.readFileSync(locationsPath, 'utf8'));
const rowById = new Map(rawLocations.map((row) => [row.id, row]));
const rowByOldId = new Map(rawLocations.filter((row) => typeof row.old_id === 'number').map((row) => [row.old_id, row]));

function buildChildCounts() {
  const counts = new Map();
  for (const row of rawLocations) {
    if (row.is_hidden || row.depth !== 3 || typeof row.parent_id !== 'number') continue;
    counts.set(row.parent_id, (counts.get(row.parent_id) || 0) + 1);
  }
  return counts;
}

const childCounts = buildChildCounts();

function isCatalogCandidate(row) {
  if (!row || row.is_hidden) return false;
  if (row.depth === 3) return true;
  if (row.depth === 2) return !childCounts.has(row.id);
  return false;
}

function getPath(row) {
  const pathRows = [];
  const seen = new Set();
  let current = row || null;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    pathRows.unshift(current);
    current = typeof current.parent_id === 'number' ? rowById.get(current.parent_id) || null : null;
  }
  return pathRows;
}

function buildCanonicalRef(row) {
  if (!row) return null;
  const pathRows = getPath(row);
  const county = (pathRows.find((item) => item.depth === 1)?.title || '').trim();
  const locality = (pathRows.find((item) => item.depth === 2)?.title || row.title || '').trim();
  const rawZone = (pathRows.find((item) => item.depth === 3)?.title || '').trim();
  const zone = rawZone && normalize(rawZone) !== normalize(locality) ? rawZone : null;
  const display = [zone, locality, county].filter(Boolean).join(', ');

  if (!county || !locality || !display) {
    return null;
  }

  return {
    provider: 'imobiliare',
    locationId: row.id,
    oldId: typeof row.old_id === 'number' ? row.old_id : null,
    depth: row.depth === 3 ? 3 : 2,
    county,
    locality,
    zone,
    display,
    searchText: [display, row.title, county, locality, zone].filter(Boolean).join(' '),
  };
}

const catalogRefs = rawLocations
  .filter(isCatalogCandidate)
  .map(buildCanonicalRef)
  .filter(Boolean);

function resolveCanonicalLocation({ locationId, label, city, zone, location }) {
  if (typeof locationId === 'number') {
    return buildCanonicalRef(rowById.get(locationId) || rowByOldId.get(locationId) || null);
  }

  const cityNorm = normalize(city);
  const zoneNorm = normalize(zone);
  if (cityNorm || zoneNorm) {
    for (const entry of catalogRefs) {
      const cityFits = !cityNorm || normalize(entry.locality) === cityNorm || normalize(entry.display).includes(cityNorm);
      const zoneFits =
        !zoneNorm ||
        normalize(entry.zone) === zoneNorm ||
        normalize(entry.display).includes(zoneNorm) ||
        normalize(entry.searchText).includes(zoneNorm);
      if (cityFits && zoneFits) {
        return entry;
      }
    }
  }

  const textCandidates = [label, zone, location, city].map((value) => String(value || '').trim()).filter(Boolean);
  for (const candidate of textCandidates) {
    const candidateNorm = normalize(candidate);
    const match = catalogRefs.find((entry) => normalize(entry.searchText).includes(candidateNorm) || normalize(entry.display).includes(candidateNorm));
    if (match) {
      return match;
    }
  }

  return null;
}

async function main() {
  const db = getFirestore(getAdminApp());
  const agenciesSnapshot = agencyFilter
    ? { docs: [await db.collection('agencies').doc(agencyFilter).get()].filter((doc) => doc.exists) }
    : await db.collection('agencies').get();

  let scanned = 0;
  let matched = 0;
  let updated = 0;
  let skipped = 0;

  for (const agencyDoc of agenciesSnapshot.docs) {
    const propertiesSnapshot = await db.collection('agencies').doc(agencyDoc.id).collection('properties').get();

    for (const propertyDoc of propertiesSnapshot.docs) {
      if (limit > 0 && scanned >= limit) break;
      scanned += 1;

      const property = propertyDoc.data();
      const existingLocationProfile = property.locationProfile?.primary;
      const resolved = resolveCanonicalLocation({
        locationId: property?.portalProfiles?.imobiliare?.locationId,
        label: property?.portalProfiles?.imobiliare?.locationLabel,
        city: property?.city,
        zone: property?.zone,
        location: property?.location,
      });

      if (!resolved) {
        skipped += 1;
        continue;
      }

      matched += 1;
      const nextLocationProfile = {
        primary: resolved,
        publishLocationId: property?.portalProfiles?.imobiliare?.locationId ?? resolved.locationId,
        source: property?.portalProfiles?.imobiliare?.locationId ? 'migrated' : 'derived',
        confidence: property?.portalProfiles?.imobiliare?.locationId ? 1 : 0.8,
      };

      const unchanged =
        existingLocationProfile &&
        existingLocationProfile.locationId === resolved.locationId &&
        existingLocationProfile.display === resolved.display;

      if (unchanged) {
        skipped += 1;
        continue;
      }

      console.log(`[${agencyDoc.id}] property ${propertyDoc.id}`, {
        title: property?.title ?? null,
        previous: existingLocationProfile?.display ?? null,
        next: resolved.display,
        mode: shouldWrite ? 'write' : 'dry-run',
      });

      if (shouldWrite) {
        await propertyDoc.ref.update({ locationProfile: nextLocationProfile });
        updated += 1;
      }
    }
  }

  console.log({
    mode: shouldWrite ? 'write' : 'dry-run',
    scanned,
    matched,
    updated,
    skipped,
  });
}

main().catch((error) => {
  console.error('Property canonical location backfill failed:', error);
  process.exit(1);
});
