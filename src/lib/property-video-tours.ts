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
};

type DrainInput = {
  adminDb: Firestore;
  agencyId?: string | null;
  limit?: number;
};

const JOB_COLLECTION = 'propertyVideoTourJobs';
const MAX_IMAGES = 18;

function nowIso() {
  return new Date().toISOString();
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
  if (format === 'portrait') return premium ? { width: 1080, height: 1920 } : { width: 720, height: 1280 };
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
    .replace(/'/g, "\\'")
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .slice(0, 120);
}

function formatPrice(price?: number | null) {
  if (!price) return '';
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(price);
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
    const response = await fetch(url);
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

async function runCommand(command: string, args: string[], cwd: string) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `${command} a esuat cu exit code ${code}.`));
    });
  });
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
  job: PropertyVideoTourJob;
  property: Property;
  agencyName?: string | null;
}) {
  const { width, height, fps, framesPerImage, job, property, agencyName } = input;
  const filters = [
    `scale=${width * 2}:${height * 2}:force_original_aspect_ratio=increase`,
    `crop=${width * 2}:${height * 2}`,
    `zoompan=z='min(zoom+0.0016,1.12)':d=${framesPerImage}:s=${width}x${height}:fps=${fps}`,
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
}) {
  const { job, property } = input;
  const bucket = adminStorage.bucket();
  const workDir = await mkdtemp(path.join(tmpdir(), 'imodeus-video-tour-'));

  try {
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
    const durationSeconds = Math.round(job.targetDurationSeconds || defaultDuration);
    const framesPerImage = Math.max(45, Math.round((durationSeconds / downloadedImages.length) * fps));
    const { width, height } = getFormatConfig(job.format, job.quality);
    const listPath = path.join(workDir, 'segments.txt');
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
          buildZoompanFilter({ width, height, fps, framesPerImage, job, property, agencyName }),
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
    }

    await writeFile(
      listPath,
      segmentPaths.map((segmentPath) => `file '${segmentPath.replace(/\\/g, '/')}'`).join('\n')
    );

    const silentVideoPath = path.join(workDir, 'video-no-audio.mp4');
    await runCommand(
      getFfmpegCommand(),
      ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', silentVideoPath],
      workDir
    );

    const finalVideoPath = path.join(workDir, 'video-tour.mp4');
    if (job.includeMusic) {
      const audioPath = await createSilentAudio(workDir, durationSeconds);
      await runCommand(
        getFfmpegCommand(),
        [
          '-y',
          '-i',
          silentVideoPath,
          '-i',
          audioPath,
          '-shortest',
          '-c:v',
          'copy',
          '-c:a',
          'aac',
          '-movflags',
          '+faststart',
          finalVideoPath,
        ],
        workDir
      );
    } else {
      await runCommand(getFfmpegCommand(), ['-y', '-i', silentVideoPath, '-c', 'copy', '-movflags', '+faststart', finalVideoPath], workDir);
    }

    const thumbnailPath = path.join(workDir, 'thumbnail.jpg');
    await runCommand(
      getFfmpegCommand(),
      ['-y', '-ss', '00:00:01', '-i', finalVideoPath, '-frames:v', '1', '-q:v', '3', thumbnailPath],
      workDir
    );

    const safeTitle = sanitizeFileName(property.title || job.propertyTitle || 'video-tur');
    const baseStoragePath = `agencies/${job.agencyId}/properties/${job.propertyId}/video-tours/cloud-${job.id}`;
    const videoStoragePath = `${baseStoragePath}/${safeTitle}.mp4`;
    const thumbnailStoragePath = `${baseStoragePath}/${safeTitle}-thumb.jpg`;
    const videoToken = randomUUID();
    const thumbnailToken = randomUUID();

    await Promise.all([
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
    ]);

    const videoUrl = getFirebaseDownloadUrl(bucket.name, videoStoragePath, videoToken);
    const thumbnailUrl = getFirebaseDownloadUrl(bucket.name, thumbnailStoragePath, thumbnailToken);

    return {
      videoUrl,
      thumbnailUrl,
      durationSeconds,
      mimeType: 'video/mp4',
      fileName: `${safeTitle}.mp4`,
      imageCount: downloadedImages.length,
      skippedImageCount: skippedImages.length,
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
    images,
    progress: 0,
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
    };
    transaction.set(jobRef, nextJob, { merge: true });
    return { job: nextJob, shouldRun: true };
  });

  if (!acquired.shouldRun) return acquired.job;

  try {
    await jobRef.set({ progress: 18, updatedAt: nowIso() }, { merge: true });
    const propertySnapshot = await propertyRef.get();
    if (!propertySnapshot.exists) throw new Error('Proprietatea nu mai exista.');
    const property = { id: propertySnapshot.id, ...propertySnapshot.data() } as Property;

    const result = await renderJobWithFfmpeg({
      adminDb: input.adminDb,
      job: acquired.job,
      property,
    });

    const completedAt = nowIso();
    const completedJob: Partial<PropertyVideoTourJob> = {
      status: 'completed',
      progress: 100,
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
