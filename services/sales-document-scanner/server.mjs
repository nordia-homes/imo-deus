import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { createClamdScanner, waitForClamd } from './clamd-client.mjs';

const PORT = Number(process.env.PORT || 8080);
const MAX_REQUEST_BYTES = Number(process.env.MAX_REQUEST_BYTES || 18 * 1024 * 1024);

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function authorized(request, expectedToken) {
  const supplied = request.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
  if (!expectedToken || expectedToken.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(expectedToken), Buffer.from(supplied));
}

async function readRequest(request, maxBytes) {
  const declaredLength = Number(request.headers['content-length'] || 0);
  if (declaredLength > maxBytes) throw Object.assign(new Error('request_too_large'), { status: 413 });
  const chunks = [];
  let received = 0;
  for await (const chunk of request) {
    received += chunk.length;
    if (received > maxBytes) throw Object.assign(new Error('request_too_large'), { status: 413 });
    chunks.push(chunk);
  }
  if (received === 0) throw Object.assign(new Error('empty_request'), { status: 400 });
  return Buffer.concat(chunks, received);
}

export function extractMultipartFile(bytes, contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  if (!match) throw Object.assign(new Error('multipart_boundary_missing'), { status: 400 });
  const boundary = match[1] || match[2];
  const boundaryBytes = Buffer.from(`--${boundary}`);
  const nextBoundaryBytes = Buffer.from(`\r\n--${boundary}`);
  const separator = Buffer.from('\r\n\r\n');
  let cursor = 0;
  while (cursor < bytes.length) {
    const markerStart = bytes.indexOf(boundaryBytes, cursor);
    if (markerStart < 0) break;
    const headersStart = markerStart + boundaryBytes.length + 2;
    const headersEnd = bytes.indexOf(separator, headersStart);
    if (headersEnd < 0) break;
    const headers = bytes.subarray(headersStart, headersEnd).toString('utf8');
    const bodyStart = headersEnd + separator.length;
    const bodyEnd = bytes.indexOf(nextBoundaryBytes, bodyStart);
    if (bodyEnd < 0) break;
    if (/content-disposition:\s*form-data;[^\r\n]*name="file"/i.test(headers)) {
      const file = bytes.subarray(bodyStart, bodyEnd);
      if (!file.length) throw Object.assign(new Error('empty_file'), { status: 400 });
      return file;
    }
    cursor = bodyEnd + 2;
  }
  throw Object.assign(new Error('multipart_file_missing'), { status: 400 });
}

function scannerFailureMessage(error) {
  if (error?.code === 'CLAMD_TIMEOUT') return 'Scanarea antivirus a depășit timpul permis.';
  if (error?.code === 'CLAMD_UNAVAILABLE') return 'Motorul antivirus se reconectează. Încearcă din nou peste câteva secunde.';
  return 'Scannerul antivirus nu a putut finaliza verificarea.';
}

export function createScannerServer(options = {}) {
  const scanner = options.scanner || createClamdScanner();
  const expectedToken = options.token ?? process.env.SCANNER_TOKEN ?? '';
  const maxRequestBytes = Number(options.maxRequestBytes || MAX_REQUEST_BYTES);

  return createServer(async (request, response) => {
    const path = String(request.url || '').split('?')[0];
    if (request.method === 'GET' && path === '/live') {
      return sendJson(response, 200, { ok: true, provider: 'clamav-private', service: 'document-scanner' });
    }
    if (request.method === 'GET' && path === '/health') {
      try {
        await scanner.health();
        return sendJson(response, 200, { ok: true, ready: true, provider: 'clamav-private', mode: 'persistent-daemon' });
      } catch (error) {
        return sendJson(response, 503, { ok: false, ready: false, provider: 'clamav-private', message: scannerFailureMessage(error) }, { 'retry-after': '2' });
      }
    }
    if (request.method !== 'POST' || path !== '/scan') return sendJson(response, 404, { error: 'not_found' });
    if (!authorized(request, expectedToken)) return sendJson(response, 401, { error: 'unauthorized' });
    if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('multipart/form-data')) {
      return sendJson(response, 415, { error: 'multipart_required' });
    }

    try {
      const requestBytes = await readRequest(request, maxRequestBytes);
      const fileBytes = extractMultipartFile(requestBytes, String(request.headers['content-type']));
      const result = await scanner.scan(fileBytes);
      if (result.infected) {
        return sendJson(response, 200, {
          safe: false,
          infected: true,
          provider: 'clamav-private',
          message: 'ClamAV a detectat conținut periculos.',
        });
      }
      return sendJson(response, 200, {
        safe: true,
        infected: false,
        provider: 'clamav-private',
        message: 'Fișier verificat cu ClamAV.',
      });
    } catch (error) {
      const status = Number(error?.status || (String(error?.code || '').startsWith('CLAMD_') ? 503 : 500));
      if (status === 503) {
        return sendJson(response, 503, {
          safe: false,
          infected: false,
          provider: 'clamav-private',
          message: scannerFailureMessage(error),
        }, { 'retry-after': '2' });
      }
      return sendJson(response, status, { error: error?.message || 'scan_failed' });
    }
  });
}

export async function startScannerServer(options = {}) {
  const scanner = options.scanner || createClamdScanner();
  await waitForClamd(scanner, {
    timeoutMs: Number(process.env.CLAMD_STARTUP_TIMEOUT_MS || 180_000),
    retryMs: Number(process.env.CLAMD_STARTUP_RETRY_MS || 1_000),
  });
  const version = await scanner.version().catch(() => 'unknown');
  return createScannerServer({ ...options, scanner }).listen(PORT, '0.0.0.0', () => {
    console.log(JSON.stringify({ event: 'scanner_ready', port: PORT, mode: 'persistent-daemon', clamdVersion: version }));
  });
}

if (process.env.NODE_ENV !== 'test') {
  startScannerServer().catch((error) => {
    console.error(JSON.stringify({ event: 'scanner_start_failed', message: error instanceof Error ? error.message : String(error) }));
    process.exitCode = 1;
  });
}
