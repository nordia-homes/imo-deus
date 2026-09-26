import { afterEach, describe, expect, it, vi } from 'vitest';
import { BodyLimitError, readBoundedText } from '../transport';
import { romimoFetch } from '../browser';
import type { User } from 'firebase/auth';

afterEach(() => vi.unstubAllGlobals());
describe('Romimo bounded streams and browser recovery messages', () => {
  it('decodes UTF-8 characters across chunk boundaries', async () => {
    const bytes = new TextEncoder().encode('țară');
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes.slice(0, 1)); controller.enqueue(bytes.slice(1)); controller.close(); } });
    expect(await readBoundedText(body, bytes.length)).toBe('țară');
  });
  it('cancels an oversized body before consuming the rest', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(11)); }, cancel });
    await expect(readBoundedText(body, 10)).rejects.toBeInstanceOf(BodyLimitError);
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('reports an interrupted request without retrying a mutation', async () => {
    const user = { getIdToken: vi.fn(async () => 'token') } as unknown as User;
    const fetch = vi.fn().mockRejectedValue(new Error('network error'));
    vi.stubGlobal('fetch', fetch);
    await expect(romimoFetch(user, 'publish', {})).rejects.toThrow(/Verifică starea/);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  it('handles a proxy HTML error instead of showing a JSON syntax error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Gateway error</html>', { status: 502 })));
    const user = { getIdToken: vi.fn(async () => 'token') } as unknown as User;
    await expect(romimoFetch(user, 'publish', {})).rejects.toThrow(/răspuns valid/);
  });
});
