import type { Contact, ContactPreferences, MatchedBuyer, MatchedProperty, Property } from '@/lib/types';
import { buildPropertyZoneFact, scorePropertyAgainstZonePreferences } from '@/lib/zones/matching';
import { normalizeRomanianText, preparedBucurestiIlfovOntology } from '@/lib/zones/ontology';
import { normalizeZoneInput } from '@/lib/zones/normalization';
import type { ClientZonePreference } from '@/lib/zones/types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalize = (value?: string | null) =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const tokenize = (value?: string | null) =>
  normalize(value)
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);

const unique = <T>(items: T[]) => Array.from(new Set(items));

const joinDefined = (parts: Array<string | undefined | null>) => parts.filter(Boolean).join(' ');

const roundScore = (value: number) => Math.round(clamp(value, 0, 100));

const GENERAL_ZONE_TO_MACRO_AREAS: Record<string, string[]> = {
  nord: ['NORD', 'CENTRU_NORD', 'NORD_VEST', 'NORD_EST', 'ILFOV_NORD'],
  sud: ['SUD', 'SUD_EST', 'SUD_VEST', 'ILFOV_SUD'],
  est: ['EST', 'NORD_EST', 'SUD_EST', 'ILFOV_EST'],
  vest: ['VEST', 'NORD_VEST', 'SUD_VEST', 'ILFOV_VEST'],
  central: ['CENTRU', 'ULTRACENTRAL', 'CENTRU_NORD'],
};

const LOCALITY_LOOKUP = new Map(
  Array.from(
    new Set(
      preparedBucurestiIlfovOntology.zones
        .map((zone) => zone.locality)
        .filter(Boolean)
        .map((locality) => locality.trim())
    )
  ).map((locality) => [normalizeRomanianText(locality), locality] as const)
);

const formatReasoning = (positives: string[], caution?: string) => {
  const parts = unique(positives).slice(0, 3);
  if (caution) {
    parts.push(caution);
  }
  return parts.join('. ');
};

const getZonePriority = (item: {
  zoneDebug?: { exact: number; adjacent: number; cluster: number; macro: number; penalty: number } | null;
}) => {
  const debug = item.zoneDebug;
  if (!debug) return 0;
  if (debug.exact > 0) return 4;
  if (debug.adjacent > 0) return 3;
  if (debug.cluster > 0) return 2;
  if (debug.macro > 0) return 1;
  return 0;
};

export function compareMatchedItemsByZonePriority<
  T extends {
    matchScore: number;
    price?: number;
    budgetScore?: number;
    zoneDebug?: { exact: number; adjacent: number; cluster: number; macro: number; penalty: number } | null;
  }
>(left: T, right: T) {
  const priorityDelta = getZonePriority(right) - getZonePriority(left);
  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const budgetDelta = (right.budgetScore || 0) - (left.budgetScore || 0);
  if (budgetDelta !== 0) {
    return budgetDelta;
  }

  const scoreDelta = right.matchScore - left.matchScore;
  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  return (left.price || 0) - (right.price || 0);
}

export function derivePreferencesFromContact(contact: Contact): ContactPreferences {
  const explicitBudgetMax =
    typeof contact.preferences?.desiredPriceRangeMax === 'number' && contact.preferences.desiredPriceRangeMax > 0
      ? contact.preferences.desiredPriceRangeMax
      : undefined;
  const contactBudget =
    typeof contact.budget === 'number' && contact.budget > 0
      ? contact.budget
      : undefined;
  const priceMaxCandidates = [explicitBudgetMax, contactBudget].filter((value): value is number => typeof value === 'number');
  const priceMax = priceMaxCandidates.length > 0 ? Math.min(...priceMaxCandidates) : 999999;
  const priceMin =
    contact.preferences?.desiredPriceRangeMin ??
    (priceMaxCandidates.length > 0 ? Math.round(priceMax * 0.8) : 0);

  return {
    desiredPriceRangeMin: Math.max(0, priceMin),
    desiredPriceRangeMax: Math.max(priceMin, priceMax),
    desiredRooms: contact.preferences?.desiredRooms ?? 0,
    desiredBathrooms: contact.preferences?.desiredBathrooms ?? 0,
    desiredSquareFootageMin: contact.preferences?.desiredSquareFootageMin ?? 0,
    desiredSquareFootageMax: contact.preferences?.desiredSquareFootageMax ?? 999999,
    desiredFeatures: contact.preferences?.desiredFeatures ?? '',
    locationPreferences: contact.preferences?.locationPreferences ?? contact.city ?? '',
  };
}

