import { z } from 'zod';
import { collectionFor, type AssistantContext } from '@/lib/ai-assistant/access';
import { CommunicationError } from '@/lib/communications/server';
import { prepareMediaUpload } from './media-uploads';

// Browser rendering is a device callback. Jarvis uses video_create for cloud rendering.
export const browserVideoSchema = z.object({
  runId: z.string().uuid(), status: z.enum(['processing', 'ready', 'error']),
  expectedUpdatedAt: z.string().datetime({ offset: true }).nullable().optional(),
  format: z.enum(['landscape', 'portrait', 'square']), style: z.enum(['cinematic', 'luxury', 'social']),
  quality: z.enum(['standard', 'premium']).nullable().optional(),
  targetDurationSeconds: z.number().min(1).max(300).nullable().optional(),
  hasMusic: z.boolean().optional(), hasAgencyBranding: z.boolean().optional(),
  imageCount: z.number().int().min(2).max(40), durationSeconds: z.number().min(1).max(600).optional(),
  videoUploadId: z.string().uuid().optional(), thumbnailUploadId: z.string().uuid().optional(),
  errorMessage: z.string().max(500).optional(),
}).strict().superRefine((v, ctx) => {
  if (v.status === 'processing' && v.expectedUpdatedAt === undefined) ctx.addIssue({ code: 'custom', message: 'Revizia proprietății este necesară.' });
  if (v.status === 'ready' && (!v.videoUploadId || !v.thumbnailUploadId || !v.durationSeconds)) ctx.addIssue({ code: 'custom', message: 'Rezultatul video necesită fișiere validate și durată.' });
});

export async function saveBrowserVideo(ctx: AssistantContext, propertyId: string, input: z.infer<typeof browserVideoSchema>) {
  const ref = collectionFor(ctx, 'properties').doc(propertyId);
  const key = `browser-video-${input.runId}-${input.status}`, ledger = collectionFor(ctx, 'assistantExecutions').doc(key);
  const preflight = async () => {
    const [member, property] = await Promise.all([ctx.adminDb.collection('users').doc(ctx.uid).get(), ref.get()]);
    if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role || !['admin', 'agent'].includes(ctx.role || '')) throw new CommunicationError('Acces revocat.', 403);
    if (!property.exists) throw new CommunicationError('Proprietatea nu mai există.', 404);
    if (input.status !== 'processing' && (property.data()?.browserVideoRun?.id !== input.runId || property.data()?.browserVideoRun?.ownerId !== ctx.uid)) throw new CommunicationError('Randarea browserului nu mai este activă.', 409);
  };
  await preflight();
  const prior = await ledger.get(); if (prior.exists) return prior.data()?.result;
  let media: Awaited<ReturnType<typeof prepareMediaUpload>> | undefined, thumbnail: typeof media;
  if (input.status === 'ready') {
    [media, thumbnail] = await Promise.all([input.videoUploadId!, input.thumbnailUploadId!].map(uploadId => prepareMediaUpload(ctx, uploadId, { purpose: 'video_tour', targetId: propertyId, createTarget: false })));
    if (media.type !== 'video' || thumbnail.type !== 'image') throw new CommunicationError('Fișierele rezultatului video nu sunt potrivite.', 415);
  }
  return ctx.adminDb.runTransaction(async tx => {
    const [member, property, previous] = await Promise.all([tx.get(ctx.adminDb.collection('users').doc(ctx.uid)), tx.get(ref), tx.get(ledger)]);
    if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role || !['admin', 'agent'].includes(ctx.role || '')) throw new CommunicationError('Acces revocat.', 403);
    if (!property.exists) throw new CommunicationError('Proprietatea nu mai există.', 404);
    if (previous.exists) return previous.data()?.result;
    const row = property.data()!;
    if (input.status === 'processing') {
      if ((row.updatedAt || null) !== input.expectedUpdatedAt || row.videoTour?.status === 'processing') throw new CommunicationError('Proprietatea s-a modificat sau există deja o randare activă.', 409);
    } else if (row.browserVideoRun?.id !== input.runId || row.browserVideoRun?.ownerId !== ctx.uid || row.videoTour?.engine !== 'browser-canvas' || row.videoTour?.status !== 'processing') throw new CommunicationError('Randarea a fost înlocuită sau finalizată.', 409);
    const now = new Date().toISOString();
    const videoTour = { status: input.status, format: input.format, style: input.style, quality: input.quality || 'standard', targetDurationSeconds: input.targetDurationSeconds || null,
      hasMusic: input.hasMusic || false, hasAgencyBranding: input.hasAgencyBranding || false, imageCount: input.imageCount,
      engine: 'browser-canvas', generatedByUid: ctx.uid, generatedAt: now,
      ...(media && thumbnail ? { url: media.url, thumbnailUrl: thumbnail.url, fileName: media.name, mimeType: media.mimeType, durationSeconds: input.durationSeconds } : {}),
      ...(input.status === 'error' ? { errorMessage: input.errorMessage || 'Randare nereușită.' } : {}),
    };
    tx.update(ref, { videoTour, browserVideoRun: { id: input.runId, ownerId: ctx.uid, status: input.status, updatedAt: now }, updatedAt: now });
    const result = { propertyId, runId: input.runId, status: input.status, updatedAt: now, videoTour };
    tx.create(ledger, { actorId: ctx.uid, operation: 'browser_video_result', status: 'completed', result, completedAt: now });
    tx.create(collectionFor(ctx, 'crmEvents').doc(key), { id: key, actorId: ctx.uid, agencyId: ctx.agencyId, source: 'device_callback', capability: 'browser_video_result', occurredAt: now, recordedAt: now, entities: { propertyId }, result: { runId: input.runId, status: input.status }, evidence: input.status === 'ready' ? 'server_validated_media_browser_duration' : 'browser_report' });
    return result;
  });
}
