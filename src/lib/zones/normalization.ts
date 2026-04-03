import {
  getZoneByName,
  getZonesByName,
  normalizeRomanianText,
  preparedBucurestiIlfovOntology,
  type PreparedZone,
} from './ontology';
import type {
  ZoneAlternative,
  ZoneNormalizationContext,
  ZoneNormalizationResult,
} from './types';

const unique = <T>(items: T[]) => Array.from(new Set(items));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const tokenize = (value?: string | null) =>
  normalizeRomanianText(value)
    .split(' ')
    .filter(Boolean);

const joinContext = (input: string, context?: ZoneNormalizationContext) =>
  [
    input,
    context?.title,
    context?.address,
    context?.description,
    context?.locality,
    context?.county,
    context?.clientIntent,
    context?.sector ? `sector ${context.sector}` : '',
  ]
    .filter(Boolean)
    .join(' ');

const editDistance = (left: string, right: string) => {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index]);
  for (let column = 1; column <= right.length; column += 1) {
    rows[0][column] = column;
  }

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + substitutionCost
      );
    }
  }

  return rows[left.length][right.length];
};

const toAlternatives = (items: Array<{ zone: PreparedZone; confidence: number }>): ZoneAlternative[] =>
  items.slice(0, 5).map(({ zone, confidence }) => ({
    zoneId: zone.zone_id,
    zoneName: zone.name,
    confidence: Number(confidence.toFixed(2)),
  }));

const containsPhrase = (haystack: string, phrase: string) => {
  if (!haystack || !phrase) {
    return false;
  }

  return haystack === phrase || haystack.includes(`${phrase} `) || haystack.includes(` ${phrase}`) || haystack.includes(` ${phrase} `);
};

