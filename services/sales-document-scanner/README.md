# Imodeus sales document scanner

Private, stateless ClamAV HTTP adapter used by the sales inbound flow. The service scans the complete multipart request, never persists a document outside the request-scoped `/tmp` directory, and requires a bearer token on `POST /scan`.

Runtime contract:

- `GET /health` returns scanner availability without configuration or document data.
- `POST /scan` requires `Authorization: Bearer <SCANNER_TOKEN>` and `multipart/form-data`.
- Clean and infected scans return HTTP 200 with the `safe`, `infected`, and `provider` fields consumed by `sales-document-processing.ts`.
- Scanner failures return HTTP 503 so Imodeus can keep the document in `needs_attention` instead of approving it.

The ClamAV signature database is refreshed while the image is built. Rebuild the image regularly to keep signatures current.
