import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import type { Firestore } from 'firebase-admin/firestore';
import type { Query } from 'firebase-admin/firestore';
import type { Property, PropertyVideoTourJob } from '@/lib/types';
import { adminStorage } from '@/firebase/admin';
import ffmpegStaticPath from 'ffmpeg-static';

type CreateJobInput = {
  adminDb: Firestore;
  agencyId: string;
  propertyId: string;
  requestedByUid: string;
  format?: PropertyVideoTourJob['format'];
  style?: PropertyVideoTourJob['style'];
  quality?: PropertyVideoTourJob['quality'];
  targetDurationSeconds?: number | null;
  includeText?: boolean;
  includeBranding?: boolean;
  includeMusic?: boolean;
  includeAiPresenter?: boolean;
  aiPresenterAvatar?: PropertyVideoTourJob['aiPresenterAvatar'];
  aiPresenterVoice?: PropertyVideoTourJob['aiPresenterVoice'];
  aiPresenterPosition?: PropertyVideoTourJob['aiPresenterPosition'];
  aiPresenterSize?: PropertyVideoTourJob['aiPresenterSize'];
  aiPresenterScript?: string | null;
};

type DrainInput = {
  adminDb: Firestore;
  agencyId?: string | null;
  limit?: number;
};

const JOB_COLLECTION = 'propertyVideoTourJobs';
const MAX_IMAGES = 18;
const FETCH_TIMEOUT_MS = 90_000;
const OPENAI_TIMEOUT_MS = 120_000;
const FFMPEG_TIMEOUT_MS = 8 * 60_000;
const STORAGE_UPLOAD_TIMEOUT_MS = 4 * 60_000;
const STALE_PROCESSING_JOB_MS = 20 * 60_000;
const OPENAI_RESPONSES_API_URL = 'https://api.openai.com/v1/responses';
const OPENAI_SPEECH_API_URL = 'https://api.openai.com/v1/audio/speech';
const OPENAI_TRANSCRIPTIONS_API_URL = 'https://api.openai.com/v1/audio/transcriptions';
const HEYGEN_API_BASE_URL = 'https://api.heygen.com';

type RenderStage =
  | 'Verific FFmpeg'
  | 'Descarc fotografiile'
  | 'Randez segmentele video'
  | 'Aplic tranzitiile'
  | 'Generez scriptul'
  | 'Generez voiceover-ul'
  | 'Incarc voiceover-ul'
  | 'Aplic poza agentului si subtitrarea'
  | 'Combin vocea cu video-ul'
  | 'Generez thumbnail-ul'
  | 'Incarc video-ul final';

type RenderProgressUpdate = {
  progress: number;
  stage: RenderStage;
};

type WordTiming = {
  word: string;
  start: number;
  end: number;
};

const CAPTION_TIMING_DELAY_SECONDS = 0.18;
const CAPTION_EMPTY_LINE = '{\\alpha&HFF&}.';
const PROPERTY_VIDEO_TOUR_TTS_INSTRUCTIONS = [
  'Voce feminina tanara, calda, placuta si usor senzuala, cu zambet audibil in ton.',
  'Intonatie premium, apropiata de HeyGen: expresiva, blanda, naturala, cu pauze firesti si energie pozitiva.',
  'Suna ca o prezentatoare imobiliara eleganta care vorbeste unui client real.',
  'Evita complet tonul rigid, dur, citit sau robotic.',
].join(' ');

function nowIso() {
  return new Date().toISOString();
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      reject(new Error(`${label} a depasit limita de ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit | undefined, timeoutMs: number, label: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`${label} a depasit limita de ${Math.round(timeoutMs / 1000)}s.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function sanitizeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'video-tur-proprietate';
}

function getFirebaseDownloadUrl(bucketName: string, storagePath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(storagePath)}?alt=media&token=${encodeURIComponent(token)}`;
}

function getFormatConfig(format: PropertyVideoTourJob['format'], quality: PropertyVideoTourJob['quality']) {
  const premium = quality === 'premium';
  if (format === 'portrait') return premium ? { width: 1080, height: 1536 } : { width: 720, height: 1024 };
  if (format === 'square') return { width: 1080, height: 1080 };
  return premium ? { width: 1920, height: 1080 } : { width: 1280, height: 720 };
}

function getSecondsPerImage(style: PropertyVideoTourJob['style']) {
  if (style === 'social') return 2.6;
  if (style === 'luxury') return 3.8;
  return 3.2;
}

function escapeFfmpegText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/,/g, '\\,')
    .replace(/'/g, "\\'")
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .slice(0, 120);
}

function truncateForOverlay(value: string, maxLength: number) {
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, Math.max(0, maxLength - 1)).trim()}…` : cleaned;
}

function formatPrice(price?: number | null) {
  if (!price) return '';
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(price);
}

function getPropertySurface(property: Property) {
  return property.totalSurface ?? property.squareFootage;
}

const VIDEO_TOUR_SCRIPT_CTA = 'Pentru mai multe detalii despre aceasta proprietate si pentru a programa o vizionare, va rog sa ne contactati. Suntem disponibili la orice ora, nu percepem comision si iti vom raspunde detaliat la toate intrebarile. Pe curand.';

function buildFallbackPresenterScript(property: Property, style: PropertyVideoTourJob['style']) {
  const surface = getPropertySurface(property);
  const opening = style === 'luxury'
    ? 'Va invit sa descoperiti o proprietate eleganta, gandita pentru cei care cauta liniste, confort si o locuinta pregatita cu atentie.'
    : style === 'social'
      ? 'Hai sa descoperim impreuna o proprietate care merita atentia ta si care poate deveni rapid acasa.'
      : 'Va invit sa descoperiti o proprietate luminoasa si bine pozitionata, potrivita atat pentru locuire, cat si pentru investitie.';
  const details = [
    property.rooms ? `${property.rooms} camere` : '',
    surface ? `${surface} metri patrati` : '',
    property.location ? `in zona ${property.location}` : '',
    property.price ? `la pretul de ${formatPrice(property.price)}` : '',
  ].filter(Boolean).join(', ');
  const description = (property.description || '')
    .replace(/\s+/g, ' ')
    .replace(/[•*_#]+/g, '')
    .slice(0, 420);
  return [opening, details ? `Proprietatea are ${details}, iar atmosfera generala este una placuta si practica pentru viata de zi cu zi.` : '', description, VIDEO_TOUR_SCRIPT_CTA]
    .filter(Boolean)
    .join(' ')
    .slice(0, 1300);
}

async function generatePresenterScript(property: Property, job: PropertyVideoTourJob) {
  const manualScript = job.aiPresenterScript?.trim();
  if (manualScript) return manualScript.slice(0, 1200);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return buildFallbackPresenterScript(property, job.style);

  try {
    const response = await fetchWithTimeout(OPENAI_RESPONSES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL || 'gpt-4.1',
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: [
                  'Scrie scripturi de prezentare imobiliara in romana pentru voiceover video.',
                  'Textul trebuie sa fie cursiv, ca o compunere scurta, cu fraze legate natural intre ele, nu o lista de puncte.',
                  'Nu copia propozitii direct din descrierea proprietatii. Extrage doar datele corecte si rescrie complet textul intr-o forma narativa, fluida si placuta la ascultat.',
                  'Scrie ca si cum ai povesti natural unui client de ce proprietatea merita vazuta: inceput elegant, dezvoltare fireasca, tranzitii line intre idei si final cald.',
                  'Stil natural, cald, premium si convingator, fara exagerari, fara promisiuni false si fara emoji.',
                  'Nu folosi bullet-uri, titluri, markdown sau enumerari seci.',
                  'Evita frazele rigide de anunt imobiliar precum "proprietatea dispune de", "este situata", "beneficiaza de" atunci cand pot fi inlocuite cu exprimari naturale.',
                  `Incheie obligatoriu cu aceasta formula, adaptata doar daca este nevoie pentru acord gramatical: "${VIDEO_TOUR_SCRIPT_CTA}"`,
                ].join(' '),
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: JSON.stringify({
                  title: property.title,
                  location: property.location,
                  price: property.price,
                  rooms: property.rooms,
                  surface: getPropertySurface(property),
                  description: property.description,
                  instruction: 'Foloseste descrierea ca sursa de informatii, nu ca text de copiat. Reformuleaza totul intr-o compunere cursiva.',
                  style: job.style,
                  targetDurationSeconds: job.targetDurationSeconds || null,
                  requiredClosing: VIDEO_TOUR_SCRIPT_CTA,
                }),
              },
            ],
          },
        ],
        max_output_tokens: 360,
      }),
    }, OPENAI_TIMEOUT_MS, 'Generarea scriptului OpenAI');

    if (!response.ok) throw new Error(`OpenAI script ${response.status}`);
    const payload = await response.json() as { output_text?: string };
    const script = payload.output_text?.trim();
    if (!script) return buildFallbackPresenterScript(property, job.style);
    const normalizedScript = script.replace(/\s+/g, ' ').trim();
    return normalizedScript.includes('Pe curand')
      ? normalizedScript.slice(0, 1400)
      : `${normalizedScript} ${VIDEO_TOUR_SCRIPT_CTA}`.slice(0, 1400);
  } catch {
    return buildFallbackPresenterScript(property, job.style);
  }
}

