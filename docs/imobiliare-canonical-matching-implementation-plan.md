# Imobiliare Canonical Matching Plan

## Goal

Unify property publishing and buyer/property matching around the same canonical
location source: the Imobiliare.ro location catalog. Keep the existing
Bucuresti-Ilfov semantic ontology as an overlay for adjacency, cluster, and
macro-area scoring instead of using it as the primary identity source.

## Current State

- Properties already store `portalProfiles.imobiliare.locationId` for publish.
- Matching currently relies mostly on text plus the Bucuresti-Ilfov ontology.
- Buyers store legacy fields such as `city`, `zones`, and `generalZone`.
- The repository already contains a local snapshot of the Imobiliare.ro
  catalog in `src/data/imobiliare-locations-index.json`.

## Target State

### Canonical business model

- A property stores a canonical matching location in `locationProfile.primary`.
- A buyer stores canonical location preferences in `locationPreferencesV2`.
- Matching uses:
  1. canonical Imobiliare identity match
  2. semantic overlay where available
  3. legacy text fallback only when canonical data is missing

### Separation of concerns

- `locationProfile.primary` is the matching location.
- `portalProfiles.imobiliare.locationId` remains the publish location and can
  still differ if the portal requires a hidden child location for publish.

## Implementation Steps

1. Add canonical location types to the shared domain types.
2. Build a canonical location catalog utility from the local Imobiliare.ro
   snapshot.
3. Persist canonical property locations from the existing Imobiliare selector.
4. Add canonical buyer location preferences.
5. Refactor matching to prefer canonical location scoring.
6. Keep the semantic Bucuresti-Ilfov ontology as a secondary scoring layer.
7. Update buyer-facing internal forms so agents can select exact Imobiliare
   zones.
8. Keep public preference forms compatible through legacy fields and
   server-side canonical derivation.
9. Add migration scripts for historic properties and buyers.
10. Verify with typecheck and focused matching scenarios.

## Matching Rules

### Primary scoring

- Same canonical location id: strongest location match.
- Same canonical locality: medium location match.
- Same county only: weak fallback, not a strong recommendation on its own.
- Excluded canonical location or locality: hard reject.

### Secondary scoring

- Bucuresti-Ilfov ontology adds:
  - adjacency
  - commercial cluster
  - macro-area compatibility
  - ambiguity penalties

### Fallback behavior

- If canonical data is missing, continue using legacy `city`, `zones`,
  `generalZone`, and free-text preference parsing so old records keep working.

## Data Migration

### Properties

- If a property already has `portalProfiles.imobiliare.locationId`, derive and
  save `locationProfile.primary`.
- If it only has text, attempt a best-effort resolution from
  `locationLabel`, `location`, `city`, and `zone`.

### Buyers

- Convert legacy `zones` to canonical preferred locations when possible.
- Convert legacy `city` to an acceptable locality preference.
- Leave `generalZone` as a semantic-only fallback.

## Rollout

1. Write new fields without changing UI behavior.
2. Switch matching to canonical-first scoring.
3. Expose exact Imobiliare zone selection in the authenticated buyer forms.
4. Backfill historic records.
5. Expand semantic overlays city by city if needed.

## Success Criteria

- Property publish and matching both point to the same canonical location model.
- Buyer/property exact matches do not depend on text normalization alone.
- Existing data keeps matching through fallback logic.
- Bucuresti-Ilfov keeps its richer semantic ranking without blocking national
  coverage.
