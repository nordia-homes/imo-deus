import assert from 'node:assert/strict';

import { buildPropertyZoneFact, scorePropertyAgainstZonePreferences } from './matching';
import { normalizeZoneInput } from './normalization';
import { getAdjacentZones, getZoneByName } from './ontology';
import type { ClientZonePreference } from './types';

const tests: Array<{ name: string; run: () => void }> = [];
const test = (name: string, run: () => void) => tests.push({ name, run });

test('Baneasa without context remains ambiguous', () => {
  const result = normalizeZoneInput('Băneasa');
  assert.equal(result.match_type, 'ambiguous');
  assert.ok((result.alternatives?.length ?? 0) > 0);
});

test('Piata Presei resolves by alias to Casa Presei', () => {
  const result = normalizeZoneInput('Piața Presei');
  assert.equal(result.matched_zone_name, 'Casa Presei');
  assert.equal(result.match_type, 'alias');
});

test('Militari Rezidence fuzzy-maps to Militari Residence', () => {
  const result = normalizeZoneInput('Militari Rezidence');
  assert.equal(result.matched_zone_name, 'Militari Residence');
});

test('Pipera office context resolves to Pipera Sud', () => {
  const result = normalizeZoneInput('Pipera', { description: 'aproape de Promenada si birouri office pe Fabrica de Glucoza' });
  assert.equal(result.matched_zone_name, 'Pipera Sud');
});

test('Pipera with American School resolves to Iancu Nicolae', () => {
  const result = normalizeZoneInput('Pipera', { description: 'aproape de American School' });
  assert.equal(result.matched_zone_name, 'Iancu Nicolae');
});

test('Pipera with Voluntari context resolves to Pipera Voluntari', () => {
  const result = normalizeZoneInput('Pipera', { locality: 'Voluntari' });
  assert.equal(result.matched_zone_name, 'Pipera Voluntari');
});

test('Militari Residence stays in Chiajna commercial geography', () => {
  const result = normalizeZoneInput('Militari Residence');
  assert.equal(result.matched_zone_id, 'ilfov::chiajna::militari-residence');
});

test('Dimitrie Leonida resolves to Popesti-Leordeni cluster', () => {
  const result = normalizeZoneInput('Dimitrie Leonida langa metrou');
  assert.equal(result.matched_zone_name, 'Dimitrie Leonida');
});

test('Baneasa airport corridor resolves to Aeroport Baneasa', () => {
  const result = normalizeZoneInput('Baneasa', { description: 'airport corridor si aeroport' });
  assert.equal(result.matched_zone_name, 'Aeroport Baneasa');
});

test('Baneasa Greenfield context resolves to Sisesti-adjacent area', () => {
  const result = normalizeZoneInput('Baneasa', { description: 'Greenfield si Jandarmeriei' });
  assert.equal(result.matched_zone_name, 'Sisesti');
});

test('Popesti with Drumul Fermei context resolves to Drumul Fermei', () => {
  const result = normalizeZoneInput('Popești', { description: 'aproape de Drumul Fermei' });
  assert.equal(result.matched_zone_name, 'Drumul Fermei');
});

test('Popesti without context remains ambiguous', () => {
  const result = normalizeZoneInput('Popesti');
  assert.equal(result.match_type, 'ambiguous');
  assert.ok((result.alternatives?.length ?? 0) > 0);
});

test('Berceni Ilfov resolves to Berceni Ilfov Central', () => {
  const result = normalizeZoneInput('Berceni Ilfov');
  assert.equal(result.matched_zone_name, 'Berceni Ilfov Central');
});

test('Berceni without context remains ambiguous', () => {
  const result = normalizeZoneInput('Berceni');
  assert.equal(result.match_type, 'ambiguous');
  assert.ok((result.alternatives?.length ?? 0) > 0);
});

test('Leonida beats generic Berceni when context exists', () => {
  const result = normalizeZoneInput('Berceni', { description: 'leonida si popesti' });
  assert.equal(result.matched_zone_name, 'Dimitrie Leonida');
});

test('composite Tei / Doamna Ghica string resolves to Tei', () => {
  const result = normalizeZoneInput('Tei / Doamna Ghica / Complet renovat');
  assert.equal(result.matched_zone_name, 'Tei');
});

test('Ion Berindei address hint resolves to Tei', () => {
  const result = normalizeZoneInput('Strada Ion Berindei 12', {
    title: 'Apartament 2 camere',
    locality: 'Bucuresti',
  });
  assert.equal(result.matched_zone_name, 'Tei');
});

test('preferred exact zone yields high score', () => {
  const propertyFact = buildPropertyZoneFact({ propertyId: 'p-1', rawZoneText: 'Aviatiei' });
  const preferences: ClientZonePreference[] = [{ scope: 'zone', preference: 'preferred', zoneId: 'bucuresti::bucuresti::aviatiei' }];
  const score = scorePropertyAgainstZonePreferences({ propertyFact, preferences });
  assert.ok(score.zoneScore >= 45);
});