export async function generatePropertyVideoTourScript(input: {
  property: Property;
  style?: PropertyVideoTourJob['style'];
  targetDurationSeconds?: number | null;
}) {
  return generatePresenterScript(input.property, {
    id: 'script-preview',
    agencyId: '',
    propertyId: input.property.id,
    status: 'queued',
    engine: 'ffmpeg-cloud',
    format: 'portrait',
    style: input.style || 'cinematic',
    quality: 'standard',
    targetDurationSeconds: input.targetDurationSeconds || null,
    includeText: true,
    includeBranding: true,
    includeMusic: true,
    includeAiPresenter: true,
    images: [],
    progress: 0,
    attempts: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
}

function getOpenAiVoice(voice: PropertyVideoTourJob['aiPresenterVoice']) {
  if (voice === 'male') return process.env.PROPERTY_VIDEO_TOUR_OPENAI_MALE_VOICE || 'ash';
  if (voice === 'female') return process.env.PROPERTY_VIDEO_TOUR_OPENAI_FEMALE_VOICE || 'nova';
  return voice || process.env.PROPERTY_VIDEO_TOUR_OPENAI_FEMALE_VOICE || 'nova';
}

export async function synthesizePropertyVideoTourVoicePreview(input: {
  voice?: PropertyVideoTourJob['aiPresenterVoice'];
  text?: string | null;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY trebuie setata pentru previzualizarea vocilor.');
  }

  const response = await fetchWithTimeout(OPENAI_SPEECH_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
      voice: getOpenAiVoice(input.voice || 'nova'),
      input: input.text || 'Buna, sunt aici sa va prezint o proprietate frumoasa, luminoasa si primitoare. Va invit sa o descoperim impreuna.',
      response_format: 'mp3',
      speed: 0.92,
      instructions: PROPERTY_VIDEO_TOUR_TTS_INSTRUCTIONS,
    }),
  }, OPENAI_TIMEOUT_MS, 'Previzualizarea vocii OpenAI');

  if (!response.ok) {
    const payload = await response.text().catch(() => '');
    throw new Error(`Nu am putut genera previzualizarea vocii (${response.status}). ${payload.slice(0, 240)}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function synthesizePresenterAudio(script: string, job: PropertyVideoTourJob, outputPath: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY trebuie setata pentru voiceover-ul prezentatorului AI.');
  }

  const response = await fetchWithTimeout(OPENAI_SPEECH_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
      voice: getOpenAiVoice(job.aiPresenterVoice),
      input: script,
      response_format: 'mp3',
      speed: job.style === 'social' ? 0.94 : job.style === 'luxury' ? 0.88 : 0.92,
      instructions: PROPERTY_VIDEO_TOUR_TTS_INSTRUCTIONS,
    }),
  }, OPENAI_TIMEOUT_MS, 'Generarea voiceover-ului OpenAI');

  if (!response.ok) {
    const payload = await response.text().catch(() => '');
    throw new Error(`Nu am putut genera voiceover-ul AI (${response.status}). ${payload.slice(0, 240)}`);
  }

  await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
}

async function transcribePresenterAudio(audioPath: string): Promise<WordTiming[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const audioBuffer = await readFile(audioPath);
    const form = new FormData();
    form.append('model', process.env.OPENAI_TRANSCRIPTION_MODEL || 'whisper-1');
    form.append('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'word');
    form.append('file', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'presenter-voice.mp3');

    const response = await fetchWithTimeout(
      OPENAI_TRANSCRIPTIONS_API_URL,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: form,
      },
      OPENAI_TIMEOUT_MS,
      'Transcrierea voiceover-ului OpenAI'
    );

    if (!response.ok) return null;
    const payload = await response.json().catch(() => ({})) as { words?: Array<{ word?: string; start?: number; end?: number }> };
    const words = (payload.words || [])
      .map((item) => ({
        word: String(item.word || '').trim(),
        start: Number(item.start),
        end: Number(item.end),
      }))
      .filter((item) => item.word && Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start);
    return words.length ? words.slice(0, 260) : null;
  } catch (error) {
    console.warn('[property-video-tour-transcription-fallback]', {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function uploadRenderAsset(input: {
  bucketName: string;
  storagePath: string;
  localPath: string;
  contentType: string;
}) {
  const token = randomUUID();
  const bucket = adminStorage.bucket(input.bucketName);
  await withTimeout(
    bucket.file(input.storagePath).save(await readFile(input.localPath), {
      resumable: false,
      contentType: input.contentType,
      metadata: {
        cacheControl: 'public, max-age=31536000',
        metadata: { firebaseStorageDownloadTokens: token },
      },
    }),
    STORAGE_UPLOAD_TIMEOUT_MS,
    `Upload asset ${path.basename(input.storagePath)}`
  );
  return getFirebaseDownloadUrl(bucket.name, input.storagePath, token);
}

function getAvatarSourceUrl(job: PropertyVideoTourJob) {
  const avatar = job.aiPresenterAvatar || 'business';
  return (
    process.env[`PROPERTY_VIDEO_TOUR_AVATAR_${avatar.toUpperCase()}_URL`] ||
    process.env.PROPERTY_VIDEO_TOUR_AVATAR_SOURCE_URL ||
    ''
  );
}

function getHeyGenAvatarId(job: PropertyVideoTourJob) {
  const avatar = (job.aiPresenterAvatar || 'business').toUpperCase();
  return (
    process.env[`HEYGEN_AVATAR_ID_${avatar}`] ||
    process.env.HEYGEN_AVATAR_ID ||
    ''
  );
}

function getHeyGenVoiceId(job: PropertyVideoTourJob) {
  const voice = (job.aiPresenterVoice || 'female').toUpperCase();
  return (
    process.env[`HEYGEN_VOICE_ID_${voice}`] ||
    process.env.HEYGEN_VOICE_ID ||
    ''
  );
}

function getHeyGenAvatarLookId(job: PropertyVideoTourJob) {
  const avatar = (job.aiPresenterAvatar || 'business').toUpperCase();
  return (
    process.env[`HEYGEN_AVATAR_LOOK_ID_${avatar}`] ||
    process.env.HEYGEN_AVATAR_LOOK_ID ||
    ''
  );
}

function getHeyGenAspectRatio(format: PropertyVideoTourJob['format']) {
  if (format === 'portrait') return '45:64';
  if (format === 'square') return '1:1';
  return '16:9';
}

function getHeyGenResolution(quality: PropertyVideoTourJob['quality']) {
  return quality === 'premium' ? '1080p' : '720p';
}

function getHeyGenEngine() {
  const engine = (process.env.HEYGEN_AVATAR_ENGINE || 'avatar_v').toLowerCase();
  if (engine === 'avatar_3' || engine === 'avatar_iii') return { type: 'avatar_iii' };
  if (engine === 'avatar_4' || engine === 'avatar_iv') return { type: 'avatar_iv' };
  return { type: 'avatar_v' };
}

function getHeyGenDimension(format: PropertyVideoTourJob['format'], quality: PropertyVideoTourJob['quality']) {
  const config = getFormatConfig(format, quality);
  return {
    width: config.width,
    height: config.height,
  };
}

async function readProviderPayload(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({})) as Promise<Record<string, any>>;
  }
  const text = await response.text().catch(() => '');
  return {
    message: text.trim().startsWith('<!DOCTYPE html') || text.trim().startsWith('<html')
      ? `Providerul a returnat HTML in loc de JSON (${response.status}). Verifica endpoint-ul HeyGen.`
      : text.slice(0, 500),
  };
}

async function pollHeyGenV2Video(input: {
  apiKey: string;
  videoId: string;
  outputPath: string;
}) {
  const timeoutAt = Date.now() + 12 * 60 * 1000;
  while (Date.now() < timeoutAt) {
    await new Promise((resolve) => setTimeout(resolve, 6000));
    const statusResponse = await fetch(`${HEYGEN_API_BASE_URL}/v1/video_status.get?video_id=${encodeURIComponent(input.videoId)}`, {
      headers: { 'x-api-key': input.apiKey },
      cache: 'no-store',
    });
    const statusPayload = await readProviderPayload(statusResponse);
    const data = statusPayload.data || statusPayload;
    const status = String(data.status || statusPayload.status || '').toLowerCase();
    const resultUrl = data.video_url || data.videoUrl || data.url || statusPayload.video_url || statusPayload.videoUrl;
    if (resultUrl) {
      await writeFile(input.outputPath, await fetchBuffer(String(resultUrl)));
      return String(resultUrl);
    }
    if (status === 'failed' || status === 'error') {
      throw new Error(data.error?.message || data.message || statusPayload.message || 'HeyGen a respins randarea avatarului.');
    }
  }

  throw new Error('HeyGen nu a finalizat randarea avatarului in timp util.');
}

async function pollHeyGenV3Video(input: {
  apiKey: string;
  videoId: string;
  outputPath: string;
}) {
  const timeoutAt = Date.now() + 12 * 60 * 1000;
  while (Date.now() < timeoutAt) {
    await new Promise((resolve) => setTimeout(resolve, 6000));
    const statusResponse = await fetch(`${HEYGEN_API_BASE_URL}/v3/videos/${encodeURIComponent(input.videoId)}`, {
      headers: { 'x-api-key': input.apiKey },
      cache: 'no-store',
    });
    const statusPayload = await readProviderPayload(statusResponse);
    const data = statusPayload.data || statusPayload;
    const status = String(data.status || statusPayload.status || '').toLowerCase();
    const resultUrl = data.video_url || data.captioned_video_url || data.videoUrl || data.url || statusPayload.video_url || statusPayload.videoUrl;
    if (resultUrl) {
      await writeFile(input.outputPath, await fetchBuffer(String(resultUrl)));
      return String(resultUrl);
    }
    if (status === 'failed' || status === 'error') {
      throw new Error(data.error?.message || data.failure_message || data.message || statusPayload.message || 'HeyGen a respins randarea avatarului.');
    }
  }

  throw new Error('HeyGen nu a finalizat randarea avatarului in timp util.');
}

async function generateHeyGenAvatarVideo(input: {
  job: PropertyVideoTourJob;
  script: string;
  audioUrl: string;
  outputPath: string;
}) {
  const apiKey = process.env.HEYGEN_API_KEY;
  const avatarId = getHeyGenAvatarId(input.job);
  const voiceId = getHeyGenVoiceId(input.job);
  const avatarLookId = getHeyGenAvatarLookId(input.job);
  if (!apiKey) {
    throw new Error('Seteaza HEYGEN_API_KEY in .env.local pentru avatarul HeyGen.');
  }
  if (!avatarId) {
    throw new Error('Seteaza HEYGEN_AVATAR_ID_BUSINESS, HEYGEN_AVATAR_ID_LUXURY sau HEYGEN_AVATAR_ID_CASUAL in .env.local.');
  }

  const useHeyGenTts = process.env.HEYGEN_USE_SCRIPT_TTS === 'true';
  if (avatarLookId) {
    if (!voiceId) {
      throw new Error('Seteaza HEYGEN_VOICE_ID_FEMALE sau HEYGEN_VOICE_ID_MALE pentru avatarul HeyGen v3.');
    }

    const response = await fetch(`${HEYGEN_API_BASE_URL}/v3/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'Idempotency-Key': input.job.id,
      },
      body: JSON.stringify({
        type: 'avatar',
        avatar_id: avatarId,
        engine: getHeyGenEngine(),
        script: input.script.slice(0, 1800),
        voice_id: voiceId,
      }),
    });

    const created = await readProviderPayload(response);
    const videoId = created.data?.video_id || created.video_id || created.data?.id || created.id;
    if (!response.ok || !videoId) {
      throw new Error(created.error?.message || created.message || `HeyGen nu a creat avatarul (${response.status}).`);
    }

    return pollHeyGenV3Video({
      apiKey,
      videoId: String(videoId),
      outputPath: input.outputPath,
    });
  }

  const response = await fetch(`${HEYGEN_API_BASE_URL}/v2/video/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'Idempotency-Key': input.job.id,
    },
    body: JSON.stringify({
      video_inputs: [
        {
          character: {
            type: 'avatar',
            avatar_id: avatarId,
            avatar_style: 'normal',
          },
          voice: useHeyGenTts
            ? {
                type: 'text',
                input_text: input.script,
                voice_id: voiceId,
                speed: input.job.style === 'social' ? 1.06 : input.job.style === 'luxury' ? 0.94 : 1,
              }
            : {
                type: 'audio',
                audio_url: input.audioUrl,
            },
          background: {
            type: 'color',
            value: '#00ff00',
          },
        },
      ],
      dimension: getHeyGenDimension(input.job.format, input.job.quality),
      caption: false,
      title: `ImoDeus property video ${input.job.propertyId}`,
    }),
  });

  const created = await readProviderPayload(response);
  const videoId = created.data?.video_id || created.video_id || created.data?.id || created.id;
  if (!response.ok || !videoId) {
    throw new Error(created.error?.message || created.message || `HeyGen nu a creat avatarul (${response.status}).`);
  }

  return pollHeyGenV2Video({
    apiKey,
    videoId: String(videoId),
    outputPath: input.outputPath,
  });
}

async function pollAvatarResult(input: {
  statusUrl: string;
  authorizationHeader?: string | null;
  resultField?: string | null;
}) {
  const timeoutAt = Date.now() + 7 * 60 * 1000;
  const resultField = input.resultField || 'result_url';

  while (Date.now() < timeoutAt) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const response = await fetch(input.statusUrl, {
      headers: input.authorizationHeader ? { Authorization: input.authorizationHeader } : undefined,
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({})) as Record<string, any>;
    const status = String(payload.status || payload.state || '').toLowerCase();
    const resultUrl = payload[resultField] || payload.resultUrl || payload.video_url || payload.videoUrl || payload.url;
    if (resultUrl) return String(resultUrl);
    if (status === 'failed' || status === 'error' || status === 'rejected') {
      throw new Error(payload.error?.message || payload.message || 'Providerul de avatar a respins randarea.');
    }
  }

  throw new Error('Providerul de avatar nu a finalizat randarea in timp util.');
}

async function generateAvatarVideo(input: {
  job: PropertyVideoTourJob;
  script: string;
  audioUrl: string;
  outputPath: string;
}) {
  const provider = (process.env.PROPERTY_VIDEO_TOUR_AVATAR_PROVIDER || 'webhook').toLowerCase();
  const avatarSourceUrl = getAvatarSourceUrl(input.job);

  if (provider === 'heygen') {
    return generateHeyGenAvatarVideo(input);
  }

  if (provider === 'did') {
    const apiKey = process.env.D_ID_API_KEY || process.env.DID_API_KEY;
    if (!apiKey || !avatarSourceUrl) {
      throw new Error('Pentru avatar AI premium seteaza D_ID_API_KEY si PROPERTY_VIDEO_TOUR_AVATAR_SOURCE_URL.');
    }

    const createResponse = await fetch('https://api.d-id.com/talks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        source_url: avatarSourceUrl,
        script: {
          type: 'audio',
          audio_url: input.audioUrl,
        },
        config: {
          stitch: true,
          result_format: 'mp4',
        },
      }),
    });
    const created = await createResponse.json().catch(() => ({})) as Record<string, any>;
    if (!createResponse.ok || !created.id) {
      throw new Error(created.message || created.error?.message || `D-ID nu a creat avatarul (${createResponse.status}).`);
    }

    const resultUrl = await pollAvatarResult({
      statusUrl: `https://api.d-id.com/talks/${created.id}`,
      authorizationHeader: `Basic ${apiKey}`,
      resultField: 'result_url',
    });
    await writeFile(input.outputPath, await fetchBuffer(resultUrl));
    return resultUrl;
  }

  const endpoint = process.env.PROPERTY_VIDEO_TOUR_AVATAR_RENDER_ENDPOINT;
  if (!endpoint) {
    throw new Error('Seteaza PROPERTY_VIDEO_TOUR_AVATAR_RENDER_ENDPOINT sau PROPERTY_VIDEO_TOUR_AVATAR_PROVIDER=did pentru avatar AI premium.');
  }

  const token = process.env.PROPERTY_VIDEO_TOUR_AVATAR_API_KEY || null;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      mode: 'lip_sync',
      avatar: input.job.aiPresenterAvatar || 'business',
      avatarSourceUrl,
      voice: input.job.aiPresenterVoice || 'female',
      script: input.script,
      audioUrl: input.audioUrl,
      output: {
        format: 'mp4',
        transparent: true,
        greenScreen: true,
      },
      metadata: {
        agencyId: input.job.agencyId,
        propertyId: input.job.propertyId,
        jobId: input.job.id,
      },
    }),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, any>;
  if (!response.ok) {
    throw new Error(payload.message || payload.error?.message || `Providerul de avatar a raspuns cu ${response.status}.`);
  }

  const resultUrl = payload.resultUrl || payload.result_url || payload.videoUrl || payload.video_url || payload.url
    || (payload.statusUrl || payload.status_url
      ? await pollAvatarResult({
          statusUrl: payload.statusUrl || payload.status_url,
          authorizationHeader: token ? `Bearer ${token}` : null,
          resultField: payload.resultField || payload.result_field || null,
        })
      : null);

  if (!resultUrl) {
    throw new Error('Providerul de avatar nu a returnat URL-ul video.');
  }

  await writeFile(input.outputPath, await fetchBuffer(String(resultUrl)));
  return String(resultUrl);
}

