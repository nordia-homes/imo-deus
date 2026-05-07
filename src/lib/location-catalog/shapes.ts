import type { CanonicalLocationRef, PropertyLocationProfile } from '@/lib/types';

export type ImobiliareLocationLike = {
  id: number;
  oldId?: number | null;
  depth?: number;
  county?: string;
  locality?: string;
  zone?: string;
  display?: string;
  searchText?: string;
  title?: string;
};

const normalizeSpace = (value?: string | null) => (value || '').replace(/\s+/g, ' ').trim();

export function buildCanonicalLocationRefFromLocationLike(
  location?: ImobiliareLocationLike | null
): CanonicalLocationRef | null {
  if (!location || typeof location.id !== 'number') {
    return null;
  }

  const county = normalizeSpace(location.county);
  const locality = normalizeSpace(location.locality || location.title);
  const rawZone = normalizeSpace(location.zone);
  const zone = rawZone && rawZone.toLowerCase() !== locality.toLowerCase() ? rawZone : null;
  const depth = location.depth === 3 ? 3 : 2;
  const display = normalizeSpace(location.display) || [zone, locality, county].filter(Boolean).join(', ');

  if (!county || !locality || !display) {
    return null;
  }

  return {
    provider: 'imobiliare',
    locationId: location.id,
    oldId: typeof location.oldId === 'number' ? location.oldId : null,
    depth,
    county,
    locality,
    zone,
    display,
    searchText: normalizeSpace(location.searchText || display),
  };
}

export function buildPropertyLocationProfileFromLocationLike(
  location?: ImobiliareLocationLike | null,
  source: PropertyLocationProfile['source'] = 'manual'
): PropertyLocationProfile | null {
  const primary = buildCanonicalLocationRefFromLocationLike(location);
  if (!primary) {
    return null;
  }

  return {
    primary,
    publishLocationId: primary.locationId,
    source,
    confidence: 1,
  };
}
