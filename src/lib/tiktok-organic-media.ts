import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { open, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pipeline } from 'node:stream/promises';
import ffmpegPath from 'ffmpeg-static';
import { adminStorage } from '@/firebase/admin';

const MAX_BYTES = 500_000_000;
const CHUNK_BYTES = 10_000_000;
const MIME = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

export function storagePathFromTikTokVideoUrl(raw: string, agencyId: string, uid: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('URL-ul videoclipului nu este valid.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com' || url.port || url.username || url.password) {
    throw new Error('Videoclipul trebuie să provină din stocarea ImoDeus.');
  }
  const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
  if (!match || decodeURIComponent(match[1]) !== adminStorage.bucket().name || url.searchParams.get('alt') !== 'media') {
    throw new Error('Videoclipul nu aparține stocării ImoDeus.');
  }
  const objectPath = decodeURIComponent(match[2]);
  if (!objectPath.startsWith(`agencies/${agencyId}/`) && !objectPath.startsWith(`users/${uid}/tiktok-studio/`)) {
    throw new Error('Videoclipul nu aparține agenției sau utilizatorului.');
  }
  return objectPath;
}

export function planTikTokVideoChunks(size: number, preferred = CHUNK_BYTES) {
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_BYTES) throw new Error('Videoclipul trebuie să aibă între 1 B și 500 MB.');
  const requested = Number.isFinite(preferred) ? Math.trunc(preferred) : CHUNK_BYTES;
  const chunkSize = size < 5_000_000 ? size : Math.min(size > 64_000_000 ? Math.floor(size / 2) : 64_000_000, Math.max(5_000_000, requested));
  const count = size <= 64_000_000 ? 1 : Math.floor(size / chunkSize);
  const effectiveChunkSize = count === 1 ? size : chunkSize;
  if (count > 1000 || size - effectiveChunkSize * (count - 1) > 128_000_000) throw new Error('Videoclipul nu poate fi împărțit conform limitelor TikTok.');
  return { chunkSize: effectiveChunkSize, count, chunkLength: (index: number) => index === count - 1 ? size - effectiveChunkSize * (count - 1) : effectiveChunkSize };
}

async function probeVideo(filePath: string, size: number) {
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn(ffmpegPath || 'ffmpeg', ['-nostdin', '-hide_banner', '-i', filePath, '-map', '0:v:0', '-frames:v', '1', '-an', '-sn', '-dn', '-f', 'null', '-'], { windowsHide: true });
    let stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Verificarea video a expirat.')); }, 30_000);
    child.stderr.on('data', chunk => { stderr = `${stderr}${String(chunk)}`.slice(-64_000); });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', code => { clearTimeout(timer); code === 0 ? resolve(stderr) : reject(new Error('Videoclipul nu poate fi decodat.')); });
  });
  const duration = output.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/i);
  const videoLine = output.split(/\r?\n/).find(line => /Video:\s*/.test(line)) || '';
  const dimensions = videoLine.match(/(?:^|[,\s])(\d{2,5})x(\d{2,5})(?:[,\s\[]|$)/);
  const codec = videoLine.match(/Video:\s*([^,\s]+)/)?.[1]?.toLowerCase();
  const fps = Number(videoLine.match(/(\d+(?:\.\d+)?)\s*fps/)?.[1]);
  if (!duration || !dimensions || !codec || !Number.isFinite(fps)) throw new Error('Metadatele video sunt incomplete.');
  const seconds = Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]);
  const width = Number(dimensions[1]); const height = Number(dimensions[2]);
  if (!['h264', 'hevc', 'vp8', 'vp9'].includes(codec) || fps < 23 || fps > 60 || width < 360 || height < 360 || width > 4096 || height > 4096 || seconds <= 0 || seconds > 600 || size > MAX_BYTES) {
    throw new Error('Formatul, rezoluția, frecvența sau durata videoclipului nu respectă limitele TikTok.');
  }
  return seconds;
}

export async function prepareTikTokVideo(rawUrl: string, agencyId: string, uid: string, maxDuration?: number) {
  const objectPath = storagePathFromTikTokVideoUrl(rawUrl, agencyId, uid);
  const file = adminStorage.bucket().file(objectPath);
  const [metadata] = await file.getMetadata();
  const declaredSize = Number(metadata.size);
  const contentType = (metadata.contentType || '').split(';')[0].toLowerCase();
  if (!MIME.has(contentType)) throw new Error('TikTok acceptă aici numai MP4, MOV sau WebM.');
  planTikTokVideoChunks(declaredSize);
  const tempPath = path.join(os.tmpdir(), `imodeus-tiktok-${randomUUID()}`);
  try {
    await pipeline(file.createReadStream(), createWriteStream(tempPath), { signal: AbortSignal.timeout(120_000) });
    const { size } = await stat(tempPath);
    if (size !== declaredSize) throw new Error('Dimensiunea videoclipului s-a schimbat în timpul pregătirii.');
    const durationSeconds = await probeVideo(tempPath, size);
    if (maxDuration && durationSeconds > maxDuration) throw new Error(`Profilul TikTok permite maximum ${maxDuration} secunde.`);
    return { tempPath, size, contentType, durationSeconds, dispose: () => unlink(tempPath).catch(() => undefined) };
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
}

export async function uploadTikTokVideo(uploadUrl: string, filePath: string, size: number, contentType: string, chunkSize: number) {
  const parsed = new URL(uploadUrl);
  if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.tiktokapis.com') || parsed.port || parsed.username || parsed.password) throw new Error('TikTok a returnat un URL de upload neașteptat.');
  const plan = planTikTokVideoChunks(size, chunkSize);
  const handle = await open(filePath, 'r');
  try {
    let offset = 0;
    for (let index = 0; index < plan.count; index += 1) {
      const length = plan.chunkLength(index);
      const buffer = Buffer.allocUnsafe(length);
      const { bytesRead } = await handle.read(buffer, 0, length, offset);
      if (bytesRead !== length) throw new Error('Citirea videoclipului a fost întreruptă.');
      const response = await fetch(uploadUrl, {
        method: 'PUT', redirect: 'error', signal: AbortSignal.timeout(90_000),
        headers: { 'Content-Type': contentType, 'Content-Length': String(length), 'Content-Range': `bytes ${offset}-${offset + length - 1}/${size}` },
        body: buffer,
      });
      if (response.status !== (index === plan.count - 1 ? 201 : 206)) throw new Error(`TikTok a respins fragmentul ${index + 1}/${plan.count} (${response.status}).`);
      offset += length;
    }
  } finally { await handle.close(); }
}
