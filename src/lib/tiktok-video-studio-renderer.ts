import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { adminStorage } from '@/firebase/admin';
import type { TikTokStudioAsset, TikTokStudioProject, TikTokStudioStoryboardScene } from '@/lib/types';

type StudioRenderInput = {
  agencyId: string;
  project: TikTokStudioProject;
  sourceAssets: TikTokStudioAsset[];
};

type WordTiming = {
  text: string;
  start: number;
  end: number;
};

type LocalPhotoAsset = {
  assetId: string;
  filePath: string;
};

type ElevenLabsTimestampResponse = {
  audio_base64?: string;
  alignment?: {
    characters?: string[];
    character_start_times_seconds?: number[];
    character_end_times_seconds?: number[];
  };
  normalized_alignment?: {
    characters?: string[];
    character_start_times_seconds?: number[];
    character_end_times_seconds?: number[];
  };
};

const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';
const SUBTITLE_SHADOW = '&H90000000';
const FRAME_RATE = 30;
const TRANSITION_SECONDS = 0.45;

function getFfmpegBinary() {
  if (!ffmpegPath) throw new Error('FFmpeg nu este disponibil in mediul curent.');
  return ffmpegPath;
}

function runFfmpeg(args: string[], cwd?: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(getFfmpegBinary(), args, { cwd, windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`FFmpeg a esuat (${code}). ${stderr.slice(-1400)}`));
    });
  });
}

