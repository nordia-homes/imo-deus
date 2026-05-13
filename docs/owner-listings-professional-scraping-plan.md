# Owner Listings Professional Scraping Plan

## Product Goal

Owner listings must work as a professional market coverage system, not as a simple scraper.

Agents should see a clean marketplace experience: complete listings, reliable filters, fresh items, stable ordering, good deduplication, and fast import. Scraping internals, source failures, queue lag, and coverage diagnostics are visible only to the master admin.

## Non-Negotiable Rules

- All configured cities must receive full coverage. Larger cities may receive lower freshness latency, but smaller cities must not receive lower quality or incomplete coverage.
- Fresh discovery and full coverage are separate workflows.
- OLX and Publi24 generic URLs are used as fast radar sources.
- Imoradar24 generic URLs are not used, because the generic sale URL cannot reliably apply the owner/proprietar filter.
- Imoradar24 uses only category-specific URLs with `/proprietar`.
- Expensive detail/phone/image enrichment must not block discovery.
- Every listing must be classified into canonical transaction and property categories.
- Master admin must have operational visibility into coverage and source health. Agents must not see this dashboard.

## Target Cities

- Bucuresti-Ilfov
- Cluj-Napoca
- Timisoara
- Brasov
- Iasi
- Constanta
- Oradea
- Arad
- Craiova
- Galati
- Braila
- Buzau
- Ploiesti
- Alba Iulia
- Baia Mare

## Canonical Categories

Transaction types:

- `sale`
- `rent`
- `unknown`

Property types:

- `apartment`
- `house`
- `land`
- `commercial`
- `unknown`

Coverage should eventually include every supported combination where the source has stable URLs:

- apartments for sale
- apartments for rent
- houses for sale
- houses for rent
- land for sale
- commercial spaces for sale
- commercial spaces for rent

Land for rent can be added only where the source exposes stable and valuable inventory.

## Source Strategy

### OLX

Fresh radar:

```txt
https://www.olx.ro/imobiliare/?currency=EUR&search%5Bprivate_business%5D=private&search%5Border%5D=created_at:desc
```

Coverage:

- category-specific URLs per city
- private owner filter
- newest-first ordering where possible

OLX phone extraction must remain asynchronous and should be generalized into a broader enrichment queue.

### Publi24

Fresh radar:

```txt
https://www.publi24.ro/anunturi/imobiliare/?commercial=false
```

Coverage:

- category-specific URLs per city
- `commercial=false`
- sale and rent categories

Publi24 JSON-LD should be used before DOM/browser fallback. Phone OCR/image extraction belongs in enrichment, not discovery.

### Imoradar24

No generic source URL.

Coverage:

- category-specific URLs per city
- `/proprietar`
- sale and rent categories where stable URLs exist

Imoradar24 is an aggregator, so it must also be used for origin-source detection. Listings whose real source is OLX or Publi24 should be skipped or merged when those sources are scraped directly.

## Architecture

### Fresh Radar

Purpose: minimize time-to-first-seen for new listings.

Inputs:

- OLX generic private URL
- Publi24 generic `commercial=false` URL

Behavior:

- runs frequently
- scans shallow pages
- stores only discovery summaries
- queues enrichment only after dedupe/classification

### Full Coverage

Purpose: guarantee complete market coverage for all cities and categories.

Inputs:

- source + city + transaction type + property type URLs

Behavior:

- runs in small atomic jobs
- guarantees all cities receive coverage
- stops intelligently after old pages, duplicate-heavy pages, or stable known endings
- records coverage state per city/source/category

### Atomic Work Unit

The scheduler should move toward jobs shaped like:

```txt
source + city + transactionType + propertyType + page
```

This is superior to one large city-level cycle because it supports fairness, retries, precise measurement, and adaptive scheduling.

### Enrichment Queue

Generalize OLX phone queue into an enrichment queue with task types:

- `phone`
- `detail`
- `images`
- `origin-source`
- `dedupe-review`

Priorities:

- P0: new listing, high-value city/category, missing phone/details
- P1: new listing, normal priority
- P2: existing listing with missing fields
- P3: retry/backfill

## Required Listing Fields

Discovery summary should persist these fields whenever possible:

- `scopeKey`
- `scopeCity`
- `source`
- `sourceLabel`
- `sourceUrl`
- `originSourceUrl`
- `originSourceLabel`
- `externalId`
- `title`
- `price`
- `link`
- `area`
- `location`
- `postedAt`
- `postedAtText`
- `propertyType`
- `transactionType`
- `categoryConfidence`
- `ownerType`
- `ownerConfidence`
- `fingerprint`
- `canonicalKey`
- `dedupeGroupId`
- `firstDiscoveredAt`
- `lastSeenAt`
- `lastVerifiedAt`
- `enrichmentStatus`

## Deduplication Strategy

Deduplication should run in layers:

1. exact `source + externalId`
2. canonical/origin source URL
3. phone + city + price + area
4. normalized title + normalized location + price + area
5. optional image hash for difficult duplicates

Imoradar24 duplicates must be treated carefully because it can point to OLX, Publi24, Storia, Imobiliare.ro, or other portals.

## Master Admin Scraping Dashboard

Visible only to master admin.

Metrics:

- coverage by city/source/category
- last full coverage time
- freshness lag
- active jobs
- failed jobs/pages
- source error rate
- duplicate ratio
- enrichment backlog
- phone extraction success rate
- suspected agency leakage
- average scrape duration
- source parser health

Alerts:

- city/category coverage is stale
- source error rate exceeds threshold
- generic radar returns zero listings unexpectedly
- enrichment backlog exceeds threshold
- duplicate ratio spikes
- parser output changes shape

## Implementation Phases

### Phase 1 - Foundation

- add canonical property/transaction types
- add category classification helpers
- expand scope registry to target cities
- add OLX/Publi24 generic radar URLs
- preserve existing category-specific URLs
- keep Imoradar category-specific only

### Phase 2 - Discovery Quality

- classify listings during discovery
- store canonical category fields
- avoid detail hydration during list discovery unless absolutely necessary
- preserve baseline/new semantics

### Phase 3 - Scheduler Upgrade

- introduce atomic job records
- split fresh radar from full coverage
- enforce rate limits per source host
- track coverage state per city/source/category

### Phase 4 - Enrichment Upgrade

- generalize phone queue into enrichment queue
- process enrichment in bounded batches
- prioritize new and high-value listings

### Phase 5 - Master Admin Observability

- add scraping health collections
- add master admin dashboard
- add alert thresholds
- add manual rerun controls per city/source/category

## Initial Compatibility Approach

The current cycle controller can be kept while Phase 1 and Phase 2 are implemented. The first implementation should extend the current registry and persisted listing fields without breaking the existing UI. Scheduler and enrichment changes can then be introduced behind the same API surface.

## Current Cron Migration

The Firebase scheduled function `ownerListingsBackgroundSync` now runs the professional path:

- calls `/api/owner-listings/sync/frontier` every 5 minutes
- processes a bounded batch of atomic frontier jobs
- drains `/api/owner-listings/enrichment-drain` up to 8 times per run

A temporary safety function `ownerListingsLegacyCycleSync` runs the older cycle once every 24 hours with reduced limits. This should be removed after the frontier dashboard shows stable coverage and enrichment health for all configured cities.

Deploy command:

```powershell
.\scripts\deploy-owner-listings-background.ps1
```

This deploys both scheduled functions:

- `ownerListingsBackgroundSync`
- `ownerListingsLegacyCycleSync`