function getVideoTourJobsCollection(adminDb: Firestore, agencyId: string, propertyId: string) {
  return adminDb
    .collection('agencies')
    .doc(agencyId)
    .collection('properties')
    .doc(propertyId)
    .collection(JOB_COLLECTION);
}

async function fetchBuffer(url: string) {
  const firebaseStorageFile = getFirebaseStorageFileFromUrl(url);
  let directStorageError: string | null = null;
  if (firebaseStorageFile) {
    try {
      const [buffer] = await adminStorage
        .bucket(firebaseStorageFile.bucketName)
        .file(firebaseStorageFile.filePath)
        .download();
      return buffer;
    } catch (error) {
      directStorageError = error instanceof Error ? error.message : 'acces direct esuat';
    }
  }

  try {
    const response = await fetchWithTimeout(url, undefined, FETCH_TIMEOUT_MS, `Descarcarea media de la ${getUrlHost(url)}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    const host = getUrlHost(url);
    const message = error instanceof Error ? error.message : 'eroare necunoscuta';
    const storageDetail = directStorageError ? ` Citire Storage: ${directStorageError}.` : '';
    throw new Error(`Nu am putut descarca media pentru randare de la ${host}: ${message}.${storageDetail}`);
  }
}

function getFirebaseStorageFileFromUrl(url: string) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname === 'firebasestorage.googleapis.com') {
      const match = parsed.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
      if (!match) return null;
      return {
        bucketName: decodeURIComponent(match[1]),
        filePath: decodeURIComponent(match[2]),
      };
    }

    if (parsed.hostname === 'storage.googleapis.com') {
      const [, bucketName, ...filePathParts] = parsed.pathname.split('/');
      if (!bucketName || filePathParts.length === 0) return null;
      return {
        bucketName: decodeURIComponent(bucketName),
        filePath: decodeURIComponent(filePathParts.join('/')),
      };
    }
  } catch {
    return null;
  }

  return null;
}

function getUrlHost(url: string) {
  try {
    return new URL(url).hostname;
  } catch {
    return 'URL invalid';
  }
}

function getUnknownErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message) return record.message;
    if (typeof record.details === 'string' && record.details) return record.details;
    if (typeof record.code === 'string' && record.code) return record.code;
    if (typeof record.code === 'number') return `Cod eroare ${record.code}`;
    try {
      return JSON.stringify(record).slice(0, 900);
    } catch {
      return fallback;
    }
  }
  if (typeof error === 'string' && error) return error;
  return fallback;
}

function summarizeCommandError(stderr: string, command: string, code: number | null) {
  const lines = stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      if (/^(Input|Output) #\d+/i.test(line)) return false;
      if (/^(Stream|Metadata|Duration|encoder|major_brand|minor_version|compatible_brands)\b/i.test(line)) return false;
      if (/^\s*handler_name\s*:/i.test(line)) return false;
      if (/^\s*vendor_id\s*:/i.test(line)) return false;
      if (/^frame=\s*\d+/i.test(line)) return false;
      if (/^video:\d+/i.test(line)) return false;
      return true;
    });
  const relevant = lines
    .filter((line) => /error|failed|invalid|unable|no such|not found|permission|denied|cannot|could not|impossible/i.test(line))
    .slice(-4);
  const fallbackLines = lines.slice(-4);
  const details = (relevant.length ? relevant : fallbackLines).join(' | ');
  const prefix = `${path.basename(command)} a esuat${typeof code === 'number' ? ` cu exit code ${code}` : ''}.`;
  return details ? `${prefix} ${details}`.slice(0, 700) : prefix;
}

async function runCommand(command: string, args: string[], cwd: string, timeoutMs = FFMPEG_TIMEOUT_MS) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true });
    let stderr = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`${path.basename(command)} a depasit limita de ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(summarizeCommandError(stderr, command, code)));
    });
  });
}

