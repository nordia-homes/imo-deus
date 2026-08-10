import { createConnection } from 'node:net';

const DEFAULT_HOST = process.env.CLAMD_HOST || '127.0.0.1';
const DEFAULT_PORT = Number(process.env.CLAMD_PORT || 3310);
const DEFAULT_TIMEOUT_MS = Number(process.env.CLAMD_TIMEOUT_MS || 45_000);
const STREAM_CHUNK_BYTES = 64 * 1024;
const MAX_RESPONSE_BYTES = 64 * 1024;

function clamdRequest(payload, options = {}) {
  const host = options.host || DEFAULT_HOST;
  const port = Number(options.port || DEFAULT_PORT);
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);

  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    const responseChunks = [];
    let responseBytes = 0;
    let settled = false;

    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve(value);
    };

    socket.setTimeout(timeoutMs);
    socket.once('timeout', () => finish(Object.assign(new Error('clamd_timeout'), { code: 'CLAMD_TIMEOUT' })));
    socket.once('error', (error) => finish(Object.assign(new Error(`clamd_unavailable: ${error.message}`), { code: 'CLAMD_UNAVAILABLE', cause: error })));
    socket.on('data', (chunk) => {
      responseBytes += chunk.length;
      if (responseBytes > MAX_RESPONSE_BYTES) {
        finish(Object.assign(new Error('clamd_response_too_large'), { code: 'CLAMD_PROTOCOL_ERROR' }));
        return;
      }
      responseChunks.push(chunk);
      if (chunk.includes(0)) {
        const response = Buffer.concat(responseChunks).toString('utf8').replace(/\0.*$/s, '').trim();
        finish(null, response);
      }
    });
    socket.once('close', () => {
      if (!settled) {
        const response = Buffer.concat(responseChunks).toString('utf8').replace(/\0.*$/s, '').trim();
        if (response) finish(null, response);
        else finish(Object.assign(new Error('clamd_closed_without_response'), { code: 'CLAMD_PROTOCOL_ERROR' }));
      }
    });
    socket.once('connect', () => socket.end(payload));
  });
}

function commandPayload(command) {
  return Buffer.from(`z${command}\0`, 'utf8');
}

function streamPayload(bytes) {
  const parts = [commandPayload('INSTREAM')];
  for (let offset = 0; offset < bytes.length; offset += STREAM_CHUNK_BYTES) {
    const chunk = bytes.subarray(offset, Math.min(offset + STREAM_CHUNK_BYTES, bytes.length));
    const length = Buffer.allocUnsafe(4);
    length.writeUInt32BE(chunk.length, 0);
    parts.push(length, chunk);
  }
  parts.push(Buffer.alloc(4));
  return Buffer.concat(parts);
}

export function createClamdScanner(options = {}) {
  return {
    async health() {
      const response = await clamdRequest(commandPayload('PING'), { ...options, timeoutMs: options.healthTimeoutMs || 2_000 });
      if (response !== 'PONG') throw Object.assign(new Error(`clamd_unexpected_health_response: ${response}`), { code: 'CLAMD_PROTOCOL_ERROR' });
      return { ready: true };
    },

    async version() {
      return clamdRequest(commandPayload('VERSION'), { ...options, timeoutMs: options.healthTimeoutMs || 2_000 });
    },

    async scan(bytes) {
      const response = await clamdRequest(streamPayload(bytes), options);
      if (/\bOK$/i.test(response)) return { safe: true, infected: false, raw: response };
      if (/\bFOUND$/i.test(response)) {
        const signature = response.replace(/^stream:\s*/i, '').replace(/\s+FOUND$/i, '').trim();
        return { safe: false, infected: true, signature, raw: response };
      }
      throw Object.assign(new Error(`clamd_scan_error: ${response || 'empty_response'}`), { code: 'CLAMD_SCAN_ERROR' });
    },
  };
}

export async function waitForClamd(scanner, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 180_000);
  const retryMs = Number(options.retryMs || 1_000);
  const startedAt = Date.now();
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      await scanner.health();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, retryMs));
    }
  }
  throw Object.assign(new Error(`clamd_startup_timeout: ${lastError instanceof Error ? lastError.message : 'unknown_error'}`), { code: 'CLAMD_STARTUP_TIMEOUT' });
}
