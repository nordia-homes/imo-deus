# Imodeus sales document scanner

Private ClamAV HTTP adapter used by the sales document flow. The production container keeps one `clamd` process loaded in memory, so every upload reuses the same signature database instead of starting `clamscan` again.

## Runtime contract

- `GET /live` verifies that the HTTP process is running.
- `GET /health` sends a real `PING` to `clamd`; it returns HTTP 503 until the antivirus engine is ready.
- `POST /scan` requires `Authorization: Bearer <SCANNER_TOKEN>` and `multipart/form-data`.
- Clean and infected scans return HTTP 200 with `safe`, `infected`, and `provider` fields.
- Transient engine failures return HTTP 503 and `Retry-After: 2`, allowing Imodeus to retry once automatically.
- The uploaded bytes are kept only for the duration of the request and are never made available before a clean verdict.

`freshclam` runs in daemon mode and notifies `clamd` after a signature update. The image also downloads the current database during every build.

## Permanent Cloud Run configuration

The supported production shape is:

- 2 vCPU;
- 4 GiB RAM;
- request concurrency 1;
- request timeout 120 seconds;
- service-level minimum instances 1, permanently;
- maximum instances 3;
- request-based billing with CPU throttling while idle and startup CPU boost.

The process does not listen on `PORT` until `clamd` answers successfully. If `clamd` exits later, the supervisor exits the container so Cloud Run replaces it.

Deploy from the repository root:

```powershell
.\scripts\deploy-sales-document-scanner.ps1
```

Prerequisites:

- Google Cloud CLI authenticated to `studio-652232171-42fb6`;
- Secret Manager secret `SALES_DOCUMENT_SCAN_TOKEN`;
- permission to use Cloud Build, Artifact Registry, Secret Manager and Cloud Run.

After deploy, `SALES_DOCUMENT_SCAN_URL` must point to `<cloud-run-service-url>/scan`. The deploy script verifies `<cloud-run-service-url>/health` and accepts only `mode: persistent-daemon`.

## Verification

```powershell
npm --prefix services/sales-document-scanner test
npm run test:sales-email
npm run typecheck
```
