import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { createClamdScanner, waitForClamd } from './clamd-client.mjs';

async function withFakeClamd(handler, run) {
  const server = createServer((socket) => {
    const chunks = [];
    socket.on('data', (chunk) => chunks.push(chunk));
    socket.on('end', () => handler(socket, Buffer.concat(chunks)));
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await run(server.address().port);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('persistent clamd client handles health and version commands', () => withFakeClamd((socket, request) => {
  if (request.equals(Buffer.from('zPING\0'))) socket.end('PONG\0');
  else if (request.equals(Buffer.from('zVERSION\0'))) socket.end('ClamAV 1.4/test\0');
  else socket.end('UNKNOWN COMMAND\0');
}, async (port) => {
  const scanner = createClamdScanner({ port, healthTimeoutMs: 500 });
  assert.deepEqual(await scanner.health(), { ready: true });
  assert.equal(await scanner.version(), 'ClamAV 1.4/test');
  await waitForClamd(scanner, { timeoutMs: 500, retryMs: 10 });
}));

test('persistent clamd client streams a clean file', () => withFakeClamd((socket, request) => {
  assert.equal(request.subarray(0, 10).toString('utf8'), 'zINSTREAM\0');
  assert.equal(request.subarray(request.length - 4).readUInt32BE(0), 0);
  socket.end('stream: OK\0');
}, async (port) => {
  const scanner = createClamdScanner({ port, timeoutMs: 500 });
  assert.deepEqual(await scanner.scan(Buffer.from('safe')), { safe: true, infected: false, raw: 'stream: OK' });
}));

test('persistent clamd client reports a detected signature', () => withFakeClamd((socket) => {
  socket.end('stream: Win.Test.EICAR_HDB-1 FOUND\0');
}, async (port) => {
  const scanner = createClamdScanner({ port, timeoutMs: 500 });
  assert.deepEqual(await scanner.scan(Buffer.from('unsafe')), {
    safe: false,
    infected: true,
    signature: 'Win.Test.EICAR_HDB-1',
    raw: 'stream: Win.Test.EICAR_HDB-1 FOUND',
  });
}));