function parseDuration(stderr: string) {
  const match = stderr.match(/Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function getMediaDuration(filePath: string) {
  return new Promise<number>((resolve, reject) => {
    const child = spawn(getFfmpegBinary(), ['-i', filePath, '-f', 'null', '-'], { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', () => {
      const duration = parseDuration(stderr);
      if (!duration) {
        reject(new Error('Nu am putut citi durata audio/video generata.'));
        return;
      }
      resolve(duration);
    });
  });
}

function getCanvasSize(aspectRatio: TikTokStudioProject['aspectRatio']) {
  if (aspectRatio === '1:1') return { width: 1080, height: 1080 };
  if (aspectRatio === '4:5') return { width: 1080, height: 1350 };
  if (aspectRatio === '16:9') return { width: 1920, height: 1080 };
  return { width: 1080, height: 1920 };
}

function escapeAssText(value: string) {
  return value
    .replace(/[{}]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function assTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const wholeSeconds = Math.floor(safe % 60);
  const centiseconds = Math.floor((safe - Math.floor(safe)) * 100);
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

function hexToAssColor(hex: string | null | undefined, fallback: string) {
  const normalized = String(hex || '').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;
  const rr = normalized.slice(0, 2);
  const gg = normalized.slice(2, 4);
  const bb = normalized.slice(4, 6);
  return `&H00${bb}${gg}${rr}`.toUpperCase();
}

function getSubtitlePreset(project: TikTokStudioProject) {
  const preset = project.subtitleStyle || project.brandKit?.defaultSubtitlePreset || 'heygen_pink';
  const accent = hexToAssColor(project.brandKit?.accentColor, '&H007F00FF');
  if (preset === 'tiktok_bold') return { active: accent, inactive: '&H00FFFFFF', outline: '&H0033163F', shadow: '&HA0000000', scale: 1.08 };
  if (preset === 'luxury_white' || preset === 'luxury') return { active: '&H00FFFFFF', inactive: '&H00F8F3EA', outline: '&H004B3C32', shadow: '&H95000000', scale: 0.92 };
  if (preset === 'minimal_premium' || preset === 'clean_white') return { active: accent, inactive: '&H00FFFFFF', outline: '&H00601848', shadow: '&H70000000', scale: 0.94 };
  if (preset === 'high_contrast') return { active: accent, inactive: '&H00FFFFFF', outline: '&H00000000', shadow: '&HAA000000', scale: 1.04 };
  return { active: accent, inactive: '&H00FFFFFF', outline: '&H00601848', shadow: SUBTITLE_SHADOW, scale: 1 };
}

function getDownloadUrl(bucketName: string, storagePath: string, token: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(storagePath)}?alt=media&token=${encodeURIComponent(token)}`;
}

async function fetchBytes(url: string) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Nu am putut descarca media Studio (${response.status}).`);
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, contentType };
}

async function downloadAssets(input: StudioRenderInput, workspace: string) {
  const photos = input.sourceAssets.filter((asset) => asset.type === 'image' && asset.url);
  if (photos.length < 2) {
    throw new Error('Randarea AI video are nevoie de cel putin doua fotografii.');
  }

  const files: LocalPhotoAsset[] = [];
  for (let index = 0; index < photos.length; index += 1) {
    const asset = photos[index];
    const media = await fetchBytes(asset.url);
    const ext = media.contentType.includes('png') ? 'png' : media.contentType.includes('webp') ? 'webp' : 'jpg';
    const filePath = path.join(workspace, `photo-${String(index + 1).padStart(2, '0')}.${ext}`);
    await writeFile(filePath, media.buffer);
    files.push({ assetId: asset.id, filePath });
  }
  return files;
}

function getElevenLabsApiKey() {
  const apiKey = (process.env.ELEVENLABS_API_KEY || '').trim();
  if (!apiKey) throw new Error('Configureaza ELEVENLABS_API_KEY in .env.local pentru randarea vocii.');
  return apiKey;
}

async function synthesizeVoiceover(input: { text: string; voiceId?: string | null; outputPath: string }) {
  const text = input.text.trim();
  if (!text) throw new Error('Scriptul voiceover este obligatoriu pentru randarea AI video.');

  const voiceId = input.voiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID || DEFAULT_VOICE_ID;
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`, {
    method: 'POST',
    headers: {
      'xi-api-key': getElevenLabsApiKey(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2',
      output_format: 'mp3_44100_128',
      voice_settings: {
        stability: Number(process.env.ELEVENLABS_VOICE_STABILITY || 0.38),
        similarity_boost: Number(process.env.ELEVENLABS_VOICE_SIMILARITY || 0.82),
        style: Number(process.env.ELEVENLABS_VOICE_STYLE || 0.42),
        use_speaker_boost: true,
      },
    }),
    cache: 'no-store',
  });

  const payload = await response.json().catch(() => null) as ElevenLabsTimestampResponse | { detail?: { message?: string } } | null;
  if (!response.ok || !payload || !('audio_base64' in payload) || !payload.audio_base64) {
    const message = payload && 'detail' in payload ? payload.detail?.message : null;
    throw new Error(message || `ElevenLabs nu a putut genera voiceover-ul (${response.status}).`);
  }

  await writeFile(input.outputPath, Buffer.from(payload.audio_base64, 'base64'));
  const alignment = payload.normalized_alignment || payload.alignment;
  return getWordTimingsFromAlignment(alignment, text);
}

function getWordTimingsFromAlignment(alignment: ElevenLabsTimestampResponse['alignment'], fallbackText: string): WordTiming[] {
  const characters = alignment?.characters || [];
  const starts = alignment?.character_start_times_seconds || [];
  const ends = alignment?.character_end_times_seconds || [];
  const words: WordTiming[] = [];
  let current = '';
  let start: number | null = null;
  let end = 0;

  characters.forEach((character, index) => {
    const charStart = Number(starts[index]);
    const charEnd = Number(ends[index]);
    if (/\s/.test(character)) {
      if (current.trim() && start !== null) words.push({ text: current.trim(), start, end: Math.max(end, start + 0.08) });
      current = '';
      start = null;
      return;
    }
    if (start === null && Number.isFinite(charStart)) start = charStart;
    if (Number.isFinite(charEnd)) end = charEnd;
    current += character;
  });
  if (current.trim() && start !== null) words.push({ text: current.trim(), start, end: Math.max(end, start + 0.08) });

  if (words.length) return words;
  const fallbackWords = fallbackText.split(/\s+/).filter(Boolean);
  return fallbackWords.map((word, index) => ({
    text: word,
    start: index * 0.42,
    end: (index + 1) * 0.42,
  }));
}

async function renderPhotoSegment(input: {
  photoPath: string;
  outputPath: string;
  width: number;
  height: number;
  duration: number;
  index: number;
  motion?: TikTokStudioStoryboardScene['motion'];
}) {
  const frames = Math.max(1, Math.round(input.duration * FRAME_RATE));
  const motion = input.motion || (input.index % 2 === 0 ? 'slow_push' : 'pull_back');
  const zoomDirection = motion === 'pull_back'
    ? "max(1.13-on/900,1.0)"
    : motion === 'detail_zoom'
      ? "min(zoom+0.0022,1.18)"
      : "min(zoom+0.0012,1.13)";
  const xExpression = motion === 'pan_left'
    ? '(iw-iw/zoom)*(1-on/900)'
    : motion === 'pan_right'
      ? '(iw-iw/zoom)*(on/900)'
      : 'iw/2-(iw/zoom/2)';
  const yExpression = motion === 'detail_zoom' ? '(ih-ih/zoom)*0.45' : 'ih/2-(ih/zoom/2)';
  const filter = [
    `scale=${input.width}:${input.height}:force_original_aspect_ratio=increase`,
    `crop=${input.width}:${input.height}`,
    `zoompan=z='${zoomDirection}':x='${xExpression}':y='${yExpression}':d=${frames}:s=${input.width}x${input.height}:fps=${FRAME_RATE}`,
    'format=yuv420p',
  ].join(',');

  await runFfmpeg([
    '-y',
    '-loop', '1',
    '-i', input.photoPath,
    '-vf', filter,
    '-t', input.duration.toFixed(3),
    '-r', String(FRAME_RATE),
    '-an',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    input.outputPath,
  ]);
}

function getStoryboardScenes(project: TikTokStudioProject, photoAssets: LocalPhotoAsset[]) {
  const scenes = project.timeline?.length ? project.timeline : project.storyboard?.length ? project.storyboard : null;
  const orderedAssets = scenes?.length
    ? scenes
      .map((scene) => photoAssets.find((asset) => asset.assetId === scene.assetId))
      .filter((asset): asset is LocalPhotoAsset => Boolean(asset))
    : photoAssets;
  return orderedAssets.map((asset, index) => {
    const scene = scenes?.find((item) => item.assetId === asset.assetId) || scenes?.[index] || null;
    return {
      ...asset,
      durationSeconds: Math.max(1.8, Number(scene?.durationSeconds) || 3),
      motion: scene?.motion || (index % 2 === 0 ? 'slow_push' : 'pull_back'),
    };
  });
}

function fitSceneDurationsToAudio(scenes: Array<LocalPhotoAsset & { durationSeconds: number; motion: TikTokStudioStoryboardScene['motion'] }>, audioDuration: number) {
  const storyboardDuration = scenes.reduce((total, scene) => total + scene.durationSeconds, 0);
  const targetDuration = Math.max(audioDuration + 0.25, storyboardDuration, scenes.length * 2.6);
  const transitionBudget = Math.max(0, scenes.length - 1) * TRANSITION_SECONDS;
  const scale = (targetDuration + transitionBudget) / Math.max(storyboardDuration, 1);
  return {
    totalDuration: targetDuration,
    scenes: scenes.map((scene) => ({
      ...scene,
      durationSeconds: Math.max(1.8, scene.durationSeconds * scale),
    })),
  };
}

async function concatSegments(segmentPaths: string[], outputPath: string, workspace: string) {
  const listPath = path.join(workspace, 'segments.txt');
  const lines = segmentPaths.map((segmentPath) => `file '${segmentPath.replace(/\\/g, '/')}'`).join('\n');
  await writeFile(listPath, lines);
  await runFfmpeg([
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listPath,
    '-c', 'copy',
    outputPath,
  ]);
}

async function xfadeSegments(input: {
  segmentPaths: string[];
  segmentDurations: number[];
  outputPath: string;
  workspace: string;
}) {
  if (input.segmentPaths.length <= 1) {
    await concatSegments(input.segmentPaths, input.outputPath, input.workspace);
    return;
  }

  const args = ['-y'];
  input.segmentPaths.forEach((segmentPath) => {
    args.push('-i', segmentPath);
  });

  const filters: string[] = [];
  let cumulative = input.segmentDurations[0];
  let previous = '[0:v]';
  for (let index = 1; index < input.segmentPaths.length; index += 1) {
    const output = index === input.segmentPaths.length - 1 ? '[v]' : `[v${index}]`;
    const offset = Math.max(0.1, cumulative - TRANSITION_SECONDS * index);
    filters.push(`${previous}[${index}:v]xfade=transition=fade:duration=${TRANSITION_SECONDS}:offset=${offset.toFixed(3)}${output}`);
    cumulative += input.segmentDurations[index];
    previous = output;
  }

  await runFfmpeg([
    ...args,
    '-filter_complex',
    filters.join(';'),
    '-map',
    '[v]',
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    input.outputPath,
  ]);
}

function groupSubtitlePhrases(words: WordTiming[]) {
  const phrases: WordTiming[][] = [];
  let current: WordTiming[] = [];
  let charCount = 0;

  words.forEach((word) => {
    const nextCount = charCount + word.text.length + (current.length ? 1 : 0);
    const gap = current.length ? word.start - current[current.length - 1].end : 0;
    if (current.length >= 6 || nextCount > 34 || gap > 0.75) {
      phrases.push(current);
      current = [];
      charCount = 0;
    }
    current.push(word);
    charCount += word.text.length + (current.length > 1 ? 1 : 0);
  });
  if (current.length) phrases.push(current);
  return phrases;
}

function splitPhraseLines(phrase: WordTiming[]) {
  if (phrase.length <= 3) return [phrase];
  const midpoint = Math.ceil(phrase.length / 2);
  return [phrase.slice(0, midpoint), phrase.slice(midpoint)];
}

function renderSubtitleText(phrase: WordTiming[], activeIndex: number, colors: { active: string; inactive: string }) {
  const lines = splitPhraseLines(phrase);
  let globalIndex = 0;
  return lines.map((line) => line.map((word) => {
    const isActive = globalIndex === activeIndex;
    globalIndex += 1;
    const color = isActive ? colors.active : colors.inactive;
    return `{\\c${color}}${escapeAssText(word.text)}`;
  }).join(' ')).join('\\N');
}

async function writeKaraokeAss(input: {
  outputPath: string;
  words: WordTiming[];
  width: number;
  height: number;
  totalDuration: number;
  project: TikTokStudioProject;
}) {
  const preset = getSubtitlePreset(input.project);
  const fontSize = Math.round(input.height * 0.052 * preset.scale);
  const outline = Math.max(4, Math.round(input.height * 0.0045));
  const y = Math.round(input.height * 0.72);
  const phrases = groupSubtitlePhrases(input.words);
  const events: string[] = [];

  phrases.forEach((phrase) => {
    phrase.forEach((word, index) => {
      const start = Math.max(0, word.start - 0.03);
      const nextWord = phrase[index + 1];
      const end = Math.min(input.totalDuration, Math.max(word.end, nextWord ? nextWord.start - 0.02 : phrase[phrase.length - 1].end + 0.16));
      events.push([
        'Dialogue: 0',
        assTime(start),
        assTime(end),
        'Caption',
        '',
        '0',
        '0',
        '0',
        '',
        `{\\an2\\pos(${Math.round(input.width / 2)},${y})}${renderSubtitleText(phrase, index, preset)}`,
      ].join(','));
    });
  });

  const ass = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${input.width}`,
    `PlayResY: ${input.height}`,
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Caption,Avenue,${fontSize},${preset.inactive},${preset.active},${preset.outline},${preset.shadow},1,0,0,0,100,100,0,0,1,${outline},2,2,70,70,120,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...events,
    '',
  ].join('\n');
  await writeFile(input.outputPath, ass, 'utf8');
}

