export type ZoneType = 'sector' | 'locality' | 'cartier' | 'subzone';

export type ZoneMatchType = 'exact' | 'alias' | 'fuzzy' | 'ambiguous';

export type ZonePreferenceKind = 'preferred' | 'acceptable' | 'excluded';

export type ZonePreferenceScope = 'zone' | 'locality' | 'macro_area';

export interface MacroArea {
  code: string;
  name: string;
}

export interface OntologyZone {
  zone_id: string;
  zone_type: ZoneType;
  county: string;
  locality: string;
  name: string;
  slug: string;
  parent: string;
  sector: number | null;
  macro_area: string[];
  is_official: boolean;
  is_commercial: boolean;
  aliases: string[];
  adjacent_zones: string[];
  micro_zones: string[];
  commercial_clusters: string[];
}

export interface AmbiguousTermRule {
  candidates: string[];
  disambiguation_hints: string[];
}

export interface ZoneOntology {
  metadata: {
    name: string;
    version: string;
    generated_on: string;
    region: string;
    notes: string[];
  };
  macro_areas: MacroArea[];
  zones: OntologyZone[];
  normalization_rules: {
    ambiguous_terms: Record<string, AmbiguousTermRule>;
  };
}

export interface ZoneAlternative {
  zoneId: string;
  zoneName: string;
  confidence: number;
}

export interface ZoneNormalizationContext {
  locality?: string | null;
  county?: string | null;
  sector?: number | null;
  address?: string | null;
  title?: string | null;
  description?: string | null;
  clientIntent?: string | null;
}

export interface ZoneNormalizationResult {
  matched_zone_id: string | null;
  matched_zone_name: string | null;
  match_type: ZoneMatchType;
  confidence: number;
  alternatives: ZoneAlternative[];
}

export interface ClientZonePreference {
  clientId?: string;
  scope: ZonePreferenceScope;
  preference: ZonePreferenceKind;
  zoneId?: string;
  locality?: string;
  macroAreaCode?: string;
  sourceText?: string;
  weight?: number;
  behavioralWeight?: number;
}

export interface PropertyZoneFactInput {
  propertyId: string;
  rawZoneText?: string | null;
  locality?: string | null;
  county?: string | null;
  sector?: number | null;
  address?: string | null;
  title?: string | null;
  description?: string | null;
}

export interface PropertyZoneFact {
  propertyId: string;
  rawZoneText: string;
  zoneId: string | null;
  zoneName: string | null;
  locality: string | null;
  county: string | null;
  sector: number | null;
  macroAreas: string[];
  commercialClusters: string[];
  normalization: ZoneNormalizationResult;
}

export interface ZoneBehaviorSignal {
  zoneId?: string;
  locality?: string;
  macroAreaCode?: string;
  strength: number;
}

export interface ZoneScoreBreakdown {
  exact_or_alias_fit: number;
  adjacency_fit: number;
  cluster_fit: number;
  macro_fit: number;
  behavioral_fit: number;
  penalty_component: number;
}

export interface ZoneMatchExplanation {
  accepted: boolean;
  hardRejectReason?: string;
  reasons: string[];
  penalties: string[];
}

export interface ZoneMatchScore {
  zoneScore: number;
  breakdown: ZoneScoreBreakdown;
  explanation: ZoneMatchExplanation;
}