const embeddedMatch = (
  normalizedInput: string,
  normalizedText: string
): { zone: PreparedZone; matchType: 'exact' | 'alias' | 'fuzzy'; confidence: number; alternatives: ZoneAlternative[] } | null => {
  const ranked = preparedBucurestiIlfovOntology.zones
    .map((zone) => {
      let score = -1;

      if (containsPhrase(normalizedInput, zone.normalizedName)) {
        score = Math.max(score, 100);
      }

      if (zone.normalizedAliases.some((alias) => containsPhrase(normalizedInput, alias))) {
        score = Math.max(score, 92);
      }

      if (zone.normalizedMicroZones.some((microZone) => containsPhrase(normalizedText, microZone))) {
        score = Math.max(score, 88);
      }

      if (zone.normalizedClusters.some((cluster) => containsPhrase(normalizedText, cluster))) {
        score = Math.max(score, 80);
      }

      const canonicalIndex = normalizedInput.indexOf(zone.normalizedName);
      if (canonicalIndex >= 0) {
        score += Math.max(0, 8 - canonicalIndex);
      }

      return { zone, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  if (!ranked.length) {
    return null;
  }

  const [top, runnerUp] = ranked;
  if (runnerUp && top.score - runnerUp.score <= 4) {
    return {
      zone: top.zone,
      matchType: 'fuzzy',
      confidence: 0.7,
      alternatives: toAlternatives(
        ranked.slice(0, 5).map((entry) => ({
          zone: entry.zone,
          confidence: clamp(entry.score / 100, 0.6, 0.9),
        }))
      ),
    };
  }

  const matchType =
    containsPhrase(normalizedInput, top.zone.normalizedName)
      ? 'exact'
      : top.zone.normalizedAliases.some((alias) => containsPhrase(normalizedInput, alias))
        ? 'alias'
        : 'fuzzy';

  return {
    zone: top.zone,
    matchType,
    confidence: clamp(top.score / 100, 0.82, 0.98),
    alternatives: toAlternatives(
      ranked.slice(1, 5).map((entry) => ({
        zone: entry.zone,
        confidence: clamp(entry.score / 100, 0.55, 0.9),
      }))
    ),
  };
};

const exactMatch = (
  normalizedInput: string
): { zone: PreparedZone; matchType: 'exact' | 'alias'; confidence: number } | null => {
  const zones = getZonesByName(normalizedInput);
  if (!zones.length) {
    return null;
  }

  const canonicalMatches = zones.filter((zone) => zone.normalizedName === normalizedInput);
  if (canonicalMatches.length === 1) {
    return {
      zone: canonicalMatches[0],
      matchType: 'exact' as const,
      confidence: 0.99,
    };
  }

  if (zones.length !== 1) {
    return null;
  }

  const zone = zones[0];
  const isCanonical = zone.normalizedName === normalizedInput;
  return {
    zone,
    matchType: isCanonical ? 'exact' : 'alias',
    confidence: isCanonical ? 0.99 : 0.97,
  };
};

const scoreContextAgainstZone = (zone: PreparedZone, normalizedText: string, tokens: string[]) => {
  let score = 0;

  if (normalizedText.includes(zone.normalizedName)) score += 4;
  if (zone.normalizedAliases.some((alias) => normalizedText.includes(alias))) score += 3;
  if (zone.normalizedMicroZones.some((microZone) => normalizedText.includes(microZone))) score += 5;
  if (zone.normalizedClusters.some((cluster) => normalizedText.includes(cluster))) score += 3;

  const locality = normalizeRomanianText(zone.locality);
  const county = normalizeRomanianText(zone.county);
  if (locality && normalizedText.includes(locality)) score += 5;
  if (county && normalizedText.includes(county)) score += 2;
  if (zone.sector && normalizedText.includes(`sector ${zone.sector}`)) score += 4;

  const overlappingTokens = zone.searchTokens.filter((token) => tokens.includes(token));
  score += Math.min(6, overlappingTokens.length);

  return score;
};

const disambiguateSpecialCase = (normalizedText: string) => {
  if (/\bmilitari\s+residence\b/.test(normalizedText) || /\bmilitari\s+rezidence\b/.test(normalizedText)) {
    return getZoneByName('Militari Residence');
  }

  if (normalizedText.includes('dimitrie leonida') || normalizedText.includes('metro leonida')) {
    return getZoneByName('Dimitrie Leonida');
  }

  if (normalizedText.includes('drumul fermei')) {
    return getZoneByName('Drumul Fermei');
  }

  if (normalizedText.includes('biruintei')) {
    return getZoneByName('Biruintei');
  }

  if (normalizedText.includes('baneasa shopping city') || normalizedText.includes('baneasa mall')) {
    return getZoneByName('Baneasa');
  }

  if (normalizedText.includes('airport') || normalizedText.includes('aeroport')) {
    return getZoneByName('Aeroport Baneasa');
  }

  if (normalizedText.includes('greenfield') || normalizedText.includes('jandarmeriei') || normalizedText.includes('sisesti')) {
    return getZoneByName('Sisesti');
  }

  if (normalizedText.includes('american school') || normalizedText.includes('iancu nicolae')) {
    return getZoneByName('Iancu Nicolae');
  }

  if (
    normalizedText.includes('promenada') ||
    normalizedText.includes('fabrica de glucoza') ||
    normalizedText.includes('office') ||
    normalizedText.includes('omv') ||
    normalizedText.includes('omt')
  ) {
    return getZoneByName('Pipera Sud');
  }

  if (normalizedText.includes('voluntari') || normalizedText.includes('pipera nord')) {
    return getZoneByName('Pipera Voluntari');
  }

  return null;
};

const fuzzyMatch = (normalizedInput: string) => {
  const scored = preparedBucurestiIlfovOntology.zones
    .map((zone) => {
      const candidates = [zone.normalizedName, ...zone.normalizedAliases];
      const distance = Math.min(...candidates.map((candidate) => editDistance(normalizedInput, candidate)));
      const longest = Math.max(normalizedInput.length, ...candidates.map((candidate) => candidate.length));
      const similarity = longest > 0 ? 1 - distance / longest : 0;
      return { zone, similarity };
    })
    .filter((entry) => entry.similarity >= 0.72)
    .sort((left, right) => right.similarity - left.similarity);

  if (!scored.length) {
    return null;
  }

  return {
    zone: scored[0].zone,
    confidence: clamp(scored[0].similarity, 0.72, 0.94),
    alternatives: toAlternatives(
      scored.slice(0, 4).map((entry) => ({
        zone: entry.zone,
        confidence: entry.similarity,
      }))
    ),
  };
};

const ambiguousMatch = (normalizedText: string, tokens: string[]) => {
  for (const [term, rule] of Object.entries(
    preparedBucurestiIlfovOntology.ontology.normalization_rules.ambiguous_terms
  )) {
    if (!normalizedText.includes(term)) {
      continue;
    }

    const preselected = disambiguateSpecialCase(normalizedText);
    if (preselected) {
      return {
        zone: preselected,
        matchType: 'fuzzy' as const,
        confidence: 0.95,
        alternatives: [],
      };
    }

    const ranked = rule.candidates
      .map((candidateName) => {
        const zone = getZoneByName(candidateName);
        if (!zone) {
          return null;
        }

        let score = scoreContextAgainstZone(zone, normalizedText, tokens);
        const hintsMatched = rule.disambiguation_hints.filter((hint) => normalizedText.includes(normalizeRomanianText(hint)));
        score += hintsMatched.length * 2;

        if (term === 'militari' && zone.name === 'Militari Residence' && (normalizedText.includes('residence') || normalizedText.includes('chiajna'))) {
          score += 6;
        }

        if (term === 'berceni' && zone.name === 'Dimitrie Leonida' && (normalizedText.includes('leonida') || normalizedText.includes('popesti'))) {
          score += 6;
        }

        if (term === 'popesti' && zone.name === 'Dimitrie Leonida' && normalizedText.includes('metrou')) {
          score += 5;
        }

        if (term === 'baneasa' && zone.name === 'Aeroport Baneasa' && normalizedText.includes('airport')) {
          score += 6;
        }

        return { zone, score };
      })
      .filter((entry): entry is { zone: PreparedZone; score: number } => entry !== null)
      .sort((left, right) => right.score - left.score);

    if (!ranked.length) {
      continue;
    }

    const [top, runnerUp] = ranked;
    if (top.score >= 7 && (!runnerUp || top.score - runnerUp.score >= 2)) {
      return {
        zone: top.zone,
        matchType: 'fuzzy' as const,
        confidence: clamp(0.78 + top.score * 0.02, 0.78, 0.96),
        alternatives: toAlternatives(
          ranked.slice(1, 5).map((entry) => ({
            zone: entry.zone,
            confidence: clamp(0.55 + entry.score * 0.02, 0.55, 0.88),
          }))
        ),
      };
    }

    return {
      zone: null,
      matchType: 'ambiguous' as const,
      confidence: clamp(0.35 + top.score * 0.03, 0.35, 0.69),
      alternatives: toAlternatives(
        ranked.slice(0, 5).map((entry) => ({
          zone: entry.zone,
          confidence: clamp(0.4 + entry.score * 0.03, 0.4, 0.82),
        }))
      ),
    };
  }

  return null;
};

export function normalizeZoneInput(input: string, context?: ZoneNormalizationContext): ZoneNormalizationResult {
  const fullText = joinContext(input, context);
  const normalizedText = normalizeRomanianText(fullText);
  const normalizedInput = normalizeRomanianText(input);
  const tokens = unique(tokenize(fullText));

  if (!normalizedInput) {
    return {
      matched_zone_id: null,
      matched_zone_name: null,
      match_type: 'ambiguous',
      confidence: 0,
      alternatives: [],
    };
  }

  const specialCase = disambiguateSpecialCase(normalizedText);
  if (specialCase) {
    return {
      matched_zone_id: specialCase.zone_id,
      matched_zone_name: specialCase.name,
      match_type: normalizedInput === specialCase.normalizedName ? 'exact' : 'fuzzy',
      confidence: 0.95,
      alternatives: [],
    };
  }

  const ambiguous = ambiguousMatch(normalizedText, tokens);
  if (ambiguous) {
    return {
      matched_zone_id: ambiguous.zone?.zone_id ?? null,
      matched_zone_name: ambiguous.zone?.name ?? null,
      match_type: ambiguous.matchType,
      confidence: Number(ambiguous.confidence.toFixed(2)),
      alternatives: ambiguous.alternatives,
    };
  }

  const exact = exactMatch(normalizedInput);
  if (exact) {
    return {
      matched_zone_id: exact.zone.zone_id,
      matched_zone_name: exact.zone.name,
      match_type: exact.matchType,
      confidence: exact.confidence,
      alternatives: [],
    };
  }

  const embedded = embeddedMatch(normalizedInput, normalizedText);
  if (embedded) {
    return {
      matched_zone_id: embedded.zone.zone_id,
      matched_zone_name: embedded.zone.name,
      match_type: embedded.matchType,
      confidence: Number(embedded.confidence.toFixed(2)),
      alternatives: embedded.alternatives,
    };
  }

  const fuzzy = fuzzyMatch(normalizedInput);
  if (fuzzy) {
    return {
      matched_zone_id: fuzzy.zone.zone_id,
      matched_zone_name: fuzzy.zone.name,
      match_type: 'fuzzy',
      confidence: Number(fuzzy.confidence.toFixed(2)),
      alternatives: fuzzy.alternatives,
    };
  }

  return {
    matched_zone_id: null,
    matched_zone_name: null,
    match_type: 'ambiguous',
    confidence: 0,
    alternatives: [],
  };
}
