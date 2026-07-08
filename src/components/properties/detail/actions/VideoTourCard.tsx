'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { doc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  CheckCircle2,
  Download,
  Film,
  Loader2,
  Music2,
  PlayCircle,
  Sparkles,
  UserRound,
  Wand2,
} from 'lucide-react';
import type { Property, PropertyVideoTour } from '@/lib/types';
import { useAgency } from '@/context/AgencyContext';
import { updateDocumentNonBlocking, useFirestore, useStorage, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  ACTION_CARD_INTERACTIVE_CLASSNAME,
  ACTION_ICON_CLASSNAME,
  ACTION_PILL_CLASSNAME,
} from './cardStyles';

type VideoFormat = PropertyVideoTour['format'];
type VideoStyle = PropertyVideoTour['style'];
type VideoQuality = NonNullable<PropertyVideoTour['quality']>;
type AiPresenterAvatar = NonNullable<PropertyVideoTour['aiPresenterAvatar']>;
type AiPresenterVoice = NonNullable<PropertyVideoTour['aiPresenterVoice']>;
type AiPresenterPosition = NonNullable<PropertyVideoTour['aiPresenterPosition']>;
type AiPresenterSize = NonNullable<PropertyVideoTour['aiPresenterSize']>;

type RenderPreset = {
  width: number;
  height: number;
  label: string;
};

const STANDARD_FORMAT_PRESETS: Record<VideoFormat, RenderPreset> = {
  landscape: { width: 1280, height: 720, label: 'Website / YouTube' },
  portrait: { width: 720, height: 1280, label: 'Reels / TikTok' },
  square: { width: 1080, height: 1080, label: 'Feed patrat' },
};

const PREMIUM_FORMAT_PRESETS: Record<VideoFormat, RenderPreset> = {
  landscape: { width: 1920, height: 1080, label: 'Website / YouTube' },
  portrait: { width: 1080, height: 1920, label: 'Reels / TikTok' },
  square: { width: 1080, height: 1080, label: 'Feed patrat' },
};

const STYLE_LABELS: Record<VideoStyle, string> = {
  cinematic: 'Cinematic calm',
  luxury: 'Luxury slow',
  social: 'Social dinamic',
};

const TARGET_DURATION_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: '15', label: '15 sec' },
  { value: '30', label: '30 sec' },
  { value: '45', label: '45 sec' },
  { value: '60', label: '60 sec' },
];

const AI_PRESENTER_AVATAR_LABELS: Record<AiPresenterAvatar, string> = {
  business: 'Business',
  luxury: 'Luxury',
  casual: 'Casual',
};

const AI_PRESENTER_VOICE_LABELS: Record<AiPresenterVoice, string> = {
  female: 'Feminin',
  male: 'Masculin',
};

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

async function readApiPayload(response: Response) {
  const text = await response.text().catch(() => '');
  if (!text) return {};

  try {
    return JSON.parse(text) as Record<string, any>;
  } catch {
    const trimmed = text.trim();
    if (trimmed.startsWith('<!DOCTYPE html') || trimmed.startsWith('<html')) {
      return { message: 'Serverul a returnat HTML in loc de raspuns JSON. Reporneste serverul dev si incearca din nou.' };
    }
    return { message: text.slice(0, 500) };
  }
}

function getApiErrorMessage(payload: Record<string, any>, fallback: string) {
  const message = (
    payload?.message ||
    payload?.job?.errorMessage ||
    payload?.errorMessage ||
    payload?.error?.message ||
    fallback
  );
  return String(message).replace(/\s+/g, ' ').slice(0, 420);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickRecorderMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  return MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) || '';
}

function getFileExtension(mimeType: string) {
  return mimeType.includes('mp4') ? 'mp4' : 'webm';
}

function getPreset(format: VideoFormat, quality: VideoQuality) {
  return quality === 'premium' ? PREMIUM_FORMAT_PRESETS[format] : STANDARD_FORMAT_PRESETS[format];
}

function formatPrice(price: number) {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(price || 0);
}

function sanitizeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'video-tur-proprietate';
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function coverRect(imageWidth: number, imageHeight: number, targetWidth: number, targetHeight: number, scale = 1) {
  const ratio = Math.max(targetWidth / imageWidth, targetHeight / imageHeight) * scale;
  const width = imageWidth * ratio;
  const height = imageHeight * ratio;
  return { width, height };
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  let resolvedUrl = url;
  try {
    const response = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    if (response.ok) {
      const blob = await response.blob();
      resolvedUrl = URL.createObjectURL(blob);
    }
  } catch {
    resolvedUrl = url;
  }

  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Nu am putut incarca una dintre fotografii pentru randare video.'));
    image.src = resolvedUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.86): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Nu am putut genera thumbnail-ul video.'));
    }, type, quality);
  });
}

function createMusicBed(durationSeconds: number) {
  const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;

  const audioContext = new AudioContextClass();
  const destination = audioContext.createMediaStreamDestination();
  const masterGain = audioContext.createGain();
  masterGain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  masterGain.gain.exponentialRampToValueAtTime(0.045, audioContext.currentTime + 1.2);
  masterGain.gain.setValueAtTime(0.045, audioContext.currentTime + Math.max(1.4, durationSeconds - 1.4));
  masterGain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + durationSeconds);
  masterGain.connect(destination);

  const notes = [146.83, 220, 293.66, 369.99];
  const oscillators = notes.map((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = index % 2 === 0 ? 'sine' : 'triangle';
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    oscillator.frequency.linearRampToValueAtTime(frequency * 1.01, audioContext.currentTime + durationSeconds);
    gain.gain.setValueAtTime(index === 0 ? 0.28 : 0.14, audioContext.currentTime);
    oscillator.connect(gain);
    gain.connect(masterGain);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + durationSeconds + 0.1);
    return oscillator;
  });

  return {
    stream: destination.stream,
    resume: () => audioContext.resume().catch(() => undefined),
    close: () => {
      oscillators.forEach((oscillator) => {
        try {
          oscillator.disconnect();
        } catch {}
      });
      void audioContext.close().catch(() => undefined);
    },
  };
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !current) {
      current = next;
    } else {
      lines.push(current);
      current = word;
      if (lines.length === maxLines - 1) break;
    }
  }

  if (current && lines.length < maxLines) lines.push(current);
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
}

