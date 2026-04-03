import {
  getAdjacentZones,
  getClusterPeers,
  getMacroAreaPeers,
  normalizeRomanianText,
  preparedBucurestiIlfovOntology,
} from './ontology';
import { normalizeZoneInput } from './normalization';
import type {
  ClientZonePreference,
  PropertyZoneFact,
  PropertyZoneFactInput,
  ZoneBehaviorSignal,
  ZoneMatchScore,
  ZoneScoreBreakdown,
} from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const round = (value: number) => Math.round(value * 100) / 100;

const DEFAULT_PENALTY_COMPONENT = 1;

export function buildPropertyZoneFact(input: PropertyZoneFactInput): PropertyZoneFact {
  const rawZoneText = [
    input.rawZoneText ?? '',
    input.locality ?? '',
    input.address ?? '',
    input.title ?? '',
    input.description ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  const normalization = normalizeZoneInput(input.rawZoneText ?? rawZoneText, {
    locality: input.locality,
    county: input.county,
    sector: input.sector,
    address: input.address,
    title: input.title,
    description: input.description,
  });

  const matchedZone = normalization.matched_zone_id
    ? preparedBucurestiIlfovOntology.zoneById.get(normalization.matched_zone_id) ?? null
    : null;

  return {
    propertyId: input.propertyId,
    rawZoneText,
    zoneId: matchedZone?.zone_id ?? null,
    zoneName: matchedZone?.name ?? null,
    locality: matchedZone?.locality ?? input.locality ?? null,
    county: matchedZone?.county ?? input.county ?? null,
    sector: matchedZone?.sector ?? input.sector ?? null,
    macroAreas: matchedZone?.macro_area ?? [],
    commercialClusters: matchedZone?.commercial_clusters ?? [],
    normalization,
  };
}

function preferenceWeight(preference: ClientZonePreference) {
  return preference.weight ?? (preference.preference === 'preferred' ? 1 : preference.preference === 'acceptable' ? 0.7 : 1);
}

function matchesPreferenceZone(propertyZoneId: string, preference: ClientZonePreference) {
  return preference.scope === 'zone' && preference.zoneId === propertyZoneId;
}

function matchesPreferenceLocality(locality: string | null, preference: ClientZonePreference) {
  return (
    preference.scope === 'locality' &&
    locality !== null &&
    normalizeRomanianText(preference.locality) === normalizeRomanianText(locality)
  );
}

function matchesPreferenceMacroArea(macroAreas: string[], preference: ClientZonePreference) {
  return preference.scope === 'macro_area' && preference.macroAreaCode !== undefined && macroAreas.includes(preference.macroAreaCode);
}

function getZonePreferenceFit(propertyFact: PropertyZoneFact, preferences: ClientZonePreference[]) {
  if (!propertyFact.zoneId) {
    return 0;
  }

  const direct = preferences
    .filter((preference) => preference.preference !== 'excluded')
    .filter((preference) => matchesPreferenceZone(propertyFact.zoneId!, preference));

  if (!direct.length) {
    return 0;
  }

  return clamp(Math.max(...direct.map(preferenceWeight)), 0, 1);
}

function getAdjacencyFit(propertyFact: PropertyZoneFact, preferences: ClientZonePreference[]) {
  if (!propertyFact.zoneId) {
    return 0;
  }

  const adjacentIds = new Set(getAdjacentZones(propertyFact.zoneId).map((zone) => zone.zone_id));
  if (!adjacentIds.size) {
    return 0;
  }

  const adjacentPreferences = preferences
    .filter((preference) => preference.preference !== 'excluded')
    .filter((preference) => preference.scope === 'zone' && preference.zoneId && adjacentIds.has(preference.zoneId));

  if (!adjacentPreferences.length) {
    return 0;
  }

  return clamp(Math.max(...adjacentPreferences.map((preference) => preferenceWeight(preference) * 0.9)), 0, 1);
}

function getClusterFit(propertyFact: PropertyZoneFact, preferences: ClientZonePreference[]) {
  if (!propertyFact.zoneId) {
    return 0;
  }

  const clusterPeers = new Set(getClusterPeers(propertyFact.zoneId).map((zone) => zone.zone_id));
  const hasDirectClusterPreference = preferences.some(
    (preference) =>
      preference.preference !== 'excluded' &&
      preference.scope === 'zone' &&
      preference.zoneId &&
      clusterPeers.has(preference.zoneId)
  );

  if (hasDirectClusterPreference) {
    return 1;
  }

  const macroAccepted = preferences.some(
    (preference) =>
      preference.preference !== 'excluded' &&
      preference.scope === 'macro_area' &&
      preference.macroAreaCode &&
      propertyFact.macroAreas.includes(preference.macroAreaCode)
  );

  return macroAccepted ? 0.55 : 0;
}

function getMacroFit(propertyFact: PropertyZoneFact, preferences: ClientZonePreference[]) {
  const zoneMacroPeers = propertyFact.zoneId
    ? new Set(getMacroAreaPeers(propertyFact.zoneId).map((zone) => zone.zone_id))
    : new Set<string>();

  const macroPreferences = preferences.filter((preference) => preference.preference !== 'excluded');

  const explicitMacroFit = macroPreferences
    .filter((preference) => matchesPreferenceMacroArea(propertyFact.macroAreas, preference))
    .map(preferenceWeight);

  const indirectMacroFit = macroPreferences
    .filter((preference) => preference.scope === 'zone' && preference.zoneId && zoneMacroPeers.has(preference.zoneId))
    .map((preference) => preferenceWeight(preference) * 0.7);

  return clamp(Math.max(0, ...explicitMacroFit, ...indirectMacroFit), 0, 1);
}

function getBehavioralFit(propertyFact: PropertyZoneFact, signals: ZoneBehaviorSignal[]) {
  if (!signals.length) {
    return 0;
  }

  const direct = signals
    .filter((signal) => signal.zoneId && signal.zoneId === propertyFact.zoneId)
    .map((signal) => signal.strength);
  const locality = signals
    .filter(
      (signal) =>
        signal.locality &&
        propertyFact.locality &&
        normalizeRomanianText(signal.locality) === normalizeRomanianText(propertyFact.locality)
    )
    .map((signal) => signal.strength * 0.75);
  const macro = signals
    .filter((signal) => signal.macroAreaCode && propertyFact.macroAreas.includes(signal.macroAreaCode))
    .map((signal) => signal.strength * 0.6);

  return clamp(Math.max(0, ...direct, ...locality, ...macro), 0, 1);
}

function evaluatePenalties(propertyFact: PropertyZoneFact, preferences: ClientZonePreference[]) {
  const reasons: string[] = [];
  const penalties: string[] = [];
  let penaltyComponent = DEFAULT_PENALTY_COMPONENT;

  const excludedZone = preferences.find(
    (preference) =>
      preference.preference === 'excluded' && preference.scope === 'zone' && preference.zoneId === propertyFact.zoneId
  );
  if (excludedZone) {
    return {
      accepted: false,
      hardRejectReason: 'Proprietatea este într-o zonă exclusă explicit de cumpărător.',
      reasons,
      penalties: ['zonă exclusă'],
      penaltyComponent: 0,
    };
  }

  const excludedLocality = preferences.find(
    (preference) =>
      preference.preference === 'excluded' &&
      preference.scope === 'locality' &&
      matchesPreferenceLocality(propertyFact.locality, preference)
  );
  if (excludedLocality) {
    return {
      accepted: false,
      hardRejectReason: 'Localitatea este exclusă explicit de cumpărător.',
      reasons,
      penalties: ['localitate exclusă'],
      penaltyComponent: 0,
    };
  }

  const excludedMacro = preferences.find(
    (preference) =>
      preference.preference === 'excluded' &&
      preference.scope === 'macro_area' &&
      matchesPreferenceMacroArea(propertyFact.macroAreas, preference)
  );
  if (excludedMacro) {
    penaltyComponent = 0.2;
    penalties.push('macro-zonă exclusă');
  }

  if (propertyFact.normalization.match_type === 'ambiguous') {
    penaltyComponent *= propertyFact.normalization.confidence >= 0.55 ? 0.65 : 0.35;
    penalties.push('normalizare ambiguă');
  } else if (propertyFact.normalization.confidence < 0.7) {
    penaltyComponent *= 0.8;
    penalties.push('încredere redusă în normalizare');
  }

  return {
    accepted: true,
    reasons,
    penalties,
    penaltyComponent,
  };
}

export function scorePropertyAgainstZonePreferences(params: {
  propertyFact: PropertyZoneFact;
  preferences: ClientZonePreference[];
  behaviorSignals?: ZoneBehaviorSignal[];
}): ZoneMatchScore {
  const { propertyFact, preferences, behaviorSignals = [] } = params;

  const penaltyEvaluation = evaluatePenalties(propertyFact, preferences);
  if (!penaltyEvaluation.accepted && penaltyEvaluation.penaltyComponent === 0) {
    const breakdown: ZoneScoreBreakdown = {
      exact_or_alias_fit: 0,
      adjacency_fit: 0,
      cluster_fit: 0,
      macro_fit: 0,
      behavioral_fit: 0,
      penalty_component: 0,
    };

    return {
      zoneScore: 0,
      breakdown,
      explanation: {
        accepted: false,
        hardRejectReason: penaltyEvaluation.hardRejectReason,
        reasons: [],
        penalties: penaltyEvaluation.penalties,
      },
    };
  }

  const exactFit = getZonePreferenceFit(propertyFact, preferences);
  const adjacencyFit = getAdjacencyFit(propertyFact, preferences);
  const clusterFit = getClusterFit(propertyFact, preferences);
  const macroFit = getMacroFit(propertyFact, preferences);
  const behavioralFit = getBehavioralFit(propertyFact, behaviorSignals);

  const breakdown: ZoneScoreBreakdown = {
    exact_or_alias_fit: round(exactFit),
    adjacency_fit: round(adjacencyFit),
    cluster_fit: round(clusterFit),
    macro_fit: round(macroFit),
    behavioral_fit: round(behavioralFit),
    penalty_component: round(penaltyEvaluation.penaltyComponent),
  };

  const zoneScore =
    100 *
    (
      0.35 * breakdown.exact_or_alias_fit +
      0.2 * breakdown.adjacency_fit +
      0.15 * breakdown.cluster_fit +
      0.1 * breakdown.macro_fit +
      0.1 * breakdown.behavioral_fit +
      0.1 * breakdown.penalty_component
    );

  const reasons: string[] = [];
  if (exactFit > 0) {
    reasons.push('zonă preferată sau alias preferat');
  } else if (adjacencyFit > 0) {
    reasons.push('zonă adiacentă unei preferințe');
  }

  if (clusterFit > 0) reasons.push('în același cluster comercial');
  if (macroFit > 0) reasons.push('în aceeași macro-zonă');
  if (behavioralFit > 0) reasons.push('aliniere cu comportamentul istoric');

  return {
    zoneScore: Math.round(clamp(zoneScore, 0, 100)),
    breakdown,
    explanation: {
      accepted: true,
      reasons,
      penalties: penaltyEvaluation.penalties,
    },
  };
}