async function writeBrandAss(input: {
  outputPath: string;
  project: TikTokStudioProject;
  width: number;
  height: number;
  totalDuration: number;
}) {
  const brand = input.project.brandKit;
  const watermark = brand?.watermarkText || brand?.name || 'ImoDeus';
  const phone = brand?.phone ? `  ${brand.phone}` : '';
  const agent = brand?.agentName ? `${brand.agentName}` : '';
  const text = escapeAssText([watermark, agent, phone].filter(Boolean).join(' | '));
  const accent = hexToAssColor(brand?.accentColor, '&H007F00FF');
  const fontSize = Math.round(input.height * 0.024);
  const x = Math.round(input.width * 0.5);
  const y = Math.round(input.height * 0.94);
  const ass = [
    '[Script Info]',
    'ScriptType: v4.00+',
    `PlayResX: ${input.width}`,
    `PlayResY: ${input.height}`,
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Brand,Avenue,${fontSize},&H00FFFFFF,${accent},&H70000000,&H90000000,1,0,0,0,100,100,0,0,1,3,1,2,40,40,40,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    `Dialogue: 0,${assTime(0)},${assTime(input.totalDuration)},Brand,,0,0,0,,{\\an2\\pos(${x},${y})\\c&H00FFFFFF&}${text}`,
    '',
  ].join('\n');
  await writeFile(input.outputPath, ass, 'utf8');
}