async function runCommandForOutput(command: string, args: string[], cwd: string, timeoutMs = FFMPEG_TIMEOUT_MS) {
  return new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`${path.basename(command)} a depasit limita de ${Math.round(timeoutMs / 1000)}s.`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve({ stdout, stderr, code });
    });
  });
}

function parseFfmpegDuration(output: string) {
  const match = output.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (![hours, minutes, seconds].every(Number.isFinite)) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

async function getMediaDurationSeconds(filePath: string, workDir: string) {
  const result = await runCommandForOutput(
    getFfmpegCommand(),
    ['-hide_banner', '-i', filePath],
    workDir,
    30_000
  );
  const duration = parseFfmpegDuration(`${result.stderr}\n${result.stdout}`);
  if (!duration || duration <= 0) {
    throw new Error(`Nu am putut determina durata media pentru ${path.basename(filePath)}.`);
  }
  return duration;
}

function getFfmpegCommand() {
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

  const resolved = candidates.find((candidate) => existsSync(candidate));
  return resolved || 'ffmpeg';
}

async function assertFfmpegAvailable(workDir: string) {
  await runCommand(getFfmpegCommand(), ['-version'], workDir);
}

function buildZoompanFilter(input: {
  width: number;
  height: number;
  fps: number;
  framesPerImage: number;
  imageIndex: number;
  job: PropertyVideoTourJob;
  property: Property;
  agencyName?: string | null;
}) {
  const { width, height, fps, framesPerImage, imageIndex, job, property, agencyName } = input;
  const progress = `on/${Math.max(framesPerImage - 1, 1)}`;
  const panXLeft = `(iw-iw/zoom)*(1-${progress})`;
  const panXRight = `(iw-iw/zoom)*${progress}`;
  const panYTop = `(ih-ih/zoom)*(1-${progress})`;
  const panYBottom = `(ih-ih/zoom)*${progress}`;
  const centerX = 'iw/2-(iw/zoom/2)';
  const centerY = 'ih/2-(ih/zoom/2)';
  const zoomStep = job.style === 'social' ? '0.0022' : job.style === 'luxury' ? '0.0010' : '0.0015';
  const zoomOutStep = job.style === 'social' ? '0.0018' : job.style === 'luxury' ? '0.0009' : '0.0013';
  const motionVariants = [
    { z: `min(1.02+on*${zoomStep},1.16)`, x: centerX, y: centerY },
    { z: `max(1.16-on*${zoomOutStep},1.03)`, x: centerX, y: centerY },
    { z: '1.12', x: panXRight, y: centerY },
    { z: '1.12', x: panXLeft, y: centerY },
    { z: '1.13', x: centerX, y: panYBottom },
    { z: '1.13', x: centerX, y: panYTop },
    { z: `min(1.04+on*${zoomStep},1.15)`, x: panXRight, y: panYBottom },
    { z: `max(1.15-on*${zoomOutStep},1.04)`, x: panXLeft, y: panYTop },
  ];
  const motion = motionVariants[imageIndex % motionVariants.length];
  const filters = [
    `scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase`,
    `crop=${width * 2}:${height * 2}`,
    `zoompan=z='${motion.z}':x='${motion.x}':y='${motion.y}':d=${framesPerImage}:s=${width}x${height}:fps=${fps}`,
    'setsar=1',
  ];

  if (job.includeText) {
    const surface = property.totalSurface ?? property.squareFootage;
    const meta = [formatPrice(property.price), property.location, property.rooms ? `${property.rooms} camere` : '', surface ? `${surface} mp` : '']
      .filter(Boolean)
      .join('  |  ');
    const titleSize = Math.max(28, Math.round(width * 0.036));
    const metaSize = Math.max(18, Math.round(width * 0.018));
    const safe = Math.max(34, Math.round(width * 0.04));
    filters.push(
      `drawbox=x=0:y=ih*0.66:w=iw:h=ih*0.34:color=black@0.42:t=fill`,
      `drawtext=text='${escapeFfmpegText(property.title || input.job.propertyTitle || 'Proprietate')}':x=${safe}:y=h-${safe + titleSize + metaSize + 22}:fontsize=${titleSize}:fontcolor=white:shadowcolor=black@0.55:shadowx=2:shadowy=2`,
      `drawtext=text='${escapeFfmpegText(meta)}':x=${safe}:y=h-${safe}:fontsize=${metaSize}:fontcolor=0xD6FFEB:shadowcolor=black@0.55:shadowx=2:shadowy=2`
    );
  }

  if (job.includeBranding) {
    const brand = escapeFfmpegText(agencyName || 'ImoDeus.ai');
    const brandSize = Math.max(16, Math.round(width * 0.016));
    const safe = Math.max(28, Math.round(width * 0.035));
    filters.push(
      `drawtext=text='${brand}':x=w-tw-${safe}:y=${safe}:fontsize=${brandSize}:fontcolor=white@0.82:shadowcolor=black@0.45:shadowx=1:shadowy=1`
    );
  }

  return filters.join(',');
}

function getTransitionSeconds(style: PropertyVideoTourJob['style']) {
  if (style === 'social') return 0.32;
  if (style === 'luxury') return 0.72;
  return 0.48;
}

function getTransitionName(index: number, style: PropertyVideoTourJob['style']) {
  const cinematic = ['fade', 'smoothleft', 'smoothright', 'distance'];
  const luxury = ['fade', 'fadeblack', 'smoothleft', 'smoothright'];
  const social = ['smoothleft', 'smoothright', 'circlecrop', 'fade'];
  const transitions = style === 'luxury' ? luxury : style === 'social' ? social : cinematic;
  return transitions[index % transitions.length];
}

async function stitchSegmentsSimple(input: {
  segmentPaths: string[];
  outputPath: string;
  quality: PropertyVideoTourJob['quality'];
  workDir: string;
}) {
  const concatPath = path.join(input.workDir, 'segments.txt');
  await writeFile(
    concatPath,
    input.segmentPaths.map((segmentPath) => `file '${path.basename(segmentPath).replace(/'/g, "'\\''")}'`).join('\n'),
    'utf8'
  );
  try {
    await runCommand(
      getFfmpegCommand(),
      ['-y', '-f', 'concat', '-safe', '0', '-i', concatPath, '-c', 'copy', '-movflags', '+faststart', input.outputPath],
      input.workDir
    );
  } catch {
    await runCommand(
      getFfmpegCommand(),
      [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        concatPath,
        '-an',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-preset',
        'veryfast',
        '-crf',
        input.quality === 'premium' ? '18' : '22',
        '-movflags',
        '+faststart',
        input.outputPath,
      ],
      input.workDir
    );
  }
}

async function stitchSegmentsWithTransitions(input: {
  segmentPaths: string[];
  outputPath: string;
  segmentDurationSeconds: number;
  transitionSeconds: number;
  style: PropertyVideoTourJob['style'];
  quality: PropertyVideoTourJob['quality'];
  workDir: string;
}) {
  const { segmentPaths, outputPath, segmentDurationSeconds, transitionSeconds, style, quality, workDir } = input;
  if (segmentPaths.length === 1) {
    await runCommand(getFfmpegCommand(), ['-y', '-i', segmentPaths[0], '-c', 'copy', '-movflags', '+faststart', outputPath], workDir);
    return;
  }

  const inputArgs = segmentPaths.flatMap((segmentPath) => ['-i', segmentPath]);
  const normalizedInputs = segmentPaths.map((_, index) => `[${index}:v]setpts=PTS-STARTPTS[v${index}]`);
  const xfadeFilters: string[] = [];
  let previousLabel = 'v0';

  for (let index = 1; index < segmentPaths.length; index += 1) {
    const outputLabel = `vx${index}`;
    const offset = Math.max(0.1, (segmentDurationSeconds - transitionSeconds) * index);
    xfadeFilters.push(
      `[${previousLabel}][v${index}]xfade=transition=${getTransitionName(index - 1, style)}:duration=${transitionSeconds.toFixed(2)}:offset=${offset.toFixed(2)}[${outputLabel}]`
    );
    previousLabel = outputLabel;
  }

  try {
    await runCommand(
      getFfmpegCommand(),
      [
        '-y',
        ...inputArgs,
        '-filter_complex',
        [...normalizedInputs, ...xfadeFilters].join(';'),
        '-map',
        `[${previousLabel}]`,
        '-an',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-preset',
        'veryfast',
        '-crf',
        quality === 'premium' ? '18' : '22',
        '-movflags',
        '+faststart',
        outputPath,
      ],
      workDir
    );
  } catch (error) {
    console.warn('[property-video-tour-transitions-fallback]', {
      message: error instanceof Error ? error.message : String(error),
    });
    await stitchSegmentsSimple({ segmentPaths, outputPath, quality, workDir });
  }
}

async function extendVideoToDuration(input: {
  inputPath: string;
  outputPath: string;
  currentDurationSeconds: number;
  targetDurationSeconds: number;
  quality: PropertyVideoTourJob['quality'];
  workDir: string;
}) {
  const extraSeconds = Math.max(0, input.targetDurationSeconds - input.currentDurationSeconds);
  if (extraSeconds < 0.15) {
    await runCommand(
      getFfmpegCommand(),
      ['-y', '-i', input.inputPath, '-c', 'copy', '-movflags', '+faststart', input.outputPath],
      input.workDir
    );
    return;
  }

  await runCommand(
    getFfmpegCommand(),
    [
      '-y',
      '-stream_loop',
      '-1',
      '-i',
      input.inputPath,
      '-t',
      input.targetDurationSeconds.toFixed(2),
      '-an',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'veryfast',
      '-crf',
      input.quality === 'premium' ? '18' : '22',
      '-movflags',
      '+faststart',
      input.outputPath,
    ],
    input.workDir
  );
}

function getPresenterOverlayConfig(input: {
  width: number;
  height: number;
  position?: PropertyVideoTourJob['aiPresenterPosition'];
  size?: PropertyVideoTourJob['aiPresenterSize'];
}) {
  const sizeRatio = input.size === 'large' ? 0.28 : input.size === 'small' ? 0.18 : 0.23;
  const overlayWidth = Math.round(input.width * sizeRatio);
  const margin = Math.max(24, Math.round(input.width * 0.045));
  if (input.width < input.height) {
    const x = margin;
    const y = Math.round(input.height * 0.36);
    return { overlayWidth, x, y, margin };
  }
  const x = input.position === 'bottom-left' ? margin : input.width - overlayWidth - margin;
  const y = Math.round(input.height * 0.46);
  return { overlayWidth, x, y, margin };
}

function escapeAssText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function splitCaptionLine<T>(items: T[]) {
  if (items.length <= 1) return { first: items, second: [] as T[] };
  const splitAt = Math.ceil(items.length / 2);
  return {
    first: items.slice(0, splitAt),
    second: items.slice(splitAt),
  };
}

function buildKaraokeAss(input: {
  script: string;
  durationSeconds: number;
  width: number;
  height: number;
  wordTimings?: WordTiming[] | null;
}) {
  const timedWords = (input.wordTimings || [])
    .filter((item) => item.word && item.end > item.start)
    .slice(0, 260);
  const words = input.script
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 180);
  const safeWords = words.length ? words : ['Prezentare', 'proprietate'];
  const totalUnits = Math.max(1, Math.round(input.durationSeconds * 100));
  const unitPerWord = Math.max(18, Math.floor(totalUnits / safeWords.length));
  const lineWordCount = input.width < input.height ? 6 : 8;
  const fontSize = Math.round(input.width * (input.width < input.height ? 0.079 : 0.052));
  const marginV = Math.round(input.height * (input.width < input.height ? 0.108 : 0.095));
  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${input.width}`,
    `PlayResY: ${input.height}`,
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: ImoDeusCaption,Arial Rounded MT Bold,${fontSize},&H00FFFFFF,&H00B827F5,&HAA5D0B42,&HAA5D0B42,-1,0,0,0,100,100,0,0,1,6,2,2,64,64,${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ];

  const events: string[] = [];
  if (timedWords.length) {
    const timedScriptWords = safeWords.map((word, index) => {
      const timedWord = timedWords[index];
      const estimatedStart = (unitPerWord * index) / 100;
      const estimatedEnd = estimatedStart + unitPerWord / 100;
      const start = Math.max(0, (timedWord?.start ?? estimatedStart) + CAPTION_TIMING_DELAY_SECONDS);
      const end = Math.min(
        input.durationSeconds,
        Math.max(start + 0.08, (timedWord?.end ?? estimatedEnd) + CAPTION_TIMING_DELAY_SECONDS)
      );
      return { word, start, end };
    });

    for (let index = 0; index < timedScriptWords.length; index += lineWordCount) {
      const lineWords = timedScriptWords.slice(index, index + lineWordCount);
      const start = Math.max(0, lineWords[0].start);
      const end = Math.min(input.durationSeconds, Math.max(lineWords[lineWords.length - 1].end + 0.1, start + 0.55));
      let cursor = start;
      const renderTimedWord = (item: { word: string; start: number; end: number }) => {
        const gapUnits = Math.max(0, Math.round((item.start - cursor) * 100));
        const units = Math.max(9, Math.round((item.end - item.start) * 100));
        cursor = item.end;
        return `${gapUnits ? `{\\k${gapUnits}}` : ''}{\\k${units}}${escapeAssText(item.word)}`;
      };
      const split = splitCaptionLine(lineWords);
      const firstLine = split.first.map(renderTimedWord).join(' ');
      const secondLine = split.second.map(renderTimedWord).join(' ');
      const text = `${firstLine}\\N${secondLine || CAPTION_EMPTY_LINE}`;
      events.push(`Dialogue: 0,${formatAssTime(start)},${formatAssTime(end)},ImoDeusCaption,,0,0,0,,${text}`);
    }
    return [...header, ...events, ''].join('\n');
  }

  let currentUnit = 0;
  for (let index = 0; index < safeWords.length; index += lineWordCount) {
    const lineWords = safeWords.slice(index, index + lineWordCount);
    const start = currentUnit / 100;
    const lineUnits = unitPerWord * lineWords.length;
    const end = Math.min(input.durationSeconds, (currentUnit + lineUnits + 35) / 100);
    currentUnit += lineUnits;
    const split = splitCaptionLine(lineWords);
    const firstLine = split.first.map((word) => `{\\k${unitPerWord}}${escapeAssText(word)}`).join(' ');
    const secondLine = split.second.map((word) => `{\\k${unitPerWord}}${escapeAssText(word)}`).join(' ');
    const text = `${firstLine}\\N${secondLine || CAPTION_EMPTY_LINE}`;
    events.push(`Dialogue: 0,${formatAssTime(start)},${formatAssTime(Math.max(start + 0.6, end))},ImoDeusCaption,,0,0,0,,${text}`);
  }

  return [...header, ...events, ''].join('\n');
}

function formatAssTime(seconds: number) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = Math.floor(safeSeconds % 60);
  const centiseconds = Math.floor((safeSeconds - Math.floor(safeSeconds)) * 100);
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

async function getPropertyAgentProfile(input: {
  adminDb: Firestore;
  property: Property;
}) {
  let profile: { name?: string | null; photoUrl?: string | null; phone?: string | null } = {
    name: input.property.agent?.name || input.property.agentName || null,
  };
  const propertyAgentPhoto = input.property.agent?.avatarUrl;
  if (propertyAgentPhoto) profile.photoUrl = propertyAgentPhoto;

  if (!input.property.agentId) return profile;
  const agentSnapshot = await input.adminDb.collection('users').doc(input.property.agentId).get();
  if (!agentSnapshot.exists) return profile;
  const agent = agentSnapshot.data() as { name?: string | null; photoUrl?: string | null; phone?: string | null } | undefined;
  profile = {
    name: profile.name || agent?.name || null,
    photoUrl: profile.photoUrl || agent?.photoUrl || null,
    phone: agent?.phone || null,
  };
  return profile;
}

function buildAgentContactBadge(input: {
  agentProfile: { name?: string | null; phone?: string | null };
  overlay: ReturnType<typeof getPresenterOverlayConfig>;
  photoSize: number;
  height: number;
  durationSeconds: number;
}) {
  const phone = truncateForOverlay(input.agentProfile.phone || '', 22);
  const name = truncateForOverlay(input.agentProfile.name || 'Agent ImoDeus', 22);
  const safeName = name || 'Agent ImoDeus';

  const nameText = escapeFfmpegText(safeName);
  const phoneText = escapeFfmpegText(phone);
  const cardHeight = Math.max(104, Math.round(input.height * 0.078));
  const gap = Math.max(18, Math.round(input.height * 0.018));
  const nameSize = Math.round(cardHeight * 0.27);
  const phoneSize = Math.round(cardHeight * 0.40);
  const cardWidth = Math.max(
    input.photoSize + 132,
    Math.round(Math.max(safeName.length * nameSize * 0.62, phone.length * phoneSize * 0.58) + cardHeight * 1.28)
  );
  const groupWidth = cardWidth + 18;
  const groupHeight = cardHeight + gap + input.photoSize + 18;
  const groupX = Math.max(10, Math.round(input.overlay.x + input.photoSize / 2 - groupWidth / 2));
  const groupY = Math.max(12, Math.round(input.overlay.y - cardHeight - gap));
  const cardX = 9;
  const cardY = 4;
  const agentX = Math.round((groupWidth - input.photoSize) / 2);
  const agentY = cardHeight + gap;
  const floatY = '8*sin(t*2.1)';
  const accent = '0xD92BFF';
  const glow = '0xF45BFF';
  const textX = cardX + Math.round(cardHeight * 0.50);
  const nameY = cardY + Math.round(cardHeight * 0.16);
  const phoneY = cardY + Math.round(cardHeight * 0.49);
  const stripX = cardX + Math.round(cardHeight * 0.18);
  const stripY = cardY + Math.round(cardHeight * 0.18);
  const stripW = Math.max(9, Math.round(cardHeight * 0.105));
  const stripH = Math.round(cardHeight * 0.64);
  const cardFilter = [
    `color=c=black@0.0:s=${groupWidth}x${groupHeight}:d=${input.durationSeconds.toFixed(2)},format=rgba[badgebase]`,
    `[badgebase]drawbox=x=${cardX + 8}:y=${cardY + 10}:w=${cardWidth}:h=${cardHeight}:color=black@0.24:t=fill`,
    `drawbox=x=${cardX}:y=${cardY}:w=${cardWidth}:h=${cardHeight}:color=black@0.72:t=fill`,
    `drawbox=x=${cardX}:y=${cardY}:w=${cardWidth}:h=${cardHeight}:color=${accent}@0.48:t=5`,
    `drawbox=x=${cardX + 5}:y=${cardY + 5}:w=${cardWidth - 10}:h=${cardHeight - 10}:color=white@0.05:t=2`,
    `drawbox=x=${stripX}:y=${stripY}:w=${stripW}:h=${stripH}:color=${glow}@0.98:t=fill`,
    `drawtext=font='Arial Rounded MT Bold':text='${nameText}':x=${textX}:y=${nameY}:fontsize=${nameSize}:fontcolor=0xFFE6FF:shadowcolor=black@0.90:shadowx=2:shadowy=2`,
    phone
      ? `drawtext=font='Arial Rounded MT Bold':text='${phoneText}':x=${textX}:y=${phoneY}:fontsize=${phoneSize}:fontcolor=white:shadowcolor=black@0.95:shadowx=3:shadowy=3[badgecard]`
      : `null[badgecard]`,
  ].join(',');

  return {
    filter: cardFilter,
    groupX,
    groupY,
    agentX,
    agentY,
    floatY,
  };
}

async function overlayAgentPhotoAndCaptions(input: {
  adminDb: Firestore;
  property: Property;
  baseVideoPath: string;
  outputPath: string;
  script: string;
  wordTimings?: WordTiming[] | null;
  durationSeconds: number;
  width: number;
  height: number;
  position?: PropertyVideoTourJob['aiPresenterPosition'];
  size?: PropertyVideoTourJob['aiPresenterSize'];
  workDir: string;
}) {
  const captionsPath = path.join(input.workDir, 'agent-captions.ass');
  await writeFile(
    captionsPath,
    buildKaraokeAss({
      script: input.script,
      durationSeconds: input.durationSeconds,
      width: input.width,
      height: input.height,
      wordTimings: input.wordTimings,
    }),
    'utf8'
  );

  const agentProfile = await getPropertyAgentProfile({
    adminDb: input.adminDb,
    property: input.property,
  });
  const agentPhotoUrl = agentProfile.photoUrl || null;

  if (!agentPhotoUrl) {
    await runCommand(
      getFfmpegCommand(),
      [
        '-y',
        '-i',
        input.baseVideoPath,
        '-vf',
        'ass=agent-captions.ass',
        '-t',
        String(input.durationSeconds),
        '-an',
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-preset',
        'veryfast',
        '-crf',
        '19',
        '-movflags',
        '+faststart',
        input.outputPath,
      ],
      input.workDir
    );
    return;
  }

  const agentPhotoPath = path.join(input.workDir, 'agent-photo.jpg');
  await writeFile(agentPhotoPath, await fetchBuffer(agentPhotoUrl));
  const overlay = getPresenterOverlayConfig({
    width: input.width,
    height: input.height,
    position: input.position,
    size: input.size,
  });
  const photoSize = overlay.overlayWidth;
  const circleMask = `scale=${photoSize}:${photoSize}:force_original_aspect_ratio=increase,crop=${photoSize}:${photoSize},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte((X-W/2)*(X-W/2)+(Y-H/2)*(Y-H/2),(W/2)*(W/2)),255,0)'`;
  const badge = buildAgentContactBadge({
    agentProfile,
    overlay,
    photoSize,
    height: input.height,
    durationSeconds: input.durationSeconds,
  });
  const filter = `${badge.filter};[1:v]${circleMask}[agent];[badgecard][agent]overlay=x=${badge.agentX}:y=${badge.agentY}:format=auto:shortest=1[badge];[0:v][badge]overlay=x=${badge.groupX}:y='${badge.groupY}+${badge.floatY}':eval=frame:format=auto:shortest=1[withagent];[withagent]ass=agent-captions.ass[v]`;

  await runCommand(
    getFfmpegCommand(),
    [
      '-y',
      '-i',
      input.baseVideoPath,
      '-loop',
      '1',
      '-i',
      agentPhotoPath,
      '-filter_complex',
      filter,
      '-map',
      '[v]',
      '-t',
      String(input.durationSeconds),
      '-an',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'veryfast',
      '-crf',
      '19',
      '-movflags',
      '+faststart',
      input.outputPath,
    ],
    input.workDir
  );
}

