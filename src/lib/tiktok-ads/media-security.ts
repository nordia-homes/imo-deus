import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import ffmpegStaticPath from 'ffmpeg-static';
import { TikTokAdsError } from './errors';

const ALLOWED_VIDEO_MIME = new Set([
  'video/mp4',
  'video/quicktime',
  'video/mpeg',
  'video/3gpp',
  'video/x-msvideo',
]);
const TIKTOK_MAX_VIDEO_BYTES = 500_000_000;
const TIKTOK_MAX_VIDEO_SECONDS = 10 * 60;
const TIKTOK_MIN_VIDEO_BITRATE_KBPS = 516;
const ALLOWED_EXTENSIONS = new Set(['.mp4', '.mov', '.mpeg', '.mpg', '.3gp', '.avi']);

export type TikTokVideoMetadata = {
  width: number;
  height: number;
  durationSeconds: number;
  bitrateKbps: number;
  codec: string;
};

function allowedMediaHosts() {
  return (process.env.TIKTOK_ADS_MEDIA_ALLOWED_HOSTS || 'firebasestorage.googleapis.com,storage.googleapis.com')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function isAllowedMediaHost(hostname: string) {
  const host = hostname.toLowerCase();
  return allowedMediaHosts().some((rule) => rule.startsWith('*.')
    ? host.endsWith(rule.slice(1)) && host !== rule.slice(2)
    : host === rule);
}

function isPrivateIpv4(address: string) {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  return octets[0] === 10
    || octets[0] === 127
    || octets[0] === 0
    || octets[0] === 169 && octets[1] === 254
    || octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31
    || octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127
    || octets[0] === 192 && octets[1] === 168
    || octets[0] === 192 && octets[1] === 0 && (octets[2] === 0 || octets[2] === 2)
    || octets[0] === 192 && octets[1] === 88 && octets[2] === 99
    || octets[0] === 198 && (octets[1] === 18 || octets[1] === 19)
    || octets[0] === 198 && octets[1] === 51 && octets[2] === 100
    || octets[0] === 203 && octets[1] === 0 && octets[2] === 113
    || octets[0] >= 224;
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase();
  const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  return normalized === '::'
    || normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe')
    || normalized.startsWith('ff')
    || normalized.startsWith('2001:db8:')
    || normalized === '2001:db8::'
    || Boolean(mappedIpv4 && isPrivateIpv4(mappedIpv4));
}

async function assertPublicHost(url: URL) {
  if (url.protocol !== 'https:') throw new TikTokAdsError('INVALID_CREATIVE', 'Asset-urile media remote trebuie să folosească HTTPS.');
  if (!url.hostname || url.username || url.password || url.port && url.port !== '443') {
    throw new TikTokAdsError('INVALID_CREATIVE', 'URL-ul media remote nu este permis.');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.local')) throw new TikTokAdsError('INVALID_CREATIVE', 'Host-ul media local nu este permis.');
  const directFamily = isIP(hostname);
  if (directFamily && (directFamily === 4 ? isPrivateIpv4(hostname) : isPrivateIpv6(hostname))) {
    throw new TikTokAdsError('INVALID_CREATIVE', 'URL-ul media rezolvă către o adresă privată sau rezervată.');
  }
  if (!isAllowedMediaHost(hostname)) {
    throw new TikTokAdsError('INVALID_CREATIVE', 'Host-ul media nu se află în allowlist-ul server-side TikTok Ads.');
  }
  const addresses = directFamily
    ? [{ address: hostname, family: directFamily }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => entry.family === 4 ? isPrivateIpv4(entry.address) : isPrivateIpv6(entry.address))) {
    throw new TikTokAdsError('INVALID_CREATIVE', 'URL-ul media rezolvă către o adresă privată sau rezervată.');
  }
}

export async function assertSafeTikTokMediaUrl(sourceUrl: string) {
  await assertPublicHost(new URL(sourceUrl));
}

function getFfmpegBinary() {
  const executable = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath || '';
  const candidates = [
    process.env.FFMPEG_PATH || '',
    ffmpegStaticPath || '',
    path.join(process.cwd(), 'node_modules', 'ffmpeg-static', executable),
    path.join(process.cwd(), 'resources', 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', executable),
    path.join(resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', executable),
    path.join(resourcesPath, 'app', 'node_modules', 'ffmpeg-static', executable),
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) || 'ffmpeg';
}

export function parseFfmpegVideoMetadata(output: string, sizeBytes?: number | null): TikTokVideoMetadata | null {
  const duration = output.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/i);
  const videoLine = output.split(/\r?\n/).find((line) => /Video:\s*/i.test(line));
  const dimensions = videoLine?.match(/(?:^|[,\s])(\d{2,5})x(\d{2,5})(?:[,\s\[]|$)/i);
  const codec = videoLine?.match(/Video:\s*([^,\s]+)/i)?.[1] || '';
  if (!duration || !dimensions || !codec) return null;
  const durationSeconds = Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]);
  const width = Number(dimensions[1]);
  const height = Number(dimensions[2]);
  const streamBitrate = videoLine?.match(/(\d+(?:\.\d+)?)\s*kb\/s/i)?.[1];
  const containerBitrate = output.match(/bitrate:\s*(\d+(?:\.\d+)?)\s*kb\/s/i)?.[1];
  const calculatedBitrate = sizeBytes && durationSeconds > 0 ? sizeBytes * 8 / durationSeconds / 1000 : null;
  const bitrateKbps = Number(streamBitrate || containerBitrate || calculatedBitrate);
  if (![width, height, durationSeconds, bitrateKbps].every(Number.isFinite)) return null;
  return { width, height, durationSeconds, bitrateKbps, codec: codec.toLowerCase() };
}

export function assertTikTokVideoMetadata(metadata: TikTokVideoMetadata) {
  if (metadata.durationSeconds <= 0 || metadata.durationSeconds > TIKTOK_MAX_VIDEO_SECONDS) {
    throw new TikTokAdsError('INVALID_CREATIVE', 'Durata video trebuie să fie mai mare decât zero și de maximum 10 minute.');
  }
  if (metadata.bitrateKbps < TIKTOK_MIN_VIDEO_BITRATE_KBPS) {
    throw new TikTokAdsError('INVALID_CREATIVE', 'Bitrate-ul video trebuie să fie de cel puțin 516 kbps.');
  }
  const ratio = metadata.width / metadata.height;
  const within = (target: number) => Math.abs(ratio - target) / target <= 0.02;
  const vertical = within(9 / 16) && metadata.width >= 540 && metadata.height >= 960;
  const horizontal = within(16 / 9) && metadata.width >= 960 && metadata.height >= 540;
  const square = within(1) && metadata.width >= 640 && metadata.height >= 640;
  if (!vertical && !horizontal && !square) {
    throw new TikTokAdsError('INVALID_CREATIVE', 'Dimensiunile video trebuie să respecte 9:16 (minim 540x960), 16:9 (minim 960x540) sau 1:1 (minim 640x640).');
  }
}

async function probeRemoteVideo(url: string, sizeBytes?: number | null) {
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn(getFfmpegBinary(), [
      '-nostdin',
      '-hide_banner',
      '-loglevel', 'info',
      '-rw_timeout', '15000000',
      '-protocol_whitelist', 'https,tls,tcp',
      '-i', url,
      '-map', '0:v:0',
      '-frames:v', '1',
      '-an',
      '-sn',
      '-dn',
      '-f', 'null',
      '-',
    ], { windowsHide: true });
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill();
      reject(new TikTokAdsError('TIMEOUT', 'Inspecția tehnică a asset-ului video a expirat.'));
    }, 30_000);
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${String(chunk)}`.slice(-64_000);
    });
    child.on('error', () => {
      clearTimeout(timeout);
      reject(new TikTokAdsError('INVALID_CREATIVE', 'Inspectorul media server-side nu este disponibil.'));
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new TikTokAdsError('INVALID_CREATIVE', 'Conținutul video nu poate fi decodat în siguranță.'));
        return;
      }
      resolve(stderr);
    });
  });
  const metadata = parseFfmpegVideoMetadata(output, sizeBytes);
  if (!metadata) throw new TikTokAdsError('INVALID_CREATIVE', 'Metadatele tehnice ale videoclipului nu pot fi validate.');
  assertTikTokVideoMetadata(metadata);
  return metadata;
}

export async function validateRemoteVideo(sourceUrl: string, expected?: { expectedMimeType?: string | null; expectedSizeBytes?: number | null; expectedDurationSeconds?: number | null }) {
  let current = new URL(sourceUrl);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    await assertPublicHost(current);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch(current, { method: 'HEAD', redirect: 'manual', signal: controller.signal, cache: 'no-store' });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || redirect === 3) throw new TikTokAdsError('INVALID_CREATIVE', 'Lanțul de redirect al asset-ului media nu este permis.');
        current = new URL(location, current);
        continue;
      }
      if (!response.ok) throw new TikTokAdsError('INVALID_CREATIVE', `Asset-ul video nu poate fi citit (${response.status}).`);
      const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!ALLOWED_VIDEO_MIME.has(mime)) throw new TikTokAdsError('INVALID_CREATIVE', `MIME video neacceptat: ${mime || 'necunoscut'}.`);
      const pathname = decodeURIComponent(current.pathname).toLowerCase();
      const extension = pathname.match(/\.[a-z0-9]+$/)?.[0] || null;
      if (extension && !ALLOWED_EXTENSIONS.has(extension)) throw new TikTokAdsError('INVALID_CREATIVE', `Extensia video ${extension} nu este acceptată de TikTok Ads.`);
      const size = Number(response.headers.get('content-length'));
      const configuredMax = Number(process.env.TIKTOK_ADS_MAX_VIDEO_BYTES || TIKTOK_MAX_VIDEO_BYTES);
      const maxBytes = Number.isFinite(configuredMax) ? Math.min(Math.max(1, configuredMax), TIKTOK_MAX_VIDEO_BYTES) : TIKTOK_MAX_VIDEO_BYTES;
      if (Number.isFinite(size) && (size <= 0 || size > maxBytes)) throw new TikTokAdsError('INVALID_CREATIVE', 'Dimensiunea video depășește limita configurată pentru TikTok Ads.');
      if (expected?.expectedSizeBytes && (expected.expectedSizeBytes <= 0 || expected.expectedSizeBytes > maxBytes)) throw new TikTokAdsError('INVALID_CREATIVE', 'Dimensiunea asset-ului Imodeus depășește limita configurată pentru TikTok Ads.');
      if (expected?.expectedMimeType && expected.expectedMimeType.split(';')[0].trim().toLowerCase() !== mime) throw new TikTokAdsError('INVALID_CREATIVE', 'MIME-ul remote diferă de asset-ul Imodeus înregistrat.');
      if (expected?.expectedSizeBytes && Number.isFinite(size) && expected.expectedSizeBytes !== size) throw new TikTokAdsError('INVALID_CREATIVE', 'Dimensiunea remote diferă de asset-ul Imodeus înregistrat.');
      const trustedSize = Number.isFinite(size) ? size : expected?.expectedSizeBytes || null;
      if (!trustedSize) throw new TikTokAdsError('INVALID_CREATIVE', 'Dimensiunea video nu poate fi verificată server-side.');
      const metadata = await probeRemoteVideo(current.toString(), trustedSize);
      if (expected?.expectedDurationSeconds && Math.abs(metadata.durationSeconds - expected.expectedDurationSeconds) > 1) {
        throw new TikTokAdsError('INVALID_CREATIVE', 'Durata remote diferă de asset-ul Imodeus înregistrat.');
      }
      return { finalUrl: current.toString(), mimeType: mime, sizeBytes: trustedSize, ...metadata };
    } catch (error) {
      if (error instanceof TikTokAdsError) throw error;
      if (error instanceof Error && error.name === 'AbortError') throw new TikTokAdsError('TIMEOUT', 'Validarea asset-ului video a expirat.');
      throw new TikTokAdsError('INVALID_CREATIVE', 'Asset-ul video remote nu poate fi validat în siguranță.', { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new TikTokAdsError('INVALID_CREATIVE', 'Asset-ul video remote nu poate fi validat.');
}
