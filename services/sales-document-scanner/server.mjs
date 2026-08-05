import { createServer } from 'node:http';
import { createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { timingSafeEqual } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = Number(process.env.PORT || 8080);
const MAX_REQUEST_BYTES = Number(process.env.MAX_REQUEST_BYTES || 18 * 1024 * 1024);
const SCAN_TIMEOUT_MS = Number(process.env.SCAN_TIMEOUT_MS || 25_000);

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(payload));
}

function authorized(request) {
  const expected = process.env.SCANNER_TOKEN || '';
  const supplied = request.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
  if (!expected || expected.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(supplied));
}

function runClamScan(filePath) {
  return new Promise((resolve) => {
    const child = spawn('clamscan', ['--no-summary', '--stdout', filePath], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish({ code: 2, timedOut: true });
    }, SCAN_TIMEOUT_MS);
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => finish({ code: 2, output: error.message, timedOut: false }));
    child.on('close', (code) => finish({ code: code ?? 2, output: `${stdout}\n${stderr}`.trim(), timedOut: false }));
  });
}

async function storeRequest(request, filePath) {
  const declaredLength = Number(request.headers['content-length'] || 0);
  if (declaredLength > MAX_REQUEST_BYTES) throw Object.assign(new Error('request_too_large'), { status: 413 });
  let received = 0;
  const destination = createWriteStream(filePath, { flags: 'wx', mode: 0o600 });
  try {
    for await (const chunk of request) {
      received += chunk.length;
      if (received > MAX_REQUEST_BYTES) throw Object.assign(new Error('request_too_large'), { status: 413 });
      if (!destination.write(chunk)) await new Promise((resolve) => destination.once('drain', resolve));
    }
    await new Promise((resolve, reject) => destination.end((error) => error ? reject(error) : resolve()));
  } catch (error) {
    destination.destroy();
    throw error;
  }
  if (received === 0) throw Object.assign(new Error('empty_request'), { status: 400 });
}

export function extractMultipartFile(bytes, contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/i);
  if (!match) throw Object.assign(new Error('multipart_boundary_missing'), { status: 400 });
  const boundary = match[1] || match[2];
  const separator = Buffer.from('\r\n\r\n');
  let cursor = 0;
  while (cursor < bytes.length) {
    const markerStart = bytes.indexOf(Buffer.from(`--${boundary}`), cursor);
    if (markerStart < 0) break;
    const headersStart = markerStart + boundary.length + 4;
    const headersEnd = bytes.indexOf(separator, headersStart);
    if (headersEnd < 0) break;
    const headers = bytes.subarray(headersStart, headersEnd).toString('utf8');
    const bodyStart = headersEnd + separator.length;
    const bodyEnd = bytes.indexOf(Buffer.from(`\r\n--${boundary}`), bodyStart);
    if (bodyEnd < 0) break;
    if (/content-disposition:\s*form-data;[^\r\n]*name="file"/i.test(headers)) return bytes.subarray(bodyStart, bodyEnd);
    cursor = bodyEnd + 2;
  }
  throw Object.assign(new Error('multipart_file_missing'), { status: 400 });
}

export function createScannerServer() {
  return createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health') return sendJson(response, 200, { ok: true, provider: 'clamav-private' });
    if (request.method !== 'POST' || request.url !== '/scan') return sendJson(response, 404, { error: 'not_found' });
    if (!authorized(request)) return sendJson(response, 401, { error: 'unauthorized' });
    if (!String(request.headers['content-type'] || '').toLowerCase().startsWith('multipart/form-data')) return sendJson(response, 415, { error: 'multipart_required' });

    const directory = await mkdtemp(join(tmpdir(), 'imodeus-scan-'));
    const requestPath = join(directory, 'request-body');
    const filePath = join(directory, 'attachment');
    try {
      await storeRequest(request, requestPath);
      const fileBytes = extractMultipartFile(await readFile(requestPath), String(request.headers['content-type']));
      await writeFile(filePath, fileBytes, { flag: 'wx', mode: 0o600 });
      const result = await runClamScan(filePath);
      if (result.code === 0) return sendJson(response, 200, { safe: true, infected: false, provider: 'clamav-private', message: 'Fisier verificat cu ClamAV.' });
      if (result.code === 1) return sendJson(response, 200, { safe: false, infected: true, provider: 'clamav-private', message: 'ClamAV a detectat continut periculos.' });
      return sendJson(response, 503, { safe: false, infected: false, provider: 'clamav-private', message: result.timedOut ? 'Scanarea antivirus a depasit timpul permis.' : 'Scannerul antivirus nu a putut finaliza verificarea.' });
    } catch (error) {
      return sendJson(response, Number(error?.status || 500), { error: error?.message || 'scan_failed' });
    } finally {
      await rm(directory, { recursive: true, force: true }).catch(() => undefined);
    }
  });
}

if (process.env.NODE_ENV !== 'test') createScannerServer().listen(PORT, '0.0.0.0', () => console.log(`Imodeus document scanner listening on ${PORT}`));
