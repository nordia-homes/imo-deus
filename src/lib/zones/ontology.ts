import ontologyJson from './bucuresti-ilfov-zone-ontology.json';

import type { OntologyZone, ZoneOntology } from './types';

const coerceStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const sanitizeOntology = (ontology: ZoneOntology): ZoneOntology => ({
  ...ontology,
  zones: ontology.zones.map((zone) => ({
    ...zone,
    aliases: coerceStringArray(zone.aliases),
    adjacent_zones: coerceStringArray(zone.adjacent_zones),
    micro_zones: coerceStringArray(zone.micro_zones),
    commercial_clusters: coerceStringArray(zone.commercial_clusters),
    macro_area: coerceStringArray(zone.macro_area),
  })),
});

export const bucurestiIlfovZoneOntology = sanitizeOntology(ontologyJson as ZoneOntology);

export const normalizeRomanianText = (value?: string | null) =>
  (value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const slugify = (value: string) =>
  normalizeRomanianText(value)
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');

const unique = <T>(items: T[]) => Array.from(new Set(items));

const tokenSet = (value?: string | null) =>
  normalizeRomanianText(value)
    .split(' ')
    .filter(Boolean);

const buildNameIndex = (zones: PreparedZone[]) => {
  const index = new Map<string, PreparedZone[]>();

  const push = (key: string, zone: PreparedZone) => {
    const normalized = normalizeRomanianText(key);
    if (!normalized) {
      return;
    }

    const current = index.get(normalized) ?? [];
    current.push(zone);
    index.set(normalized, current);
  };

  for (const zone of zones) {
    push(zone.name, zone);
    push(zone.slug.replace(/-/g, ' '), zone);

    for (const alias of zone.aliases) {
      push(alias, zone);
    }

    for (const microZone of zone.micro_zones) {
      push(microZone, zone);
    }

    for (const cluster of zone.commercial_clusters) {
      push(cluster, zone);
    }
  }

  return index;
};

export interface PreparedZone extends OntologyZone {
  normalizedName: string;
  normalizedAliases: string[];
  normalizedMicroZones: string[];
  normalizedClusters: string[];
  searchTokens: string[];
}

export interface PreparedOntology {
  ontology: ZoneOntology;
  zones: PreparedZone[];
  zoneById: Map<string, PreparedZone>;
  zoneByNormalizedName: Map<string, PreparedZone[]>;
}

const preparedZones: PreparedZone[] = bucurestiIlfovZoneOntology.zones.map((zone) => ({
  ...zone,
  normalizedName: normalizeRomanianText(zone.name),
  normalizedAliases: zone.aliases.map((alias) => normalizeRomanianText(alias)),
  normalizedMicroZones: zone.micro_zones.map((microZone) => normalizeRomanianText(microZone)),
  normalizedClusters: zone.commercial_clusters.map((cluster) => normalizeRomanianText(cluster)),
  searchTokens: unique(
    [
      zone.name,
      zone.slug.replace(/-/g, ' '),
      zone.locality,
      zone.county,
      ...zone.aliases,
      ...zone.micro_zones,
      ...zone.commercial_clusters,
    ].flatMap((item) => tokenSet(item))
  ),
}));

const zoneById = new Map(preparedZones.map((zone) => [zone.zone_id, zone]));
const zoneByNormalizedName = buildNameIndex(preparedZones);

export const preparedBucurestiIlfovOntology: PreparedOntology = {
  ontology: bucurestiIlfovZoneOntology,
  zones: preparedZones,
  zoneById,
  zoneByNormalizedName,
};

export function getZoneByName(name: string) {
  const matches = zoneByNormalizedName.get(normalizeRomanianText(name)) ?? [];
  return matches[0] ?? null;
}

export function getZonesByName(name: string) {
  return zoneByNormalizedName.get(normalizeRomanianText(name)) ?? [];
}

export function getAdjacentZones(zoneId: string) {
  const zone = zoneById.get(zoneId);
  if (!zone) {
    return [];
  }

  return zone.adjacent_zones
    .map((name) => getZoneByName(name))
    .filter((candidate): candidate is PreparedZone => candidate !== null);
}

export function getClusterPeers(zoneId: string) {
  const zone = zoneById.get(zoneId);
  if (!zone) {
    return [];
  }

  const clusterNames = new Set(zone.commercial_clusters.map((cluster) => normalizeRomanianText(cluster)));

  return preparedZones.filter(
    (candidate) =>
      candidate.zone_id !== zone.zone_id &&
      candidate.normalizedClusters.some((cluster) => clusterNames.has(cluster))
  );
}

export function getMacroAreaPeers(zoneId: string) {
  const zone = zoneById.get(zoneId);
  if (!zone) {
    return [];
  }

  const macroAreas = new Set(zone.macro_area);
  return preparedZones.filter(
    (candidate) =>
      candidate.zone_id !== zone.zone_id && candidate.macro_area.some((macroArea) => macroAreas.has(macroArea))
  );
}