function scoreRange(value: number, min: number, max: number, weight: number) {
  if (!value || (min <= 0 && max <= 0)) {
    return { score: Math.round(weight * 0.45), label: '' };
  }

  if (value >= min && value <= max) {
    return { score: weight, label: '' };
  }

  const safeMax = max > 0 ? max : min || value;
  const overflow = value < min ? (min - value) / Math.max(min, 1) : (value - safeMax) / Math.max(safeMax, 1);
  const score = weight * Math.max(0, 1 - overflow * 1.35);
  return { score: Math.round(score), label: '' };
}

function scoreBudgetFit(propertyPrice: number, buyerBudgetMax: number, weight: number) {
  if (!propertyPrice || !buyerBudgetMax) {
    return {
      weightedScore: Math.round(weight * 0.45),
      budgetScore: 45,
      isRejected: false,
    };
  }

  if (propertyPrice <= buyerBudgetMax) {
    return {
      weightedScore: weight,
      budgetScore: 100,
      isRejected: false,
    };
  }

  const hardLimit = buyerBudgetMax * 1.15;
  if (propertyPrice > hardLimit) {
    return {
      weightedScore: 0,
      budgetScore: 0,
      isRejected: true,
    };
  }

  const overflowRatio = (propertyPrice - buyerBudgetMax) / Math.max(hardLimit - buyerBudgetMax, 1);
  const budgetScore = Math.round(Math.max(0, 100 * (1 - overflowRatio)));

  return {
    weightedScore: Math.round(weight * (budgetScore / 100)),
    budgetScore,
    isRejected: false,
  };
}

function formatBudgetDelta(propertyPrice: number, buyerBudgetMax: number) {
  if (!propertyPrice || !buyerBudgetMax) {
    return '';
  }

  if (propertyPrice <= buyerBudgetMax) {
    return 'in buget';
  }

  const overPercentage = Math.round(((propertyPrice - buyerBudgetMax) / buyerBudgetMax) * 100);
  return `+${overPercentage}% peste buget`;
}

function scoreTarget(value: number, target: number, weight: number) {
  if (!target || !value) {
    return Math.round(weight * 0.45);
  }

  if (value === target) {
    return weight;
  }

  const distance = Math.abs(value - target);
  if (distance === 1) {
    return Math.round(weight * 0.72);
  }

  return Math.round(Math.max(0, weight * (1 - distance / Math.max(target + 1, 4))));
}

function propertyText(property: Property) {
  return joinDefined([
    property.title,
    property.description,
    property.location,
    property.address,
    property.city,
    property.zone,
    property.propertyType,
    property.interiorState,
    property.furnishing,
    property.heatingSystem,
    property.parking,
    property.keyFeatures,
    property.amenities?.join(' '),
  ]);
}

function contactText(contact: Contact) {
  return joinDefined([
    contact.city,
    contact.zones?.join(' '),
    contact.description,
    contact.preferences?.desiredFeatures,
    contact.preferences?.locationPreferences,
    contact.generalZone || undefined,
  ]);
}

const splitZoneFragments = (value?: string | null) =>
  (value || '')
    .split(/[,;/|]+/g)
    .map((item) => item.trim())
    .filter(Boolean);

type ParsedZonePreference = {
  raw: string;
  cleaned: string;
  preference: ClientZonePreference['preference'];
};

function stripPreferenceDirective(raw: string, preference: ClientZonePreference['preference']) {
  if (preference === 'excluded') {
    return raw
      .replace(/^(?:fara|fără|except(?:and)?|exclude|exclus|evita|evită|avoid)\s+/i, '')
      .replace(/^nu\s+(?:vreau\s+)?(?:in\s+)?/i, '')
      .trim();
  }

  if (preference === 'acceptable') {
    return raw
      .replace(/^(?:acceptabil(?:a|e)?|accept|ok|poate|preferabil|aproape\s+de|langa|lângă|adiacent(?:a|e)?\s+(?:cu|de)?|in\s+jur\s+de)\s+/i, '')
      .trim();
  }

  return raw.trim();
}

function getLocalityPreference(cleaned: string) {
  const normalized = normalizeRomanianText(cleaned);
  if (!normalized) {
    return null;
  }

  return LOCALITY_LOOKUP.get(normalized) ?? null;
}

