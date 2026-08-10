import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.NODE_ENV = 'test';
process.env.SCANNER_TOKEN = 'test-token';
const { createScannerServer, extractMultipartFile } = await import('./server.mjs');

const healthyScanner = {
  health: async () => ({ ready: true }),
  version: async () => 'ClamAV test',
  scan: async () => ({ safe: true, infected: false }),
};

async function withServer(run, options = {}) {
  const server = createScannerServer({ scanner: healthyScanner, ...options }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('health endpoint does not expose configuration', () => withServer(async (baseUrl) => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, ready: true, provider: 'clamav-private', mode: 'persistent-daemon' });
}));

test('health endpoint reports unavailable when clamd is not ready', () => withServer(async (baseUrl) => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('retry-after'), '2');
  assert.deepEqual(await response.json(), {
    ok: false,
    ready: false,
    provider: 'clamav-private',
    message: 'Motorul antivirus se reconectează. Încearcă din nou peste câteva secunde.',
  });
}, {
  scanner: {
    health: async () => { throw Object.assign(new Error('offline'), { code: 'CLAMD_UNAVAILABLE' }); },
    scan: healthyScanner.scan,
  },
}));

test('scan endpoint requires the configured bearer token', () => withServer(async (baseUrl) => {
  const response = await fetch(`${baseUrl}/scan`, { method: 'POST' });
  assert.equal(response.status, 401);
}));

test('scan endpoint requires multipart content', () => withServer(async (baseUrl) => {
  const response = await fetch(`${baseUrl}/scan`, {
    method: 'POST',
    headers: { authorization: 'Bearer test-token', 'content-type': 'application/octet-stream' },
    body: 'hello',
  });
  assert.equal(response.status, 415);
}));


test('extracts only the uploaded file bytes from multipart input', () => {
  const boundary = 'imodeus-test-boundary';
  const signature = Buffer.from('first-byte-signature');
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\n`),
    signature,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  assert.deepEqual(extractMultipartFile(body, `multipart/form-data; boundary=${boundary}`), signature);
});

test('scan endpoint returns a clean verdict from the persistent daemon', () => withServer(async (baseUrl) => {
  const form = new FormData();
  form.set('file', new Blob(['safe-content'], { type: 'text/plain' }), 'safe.txt');
  const response = await fetch(`${baseUrl}/scan`, {
    method: 'POST',
    headers: { authorization: 'Bearer test-token' },
    body: form,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    safe: true,
    infected: false,
    provider: 'clamav-private',
    message: 'Fișier verificat cu ClamAV.',
  });
}));

test('scan endpoint returns a detected verdict without exposing the signature', () => withServer(async (baseUrl) => {
  const form = new FormData();
  form.set('file', new Blob(['unsafe-content'], { type: 'text/plain' }), 'unsafe.txt');
  const response = await fetch(`${baseUrl}/scan`, {
    method: 'POST',
    headers: { authorization: 'Bearer test-token' },
    body: form,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    safe: false,
    infected: true,
    provider: 'clamav-private',
    message: 'ClamAV a detectat conținut periculos.',
  });
}, {
  scanner: {
    health: healthyScanner.health,
    scan: async () => ({ safe: false, infected: true, signature: 'test-signature' }),
  },
}));
