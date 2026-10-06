import { NextResponse } from 'next/server';
import { z } from 'zod';
import { assistantContext, collectionFor } from '@/lib/ai-assistant/access';
import { assistantError } from '@/lib/ai-assistant/http-error';
import { CommunicationError } from '@/lib/communications/server';
import { readBoundedText } from '@/lib/romimo/transport';
export const runtime = 'nodejs';
const cancelSchema = z.object({ runId: z.string().uuid() }).strict();
export async function POST(request: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  try {
    const ctx = await assistantContext(request), { propertyId } = await params, { runId } = cancelSchema.parse(JSON.parse(await readBoundedText(request.body, 2000)));
    const ref = collectionFor(ctx, 'properties').doc(propertyId), key = `browser-video-${runId}-cancel`, ledger = collectionFor(ctx, 'assistantExecutions').doc(key);
    const result = await ctx.adminDb.runTransaction(async tx => {
      const [member, property, prior] = await Promise.all([tx.get(ctx.adminDb.collection('users').doc(ctx.uid)), tx.get(ref), tx.get(ledger)]);
      if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new CommunicationError('Acces revocat.', 403);
      if (prior.exists && prior.data()?.actorId === ctx.uid) return prior.data()?.result;
      const row = property.data();
      if (!row || row.browserVideoRun?.id !== runId || ctx.role !== 'admin' && row.browserVideoRun?.ownerId !== ctx.uid) throw new CommunicationError('Randare inaccesibilă.', 404);
      if (row.videoTour?.engine !== 'browser-canvas' || row.videoTour?.status !== 'processing') throw new CommunicationError('Randarea a fost deja încheiată sau înlocuită.', 409);
      const now = new Date().toISOString(), result = { propertyId, runId, status: 'cancelled', note: 'Rezultatele întârziate ale browserului vor fi refuzate.' };
      tx.update(ref, { videoTour: { ...row.videoTour, status: 'error', errorMessage: 'Randare anulată de agent.' }, browserVideoRun: { ...row.browserVideoRun, status: 'cancelled', updatedAt: now }, updatedAt: now });
      tx.create(ledger, { actorId: ctx.uid, status: 'completed', result, completedAt: now });
      tx.create(collectionFor(ctx, 'crmEvents').doc(key), { id: key, agencyId: ctx.agencyId, actorId: ctx.uid, capability: 'browser_video_cancel', source: 'crm_action', occurredAt: now, recordedAt: now, entities: { propertyId }, result });
      return result;
    });
    return NextResponse.json(result);
  } catch (error) { return assistantError(error); }
}
