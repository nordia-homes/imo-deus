# Owner Listings Baseline Implementation Plan

## Goal

Implement a stable `owner listings` flow with these rules:

- scraping scope is driven by explicit source URLs, not by agency city
- agency city is used only as the default UI filter
- the first full scrape for a scope is treated as the baseline
- baseline listings are stored but not marked `NOU`
- from the second full cycle onward, only truly first-seen listings are marked `NOU`
- the default UI order is `new -> old` using `firstDiscoveredAt desc`
- repeated sightings must not visually reshuffle old listings as if they reappeared

## Current Gaps

- scrape scope is still derived from `resolveAgencyOwnerListingScope(agency)`
- the UI sorts by `postedAt desc`, which makes refreshed listings feel unstable
- `isNew` is currently cleared per scope at cycle start, which does not match baseline semantics
- there is no explicit baseline completion state per scope
- listings are stored globally, but the operational cycle is still agency-driven

## Target Design

### 1. Scope Registry

Introduce a central scope registry for owner-listings scraping:

- each scope has:
  - `key`
  - `label`
  - `defaultCityKeys`
  - `searchKeywords`
  - `sourceUrls` per portal
- examples:
  - `bucuresti-ilfov`
  - `cluj`
  - `timis`

The scraper must use this registry directly.

### 2. Scope State

Introduce scope-level state collection, separate from agency:

- collection: `ownerListingScopes`
- document id: `scopeKey`

Suggested fields:

- `scopeKey`
- `scopeLabel`
- `baselineStatus`: `pending | running | completed`
- `baselineCompletedAt`
- `baselineCycleNumber`
- `cycleNumber`
- `status`
- `currentSource`
- `currentSourceIndex`
- `cooldownUntil`
- `hardPageLimit`
- `maxAgeDays`
- `maxListingsPerSource`
- `maxPagesPerTick`
- `maxRuntimeMs`
- `createdAt`
- `updatedAt`

### 3. Listing Lifecycle

Every listing keeps:

- `scopeKey`
- `scopeCity`
- `firstDiscoveredAt`
- `lastSeenAt`
- `discoveredCycleNumber`
- `isBaselineListing`
- `isNew`
- optional future field:
  - `newUntilAt`

Rules:

- if listing does not exist and baseline is not complete:
  - save it
  - `isBaselineListing = true`
  - `isNew = false`
- if listing does not exist and baseline is complete:
  - save it
  - `isBaselineListing = false`
  - `isNew = true`
- if listing already exists:
  - update mutable data only
  - preserve `firstDiscoveredAt`
  - preserve `discoveredCycleNumber`
  - never set `isNew = true` again just because it was seen again

### 4. Badge Semantics

Use temporary `NOU`:

- recommended rule:
  - `isNew = true` only for listings first discovered within the last 7 days
- background tick or read-time normalization can clear stale `isNew`

### 5. UI Behavior

Page `Anunturi de la proprietari`:

- default scope filter comes from agency city mapping
- data source itself is global across all configured scopes
- default sort:
  - `firstDiscoveredAt desc`
- optional filters:
  - `Doar NOI`
  - scope selector

Important:

- do not sort by `lastSeenAt`
- do not sort by `scrapedAt`
- old listings must stay visually stable

## Implementation Steps

### Phase 1. Scope Registry Refactor

- replace agency-derived scrape URLs with a central registry
- keep agency-derived default filter mapping only for UI

### Phase 2. Scope-Level Cycle State

- move scheduled cycle orchestration from agency to scope
- keep agency-specific favorites untouched
- support a manual sync path for one scope at a time

### Phase 3. Baseline Semantics

- add explicit baseline state per scope
- mark first full cycle as baseline
- disable `NOU` during baseline
- enable `NOU` only for post-baseline first-seen listings

### Phase 4. Stable Listing Ordering

- query UI using `firstDiscoveredAt desc`
- ensure old listings are not promoted by refresh

### Phase 5. Cleanup + Baseline Reset

- after code verification:
  - delete existing `ownerListings`
  - delete related scope/cycle job state
  - run a fresh full baseline scrape

## Verification Plan

- compile `owner-listings` TypeScript target
- run direct source-page scrapers locally
- run one real sync for a target scope
- verify:
  - no `OLX` / `Publi24` leakage from `Imoradar24`
  - `Imobiliare.ro` listings appear
  - new listings are stored with the right `isNew` / baseline semantics
  - UI ordering is `firstDiscoveredAt desc`

