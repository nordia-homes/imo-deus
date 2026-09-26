# Romimo / Publi24 API V2

Implemented in the existing Next.js API and Firebase agency model. No new runtime dependency, secret in source, deployment, live authenticated call, or lead import is included.

## Sources and verification status

- Swagger: https://services.romimo.ro/swagger/index.html?urls.primaryName=API%20V2
- Contract: https://services.romimo.ro/swagger/v2/swagger.json
- Public resources read on 2026-09-26: `/api/Resources/Categories`, `/Currencies`, `/Properties`, `/County`, `/City`.
- `src/lib/romimo/catalog.snapshot.json` contains those categories, currencies and property definitions; `validCategories` are normalized to `categoryIds`. This is a preview fallback only. Each publication rechecks the live catalog.
- Live account behavior is NOT verified. Successful responses have no schemas in Swagger. The token parser accepts a JWT string or `token`, `accessToken`, `access_token`; an unknown shape fails closed. The article reader accepts an explicit matching `externalid`/`externalId` and boolean `active`, at the root or under `ad`. These are conservative provisional adapters, not observed account response fixtures. Unknown responses stay pending.
- Publication on anuntul.ro is not established by this contract. The existing UI provider remains `publi24`, labeled Publi24 / Romimo. The account's actual cross-publication must be checked with the provider.

## User workflow

1. An agency administrator opens **Integrări → Publi24 / Romimo**, enters the API key and account email. The backend obtains a token and checks `GET /api/User/Package` before saving the connection.
2. In a property, open the settings button on the Publi24/Romimo row. Inspect the title, description and first 20 photos. Confirm currency (EUR suggested), category, county/city/area, agent contact, and validity dates (30 days suggested, editable). Fill required category-specific fields. Bucharest uses a sector as city.
3. Validate the preview and publish. The server reloads the property, validates the live taxonomy and location, and compares a hash binding both the payload and the entire CRM property before submitting. A transaction rechecks the property after remote validation. Derived fields refresh from the CRM on the next preview; deliberate portal overrides and dates are preserved. Publication sends canonical location names from the provider's catalog. It never sends the owner's contact, paid promotion, WhatsApp opt-in, or exact coordinates automatically.
4. **Verifică pe portal** reads the article using the authoritative account email and external ID. HTTP 200 alone does not mark an ad published. An unsupported response remains “De verificat”.
5. **Retrage anunțul → Confirmă retragerea** calls DELETE for this single ad. Only HTTP 204 directly confirms deletion. The CRM property is retained.
6. Disconnecting removes the API key, while retaining account identity and mappings. It does not withdraw existing advertisements. Switching account emails after any operation requires an explicit migration.
7. **Integrări → Publi24 / Romimo → Anunțuri gestionate** lists submissions, with pagination. Verification and withdrawal remain available here even if the property was deleted from the CRM. The authoritative outcome is retained when a property disappears during an external request. The CRM removal dialog now withdraws linked listings before deletion or marking an agency sale. Partial failures retain the property and the private withdrawal results for retry. Direct status edits elsewhere do not trigger withdrawal. See `property-removal.md`.

Updates use the same POST endpoint and external ID, but are disabled by default because Swagger does not document upsert semantics. After the test account confirms them, set the **server-only** environment variable `ROMIMO_UPSERT_CONFIRMED=true` in the chosen runtime and restart/redeploy. Do not enable it merely to bypass a pending submission. Republish after deletion is subject to this same gate. Repost/paid promotion and leads are intentionally deferred to the next phase.

## Storage and authorization

- Private connection: `agencyPrivateIntegrations/{agencyId}__romimo` (API key, account email, agency operation lease). No token is stored: a fresh token is obtained for each authenticated operation.
- Authoritative per-property state: `agencyPrivateIntegrations/{agencyId}__romimo/operations/{propertyId}` (stable reference, submitted intent, settings, hash, latest actor/action/time and remote observation). These paths are not client-readable/writable under existing rules.
- Public property projection: `promotions.publi24` and `portalProfiles.publi24` (status/link/message only, no credentials or account email). Never trust this client-writable projection for remote identifiers.
- Every route uses the database and agency resolved by the existing Firebase token verifier. Account changes require role `admin`; property operations require `admin` or `agent`. Demo agencies are blocked before external access. All property reads stay under the resolved agency. **The audit found that the existing Firestore rules let users modify the profile fields on which this authorization depends. This is an unresolved project-level authorization risk; see `romimo-audit.md`. Mocked route tests do not establish a trustworthy membership source.**
- The external reference is `imo` + 27 hex characters of SHA-256 over `[agencyId, propertyId]`, within the 30-character API limit.
- A transaction-backed 240-second per-agency lease serializes account changes and operations. The lease owner and expiry are checked transactionally on writes, and at least 30 seconds must remain before the external mutation (20-second request timeout). A stale worker cannot overwrite another worker's result or connection. Lease-release failure does not mask the business outcome; expiry releases it. Remote requests disable redirects and automatic mutation retries. Intent is committed before the HTTP write. Timeout/5xx/unknown results remain pending; even a subsequent 404 never enables a blind retry. Explicit 400/401/403/415/422/429 rejections permit correction for a first submission. A request already in flight cannot be atomically coupled with Firestore; unresolved outcomes still require reconciliation.
- Provider response bodies are limited to 2 MB while streaming; API request bodies are limited to 100 KB while streaming. The browser has a 190-second timeout, no automatic mutation retries, and safe messages for network/proxy errors. After a failed mutation, the property dialog refreshes the authoritative submission state.
- API keys are query parameters on the provider token endpoint, as required by its contract. Request URLs, raw upstream bodies, and underlying fetch errors are never logged or returned. Upstream errors are reduced to safe HTTP status messages.

## API routes

- `GET /api/romimo/status`
- `GET /api/romimo/listings?cursor={lastPropertyId}` (up to 50 local operation records per page; only submitted records are returned; no credentials/contact settings)
- `POST /api/romimo/connect`: `{ apiKey, email }`
- `POST /api/romimo/disconnect`: `{}`
- `POST /api/romimo/preview`: `{ propertyId, settings? }`
- `POST /api/romimo/publish`: `{ propertyId, settings, previewHash }` (also update after verification gate)
- `POST /api/romimo/verify`: `{ propertyId }`
- `POST /api/romimo/unpublish`: `{ propertyId }`

## Test-account acceptance checklist

Obtain API key, account email, test-vs-production environment guidance, package limits and provider rate limits. Use a disposable listing approved for testing.

1. Verify token response shape/expiry and account-package authorization; add redacted fixtures to tests.
2. Publish an apartment with photos. Check the returned response and GET response against the adapter; distinguish active/requested-active from actually visible/moderated status. Confirm public URLs and Publi24/Romimo distribution.
3. Confirm an identical external ID updates the existing ad without creating another or consuming another publication slot. Then enable the update gate.
4. Change price, description and photo order; verify the same remote ad changes. Confirm dates, timezone, maximum photo count, download accessibility, additional category-specific restrictions, package and billing behavior.
5. Delete the ad, verify disappearance, then test recreation with the same external ID. Confirm pending/error handling and expired tokens.
6. Test two agencies to verify account isolation and compare property references.

Run `npm run test:romimo`, `npm run typecheck`, and targeted ESLint. Unit tests simulate the provider; they do not establish compatibility with authenticated production responses. No UI browser test or live end-to-end account test is implied by these tests.
