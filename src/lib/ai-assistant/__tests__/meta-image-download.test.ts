import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: mocks.lookup }));
vi.mock('node:https', () => ({ request: mocks.request }));
import { downloadMetaImage } from '@/lib/meta-image-download';
let status: number, headers: Record<string, string>, chunks: Buffer[];
beforeEach(() => {
    status = 200;
    headers = {};
    chunks = [Buffer.from([255, 216, 255, 1])];
    mocks.lookup.mockReset().mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    mocks.request.mockReset().mockImplementation((_url, options, callback) => {
        const req = new EventEmitter() as any;
        req.end = () => { const response = Readable.from(chunks) as any; response.statusCode = status; response.headers = headers; callback(response); };
        return req;
    });
});
describe('bounded public Meta image download', () => {
    it('pins the validated DNS address and keeps TLS hostname', async () => { const result = await downloadMetaImage('https://images.example/photo.jpg'); expect(result.extension).toBe('jpg'); const [url, options] = mocks.request.mock.calls[0]; expect(url.hostname).toBe('images.example'); expect(options.signal).toBeInstanceOf(AbortSignal); const callback = vi.fn(); options.lookup('images.example', { all: true }, callback); expect(callback).toHaveBeenCalledWith(null, [{ address: '8.8.8.8', family: 4 }]); options.lookup('images.example', {}, callback); expect(callback).toHaveBeenLastCalledWith(null, '8.8.8.8', 4); });
    it.each(['http://images.example/a', 'https://user:pass@images.example/a', 'https://127.0.0.1/a', 'https://images.example:8443/a', 'https://images.example/a#part', 'https://localhost/a'])('rejects URL %s without network access', async (url) => { await expect(downloadMetaImage(url)).rejects.toThrow(); expect(mocks.request).not.toHaveBeenCalled(); expect(mocks.lookup).not.toHaveBeenCalled(); });
    it.each(['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1', 'fc00::1', '::ffff:127.0.0.1'])('rejects DNS address %s', async (address) => { mocks.lookup.mockResolvedValue([{ address, family: address.includes(':') ? 6 : 4 }]); await expect(downloadMetaImage('https://images.example/a')).rejects.toThrow(); expect(mocks.request).not.toHaveBeenCalled(); });
    it('rejects mixed public and private DNS responses', async () => { mocks.lookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }]); await expect(downloadMetaImage('https://images.example/a')).rejects.toThrow(); });
    it.each([301, 302, 404, 500])('does not follow or accept HTTP %s', async (code) => { status = code; headers = { location: 'http://169.254.169.254' }; await expect(downloadMetaImage('https://images.example/a')).rejects.toThrow(); expect(mocks.request).toHaveBeenCalledTimes(1); });
    it('limits a declared oversized body', async () => { headers = { 'content-length': String(9 * 1024 * 1024) }; await expect(downloadMetaImage('https://images.example/a')).rejects.toThrow('8 MB'); });
    it('limits streamed bytes when content-length is absent', async () => { chunks = [Buffer.alloc(8 * 1024 * 1024), Buffer.from([1])]; await expect(downloadMetaImage('https://images.example/a')).rejects.toThrow('8 MB'); });
    it.each([Buffer.alloc(0), Buffer.from('<html>'), Buffer.from('%PDF')])('rejects non-image bytes', async (bytes) => { chunks = [bytes]; await expect(downloadMetaImage('https://images.example/a')).rejects.toThrow('Conținutul'); });
    it('recognizes PNG by signature, not response headers', async () => { chunks = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])]; expect((await downloadMetaImage('https://images.example/a')).mime).toBe('image/png'); });
    it('recognizes WebP by signature', async () => { chunks = [Buffer.from('RIFF0000WEBP')]; expect((await downloadMetaImage('https://images.example/a')).mime).toBe('image/webp'); });
});