async function overlayAgentPhotoOnly(input: {
  adminDb: Firestore;
  property: Property;
  baseVideoPath: string;
  outputPath: string;
  durationSeconds: number;
  width: number;
  height: number;
  position?: PropertyVideoTourJob['aiPresenterPosition'];
  size?: PropertyVideoTourJob['aiPresenterSize'];
  workDir: string;
}) {
  const agentProfile = await getPropertyAgentProfile({
    adminDb: input.adminDb,
    property: input.property,
  });
  const agentPhotoUrl = agentProfile.photoUrl || null;

  if (!agentPhotoUrl) {
    await runCommand(getFfmpegCommand(), ['-y', '-i', input.baseVideoPath, '-c', 'copy', '-movflags', '+faststart', input.outputPath], input.workDir);
    return;
  }

  const agentPhotoPath = path.join(input.workDir, 'agent-photo-fallback.jpg');
  await writeFile(agentPhotoPath, await fetchBuffer(agentPhotoUrl));
  const overlay = getPresenterOverlayConfig({
    width: input.width,
    height: input.height,
    position: input.position,
    size: input.size,
  });
  const photoSize = overlay.overlayWidth;
  const circleMask = `scale=${photoSize}:${photoSize}:force_original_aspect_ratio=increase,crop=${photoSize}:${photoSize},format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='if(lte((X-W/2)*(X-W/2)+(Y-H/2)*(Y-H/2),(W/2)*(W/2)),255,0)'`;
  const badge = buildAgentContactBadge({
    agentProfile,
    overlay,
    photoSize,
    height: input.height,
    durationSeconds: input.durationSeconds,
  });
  const filter = `${badge.filter};[1:v]${circleMask}[agent];[badgecard][agent]overlay=x=${badge.agentX}:y=${badge.agentY}:format=auto:shortest=1[badge];[0:v][badge]overlay=x=${badge.groupX}:y='${badge.groupY}+${badge.floatY}':eval=frame:format=auto:shortest=1[v]`;

  await runCommand(
    getFfmpegCommand(),
    [
      '-y',
      '-i',
      input.baseVideoPath,
      '-loop',
      '1',
      '-i',
      agentPhotoPath,
      '-filter_complex',
      filter,
      '-map',
      '[v]',
      '-t',
      String(input.durationSeconds),
      '-an',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'veryfast',
      '-crf',
      '19',
      '-movflags',
      '+faststart',
      input.outputPath,
    ],
    input.workDir
  );
}