async function burnSubtitles(input: { videoPath: string; assPath: string; outputPath: string }) {
  const cwd = path.dirname(input.assPath);
  await runFfmpeg([
    '-y',
    '-i', input.videoPath,
    '-vf', 'ass=captions.ass',
    '-an',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '19',
    '-pix_fmt', 'yuv420p',
    input.outputPath,
  ], cwd);
}

async function applyAssOverlay(input: { videoPath: string; assPath: string; assFileName: string; outputPath: string }) {
  const cwd = path.dirname(input.assPath);
  await runFfmpeg([
    '-y',
    '-i', input.videoPath,
    '-vf', `ass=${input.assFileName}`,
    '-an',
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '19',
    '-pix_fmt', 'yuv420p',
    input.outputPath,
  ], cwd);
}

async function muxAudio(input: { videoPath: string; audioPath: string; outputPath: string; duration: number }) {
  await runFfmpeg([
    '-y',
    '-i', input.videoPath,
    '-i', input.audioPath,
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-t', input.duration.toFixed(3),
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '160k',
    '-movflags', '+faststart',
    input.outputPath,
  ]);
}

async function createThumbnail(input: { videoPath: string; outputPath: string }) {
  await runFfmpeg([
    '-y',
    '-ss', '00:00:01.000',
    '-i', input.videoPath,
    '-frames:v', '1',
    '-q:v', '2',
    input.outputPath,
  ]);
}

