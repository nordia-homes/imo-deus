BEGIN;

CREATE TABLE IF NOT EXISTS zones (
  zone_id TEXT PRIMARY KEY,
  region_name TEXT NOT NULL,
  county_name TEXT NOT NULL,
  sector_no INTEGER NULL,
  locality_name TEXT NOT NULL,
  zone_name TEXT NOT NULL,
  zone_slug TEXT NOT NULL,
  zone_type TEXT NOT NULL CHECK (zone_type IN ('sector', 'locality', 'cartier', 'subzone')),
  parent_label TEXT NULL,
  parent_zone_id TEXT NULL,
  is_official BOOLEAN NOT NULL DEFAULT FALSE,
  is_commercial BOOLEAN NOT NULL DEFAULT TRUE,
  canonical_normalized_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS zones_slug_ux ON zones (county_name, locality_name, zone_slug);
CREATE INDEX IF NOT EXISTS zones_type_idx ON zones (zone_type);
CREATE INDEX IF NOT EXISTS zones_locality_idx ON zones (locality_name);
CREATE INDEX IF NOT EXISTS zones_sector_idx ON zones (sector_no);
CREATE INDEX IF NOT EXISTS zones_normalized_name_idx ON zones (canonical_normalized_name);

CREATE TABLE IF NOT EXISTS zone_aliases (
  alias_id BIGSERIAL PRIMARY KEY,
  zone_id TEXT NOT NULL REFERENCES zones(zone_id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_normalized TEXT NOT NULL,
  alias_kind TEXT NOT NULL CHECK (alias_kind IN ('alias', 'microzone', 'cluster_label', 'slug_variant')),
  confidence_weight NUMERIC(5,4) NOT NULL DEFAULT 1.0000
);

CREATE UNIQUE INDEX IF NOT EXISTS zone_aliases_unique_idx
  ON zone_aliases (zone_id, alias_normalized, alias_kind);
CREATE INDEX IF NOT EXISTS zone_aliases_lookup_idx ON zone_aliases (alias_normalized);

CREATE TABLE IF NOT EXISTS zone_adjacency (
  source_zone_id TEXT NOT NULL REFERENCES zones(zone_id) ON DELETE CASCADE,
  target_zone_id TEXT NOT NULL REFERENCES zones(zone_id) ON DELETE CASCADE,
  relation_type TEXT NOT NULL DEFAULT 'adjacent',
  relation_weight NUMERIC(5,4) NOT NULL DEFAULT 1.0000,
  PRIMARY KEY (source_zone_id, target_zone_id)
);

CREATE TABLE IF NOT EXISTS zone_clusters (
  cluster_id TEXT NOT NULL,
  cluster_name TEXT NOT NULL,
  cluster_slug TEXT NOT NULL,
  zone_id TEXT NOT NULL REFERENCES zones(zone_id) ON DELETE CASCADE,
  PRIMARY KEY (cluster_id, zone_id)
);

CREATE TABLE IF NOT EXISTS zone_macro_areas (
  zone_id TEXT NOT NULL REFERENCES zones(zone_id) ON DELETE CASCADE,
  macro_area_code TEXT NOT NULL,
  PRIMARY KEY (zone_id, macro_area_code)
);

CREATE TABLE IF NOT EXISTS client_zone_preferences (
  preference_id BIGSERIAL PRIMARY KEY,
  client_id TEXT NOT NULL,
  preference_scope TEXT NOT NULL CHECK (preference_scope IN ('zone', 'locality', 'macro_area')),
  preference_kind TEXT NOT NULL CHECK (preference_kind IN ('preferred', 'acceptable', 'excluded')),
  zone_id TEXT NULL REFERENCES zones(zone_id) ON DELETE CASCADE,
  locality_name TEXT NULL,
  macro_area_code TEXT NULL,
  source_text TEXT NULL,
  weight NUMERIC(5,4) NOT NULL DEFAULT 1.0000,
  behavioral_weight NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (preference_scope = 'zone' AND zone_id IS NOT NULL AND locality_name IS NULL AND macro_area_code IS NULL) OR
    (preference_scope = 'locality' AND zone_id IS NULL AND locality_name IS NOT NULL AND macro_area_code IS NULL) OR
    (preference_scope = 'macro_area' AND zone_id IS NULL AND locality_name IS NULL AND macro_area_code IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS property_zone_facts (
  property_id TEXT PRIMARY KEY,
  raw_zone_text TEXT NOT NULL,
  zone_id TEXT NULL REFERENCES zones(zone_id) ON DELETE SET NULL,
  normalized_zone_name TEXT NULL,
  locality_name TEXT NULL,
  county_name TEXT NULL,
  sector_no INTEGER NULL,
  macro_area_codes TEXT[] NOT NULL DEFAULT '{}',
  cluster_ids TEXT[] NOT NULL DEFAULT '{}',
  normalization_match_type TEXT NOT NULL CHECK (normalization_match_type IN ('exact', 'alias', 'fuzzy', 'ambiguous')),
  normalization_confidence NUMERIC(5,4) NOT NULL DEFAULT 0.0000,
  normalization_alternatives JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;