async function overlayPresenterVideo(input: {
  baseVideoPath: string;
  presenterVideoPath: string;
  outputPath: string;
  width: number;
  height: number;
  position?: PropertyVideoTourJob['aiPresenterPosition'];
  size?: PropertyVideoTourJob['aiPresenterSize'];
  workDir: string;
}) {
  const overlay = getPresenterOverlayConfig(input);
  const filter = `[1:v]scale=${overlay.overlayWidth}:-1:force_original_aspect_ratio=decrease,format=rgba,colorkey=0x00ff00:0.22:0.10,setsar=1[presenter];[0:v][presenter]overlay=x=${overlay.x}:y=${overlay.y}:format=auto:shortest=1[v]`;

  await runCommand(
    getFfmpegCommand(),
    [
      '-y',
      '-i',
      input.baseVideoPath,
      '-stream_loop',
      '-1',
      '-i',
      input.presenterVideoPath,
      '-filter_complex',
      filter,
      '-map',
      '[v]',
      '-an',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'veryfast',
      '-crf',
      '19',
      '-movflags',
      '+faststart',
      input.outputPath,
    ],
    input.workDir
  );
}

async function muxFinalVideo(input: {
  videoPath: string;
  outputPath: string;
  presenterAudioPath?: string | null;
  includeMusic: boolean;
  durationSeconds: number;
  workDir: string;
}) {
  if (input.presenterAudioPath && input.includeMusic) {
    const musicPath = await createSilentAudio(input.workDir, input.durationSeconds);
    await runCommand(
      getFfmpegCommand(),
      [
        '-y',
        '-i',
        input.videoPath,
        '-i',
        input.presenterAudioPath,
        '-i',
        musicPath,
        '-filter_complex',
        '[1:a]volume=1.0,afade=t=in:st=0:d=0.15,afade=t=out:st=' + Math.max(0, input.durationSeconds - 0.35) + ':d=0.35[voice];[2:a]volume=0.018[bed];[voice][bed]amix=inputs=2:duration=first:dropout_transition=0[a]',
        '-map',
        '0:v',
        '-map',
        '[a]',
        '-shortest',
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        input.outputPath,
      ],
      input.workDir
    );
    return;
  }

  if (input.presenterAudioPath) {
    await runCommand(
      getFfmpegCommand(),
      [
        '-y',
        '-i',
        input.videoPath,
        '-i',
        input.presenterAudioPath,
        '-shortest',
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        input.outputPath,
      ],
      input.workDir
    );
    return;
  }

  if (input.includeMusic) {
    const audioPath = await createSilentAudio(input.workDir, input.durationSeconds);
    await runCommand(
      getFfmpegCommand(),
      [
        '-y',
        '-i',
        input.videoPath,
        '-i',
        audioPath,
        '-shortest',
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-movflags',
        '+faststart',
        input.outputPath,
      ],
      input.workDir
    );
    return;
  }

  await runCommand(getFfmpegCommand(), ['-y', '-i', input.videoPath, '-c', 'copy', '-movflags', '+faststart', input.outputPath], input.workDir);
}

async function createSilentAudio(workDir: string, durationSeconds: number) {
  const audioPath = path.join(workDir, 'ambient.m4a');
  await runCommand(
    getFfmpegCommand(),
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      `sine=frequency=174:sample_rate=44100:duration=${durationSeconds}`,
      '-filter:a',
      'volume=0.035,afade=t=in:st=0:d=1.2,afade=t=out:st=' + Math.max(0, durationSeconds - 1.4) + ':d=1.4',
      '-c:a',
      'aac',
      '-b:a',
      '96k',
      audioPath,
    ],
    workDir
  );
  return audioPath;
}