test('adjacent preferred zone gets adjacency credit', () => {
  const aviatiei = getZoneByName('Aviatiei');
  assert.ok(aviatiei);
  const adjacentZone = getAdjacentZones(aviatiei.zone_id)[0];
  assert.ok(adjacentZone);

  const forward = scorePropertyAgainstZonePreferences({
    propertyFact: buildPropertyZoneFact({ propertyId: 'p-2', rawZoneText: adjacentZone.name }),
    preferences: [{ scope: 'zone', preference: 'preferred', zoneId: aviatiei.zone_id }],
  });

  const reverse = scorePropertyAgainstZonePreferences({
    propertyFact: buildPropertyZoneFact({ propertyId: 'p-2b', rawZoneText: aviatiei.name }),
    preferences: [{ scope: 'zone', preference: 'preferred', zoneId: adjacentZone.zone_id }],
  });

  assert.ok(forward.breakdown.adjacency_fit > 0 || reverse.breakdown.adjacency_fit > 0);
});

test('same commercial cluster gets cluster credit', () => {
  const propertyFact = buildPropertyZoneFact({ propertyId: 'p-3', rawZoneText: 'Primaverii' });
  const preferences: ClientZonePreference[] = [{ scope: 'zone', preference: 'preferred', zoneId: 'bucuresti::bucuresti::herastrau' }];
  const score = scorePropertyAgainstZonePreferences({ propertyFact, preferences });
  assert.ok(score.breakdown.cluster_fit > 0);
});

test('same macro area but not direct match still scores', () => {
  const propertyFact = buildPropertyZoneFact({ propertyId: 'p-4', rawZoneText: 'Pajura' });
  const preferences: ClientZonePreference[] = [{ scope: 'macro_area', preference: 'preferred', macroAreaCode: 'NORD_VEST' }];
  const score = scorePropertyAgainstZonePreferences({ propertyFact, preferences });
  assert.ok(score.breakdown.macro_fit > 0);
});

test('zone preferences alone do not grant macro fit for broad unrelated areas', () => {
  const propertyFact = buildPropertyZoneFact({ propertyId: 'p-4b', rawZoneText: 'Pipera Sud' });
  const preferences: ClientZonePreference[] = [
    { scope: 'zone', preference: 'preferred', zoneId: 'bucuresti::bucuresti::militari' },
    { scope: 'zone', preference: 'preferred', zoneId: 'bucuresti::bucuresti::drumul-taberei' },
  ];
  const score = scorePropertyAgainstZonePreferences({ propertyFact, preferences });
  assert.equal(score.breakdown.macro_fit, 0);
  assert.equal(score.breakdown.cluster_fit, 0);
});

test('excluded zone is a hard reject', () => {
  const propertyFact = buildPropertyZoneFact({ propertyId: 'p-5', rawZoneText: 'Rahova' });
  const preferences: ClientZonePreference[] = [{ scope: 'zone', preference: 'excluded', zoneId: 'bucuresti::bucuresti::rahova' }];
  const score = scorePropertyAgainstZonePreferences({ propertyFact, preferences });
  assert.equal(score.zoneScore, 0);
  assert.equal(score.explanation.accepted, false);
});

test('excluded locality is a hard reject', () => {
  const propertyFact = buildPropertyZoneFact({ propertyId: 'p-6', rawZoneText: 'Militari Residence' });
  const preferences: ClientZonePreference[] = [{ scope: 'locality', preference: 'excluded', locality: 'Chiajna' }];
  const score = scorePropertyAgainstZonePreferences({ propertyFact, preferences });
  assert.equal(score.zoneScore, 0);
  assert.equal(score.explanation.accepted, false);
});

test('excluded macro area applies strong penalty', () => {
  const propertyFact = buildPropertyZoneFact({ propertyId: 'p-7', rawZoneText: 'Dudu' });
  const preferences: ClientZonePreference[] = [
    { scope: 'macro_area', preference: 'excluded', macroAreaCode: 'ILFOV_VEST' },
    { scope: 'zone', preference: 'preferred', zoneId: 'ilfov::chiajna::rosu' },
  ];
  const score = scorePropertyAgainstZonePreferences({ propertyFact, preferences });
  assert.ok(score.breakdown.penalty_component < 1);
});

test('ambiguous low-confidence normalization reduces score', () => {
  const propertyFact = buildPropertyZoneFact({ propertyId: 'p-8', rawZoneText: 'Popesti' });
  const preferences: ClientZonePreference[] = [{ scope: 'macro_area', preference: 'preferred', macroAreaCode: 'ILFOV_SUD' }];
  const score = scorePropertyAgainstZonePreferences({ propertyFact, preferences });
  assert.ok(score.breakdown.penalty_component < 1);
});

let passed = 0;
for (const current of tests) {
  current.run();
  passed += 1;
}

console.log(`Zone services tests passed: ${passed}/${tests.length}`);
