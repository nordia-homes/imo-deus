import rawLocations from '@/data/imobiliare-locations-index.json';
import type { BuyerLocationPreference, CanonicalLocationRef, Contact, Property } from '@/lib/types';
import { buildCanonicalLocationRefFromLocationLike } from './shapes';

type RawLocationRow = {
  id: number;
  old_id?: number | null;
  title?: string;
  slug?: string;
  parent_id?: number | null;
  depth?: number | null;
  is_hidden?: boolean;
};

const normalize = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const rows = (rawLocations as RawLocationRow[]).filter((row) => row && typeof row.id === 'number');
const rowById = new Map(rows.map((row) => [row.id, row]));
const rowByOldId = new Map(
  rows
    .filter((row) => typeof row.old_id === 'number')
    .map((row) => [row.old_id as number, row])
);

function getPath(row?: RawLocationRow | null) {
  const path: RawLocationRow[] = [];
  const seen = new Set<number>();
  let current = row || null;

  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current);
    current = typeof current.parent_id === 'number' ? rowById.get(current.parent_id) || null : null;
  }

  return path;
}

function visibleChildCounts() {
  const counts = new Map<number, number>();
  for (const row of rows) {
    if (row.is_hidden || row.depth !== 3 || typeof row.parent_id !== 'number') {
      continue;
    }
    counts.set(row.parent_id, (counts.get(row.parent_id) || 0) + 1);
  }
  return counts;
}

const childCounts = visibleChildCounts();

function isCatalogCandidate(row: RawLocationRow) {
  if (row.is_hidden) {
    return false;
  }
  if (row.depth === 3) {
    return true;
  }
  if (row.depth === 2) {
    return !childCounts.has(row.id);
  }
  return false;
}

function buildRefFromRow(row?: RawLocationRow | null): CanonicalLocationRef | null {
  if (!row) {
    return null;
  }

  const path = getPath(row);
  const county = path.find((item) => item.depth === 1)?.title?.trim() || '';
  const locality = path.find((item) => item.depth === 2)?.title?.trim() || row.title?.trim() || '';
  const zoneCandidate = path.find((item) => item.depth === 3)?.title?.trim() || '';
  const zone = normalize(zoneCandidate) && normalize(zoneCandidate) !== normalize(locality) ? zoneCandidate : null;
  const display = [zone, locality, county].filter(Boolean).join(', ');

  return buildCanonicalLocationRefFromLocationLike({
    id: row.id,
    oldId: typeof row.old_id === 'number' ? row.old_id : null,
    depth: row.depth === 3 ? 3 : 2,
    county,
    locality,
    zone: zone || undefined,
    display,
    searchText: [display, row.title, county, locality, zone].filter(Boolean).join(' '),
  });
}

const catalogRefs = rows.filter(isCatalogCandidate).map(buildRefFromRow).filter(Boolean) as CanonicalLocationRef[];
const catalogRefById = new Map(catalogRefs.map((entry) => [entry.locationId, entry]));
const catalogRefByOldId = new Map(
  catalogRefs
    .filter((entry) => typeof entry.oldId === 'number')
    .map((entry) => [entry.oldId as number, entry])
);

export function getCanonicalLocationById(locationId?: number | null) {
  if (typeof locationId !== 'number') {
    return null;
  }
  return catalogRefById.get(locationId) || buildRefFromRow(rowById.get(locationId) || null);
}

export function getCanonicalLocationByOldId(oldId?: number | null) {
  if (typeof oldId !== 'number') {
    return null;
  }
  return catalogRefByOldId.get(oldId) || buildRefFromRow(rowByOldId.get(oldId) || null);
}

export function searchCanonicalLocations(query: string, limit = 25) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) {
    return catalogRefs.slice(0, limit);
  }

  return catalogRefs
    .map((entry) => {
      const haystack = normalize([entry.display, entry.searchText, entry.locality, entry.zone, entry.county].join(' '));
      const exact = haystack.includes(normalizedQuery) ? 1 : 0;
      const starts = haystack.startsWith(normalizedQuery) ? 1 : 0;
      return { entry, score: starts * 2 + exact };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.entry.display.localeCompare(right.entry.display, 'ro'))
    .slice(0, limit)
    .map((item) => item.entry);
}