function drawKenBurnsFrame({
  ctx,
  image,
  frameWidth,
  frameHeight,
  progress,
  imageIndex,
  property,
  agencyName,
  agencyLogo,
  includeText,
  includeBranding,
  style,
}: {
  ctx: CanvasRenderingContext2D;
  image: HTMLImageElement;
  frameWidth: number;
  frameHeight: number;
  progress: number;
  imageIndex: number;
  property: Property;
  agencyName?: string | null;
  agencyLogo?: HTMLImageElement | null;
  includeText: boolean;
  includeBranding: boolean;
  style: VideoStyle;
}) {
  const eased = easeInOut(progress);
  const direction = imageIndex % 4;
  const baseScale = style === 'social' ? 1.12 : style === 'luxury' ? 1.07 : 1.09;
  const scaleTravel = style === 'social' ? 0.16 : 0.1;
  const scale = baseScale + scaleTravel * eased;
  const rect = coverRect(image.naturalWidth, image.naturalHeight, frameWidth, frameHeight, scale);
  const panX = frameWidth * (style === 'social' ? 0.09 : 0.055);
  const panY = frameHeight * (style === 'social' ? 0.075 : 0.045);
  const fromX = direction === 0 || direction === 3 ? -panX : panX;
  const toX = -fromX;
  const fromY = direction === 1 || direction === 2 ? -panY : panY;
  const toY = -fromY;
  const x = (frameWidth - rect.width) / 2 + fromX + (toX - fromX) * eased;
  const y = (frameHeight - rect.height) / 2 + fromY + (toY - fromY) * eased;

  ctx.clearRect(0, 0, frameWidth, frameHeight);
  ctx.fillStyle = '#07111f';
  ctx.fillRect(0, 0, frameWidth, frameHeight);

  const bgRect = coverRect(image.naturalWidth, image.naturalHeight, frameWidth, frameHeight, 1.04);
  ctx.save();
  ctx.filter = 'blur(22px) saturate(0.9) brightness(0.62)';
  ctx.drawImage(image, (frameWidth - bgRect.width) / 2, (frameHeight - bgRect.height) / 2, bgRect.width, bgRect.height);
  ctx.restore();

  ctx.save();
  ctx.translate(frameWidth / 2, frameHeight / 2);
  ctx.rotate((imageIndex % 2 === 0 ? 1 : -1) * 0.006 * Math.sin(eased * Math.PI));
  ctx.drawImage(image, x - frameWidth / 2, y - frameHeight / 2, rect.width, rect.height);
  ctx.restore();

  const gradient = ctx.createLinearGradient(0, frameHeight * 0.45, 0, frameHeight);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(0.68, 'rgba(3,9,18,0.45)');
  gradient.addColorStop(1, 'rgba(3,9,18,0.82)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, frameWidth, frameHeight);

  const vignette = ctx.createRadialGradient(
    frameWidth / 2,
    frameHeight / 2,
    frameWidth * 0.18,
    frameWidth / 2,
    frameHeight / 2,
    frameWidth * 0.75,
  );
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.34)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, frameWidth, frameHeight);

  const edgeFade = Math.min(progress / 0.08, (1 - progress) / 0.08, 1);
  if (edgeFade < 1) {
    ctx.fillStyle = `rgba(3,9,18,${1 - edgeFade})`;
    ctx.fillRect(0, 0, frameWidth, frameHeight);
  }

  if (!includeText) return;

  const safe = Math.max(28, Math.round(frameWidth * 0.045));
  const titleSize = Math.max(30, Math.round(frameWidth * 0.045));
  const metaSize = Math.max(18, Math.round(frameWidth * 0.021));
  const bottom = frameHeight - safe;
  const maxTextWidth = frameWidth - safe * 2;

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = `700 ${titleSize}px Inter, Arial, sans-serif`;
  drawWrappedText(ctx, property.title, safe, bottom - titleSize * 1.8, maxTextWidth, titleSize * 1.12, 2);

  ctx.font = `600 ${metaSize}px Inter, Arial, sans-serif`;
  ctx.fillStyle = 'rgba(214,255,235,0.95)';
  const surface = property.totalSurface ?? property.squareFootage;
  const meta = [formatPrice(property.price), property.location, `${property.rooms} camere`, `${surface} mp`]
    .filter(Boolean)
    .join('  |  ');
  ctx.fillText(meta, safe, bottom);

  if (includeBranding) {
    const brandName = agencyName || 'ImoDeus.ai';
    const brandFontSize = Math.max(16, Math.round(frameWidth * 0.018));
    ctx.textAlign = 'right';
    ctx.font = `700 ${brandFontSize}px Inter, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    if (agencyLogo) {
      const logoSize = Math.max(28, Math.round(frameWidth * 0.035));
      const logoX = frameWidth - safe - logoSize;
      const logoY = safe;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(logoX, logoY, logoSize, logoSize, logoSize * 0.22);
      ctx.clip();
      ctx.drawImage(agencyLogo, logoX, logoY, logoSize, logoSize);
      ctx.restore();
      ctx.fillText(brandName, logoX - 10, logoY + logoSize * 0.68);
    } else {
      ctx.fillText(brandName, frameWidth - safe, safe + metaSize);
    }
    ctx.textAlign = 'left';
  }
}

export function VideoTourCard({
  property,
  isMobile = false,
  triggerVariant = 'card',
}: {
  property: Property;
  isMobile?: boolean;
  triggerVariant?: 'card' | 'gallery-button';
}) {
  const { agencyId, agency } = useAgency();
  const { user } = useUser();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [format, setFormat] = useState<VideoFormat>('portrait');
  const [style, setStyle] = useState<VideoStyle>('cinematic');
  const [quality, setQuality] = useState<VideoQuality>('standard');
  const [targetDuration, setTargetDuration] = useState('auto');
  const [includeText, setIncludeText] = useState(true);
  const [includeBranding, setIncludeBranding] = useState(true);
  const [includeMusic, setIncludeMusic] = useState(true);
  const [includeAiPresenter, setIncludeAiPresenter] = useState(false);
  const [aiPresenterAvatar, setAiPresenterAvatar] = useState<AiPresenterAvatar>('business');
  const [aiPresenterVoice, setAiPresenterVoice] = useState<AiPresenterVoice>('female');
  const [aiPresenterPosition, setAiPresenterPosition] = useState<AiPresenterPosition>('bottom-right');
  const [aiPresenterSize, setAiPresenterSize] = useState<AiPresenterSize>('medium');
  const [aiPresenterScript, setAiPresenterScript] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCloudRendering, setIsCloudRendering] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);

  const images = useMemo(
    () => (property.images || []).map((image) => image.url).filter(Boolean).slice(0, 18),
    [property.images],
  );
  const existingVideoUrl = property.videoTour?.url || null;
  const previewUrl = localPreviewUrl || existingVideoUrl;
  const canGenerate = images.length >= 2 && Boolean(user && agencyId);
  const selectedPreset = getPreset(format, quality);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  const persistVideoTour = (payload: PropertyVideoTour) => {
    if (!agencyId || !property.id) return;
    const propertyRef = doc(firestore, 'agencies', agencyId, 'properties', property.id);
    updateDocumentNonBlocking(propertyRef, { videoTour: payload });
  };

  const authorizedFetch = async (input: RequestInfo, init?: RequestInit) => {
    if (!user) throw new Error('Autentifica-te pentru a genera video.');
    const token = await user.getIdToken(true);
    return fetch(input, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers || {}),
      },
    });
  };

  const handleDownload = () => {
    const url = previewUrl;
    if (!url) return;
    const extension = getFileExtension(property.videoTour?.mimeType || '');
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sanitizeFileName(property.title)}-video-tur.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleGenerate = async () => {
    if (!canGenerate || isGenerating) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const mimeType = pickRecorderMimeType();

    if (!canvas || !ctx || !mimeType) {
      toast({
        variant: 'destructive',
        title: 'Generator indisponibil',
        description: 'Browserul curent nu poate inregistra video din canvas.',
      });
      return;
    }

    setIsGenerating(true);
    setProgress(2);
    let musicBed: ReturnType<typeof createMusicBed> = null;
    persistVideoTour({
      status: 'processing',
      format,
      style,
      quality,
      targetDurationSeconds: targetDuration === 'auto' ? null : Number(targetDuration),
      hasMusic: includeMusic,
      hasAgencyBranding: includeBranding,
      engine: 'browser-canvas',
      generatedAt: new Date().toISOString(),
      generatedByUid: user?.uid || null,
      imageCount: images.length,
    });

    try {
      const preset = selectedPreset;
      canvas.width = preset.width;
      canvas.height = preset.height;
      const frameRate = 30;
      const targetSeconds = targetDuration === 'auto' ? null : Number(targetDuration);
      const defaultSecondsPerImage = style === 'social' ? 2.6 : style === 'luxury' ? 3.8 : 3.2;
      const secondsPerImage = targetSeconds
        ? Math.max(1.6, Math.min(5.2, targetSeconds / images.length))
        : defaultSecondsPerImage;
      const durationSeconds = Math.round(images.length * secondsPerImage);
      const loadedImages: HTMLImageElement[] = [];
      const agencyLogo = agency?.logoUrl && includeBranding ? await loadImage(agency.logoUrl).catch(() => null) : null;

      for (let index = 0; index < images.length; index += 1) {
        loadedImages.push(await loadImage(images[index]));
        setProgress(5 + Math.round(((index + 1) / images.length) * 20));
      }

      drawKenBurnsFrame({
        ctx,
        image: loadedImages[0],
        frameWidth: preset.width,
        frameHeight: preset.height,
        progress: 0.18,
        imageIndex: 0,
        property,
        agencyName: agency?.name || null,
        agencyLogo,
        includeText,
        includeBranding,
        style,
      });
      const thumbnailBlob = await canvasToBlob(canvas);

      const canvasStream = canvas.captureStream(frameRate);
      musicBed = includeMusic ? createMusicBed(durationSeconds) : null;
      await musicBed?.resume();
      const stream = musicBed
        ? new MediaStream([...canvasStream.getVideoTracks(), ...musicBed.stream.getAudioTracks()])
        : canvasStream;
      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: quality === 'premium' ? 12_000_000 : format === 'portrait' ? 7_000_000 : 8_500_000,
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      const stopped = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });

      recorder.start(500);
      const start = performance.now();
      const totalMs = images.length * secondsPerImage * 1000;

      await new Promise<void>((resolve) => {
        const render = (now: number) => {
          const elapsed = Math.min(now - start, totalMs);
          const rawIndex = Math.min(images.length - 1, Math.floor(elapsed / (secondsPerImage * 1000)));
          const imageElapsed = elapsed - rawIndex * secondsPerImage * 1000;
          const progressInImage = Math.min(1, imageElapsed / (secondsPerImage * 1000));
          const image = loadedImages[rawIndex];

          drawKenBurnsFrame({
            ctx,
            image,
            frameWidth: preset.width,
            frameHeight: preset.height,
            progress: progressInImage,
            imageIndex: rawIndex,
            property,
            agencyName: agency?.name || null,
            agencyLogo,
            includeText,
            includeBranding,
            style,
          });

          setProgress(25 + Math.round((elapsed / totalMs) * 55));
          if (elapsed >= totalMs) {
            resolve();
            return;
          }
          requestAnimationFrame(render);
        };
        requestAnimationFrame(render);
      });

      recorder.stop();
      const blob = await stopped;
      musicBed?.close();
      musicBed = null;
      const extension = getFileExtension(mimeType);
      const fileName = `${sanitizeFileName(property.title)}-${Date.now()}.${extension}`;
      const thumbnailName = `${sanitizeFileName(property.title)}-${Date.now()}-thumb.jpg`;
      const videoRef = ref(storage, `agencies/${agencyId}/properties/${property.id}/video-tours/${fileName}`);
      const thumbnailRef = ref(storage, `agencies/${agencyId}/properties/${property.id}/video-tours/${thumbnailName}`);

      setProgress(86);
      await Promise.all([
        uploadBytes(videoRef, blob, { contentType: mimeType }),
        uploadBytes(thumbnailRef, thumbnailBlob, { contentType: 'image/jpeg' }),
      ]);
      const [downloadUrl, thumbnailUrl] = await Promise.all([
        getDownloadURL(videoRef),
        getDownloadURL(thumbnailRef),
      ]);

      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(URL.createObjectURL(blob));
      persistVideoTour({
        status: 'ready',
        url: downloadUrl,
        thumbnailUrl,
        fileName,
        format,
        style,
        quality,
        targetDurationSeconds: targetDuration === 'auto' ? null : Number(targetDuration),
        hasMusic: includeMusic,
        hasAgencyBranding: includeBranding,
        engine: 'browser-canvas',
        mimeType,
        durationSeconds,
        imageCount: images.length,
        generatedAt: new Date().toISOString(),
        generatedByUid: user?.uid || null,
      });
      setProgress(100);
      toast({
        title: 'Video generat',
        description: `Turul video a fost creat si salvat pe proprietate (${selectedPreset.label}).`,
      });
    } catch (error) {
      musicBed?.close();
      const message = error instanceof Error ? error.message : 'Nu am putut genera video-ul.';
      persistVideoTour({
        status: 'error',
        format,
        style,
        quality,
        targetDurationSeconds: targetDuration === 'auto' ? null : Number(targetDuration),
        hasMusic: includeMusic,
        hasAgencyBranding: includeBranding,
        engine: 'browser-canvas',
        generatedAt: new Date().toISOString(),
        generatedByUid: user?.uid || null,
        imageCount: images.length,
        errorMessage: message,
      });
      toast({
        variant: 'destructive',
        title: 'Generare video esuata',
        description: message,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCloudRender = async () => {
    if (!canGenerate || isCloudRendering) return;
    setIsCloudRendering(true);
    setCloudStatus('Se creeaza jobul cloud...');
    setProgress(4);

    try {
      const response = await authorizedFetch(`/api/properties/${property.id}/video-tour-jobs`, {
        method: 'POST',
        body: JSON.stringify({
          format,
          style,
          quality,
          targetDurationSeconds: targetDuration === 'auto' ? null : Number(targetDuration),
          includeText,
          includeBranding,
          includeMusic,
          includeAiPresenter,
          aiPresenterAvatar,
          aiPresenterVoice,
          aiPresenterPosition,
          aiPresenterSize,
          aiPresenterScript: includeAiPresenter ? aiPresenterScript : null,
        }),
      });
      const payload = await readApiPayload(response);
      if (!response.ok) throw new Error(getApiErrorMessage(payload, 'Nu am putut crea jobul video cloud.'));
      const jobId = payload?.job?.id as string | undefined;
      if (!jobId) throw new Error('Jobul video cloud nu a returnat un ID valid.');

      setProgress(12);
      setCloudStatus('Job creat. Se porneste randarea FFmpeg...');
      let runCompletedJob: Record<string, any> | null = null;
      let runError: Error | null = null;
      let runFinished = false;
      const runPromise = authorizedFetch(`/api/properties/${property.id}/video-tour-jobs/${jobId}?wait=1`, {
        method: 'POST',
      })
        .then(async (runResponse) => {
          const runPayload = await readApiPayload(runResponse);
          if (!runResponse.ok) throw new Error(getApiErrorMessage(runPayload, 'Nu am putut porni randarea cloud.'));
          const job = runPayload?.job as Record<string, any> | undefined;
          if (job?.status === 'completed') runCompletedJob = job;
          if (job?.status === 'error') throw new Error(getApiErrorMessage(runPayload, 'Randarea cloud a esuat.'));
        })
        .catch((error) => {
          runError = error instanceof Error ? error : new Error('Nu am putut porni randarea cloud.');
        })
        .finally(() => {
          runFinished = true;
        });

      setCloudStatus('Randarea ruleaza. Verific progresul...');
      const startedAt = Date.now();
      let completedJob: Record<string, any> | null = null;
      while (Date.now() - startedAt < 15 * 60 * 1000) {
        await delay(2500);
        if (runError) throw runError;
        if (runCompletedJob) {
          completedJob = runCompletedJob;
          break;
        }
        const statusResponse = await authorizedFetch(`/api/properties/${property.id}/video-tour-jobs/${jobId}`, {
          method: 'GET',
        });
        const statusPayload = await readApiPayload(statusResponse);
        if (!statusResponse.ok) {
          throw new Error(getApiErrorMessage(statusPayload, 'Nu am putut verifica statusul randarii.'));
        }
        const currentJob = statusPayload?.job as Record<string, any> | undefined;
        const jobProgress = Number(currentJob?.progress);
        const jobStage = typeof currentJob?.stage === 'string' ? currentJob.stage : null;
        const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000);
        const estimatedProgress = Math.min(95, 18 + Math.floor(elapsedSeconds / 3));
        if (Number.isFinite(jobProgress)) {
          setProgress(Math.min(98, Math.max(12, Math.round(jobProgress))));
        } else {
          setProgress(Math.min(98, Math.max(12, estimatedProgress)));
        }
        if (currentJob?.status === 'completed') {
          completedJob = currentJob;
          break;
        }
        if (currentJob?.status === 'error') {
          throw new Error(getApiErrorMessage(statusPayload, 'Randarea cloud a esuat.'));
        }
        if (runFinished) {
          await runPromise;
          if (runCompletedJob) {
            completedJob = runCompletedJob;
            break;
          }
          if (runError) throw runError;
        }
        setCloudStatus(jobStage ? `${jobStage}... ${elapsedSeconds}s` : `Randarea ruleaza... ${elapsedSeconds}s`);
      }
      if (!completedJob && !runFinished) await runPromise;
      if (!completedJob && runCompletedJob) completedJob = runCompletedJob;
      if (runError) throw runError;
      if (!completedJob) throw new Error('Randarea dureaza prea mult. Jobul poate continua in fundal; reincarca proprietatea peste cateva minute.');

      setProgress(100);
      setCloudStatus('Video MP4 randat in cloud.');
      toast({
        title: 'Video MP4 generat in cloud',
        description: 'Turul video H.264 a fost salvat pe proprietate si poate fi folosit in Meta Ads.',
      });
      if (localPreviewUrl) {
        URL.revokeObjectURL(localPreviewUrl);
        setLocalPreviewUrl(null);
      }
    } catch (error) {
      setCloudStatus('Randarea cloud a esuat.');
      toast({
        variant: 'destructive',
        title: 'Randare cloud esuata',
        description: error instanceof Error ? error.message : 'Nu am putut genera MP4-ul cloud.',
      });
    } finally {
      setIsCloudRendering(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {triggerVariant === 'gallery-button' ? (
          <Button
            type="button"
            variant="secondary"
            className="rounded-full border border-emerald-300/35 bg-emerald-400/18 text-white shadow-[0_18px_40px_-18px_rgba(0,0,0,0.55)] backdrop-blur-xl hover:bg-emerald-400/24 hover:text-white"
          >
            <Film className="mr-2 h-4 w-4" />
            Video tur
          </Button>
        ) : (
          <Card className={cn(`${ACTION_CARD_INTERACTIVE_CLASSNAME} p-0 cursor-pointer`, isMobile && 'rounded-[1.6rem]')}>
            <CardContent className="flex w-full items-center justify-between p-2">
              <div className="flex min-w-0 items-center gap-3">
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', ACTION_PILL_CLASSNAME)}>
                  <Film className={ACTION_ICON_CLASSNAME} />
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-white">Video tur proprietate</p>
                  <p className="truncate text-xs text-white/60">
                    Genereaza un video cinematic din fotografii.
                  </p>
                </div>
              </div>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${ACTION_PILL_CLASSNAME}`}>
                {property.videoTour?.status === 'ready' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                ) : (
                  <Sparkles className="h-4 w-4 text-emerald-200" />
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-[#07111f] p-0 text-white shadow-2xl sm:max-w-[920px]">
        <DialogHeader className="border-b border-white/10 px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <Film className="h-5 w-5 text-emerald-200" />
            Video tur proprietate
          </DialogTitle>
          <DialogDescription className="text-sm text-white/58">
            Creeaza un clip cu zoom, pan, miscare cinematica si text de vanzare, salvat direct pe proprietate.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_340px]">
          <div className="border-b border-white/10 bg-black/28 p-4 lg:border-b-0 lg:border-r">
            <div className="overflow-hidden rounded-lg border border-white/10 bg-black">
              {previewUrl ? (
                <video src={previewUrl} controls playsInline className="aspect-video h-full w-full bg-black object-contain" />
              ) : (
                <canvas ref={canvasRef} className="aspect-video h-full w-full bg-black object-contain" />
              )}
              {previewUrl ? <canvas ref={canvasRef} className="hidden" /> : null}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {images.slice(0, 6).map((url, index) => (
                <div key={`${url}-${index}`} className="relative aspect-video overflow-hidden rounded-md border border-white/10 bg-white/5">
                  <Image src={url} alt={`${property.title} ${index + 1}`} fill className="object-cover" sizes="180px" />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/52">Format</Label>
                <Select value={format} onValueChange={(value) => setFormat(value as VideoFormat)}>
                  <SelectTrigger className="border-white/10 bg-white/[0.06] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">Reels / TikTok</SelectItem>
                    <SelectItem value="landscape">Website / YouTube</SelectItem>
                    <SelectItem value="square">Feed patrat</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/52">Stil</Label>
                <Select value={style} onValueChange={(value) => setStyle(value as VideoStyle)}>
                  <SelectTrigger className="border-white/10 bg-white/[0.06] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cinematic">{STYLE_LABELS.cinematic}</SelectItem>
                    <SelectItem value="luxury">{STYLE_LABELS.luxury}</SelectItem>
                    <SelectItem value="social">{STYLE_LABELS.social}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="video-tour-text" className="text-sm font-medium text-white/82">Text proprietate</Label>
                <Switch id="video-tour-text" checked={includeText} onCheckedChange={setIncludeText} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="video-tour-brand" className="text-sm font-medium text-white/82">Branding agentie</Label>
                <Switch id="video-tour-brand" checked={includeBranding} onCheckedChange={setIncludeBranding} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="video-tour-music" className="flex items-center gap-2 text-sm font-medium text-white/82">
                  <Music2 className="h-4 w-4 text-emerald-200" />
                  Muzica ambientala
                </Label>
                <Switch id="video-tour-music" checked={includeMusic} onCheckedChange={setIncludeMusic} />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="video-tour-ai-presenter" className="flex items-center gap-2 text-sm font-medium text-white/82">
                  <UserRound className="h-4 w-4 text-emerald-200" />
                  Voce + poza agent
                </Label>
                <Switch id="video-tour-ai-presenter" checked={includeAiPresenter} onCheckedChange={setIncludeAiPresenter} />
              </div>

              {includeAiPresenter ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/52">Voce</Label>
                      <Select value={aiPresenterVoice} onValueChange={(value) => setAiPresenterVoice(value as AiPresenterVoice)}>
                        <SelectTrigger className="border-white/10 bg-white/[0.06] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(AI_PRESENTER_VOICE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/52">Pozitie</Label>
                      <Select value={aiPresenterPosition} onValueChange={(value) => setAiPresenterPosition(value as AiPresenterPosition)}>
                        <SelectTrigger className="border-white/10 bg-white/[0.06] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bottom-right">Dreapta jos</SelectItem>
                          <SelectItem value="bottom-left">Stanga jos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/52">Marime</Label>
                      <Select value={aiPresenterSize} onValueChange={(value) => setAiPresenterSize(value as AiPresenterSize)}>
                        <SelectTrigger className="border-white/10 bg-white/[0.06] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="small">Mic</SelectItem>
                          <SelectItem value="medium">Mediu</SelectItem>
                          <SelectItem value="large">Mare</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/52">Script</Label>
                    <Textarea
                      value={aiPresenterScript}
                      onChange={(event) => setAiPresenterScript(event.target.value)}
                      placeholder="Lasa gol pentru script automat din descrierea proprietatii."
                      className="min-h-[92px] resize-none border-white/10 bg-white/[0.06] text-sm text-white placeholder:text-white/34"
                    />
                    <p className="text-xs leading-5 text-white/50">
                      Foloseste poza agentului proprietatii, voiceover si subtitrare animata pe cuvinte. Nu foloseste avatar extern.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-lg border border-emerald-300/16 bg-emerald-400/[0.06] p-4">
              <p className="text-sm font-semibold text-emerald-100">
                {images.length} fotografii pregatite
              </p>
              <p className="mt-1 text-xs leading-5 text-white/58">
                Generatorul foloseste miscari diferite pe fiecare cadru, fundal blur, vignette, thumbnail si compozitie adaptata formatului ales.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/52">Calitate</Label>
                <Select value={quality} onValueChange={(value) => setQuality(value as VideoQuality)}>
                  <SelectTrigger className="border-white/10 bg-white/[0.06] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard rapid</SelectItem>
                    <SelectItem value="premium">Premium HD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-[0.16em] text-white/52">Durata</Label>
                <Select value={targetDuration} onValueChange={setTargetDuration}>
                  <SelectTrigger className="border-white/10 bg-white/[0.06] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_DURATION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isGenerating ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>Se genereaza video-ul</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2 bg-white/10" />
              </div>
            ) : null}

            {isCloudRendering || cloudStatus ? (
              <div className="space-y-2 rounded-lg border border-sky-300/15 bg-sky-400/[0.06] p-3">
                <div className="flex items-center justify-between gap-3 text-xs text-white/64">
                  <span>{cloudStatus || 'Randare cloud'}</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2 bg-white/10" />
              </div>
            ) : null}

            {property.videoTour?.status === 'ready' && property.videoTour.generatedAt ? (
              <p className="text-xs text-white/48">
                Ultimul video: {new Date(property.videoTour.generatedAt).toLocaleString('ro-RO')}
              </p>
            ) : null}

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                className="h-11 rounded-full bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                onClick={() => void handleCloudRender()}
                disabled={!canGenerate || isGenerating || isCloudRendering}
              >
                {isCloudRendering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Randare cloud MP4
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white"
                onClick={() => void handleGenerate()}
                disabled={!canGenerate || isGenerating || isCloudRendering}
              >
                {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                {previewUrl ? 'Preview browser din nou' : 'Preview browser'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08] hover:text-white"
                onClick={handleDownload}
                disabled={!previewUrl || isGenerating || isCloudRendering}
              >
                {previewUrl ? <Download className="mr-2 h-4 w-4" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                Descarca video
              </Button>
            </div>

            {!canGenerate ? (
              <p className="text-xs leading-5 text-red-200/80">
                Ai nevoie de cel putin doua fotografii si de o sesiune activa pentru a genera video-ul.
              </p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