async function uploadFile(input: {
  localPath: string;
  storagePath: string;
  contentType: string;
}) {
  const bucket = adminStorage.bucket();
  const token = randomUUID();
  const buffer = await readFile(input.localPath);
  const file = bucket.file(input.storagePath);
  await file.save(buffer, {
    contentType: input.contentType,
    resumable: false,
    metadata: {
      cacheControl: 'public, max-age=31536000',
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });
  return {
    url: getDownloadUrl(bucket.name, input.storagePath, token),
    sizeBytes: buffer.byteLength,
  };
}

export async function renderTikTokStudioPhotoVideo(input: StudioRenderInput) {
  const workspace = await mkdtemp(path.join(tmpdir(), 'imodeus-tiktok-studio-'));
  try {
    await mkdir(workspace, { recursive: true });
    const { width, height } = getCanvasSize(input.project.aspectRatio);
    const photoAssets = await downloadAssets(input, workspace);
    const audioPath = path.join(workspace, 'voiceover.mp3');
    const words = await synthesizeVoiceover({
      text: input.project.script || '',
      voiceId: input.project.voiceId,
      outputPath: audioPath,
    });
    const audioDuration = await getMediaDuration(audioPath);
    const fittedScenes = fitSceneDurationsToAudio(getStoryboardScenes(input.project, photoAssets), audioDuration);
    const totalDuration = fittedScenes.totalDuration;
    const segmentPaths: string[] = [];
    const segmentDurations: number[] = [];

    for (let index = 0; index < fittedScenes.scenes.length; index += 1) {
      const scene = fittedScenes.scenes[index];
      const segmentPath = path.join(workspace, `segment-${String(index + 1).padStart(2, '0')}.mp4`);
      await renderPhotoSegment({
        photoPath: scene.filePath,
        outputPath: segmentPath,
        width,
        height,
        duration: scene.durationSeconds,
        index,
        motion: scene.motion,
      });
      segmentPaths.push(segmentPath);
      segmentDurations.push(scene.durationSeconds);
    }

    const silentVideoPath = path.join(workspace, 'silent.mp4');
    const subtitledVideoPath = path.join(workspace, 'subtitled.mp4');
    const brandedVideoPath = path.join(workspace, 'branded.mp4');
    const finalVideoPath = path.join(workspace, 'final.mp4');
    const thumbnailPath = path.join(workspace, 'thumbnail.jpg');
    const assPath = path.join(workspace, 'captions.ass');
    const brandAssPath = path.join(workspace, 'brand.ass');

    await xfadeSegments({ segmentPaths, segmentDurations, outputPath: silentVideoPath, workspace });
    const shouldRenderSubtitles = !(input.project.repurposeVariants || []).includes('no_subtitles');
    if (shouldRenderSubtitles) {
      await writeKaraokeAss({ outputPath: assPath, words, width, height, totalDuration, project: input.project });
      await burnSubtitles({ videoPath: silentVideoPath, assPath, outputPath: subtitledVideoPath });
    }
    await writeBrandAss({ outputPath: brandAssPath, project: input.project, width, height, totalDuration });
    await applyAssOverlay({
      videoPath: shouldRenderSubtitles ? subtitledVideoPath : silentVideoPath,
      assPath: brandAssPath,
      assFileName: 'brand.ass',
      outputPath: brandedVideoPath,
    });
    await muxAudio({ videoPath: brandedVideoPath, audioPath, outputPath: finalVideoPath, duration: totalDuration });
    await createThumbnail({ videoPath: finalVideoPath, outputPath: thumbnailPath });

    const basePath = `agencies/${input.agencyId}/tiktok-studio/projects/${input.project.id}`;
    const videoUpload = await uploadFile({
      localPath: finalVideoPath,
      storagePath: `${basePath}/render.mp4`,
      contentType: 'video/mp4',
    });
    const thumbnailUpload = await uploadFile({
      localPath: thumbnailPath,
      storagePath: `${basePath}/thumbnail.jpg`,
      contentType: 'image/jpeg',
    });

    return {
      videoUrl: videoUpload.url,
      thumbnailUrl: thumbnailUpload.url,
      sizeBytes: videoUpload.sizeBytes,
      durationSeconds: Number(totalDuration.toFixed(2)),
    };
  } finally {
    await rm(workspace, { recursive: true, force: true }).catch(() => undefined);
  }
}
