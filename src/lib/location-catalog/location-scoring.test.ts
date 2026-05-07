import assert from 'node:assert/strict';

import { scoreCanonicalLocationAgainstPreferences } from './location-scoring';
import { resolveCanonicalLocationRef } from './imobiliare-canonical';
import type { BuyerLocationPreference } from '@/lib/types';

const tests: Array<{ name: string; run: () => void }> = [];
const test = (name: string, run: () => void) => tests.push({ name, run });

test('exact canonical location is scored strongly', () => {
  const location = resolveCanonicalLocationRef({
    city: 'Popesti-Leordeni',
    zone: 'Popesti-Leordeni',
  });
  assert.ok(location);

  const preferences: BuyerLocationPreference[] = [
    {
      preference: 'preferred',
      scope: 'location',
      location,
      source: 'manual',
      sourceText: location.display,
      weight: 1,
    },
  ];

  const result = scoreCanonicalLocationAgainstPreferences({
    propertyLocation: location,
    preferences,
  });
  assert.ok(result.accepted);
  assert.ok(result.breakdown.exact > 0);
  assert.ok(result.score >= 70);
});

test('excluded locality is a hard reject', () => {
  const propertyLocation = resolveCanonicalLocationRef({
    city: 'Popesti-Leordeni',
    zone: 'Popesti-Leordeni',
  });
  assert.ok(propertyLocation);

  const result = scoreCanonicalLocationAgainstPreferences({
    propertyLocation,
    preferences: [
      {
        preference: 'excluded',
        scope: 'locality',
        locality: 'Popesti-Leordeni',
        source: 'migration',
      },
    ],
  });

  assert.equal(result.accepted, false);
  assert.equal(result.score, 0);
});

let passed = 0;
for (const current of tests) {
  current.run();
  passed += 1;
}

console.log(`Canonical location scoring tests passed: ${passed}/${tests.length}`);
