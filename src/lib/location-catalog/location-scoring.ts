import type { BuyerLocationPreference, CanonicalLocationRef } from '@/lib/types';
import { isSameCanonicalLocality, isSameCanonicalLocation } from './imobiliare-canonical';

type CanonicalLocationBreakdown = {
  exact: number;
  locality: number;
  county: number;
  excluded: number;
};

export type CanonicalLocationMatch = {
  score: number;
  accepted: boolean;
  reasons: string[];
  breakdown: CanonicalLocationBreakdown;
  hardRejectReason?: string;
};

const normalize = (value?: string | null) =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

function matchesLocalityPreference(location: CanonicalLocationRef | null, preference: BuyerLocationPreference) {
  return Boolean(
    location &&
      preference.scope === 'locality' &&
      preference.locality &&
      normalize(location.locality) === normalize(preference.locality)
  );
}

export function scoreCanonicalLocationAgainstPreferences(params: {
  propertyLocation: CanonicalLocationRef | null;
  preferences: BuyerLocationPreference[];
}): CanonicalLocationMatch {
  const { propertyLocation, preferences } = params;
  if (!propertyLocation || preferences.length === 0) {
    return {
      score: 0,
      accepted: true,
      reasons: [],
      breakdown: { exact: 0, locality: 0, county: 0, excluded: 0 },
    };
  }

  const exactExcluded = preferences.find(
    (preference) =>
      preference.preference === 'excluded' &&
      preference.scope === 'location' &&
      preference.location &&
      isSameCanonicalLocation(propertyLocation, preference.location)
  );
  if (exactExcluded) {
    return {
      score: 0,
      accepted: false,
      reasons: [],
      breakdown: { exact: 0, locality: 0, county: 0, excluded: 1 },
      hardRejectReason: 'Proprietatea este într-o zonă exclusă explicit.',
    };
  }

  const localityExcluded = preferences.find(
    (preference) => preference.preference === 'excluded' && matchesLocalityPreference(propertyLocation, preference)
  );
  if (localityExcluded) {
    return {
      score: 0,
      accepted: false,
      reasons: [],
      breakdown: { exact: 0, locality: 0, county: 0, excluded: 1 },
      hardRejectReason: 'Localitatea este exclusă explicit.',
    };
  }

  let exact = 0;
  let locality = 0;
  let county = 0;
  const reasons: string[] = [];

  for (const preference of preferences) {
    if (preference.preference === 'excluded') {
      continue;
    }

    if (preference.scope === 'location' && preference.location) {
      if (isSameCanonicalLocation(propertyLocation, preference.location)) {
        exact = Math.max(exact, preference.preference === 'preferred' ? 1 : 0.82);
      } else if (isSameCanonicalLocality(propertyLocation, preference.location)) {
        locality = Math.max(locality, preference.preference === 'preferred' ? 0.78 : 0.62);
      } else if (normalize(propertyLocation.county) === normalize(preference.location.county)) {
        county = Math.max(county, preference.preference === 'preferred' ? 0.3 : 0.2);
      }
      continue;
    }

    if (matchesLocalityPreference(propertyLocation, preference)) {
      locality = Math.max(locality, preference.preference === 'preferred' ? 0.72 : 0.58);
    }
  }

  if (exact > 0) {
    reasons.push('Potrivire exacta pe locatie');
  } else if (locality > 0) {
    reasons.push('potrivire în aceeași localitate');
  } else if (county > 0) {
    reasons.push('potrivire la nivel de județ');
  }

  const score = Math.round(100 * (0.75 * exact + 0.2 * locality + 0.05 * county));
  return {
    score,
    accepted: true,
    reasons,
    breakdown: { exact, locality, county, excluded: 0 },
  };
}

