import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

process.env.NODE_ENV = 'test';
process.env.SCANNER_TOKEN = 'test-token';
const { createScannerServer, extractMultipartFile } = await import('./server.mjs');

async function withServer(run) {
  const server = createScannerServer().listen(0, '127.0.0.1');
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
  assert.deepEqual(await response.json(), { ok: true, provider: 'clamav-private' });
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
