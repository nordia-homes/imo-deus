import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const yaml = require('js-yaml');

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const defaultInput = path.join(rootDir, 'src', 'lib', 'zones', 'bucuresti-ilfov-zone-ontology.json');
const defaultOutput = path.join(rootDir, 'scripts', 'sql', 'bucharest-ilfov-zone-seed.sql');

const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const current = process.argv[index];
  if (!current.startsWith('--')) continue;
  args.set(current.slice(2), process.argv[index + 1]);
  index += 1;
}

const inputPath = path.resolve(args.get('input') ?? defaultInput);
const outputPath = path.resolve(args.get('output') ?? defaultOutput);

const normalize = (value = '') =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const slugify = (value = '') => normalize(value).replace(/\s+/g, '-');

const sql = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
};

const parseOntology = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8');
  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {
    return yaml.load(raw);
  }
  return JSON.parse(raw);
};

const asStringArray = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []);

const ontology = parseOntology(inputPath);
ontology.zones = ontology.zones.map((zone) => ({
  ...zone,
  aliases: asStringArray(zone.aliases),
  adjacent_zones: asStringArray(zone.adjacent_zones),
  micro_zones: asStringArray(zone.micro_zones),
  commercial_clusters: asStringArray(zone.commercial_clusters),
  macro_area: asStringArray(zone.macro_area),
}));
const zoneNameMap = new Map(ontology.zones.map((zone) => [normalize(zone.name), zone]));
const clusterIds = new Map();

const getClusterId = (clusterName) => {
  const existing = clusterIds.get(clusterName);
  if (existing) return existing;
  const clusterId = `cluster::${slugify(clusterName)}`;
  clusterIds.set(clusterName, clusterId);
  return clusterId;
};

const statements = [];
statements.push('BEGIN;');
statements.push('TRUNCATE TABLE zone_clusters, zone_adjacency, zone_aliases, zone_macro_areas, zones RESTART IDENTITY CASCADE;');

for (const zone of ontology.zones) {
  statements.push(
    `INSERT INTO zones (` +
      `zone_id, region_name, county_name, sector_no, locality_name, zone_name, zone_slug, zone_type, parent_label, parent_zone_id, is_official, is_commercial, canonical_normalized_name` +
      `) VALUES (` +
      [
        sql(zone.zone_id),
        sql(ontology.metadata.region),
        sql(zone.county),
        sql(zone.sector),
        sql(zone.locality),
        sql(zone.name),
        sql(zone.slug),
        sql(zone.zone_type),
        sql(zone.parent),
        'NULL',
        sql(zone.is_official),
        sql(zone.is_commercial),
        sql(normalize(zone.name)),
      ].join(', ') +
      `);`
  );

  statements.push(
    `INSERT INTO zone_aliases (zone_id, alias, alias_normalized, alias_kind, confidence_weight) VALUES ` +
      `(${sql(zone.zone_id)}, ${sql(zone.name)}, ${sql(normalize(zone.name))}, 'alias', 1.0000), ` +
      `(${sql(zone.zone_id)}, ${sql(zone.slug.replace(/-/g, ' '))}, ${sql(normalize(zone.slug.replace(/-/g, ' ')))}, 'slug_variant', 0.9800);`
  );

  for (const alias of zone.aliases) {
    statements.push(
      `INSERT INTO zone_aliases (zone_id, alias, alias_normalized, alias_kind, confidence_weight) VALUES (` +
        `${sql(zone.zone_id)}, ${sql(alias)}, ${sql(normalize(alias))}, 'alias', 0.9700` +
      `);`
    );
  }

  for (const microZone of zone.micro_zones) {
    statements.push(
      `INSERT INTO zone_aliases (zone_id, alias, alias_normalized, alias_kind, confidence_weight) VALUES (` +
        `${sql(zone.zone_id)}, ${sql(microZone)}, ${sql(normalize(microZone))}, 'microzone', 0.9300` +
      `);`
    );
  }

  for (const clusterName of zone.commercial_clusters) {
    statements.push(
      `INSERT INTO zone_aliases (zone_id, alias, alias_normalized, alias_kind, confidence_weight) VALUES (` +
        `${sql(zone.zone_id)}, ${sql(clusterName)}, ${sql(normalize(clusterName))}, 'cluster_label', 0.8800` +
      `);`
    );
  }

  for (const macroArea of zone.macro_area) {
    statements.push(
      `INSERT INTO zone_macro_areas (zone_id, macro_area_code) VALUES (${sql(zone.zone_id)}, ${sql(macroArea)});`
    );
  }

  for (const adjacentName of zone.adjacent_zones) {
    const adjacentZone = zoneNameMap.get(normalize(adjacentName));
    if (!adjacentZone) continue;
    statements.push(
      `INSERT INTO zone_adjacency (source_zone_id, target_zone_id, relation_type, relation_weight) VALUES (` +
        `${sql(zone.zone_id)}, ${sql(adjacentZone.zone_id)}, 'adjacent', 1.0000` +
      `) ON CONFLICT DO NOTHING;`
    );
  }

  for (const clusterName of zone.commercial_clusters) {
    statements.push(
      `INSERT INTO zone_clusters (cluster_id, cluster_name, cluster_slug, zone_id) VALUES (` +
        `${sql(getClusterId(clusterName))}, ${sql(clusterName)}, ${sql(slugify(clusterName))}, ${sql(zone.zone_id)}` +
      `) ON CONFLICT DO NOTHING;`
    );
  }
}

statements.push('COMMIT;');

fs.writeFileSync(outputPath, `${statements.join('\n')}\n`, 'utf8');
console.log(`Generated ${outputPath}`);