function getMacroAreaPreferences(cleaned: string) {
  const normalized = normalizeRomanianText(cleaned);
  if (!normalized) {
    return [];
  }

  const matches = new Set<string>();

  if (/\bnord(?:ul|ului)?\b/.test(normalized)) {
    for (const code of GENERAL_ZONE_TO_MACRO_AREAS.nord || []) matches.add(code);
  }

  if (/\bsud(?:ul|ului)?\b/.test(normalized)) {
    for (const code of GENERAL_ZONE_TO_MACRO_AREAS.sud || []) matches.add(code);
  }

  if (/\best(?:ul|ului)?\b/.test(normalized)) {
    for (const code of GENERAL_ZONE_TO_MACRO_AREAS.est || []) matches.add(code);
  }

  if (/\bvest(?:ul|ului)?\b/.test(normalized)) {
    for (const code of GENERAL_ZONE_TO_MACRO_AREAS.vest || []) matches.add(code);
  }

  if (/\bcentr(?:al|u|ul|ului)\b/.test(normalized)) {
    for (const code of GENERAL_ZONE_TO_MACRO_AREAS.central || []) matches.add(code);
  }

  return Array.from(matches);
}

function parseZonePreferenceFragment(fragment: string, defaultPreference: ClientZonePreference['preference']): ParsedZonePreference | null {
  const raw = fragment.trim();
  const normalized = normalize(raw);

  if (!raw || !normalized) {
    return null;
  }

  const excludedPatterns = [
    /^(?:fara|except(?:and)?|exclude|exclus|evita|avoid)\s+/,
    /^nu\s+(?:vreau\s+)?(?:in\s+)?/,
  ];
  const acceptablePatterns = [
    /^(?:acceptabil(?:a|e)?|accept|ok|poate|preferabil|aproape\s+de|langa|adiacent(?:a|e)?\s+(?:cu|de)?|in\s+jur\s+de)\s+/,
  ];

  for (const pattern of excludedPatterns) {
    if (pattern.test(normalized)) {
      return {
        raw,
        cleaned: stripPreferenceDirective(raw, 'excluded'),
        preference: 'excluded',
      };
    }
  }

  for (const pattern of acceptablePatterns) {
    if (pattern.test(normalized)) {
      return {
        raw,
        cleaned: stripPreferenceDirective(raw, 'acceptable'),
        preference: 'acceptable',
      };
    }
  }

  return {
    raw,
    cleaned: raw,
    preference: defaultPreference,
  };
}

export function deriveZonePreferencesFromContact(contact: Contact, preferences: ContactPreferences): ClientZonePreference[] {
  const collected: ClientZonePreference[] = [];
  const seen = new Set<string>();

  const pushPreference = (preference: ClientZonePreference) => {
    const key = [
      preference.preference,
      preference.scope,
      preference.zoneId || '',
      preference.locality || '',
      preference.macroAreaCode || '',
    ].join('::');

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    collected.push(preference);
  };

  const addZoneTextAsPreference = (value: string, defaultPreference: ClientZonePreference['preference']) => {
    const parsed = parseZonePreferenceFragment(value, defaultPreference);
    if (!parsed || !parsed.cleaned) {
      return;
    }

    const normalization = normalizeZoneInput(parsed.cleaned, {
      locality: contact.city,
      description: contact.description,
      clientIntent: preferences.locationPreferences,
    });

    if (normalization.matched_zone_id && normalization.confidence >= 0.55) {
      pushPreference({
        scope: 'zone',
        preference: parsed.preference,
        zoneId: normalization.matched_zone_id,
        sourceText: parsed.raw,
        weight:
          parsed.preference === 'acceptable'
            ? 0.72
            : normalization.confidence >= 0.9
              ? 1
              : 0.85,
      });
      return;
    }

    if (normalization.match_type === 'ambiguous' && normalization.alternatives.length > 0) {
      const mappedPreference = parsed.preference === 'preferred' ? 'acceptable' : parsed.preference;
      const fallbackWeight = parsed.preference === 'excluded' ? 1 : mappedPreference === 'acceptable' ? 0.45 : 0.6;

      for (const alternative of normalization.alternatives) {
        pushPreference({
          scope: 'zone',
          preference: mappedPreference,
          zoneId: alternative.zoneId,
          sourceText: parsed.raw,
          weight: fallbackWeight,
        });
      }
      return;
    }

    const locality = getLocalityPreference(parsed.cleaned);
    if (locality) {
      pushPreference({
        scope: 'locality',
        preference: parsed.preference,
        locality,
        sourceText: parsed.raw,
        weight: parsed.preference === 'acceptable' ? 0.72 : 1,
      });
      return;
    }

    for (const macroAreaCode of getMacroAreaPreferences(parsed.cleaned)) {
      pushPreference({
        scope: 'macro_area',
        preference: parsed.preference,
        macroAreaCode,
        sourceText: parsed.raw,
        weight: parsed.preference === 'acceptable' ? 0.68 : 0.82,
      });
    }
  };

  for (const zone of contact.zones || []) {
    addZoneTextAsPreference(zone, 'preferred');
  }

  for (const fragment of splitZoneFragments(preferences.locationPreferences)) {
    addZoneTextAsPreference(fragment, 'preferred');
  }

  for (const fragment of splitZoneFragments(contact.description)) {
    addZoneTextAsPreference(fragment, 'acceptable');
  }

  if (contact.city) {
    pushPreference({
      scope: 'locality',
      preference: 'acceptable',
      locality: contact.city,
      sourceText: contact.city,
      weight: 0.8,
    });
  }

  const generalZoneKey = normalize(contact.generalZone || '');
  for (const macroAreaCode of GENERAL_ZONE_TO_MACRO_AREAS[generalZoneKey] || []) {
    pushPreference({
      scope: 'macro_area',
      preference: 'acceptable',
      macroAreaCode,
      sourceText: contact.generalZone || undefined,
      weight: 0.7,
    });
  }

  return collected;
}