export function resolveCanonicalLocationRef(params: {
  locationId?: number | null;
  oldId?: number | null;
  label?: string | null;
  city?: string | null;
  zone?: string | null;
  location?: string | null;
  skipIds?: boolean;
}) {
  if (!params.skipIds) {
    const byId = getCanonicalLocationById(params.locationId);
    if (byId) {
      return byId;
    }

    const byOldId = getCanonicalLocationByOldId(params.oldId);
    if (byOldId) {
      return byOldId;
    }
  }

  const candidates = [params.label, params.zone, params.location, params.city]
    .map((value) => (value || '').trim())
    .filter(Boolean);

  if (!candidates.length) {
    return null;
  }

  const cityNorm = normalize(params.city);
  const zoneNorm = normalize(params.zone);
  for (const entry of catalogRefs) {
    const entryCity = normalize(entry.locality);
    const entryZone = normalize(entry.zone);
    const entryDisplay = normalize(entry.display);
    const entrySearch = normalize(entry.searchText || '');

    if (zoneNorm && cityNorm) {
      const zoneFits = entryZone === zoneNorm || entryDisplay.includes(zoneNorm) || entrySearch.includes(zoneNorm);
      const cityFits = entryCity === cityNorm || entryDisplay.includes(cityNorm) || entrySearch.includes(cityNorm);
      if (zoneFits && cityFits) {
        return entry;
      }
    }
  }

  const best = candidates.flatMap((candidate) => searchCanonicalLocations(candidate, 5))[0];
  return best || null;
}

export function isSameCanonicalLocation(left?: CanonicalLocationRef | null, right?: CanonicalLocationRef | null) {
  return Boolean(left && right && left.provider === right.provider && left.locationId === right.locationId);
}

export function isSameCanonicalLocality(left?: CanonicalLocationRef | null, right?: CanonicalLocationRef | null) {
  return Boolean(
    left &&
      right &&
      left.provider === right.provider &&
      normalize(left.locality) === normalize(right.locality) &&
      normalize(left.county) === normalize(right.county)
  );
}

type CanonicalPropertyLocationContext = {
  location: CanonicalLocationRef | null;
  hasConflict: boolean;
  source: 'profile' | 'resolved' | 'none';
};

export function getCanonicalPropertyLocationContext(property: Property): CanonicalPropertyLocationContext {
  const profileLocation = property.locationProfile?.primary || null;
  const resolvedLocation =
    profileLocation ||
    resolveCanonicalLocationRef({
      locationId: property.portalProfiles?.imobiliare?.locationId,
      label: property.portalProfiles?.imobiliare?.locationLabel,
      city: property.city,
      zone: property.zone,
      location: property.location,
    });

  return {
    location: resolvedLocation,
    hasConflict: false,
    source: resolvedLocation ? (profileLocation ? 'profile' : 'resolved') : 'none',
  };
}

export function buildCanonicalPropertyLocation(property: Property) {
  return getCanonicalPropertyLocationContext(property).location;
}

function pushUniquePreference(
  target: BuyerLocationPreference[],
  next: BuyerLocationPreference,
  seen: Set<string>
) {
  const key = [
    next.preference,
    next.scope,
    next.location?.locationId || '',
    normalize(next.locality || ''),
    normalize(next.sourceText || ''),
  ].join('::');
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  target.push(next);
}

export function deriveCanonicalBuyerLocationPreferences(contact: Contact) {
  if (Array.isArray(contact.locationPreferencesV2) && contact.locationPreferencesV2.length > 0) {
    return contact.locationPreferencesV2;
  }

  const preferences: BuyerLocationPreference[] = [];
  const seen = new Set<string>();
  const city = (contact.city || '').trim();

  for (const zoneText of contact.zones || []) {
    const resolved = resolveCanonicalLocationRef({
      city,
      zone: zoneText,
      label: zoneText,
      location: [zoneText, city].filter(Boolean).join(', '),
    });

    if (resolved) {
      pushUniquePreference(
        preferences,
        {
          preference: 'preferred',
          scope: 'location',
          location: resolved,
          source: 'legacy_zone',
          sourceText: zoneText,
          weight: 1,
        },
        seen
      );
      continue;
    }

    if (city) {
      pushUniquePreference(
        preferences,
        {
          preference: 'preferred',
          scope: 'locality',
          locality: city,
          source: 'legacy_zone',
          sourceText: zoneText,
          weight: 0.7,
        },
        seen
      );
    }
  }

  if (city) {
    pushUniquePreference(
      preferences,
      {
        preference: 'acceptable',
        scope: 'locality',
        locality: city,
        source: 'legacy_city',
        sourceText: city,
        weight: 0.8,
      },
      seen
    );
  }

  return preferences;
}
