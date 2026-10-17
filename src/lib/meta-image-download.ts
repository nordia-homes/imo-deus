import { lookup } from 'node:dns/promises';
import { request } from 'node:https';
import { isIP } from 'node:net';
import { publicAddress } from './ai-assistant/mcp';
const MAX_BYTES = 8 * 1024 * 1024;
export async function downloadMetaImage(raw: string) {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.port && url.port !== '443' || isIP(url.hostname) || !url.hostname.includes('.'))
        throw Error('Adresă imagine neacceptată.');
    const addresses = await lookup(url.hostname, { all: true });
    if (!addresses.length || addresses.some(row => !publicAddress(row.address)))
        throw Error('Adresă imagine privată sau rezervată.');
    const pinned = addresses[0];
    const bytes = await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        let length = 0;
        const req = request(url, { method: 'GET', headers: { Accept: 'image/jpeg,image/png,image/webp' }, signal: AbortSignal.timeout(15000), lookup: (_host, options, callback) => { const done = callback as any; if ((options as any).all)
                done(null, [pinned]);
            else
                done(null, pinned.address, pinned.family); } }, response => {
            if (response.statusCode !== 200) {
                response.resume();
                reject(Error('Imaginea nu poate fi descărcată direct.'));
                return;
            }
            if (Number(response.headers['content-length']) > MAX_BYTES) {
                response.destroy();
                reject(Error('Imaginea depășește 8 MB.'));
                return;
            }
            response.on('data', (chunk: Buffer) => { length += chunk.length; if (length > MAX_BYTES) {
                response.destroy(Error('Imaginea depășește 8 MB.'));
                return;
            } chunks.push(chunk); });
            response.on('error', reject);
            response.on('end', () => resolve(Buffer.concat(chunks)));
        });
        req.on('error', reject);
        req.end();
    });
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255, png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), webp = bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
    if (!jpeg && !png && !webp)
        throw Error('Conținutul nu este o imagine JPEG, PNG sau WebP.');
    return { bytes, mime: jpeg ? 'image/jpeg' : png ? 'image/png' : 'image/webp', extension: jpeg ? 'jpg' : png ? 'png' : 'webp' };
}