function scoreTokenOverlap(source: string, target: string, weight: number) {
  const sourceTokens = unique(tokenize(source));
  const targetTokens = unique(tokenize(target));

  if (sourceTokens.length === 0 || targetTokens.length === 0) {
    return 0;
  }

  const overlaps = sourceTokens.filter((token) => targetTokens.includes(token));
  const ratio = overlaps.length / Math.max(1, Math.min(sourceTokens.length, targetTokens.length));
  return Math.round(weight * ratio);
}

function locationScore(property: Property, preferences: ContactPreferences, contact?: Contact) {
  let score = 0;
  const positives: string[] = [];
  const zoneReasons: string[] = [];
  let zoneDebug:
    | {
        exact: number;
        adjacent: number;
        cluster: number;
        macro: number;
        penalty: number;
      }
    | null = null;

  if (contact) {
    const propertyFact = buildPropertyZoneFact({
      propertyId: property.id,
      rawZoneText: joinDefined([property.zone, property.location, property.address, property.city]),
      locality: property.city || property.location.split(',')[0],
      address: property.address,
      title: property.title,
      description: property.description,
    });

    const zonePreferences = deriveZonePreferencesFromContact(contact, preferences);
    const zoneMatch = scorePropertyAgainstZonePreferences({
      propertyFact,
      preferences: zonePreferences,
    });
    zoneDebug = {
      exact: zoneMatch.breakdown.exact_or_alias_fit,
      adjacent: zoneMatch.breakdown.adjacency_fit,
      cluster: zoneMatch.breakdown.cluster_fit,
      macro: zoneMatch.breakdown.macro_fit,
      penalty: zoneMatch.breakdown.penalty_component,
    };

    const zonePoints = Math.round((zoneMatch.zoneScore / 100) * 18);
    score += zonePoints;

    if (zoneMatch.breakdown.exact_or_alias_fit > 0) {
      positives.push('zona se potrivește direct cu preferințele clientului');
      zoneReasons.push('zonă exactă');
    } else if (zoneMatch.breakdown.adjacency_fit > 0) {
      positives.push('zona este adiacentă unei preferințe importante');
      zoneReasons.push('zonă adiacentă');
    }

    if (zoneMatch.breakdown.cluster_fit > 0) {
      positives.push('zona este în același cluster comercial căutat');
      zoneReasons.push('același cluster');
    }

    if (zoneMatch.breakdown.macro_fit > 0 && zoneMatch.breakdown.exact_or_alias_fit === 0) {
      positives.push('macro-zona este compatibilă cu căutarea');
      zoneReasons.push('macro-zonă compatibilă');
    }

    if (!zoneMatch.explanation.accepted) {
      score = Math.max(0, score - 14);
    } else if (zoneMatch.breakdown.penalty_component < 1) {
      score = Math.max(0, score - Math.round((1 - zoneMatch.breakdown.penalty_component) * 6));
    }
  } else {
    const desiredLocation = preferences.locationPreferences || '';
    const propertyLocationBlob = joinDefined([property.location, property.address, property.city, property.zone]);
    const locationTokensScore = scoreTokenOverlap(desiredLocation, propertyLocationBlob, 16);
    if (locationTokensScore > 0) {
      score += locationTokensScore;
      positives.push('zona este apropiata de cautarea clientului');
    }
  }

  return { score: clamp(score, 0, 24), positives, zoneReasons: unique(zoneReasons), zoneDebug };
}

function featureScore(property: Property, preferences: ContactPreferences) {
  const score = scoreTokenOverlap(preferences.desiredFeatures, propertyText(property), 16);
  return {
    score,
    positives: score > 0 ? ['dotarile si descrierea sunt compatibile cu preferintele'] : [],
  };
}