async function renderJobWithFfmpeg(input: {
  adminDb: Firestore;
  job: PropertyVideoTourJob;
  property: Property;
  onProgress?: (update: RenderProgressUpdate) => Promise<void>;
}) {
  const { job, property } = input;
  const bucket = adminStorage.bucket();
  const workDir = await mkdtemp(path.join(tmpdir(), 'imodeus-video-tour-'));

  try {
    await input.onProgress?.({ progress: 18, stage: 'Verific FFmpeg' });
    await assertFfmpegAvailable(workDir);
    await mkdir(path.join(workDir, 'frames'), { recursive: true });

    const images = (job.images || []).slice(0, MAX_IMAGES);
    if (images.length < 2) {
      throw new Error('Randarea cloud are nevoie de cel putin doua fotografii.');
    }

    const downloadedImages: Array<{ sourceIndex: number; fileName: string }> = [];
    const skippedImages: string[] = [];
    for (let index = 0; index < images.length; index += 1) {
      const fileName = `image-${String(downloadedImages.length).padStart(3, '0')}.jpg`;
      try {
        const imageBuffer = await fetchBuffer(images[index].url);
        await writeFile(path.join(workDir, 'frames', fileName), imageBuffer);
        downloadedImages.push({ sourceIndex: index, fileName });
        await input.onProgress?.({
          progress: 20 + Math.round((downloadedImages.length / images.length) * 12),
          stage: 'Descarc fotografiile',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Nu am putut descarca fotografia.';
        skippedImages.push(`Foto ${index + 1}: ${message}`);
      }
    }

    if (downloadedImages.length < 2) {
      const details = skippedImages.slice(0, 3).join(' | ');
      throw new Error(
        `Randarea cloud nu poate citi cel putin doua fotografii valide. ${details ? `Detalii: ${details}` : ''}`.trim()
      );
    }

    const fps = 30;
    const agencySnapshot = await input.adminDb.collection('agencies').doc(job.agencyId).get();
    const agencyName = (agencySnapshot.data() as { name?: string } | undefined)?.name || null;
    const defaultDuration = downloadedImages.length * getSecondsPerImage(job.style);
    const baseDurationSeconds = Math.round(job.targetDurationSeconds || defaultDuration);
    let renderDurationSeconds = baseDurationSeconds;
    const transitionSeconds = getTransitionSeconds(job.style);
    const segmentDurationSeconds = (baseDurationSeconds + (downloadedImages.length - 1) * transitionSeconds) / downloadedImages.length;
    const framesPerImage = Math.max(45, Math.round(segmentDurationSeconds * fps));
    const { width, height } = getFormatConfig(job.format, job.quality);
    const segmentPaths: string[] = [];

    for (let index = 0; index < downloadedImages.length; index += 1) {
      const segmentPath = path.join(workDir, `segment-${String(index).padStart(3, '0')}.mp4`);
      segmentPaths.push(segmentPath);
      await runCommand(
        getFfmpegCommand(),
        [
          '-y',
          '-loop',
          '1',
          '-i',
          path.join(workDir, 'frames', downloadedImages[index].fileName),
          '-vf',
          buildZoompanFilter({ width, height, fps, framesPerImage, imageIndex: index, job, property, agencyName }),
          '-t',
          String(framesPerImage / fps),
          '-an',
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-preset',
          'veryfast',
          '-crf',
          job.quality === 'premium' ? '18' : '22',
          segmentPath,
        ],
        workDir
      );
      await input.onProgress?.({
        progress: 34 + Math.round(((index + 1) / downloadedImages.length) * 26),
        stage: 'Randez segmentele video',
      });
    }

    const silentVideoPath = path.join(workDir, 'video-no-audio.mp4');
    await input.onProgress?.({ progress: 62, stage: 'Aplic tranzitiile' });
    await stitchSegmentsWithTransitions({
      segmentPaths,
      outputPath: silentVideoPath,
      segmentDurationSeconds: framesPerImage / fps,
      transitionSeconds,
      style: job.style,
      quality: job.quality,
      workDir,
    });
    await input.onProgress?.({ progress: 66, stage: 'Aplic tranzitiile' });

    let presenterScript: string | null = null;
    let presenterAudioPath: string | null = null;
    let presenterAudioUrl: string | null = null;
    let presenterVideoUrl: string | null = null;
    let presenterWordTimings: WordTiming[] | null = null;
    let videoForMuxPath = silentVideoPath;

    if (job.includeAiPresenter) {
      await input.onProgress?.({ progress: 68, stage: 'Generez scriptul' });
      presenterScript = await generatePresenterScript(property, job);
      await input.onProgress?.({ progress: 70, stage: 'Generez scriptul' });
      presenterAudioPath = path.join(workDir, 'presenter-voice.mp3');
      await input.onProgress?.({ progress: 72, stage: 'Generez voiceover-ul' });
      await synthesizePresenterAudio(presenterScript, job, presenterAudioPath);
      const presenterAudioDurationSeconds = await getMediaDurationSeconds(presenterAudioPath, workDir);
      renderDurationSeconds = Math.max(baseDurationSeconds, Math.ceil(presenterAudioDurationSeconds + 0.35));
      await input.onProgress?.({ progress: 74, stage: 'Generez voiceover-ul' });
      presenterWordTimings = await transcribePresenterAudio(presenterAudioPath);
      await input.onProgress?.({ progress: 76, stage: 'Incarc voiceover-ul' });
      presenterAudioUrl = await uploadRenderAsset({
        bucketName: bucket.name,
        storagePath: `agencies/${job.agencyId}/properties/${job.propertyId}/video-tours/cloud-${job.id}/presenter-voice.mp3`,
        localPath: presenterAudioPath,
        contentType: 'audio/mpeg',
      });
      await input.onProgress?.({ progress: 78, stage: 'Incarc voiceover-ul' });

      const compositedVideoPath = path.join(workDir, 'video-with-agent-voice.mp4');
      await input.onProgress?.({ progress: 80, stage: 'Aplic poza agentului si subtitrarea' });
      const baseVideoForPresenterPath = path.join(workDir, 'video-for-presenter-duration.mp4');
      await extendVideoToDuration({
        inputPath: silentVideoPath,
        outputPath: baseVideoForPresenterPath,
        currentDurationSeconds: baseDurationSeconds,
        targetDurationSeconds: renderDurationSeconds,
        quality: job.quality,
        workDir,
      });
      try {
        await overlayAgentPhotoAndCaptions({
          adminDb: input.adminDb,
          property,
          baseVideoPath: baseVideoForPresenterPath,
          outputPath: compositedVideoPath,
          script: presenterScript,
          wordTimings: presenterWordTimings,
          durationSeconds: renderDurationSeconds,
          width,
          height,
          position: job.aiPresenterPosition,
          size: job.aiPresenterSize,
          workDir,
        });
        await input.onProgress?.({ progress: 84, stage: 'Aplic poza agentului si subtitrarea' });
      } catch (error) {
        console.warn('[property-video-tour-caption-fallback]', {
          message: error instanceof Error ? error.message : String(error),
        });
        await overlayAgentPhotoOnly({
          adminDb: input.adminDb,
          property,
          baseVideoPath: baseVideoForPresenterPath,
          outputPath: compositedVideoPath,
          durationSeconds: renderDurationSeconds,
          width,
          height,
          position: job.aiPresenterPosition,
          size: job.aiPresenterSize,
          workDir,
        });
        await input.onProgress?.({ progress: 84, stage: 'Aplic poza agentului si subtitrarea' });
      }
      presenterVideoUrl = null;
      videoForMuxPath = compositedVideoPath;
    } else {
      renderDurationSeconds = baseDurationSeconds;
    }

    const finalVideoPath = path.join(workDir, 'video-tour.mp4');
    await input.onProgress?.({ progress: 86, stage: 'Combin vocea cu video-ul' });
    await muxFinalVideo({
      videoPath: videoForMuxPath,
      outputPath: finalVideoPath,
      presenterAudioPath,
      includeMusic: job.includeMusic,
      durationSeconds: renderDurationSeconds,
      workDir,
    });
    await input.onProgress?.({ progress: 90, stage: 'Combin vocea cu video-ul' });

    const thumbnailPath = path.join(workDir, 'thumbnail.jpg');
    await input.onProgress?.({ progress: 92, stage: 'Generez thumbnail-ul' });
    await runCommand(
      getFfmpegCommand(),
      ['-y', '-ss', '00:00:01', '-i', finalVideoPath, '-frames:v', '1', '-q:v', '3', thumbnailPath],
      workDir
    );
    await input.onProgress?.({ progress: 93, stage: 'Generez thumbnail-ul' });

    const safeTitle = sanitizeFileName(property.title || job.propertyTitle || 'video-tur');
    const baseStoragePath = `agencies/${job.agencyId}/properties/${job.propertyId}/video-tours/cloud-${job.id}`;
    const videoStoragePath = `${baseStoragePath}/${safeTitle}.mp4`;
    const thumbnailStoragePath = `${baseStoragePath}/${safeTitle}-thumb.jpg`;
    const videoToken = randomUUID();
    const thumbnailToken = randomUUID();

    await input.onProgress?.({ progress: 94, stage: 'Incarc video-ul final' });
    await withTimeout(
      Promise.all([
        bucket.file(videoStoragePath).save(await readFile(finalVideoPath), {
          resumable: false,
          contentType: 'video/mp4',
          metadata: {
            cacheControl: 'public, max-age=31536000',
            metadata: { firebaseStorageDownloadTokens: videoToken },
          },
        }),
        bucket.file(thumbnailStoragePath).save(await readFile(thumbnailPath), {
          resumable: false,
          contentType: 'image/jpeg',
          metadata: {
            cacheControl: 'public, max-age=31536000',
            metadata: { firebaseStorageDownloadTokens: thumbnailToken },
          },
        }),
      ]),
      STORAGE_UPLOAD_TIMEOUT_MS,
      'Upload video final'
    );
    await input.onProgress?.({ progress: 96, stage: 'Incarc video-ul final' });

    const videoUrl = getFirebaseDownloadUrl(bucket.name, videoStoragePath, videoToken);
    const thumbnailUrl = getFirebaseDownloadUrl(bucket.name, thumbnailStoragePath, thumbnailToken);

    return {
      videoUrl,
      thumbnailUrl,
      durationSeconds: renderDurationSeconds,
      mimeType: 'video/mp4',
      fileName: `${safeTitle}.mp4`,
      imageCount: downloadedImages.length,
      skippedImageCount: skippedImages.length,
      presenterScript,
      presenterAudioUrl,
      presenterVideoUrl,
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function createPropertyVideoTourJob(input: CreateJobInput) {
  const propertyRef = input.adminDb
    .collection('agencies')
    .doc(input.agencyId)
    .collection('properties')
    .doc(input.propertyId);
  const propertySnapshot = await propertyRef.get();

  if (!propertySnapshot.exists) {
    throw new Error('Proprietatea nu exista sau nu apartine agentiei curente.');
  }

  const property = { id: propertySnapshot.id, ...propertySnapshot.data() } as Property;
  const images = (property.images || [])
    .filter((image) => image?.url)
    .slice(0, MAX_IMAGES)
    .map((image) => ({ url: image.url, alt: image.alt || property.title }));

  if (images.length < 2) {
    throw new Error('Ai nevoie de cel putin doua fotografii pentru randarea video cloud.');
  }

  const jobRef = getVideoTourJobsCollection(input.adminDb, input.agencyId, input.propertyId).doc();
  const now = nowIso();
  const job: PropertyVideoTourJob = {
    id: jobRef.id,
    agencyId: input.agencyId,
    propertyId: input.propertyId,
    propertyTitle: property.title,
    status: 'queued',
    engine: 'ffmpeg-cloud',
    format: input.format || 'portrait',
    style: input.style || 'cinematic',
    quality: input.quality || 'premium',
    targetDurationSeconds: input.targetDurationSeconds || null,
    includeText: input.includeText !== false,
    includeBranding: input.includeBranding !== false,
    includeMusic: input.includeMusic !== false,
    includeAiPresenter: Boolean(input.includeAiPresenter),
    aiPresenterAvatar: input.aiPresenterAvatar || 'business',
    aiPresenterVoice: input.aiPresenterVoice || 'female',
    aiPresenterPosition: input.aiPresenterPosition || 'bottom-right',
    aiPresenterSize: input.aiPresenterSize || 'medium',
    aiPresenterScript: input.aiPresenterScript?.trim() || null,
    images,
    progress: 0,
    stage: 'In asteptare',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    requestedByUid: input.requestedByUid,
  };

  await jobRef.set(job);
  await propertyRef.set(
    {
      videoTour: {
        status: 'processing',
        format: job.format,
        style: job.style,
        quality: job.quality,
        targetDurationSeconds: job.targetDurationSeconds,
        hasMusic: job.includeMusic,
        hasAgencyBranding: job.includeBranding,
        hasAiPresenter: job.includeAiPresenter,
        aiPresenterAvatar: job.aiPresenterAvatar,
        aiPresenterVoice: job.aiPresenterVoice,
        aiPresenterPosition: job.aiPresenterPosition,
        aiPresenterSize: job.aiPresenterSize,
        aiPresenterScript: job.aiPresenterScript,
        engine: 'cloud-renderer',
        imageCount: images.length,
        generatedAt: now,
        generatedByUid: input.requestedByUid,
      },
    },
    { merge: true }
  );

  return job;
}

export async function getPropertyVideoTourJobs(adminDb: Firestore, agencyId: string, propertyId: string) {
  const snapshot = await getVideoTourJobsCollection(adminDb, agencyId, propertyId)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();
  return snapshot.docs.map((doc) => doc.data() as PropertyVideoTourJob);
}

export async function getPropertyVideoTourJob(adminDb: Firestore, agencyId: string, propertyId: string, jobId: string) {
  const jobRef = getVideoTourJobsCollection(adminDb, agencyId, propertyId).doc(jobId);
  const snapshot = await jobRef.get();
  if (!snapshot.exists) {
    const error = new Error('Jobul video nu exista.') as Error & { status?: number };
    error.status = 404;
    throw error;
  }
  const job = snapshot.data() as PropertyVideoTourJob;
  if (job.status === 'processing' && job.lockedAt) {
    const lockAgeMs = Date.now() - new Date(job.lockedAt).getTime();
    if (lockAgeMs > STALE_PROCESSING_JOB_MS) {
      const failedAt = nowIso();
      const staleJob: Partial<PropertyVideoTourJob> = {
        status: 'error',
        progress: 100,
        stage: null,
        lockedAt: null,
        updatedAt: failedAt,
        failedAt,
        errorMessage: `Randarea a ramas blocata la etapa "${job.stage || 'necunoscuta'}". Porneste o randare noua.`,
      };
      await Promise.all([
        jobRef.set(staleJob, { merge: true }),
        adminDb
          .collection('agencies')
          .doc(agencyId)
          .collection('properties')
          .doc(propertyId)
          .set(
            {
              videoTour: {
                status: 'error',
                errorMessage: staleJob.errorMessage,
                generatedAt: failedAt,
              },
            },
            { merge: true }
          ),
      ]);
      return { ...job, ...staleJob } as PropertyVideoTourJob;
    }
  }
  return job;
}

export async function runPropertyVideoTourJob(input: {
  adminDb: Firestore;
  agencyId: string;
  propertyId: string;
  jobId: string;
}) {
  const jobRef = getVideoTourJobsCollection(input.adminDb, input.agencyId, input.propertyId).doc(input.jobId);
  const propertyRef = input.adminDb
    .collection('agencies')
    .doc(input.agencyId)
    .collection('properties')
    .doc(input.propertyId);

  const acquired = await input.adminDb.runTransaction(async (transaction) => {
    const jobSnapshot = await transaction.get(jobRef);
    if (!jobSnapshot.exists) throw new Error('Jobul video nu exista.');
    const job = jobSnapshot.data() as PropertyVideoTourJob;
    if (job.status === 'completed') return { job, shouldRun: false };
    if (job.status === 'processing' && job.lockedAt) {
      const lockAgeMs = Date.now() - new Date(job.lockedAt).getTime();
      if (lockAgeMs < 10 * 60 * 1000) return { job, shouldRun: false };
    }
    const nextJob = {
      ...job,
      status: 'processing' as const,
      lockedAt: nowIso(),
      updatedAt: nowIso(),
      attempts: (job.attempts || 0) + 1,
      progress: Math.max(job.progress || 0, 8),
      stage: 'Pornesc randarea',
    };
    transaction.set(jobRef, nextJob, { merge: true });
    return { job: nextJob, shouldRun: true };
  });

  if (!acquired.shouldRun) return acquired.job;

  try {
    let lastProgress = Math.max(acquired.job.progress || 0, 18);
    let lastStage = acquired.job.stage || 'Pornesc randarea';
    const updateProgress = async (update: RenderProgressUpdate) => {
      const nextProgress = Math.min(96, Math.max(18, Math.round(update.progress)));
      const nextStage = update.stage;
      if (nextProgress <= lastProgress && nextStage === lastStage) return;
      lastProgress = nextProgress;
      lastStage = nextStage;
      await jobRef.set({
        progress: nextProgress,
        stage: nextStage,
        lockedAt: nowIso(),
        updatedAt: nowIso(),
      }, { merge: true });
    };

    await jobRef.set({ progress: lastProgress, stage: lastStage, lockedAt: nowIso(), updatedAt: nowIso() }, { merge: true });
    const propertySnapshot = await propertyRef.get();
    if (!propertySnapshot.exists) throw new Error('Proprietatea nu mai exista.');
    const property = { id: propertySnapshot.id, ...propertySnapshot.data() } as Property;

    const result = await renderJobWithFfmpeg({
      adminDb: input.adminDb,
      job: acquired.job,
      property,
      onProgress: updateProgress,
    });

    const completedAt = nowIso();
    const completedJob: Partial<PropertyVideoTourJob> = {
      status: 'completed',
      progress: 100,
      stage: null,
      videoUrl: result.videoUrl,
      thumbnailUrl: result.thumbnailUrl,
      durationSeconds: result.durationSeconds,
      mimeType: result.mimeType,
      completedAt,
      updatedAt: completedAt,
      lockedAt: null,
    };

    await Promise.all([
      jobRef.set(completedJob, { merge: true }),
      propertyRef.set(
        {
          videoTour: {
            status: 'ready',
            url: result.videoUrl,
            thumbnailUrl: result.thumbnailUrl,
            fileName: result.fileName,
            format: acquired.job.format,
            style: acquired.job.style,
            quality: acquired.job.quality,
            targetDurationSeconds: acquired.job.targetDurationSeconds,
            hasMusic: acquired.job.includeMusic,
            hasAgencyBranding: acquired.job.includeBranding,
            hasAiPresenter: acquired.job.includeAiPresenter,
            aiPresenterAvatar: acquired.job.aiPresenterAvatar,
            aiPresenterVoice: acquired.job.aiPresenterVoice,
            aiPresenterPosition: acquired.job.aiPresenterPosition,
            aiPresenterSize: acquired.job.aiPresenterSize,
            aiPresenterScript: result.presenterScript || acquired.job.aiPresenterScript || null,
            aiPresenterAudioUrl: result.presenterAudioUrl || null,
            aiPresenterVideoUrl: result.presenterVideoUrl || null,
            engine: 'cloud-renderer',
            mimeType: result.mimeType,
            durationSeconds: result.durationSeconds,
            imageCount: result.imageCount,
            generatedAt: completedAt,
            generatedByUid: acquired.job.requestedByUid,
          },
        },
        { merge: true }
      ),
    ]);

    return { ...acquired.job, ...completedJob } as PropertyVideoTourJob;
  } catch (error) {
    const message = getUnknownErrorMessage(error, 'Randarea cloud a esuat.');
    console.error('[property-video-tour-worker]', {
      agencyId: acquired.job.agencyId,
      propertyId: acquired.job.propertyId,
      jobId: acquired.job.id,
      message,
      error,
    });
    const failedAt = nowIso();
    await Promise.all([
      jobRef.set(
        {
          status: 'error',
          progress: 100,
          stage: null,
          errorMessage: message,
          failedAt,
          updatedAt: failedAt,
          lockedAt: null,
        },
        { merge: true }
      ),
      propertyRef.set(
        {
          videoTour: {
            status: 'error',
            format: acquired.job.format,
            style: acquired.job.style,
            quality: acquired.job.quality,
            targetDurationSeconds: acquired.job.targetDurationSeconds,
            hasMusic: acquired.job.includeMusic,
            hasAgencyBranding: acquired.job.includeBranding,
            hasAiPresenter: acquired.job.includeAiPresenter,
            aiPresenterAvatar: acquired.job.aiPresenterAvatar,
            aiPresenterVoice: acquired.job.aiPresenterVoice,
            aiPresenterPosition: acquired.job.aiPresenterPosition,
            aiPresenterSize: acquired.job.aiPresenterSize,
            aiPresenterScript: acquired.job.aiPresenterScript || null,
            engine: 'cloud-renderer',
            imageCount: acquired.job.images.length,
            generatedAt: failedAt,
            generatedByUid: acquired.job.requestedByUid,
            errorMessage: message,
          },
        },
        { merge: true }
      ),
    ]);
    throw new Error(message);
  }
}

export async function drainPropertyVideoTourJobs(input: DrainInput) {
  let query: Query = input.agencyId
    ? input.adminDb.collectionGroup(JOB_COLLECTION).where('agencyId', '==', input.agencyId)
    : input.adminDb.collectionGroup(JOB_COLLECTION);

  query = query.where('status', '==', 'queued').limit(Math.max(input.limit || 1, 5));
  const snapshot = await query.get();
  const jobs = snapshot.docs
    .map((doc) => doc.data() as PropertyVideoTourJob)
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
    .slice(0, input.limit || 1);
  const results = [];

  for (const job of jobs) {
    try {
      const rendered = await runPropertyVideoTourJob({
        adminDb: input.adminDb,
        agencyId: job.agencyId,
        propertyId: job.propertyId,
        jobId: job.id,
      });
      results.push({ jobId: job.id, status: rendered.status });
    } catch (error) {
      results.push({ jobId: job.id, status: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  }

  return { processed: results.length, results };
}