export function scorePropertyForPreferences(property: Property, preferences: ContactPreferences, contact?: Contact) {
  const positives: string[] = [];
  let caution: string | undefined;
  let budgetReasoning: string | undefined;
  const effectiveBudgetMax =
    contact?.budget && contact.budget > 0
      ? Math.min(preferences.desiredPriceRangeMax || contact.budget, contact.budget)
      : preferences.desiredPriceRangeMax || 0;

  const priceFit = scoreBudgetFit(property.price || 0, effectiveBudgetMax, 28);
  const price = priceFit.weightedScore;
  if (priceFit.budgetScore === 100) {
    budgetReasoning = formatBudgetDelta(property.price || 0, effectiveBudgetMax);
    positives.push(budgetReasoning);
  } else if (priceFit.budgetScore > 0 && property.price && effectiveBudgetMax && property.price > effectiveBudgetMax) {
    budgetReasoning = formatBudgetDelta(property.price, effectiveBudgetMax);
    caution = budgetReasoning;
  } else if (priceFit.isRejected) {
    budgetReasoning = `respins: ${formatBudgetDelta(property.price || 0, effectiveBudgetMax)}`;
    caution = budgetReasoning;
  }

  const rooms = scoreTarget(property.rooms || 0, preferences.desiredRooms || 0, 16);
  if (rooms >= 12 && (preferences.desiredRooms || 0) > 0) {
    positives.push('numarul de camere este potrivit');
  }

  const bathrooms = scoreTarget(property.bathrooms || 0, preferences.desiredBathrooms || 0, 8);
  if (bathrooms >= 6 && (preferences.desiredBathrooms || 0) > 0) {
    positives.push('numarul de bai este potrivit');
  }

  const area = scoreRange(
    property.squareFootage || 0,
    preferences.desiredSquareFootageMin || 0,
    preferences.desiredSquareFootageMax || 0,
    16
  ).score;
  if (area >= 12 && (preferences.desiredSquareFootageMin || 0) > 0) {
    positives.push('suprafata este aproape de tinta');
  }

  const location = locationScore(property, preferences, contact);
  positives.push(...location.positives);

  const features = featureScore(property, preferences);
  positives.push(...features.positives);

  const score = roundScore(price + rooms + bathrooms + area + location.score + features.score + 8);
  return {
    isRejected: priceFit.isRejected,
    budgetScore: priceFit.budgetScore,
    budgetReasoning,
    score,
    reasoning: formatReasoning(positives, caution),
    zoneReasoning: location.zoneReasons.length > 0 ? location.zoneReasons.join(' · ') : null,
    zoneDebug: location.zoneDebug,
  };
}

export function getDeterministicMatchedProperties(
  contact: Contact,
  properties: Property[],
  limit = 12
): MatchedProperty[] {
  const preferences = derivePreferencesFromContact(contact);

  return properties
    .filter((property) => property.status !== 'Vândut' && property.status !== 'Închiriat' && property.status !== 'Rezervat')
    .map((property) => {
      const scored = scorePropertyForPreferences(property, preferences, contact);
      return {
        ...property,
        isRejected: scored.isRejected,
        matchScore: scored.score,
        reasoning: scored.reasoning || 'Compatibilitate buna pe criteriile esentiale.',
        zoneReasoning: scored.zoneReasoning,
        zoneDebug: scored.zoneDebug,
      };
    })
    .filter((property) => !property.isRejected)
    .filter((property) => property.matchScore >= 40)
    .sort(compareMatchedItemsByZonePriority)
    .slice(0, limit);
}

export function scoreBuyerForProperty(contact: Contact, property: Property) {
  const preferences = derivePreferencesFromContact(contact);
  return scorePropertyForPreferences(property, preferences, contact);
}

export function getDeterministicMatchedBuyers(
  property: Property,
  contacts: Contact[],
  limit = 12
): MatchedBuyer[] {
  return contacts
    .filter((contact) => contact.contactType === 'Cumparator')
    .filter((contact) => contact.status !== 'Câștigat' && contact.status !== 'Pierdut')
    .map((contact) => {
      const scored = scoreBuyerForProperty(contact, property);
      return {
        ...contact,
        isRejected: scored.isRejected,
        matchScore: scored.score,
        reasoning: scored.reasoning || 'Compatibilitate buna pe criteriile esentiale.',
        zoneReasoning: scored.zoneReasoning,
        zoneDebug: scored.zoneDebug,
      };
    })
    .filter((contact) => !contact.isRejected)
    .filter((contact) => contact.matchScore >= 40)
    .sort(compareMatchedItemsByZonePriority)
    .slice(0, limit);
}
