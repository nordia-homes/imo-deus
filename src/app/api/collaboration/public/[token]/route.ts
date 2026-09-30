import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '@/firebase/admin';
import { CollaborationError, createLead, getActiveLink } from '@/lib/collaboration/server';

export const runtime = 'nodejs';

const inputSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('message'), name: z.string().trim().min(2).max(120), email: z.string().email().max(200), phone: z.string().trim().min(8).max(40), message: z.string().trim().min(1).max(3000), website: z.string().max(0).optional() }),
  z.object({ kind: z.literal('viewing'), name: z.string().trim().min(2).max(120), email: z.string().email().max(200), phone: z.string().trim().min(8).max(40), message: z.string().trim().max(3000), website: z.string().max(0).optional() }),
  z.object({ kind: z.literal('reaction'), reaction: z.enum(['like', 'dislike']), visitorId: z.string().min(16).max(100) }),
  z.object({ kind: z.literal('view'), visitorId: z.string().min(16).max(100) }),
]);

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const { link, listing } = await getActiveLink(adminDb, token);
    const input = inputSchema.parse(await request.json());
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const bucket = Math.floor(Date.now() / 900_000);
    const isLead = input.kind === 'message' || input.kind === 'viewing';
    const limitId = createHash('sha256').update(`${ip}:${token}:${bucket}:${isLead ? 'lead' : 'activity'}`).digest('hex');
    const limitRef = adminDb.collection('collaborationRateLimits').doc(limitId);
    const allowed = await adminDb.runTransaction(async tx => {
      const snap = await tx.get(limitRef);
      const count = Number(snap.data()?.count || 0);
      if (count >= (isLead ? 5 : 100)) return false;
      tx.set(limitRef, { count: count + 1, expiresAt: new Date(Date.now() + 900_000).toISOString() }, { merge: true });
      return true;
    });
    if (!allowed) return NextResponse.json({ message: 'Prea multe solicitări. Reîncearcă mai târziu.' }, { status: 429 });
    if (input.kind === 'message' || input.kind === 'viewing') {
      if (input.website) return NextResponse.json({ ok: true });
      const lead = await createLead(adminDb, link, listing, input);
      return NextResponse.json({ ok: true, leadId: lead.id });
    }
    const id = createHash('sha256').update(`${token}:${input.visitorId}`).digest('hex');
    const ref = adminDb.collection('collaborationLinkActivity').doc(id);
    const statsRef = adminDb.collection('collaborationLinkStats').doc(token);
    await adminDb.runTransaction(async tx => {
      const previous = await tx.get(ref);
      const now = new Date().toISOString();
      if (input.kind === 'view') {
        if (previous.data()?.viewedAt) return;
        tx.set(ref, { linkId: token, listingId: listing.id, collaboratorUid: link.collaboratorUid, viewedAt: now }, { merge: true });
        tx.set(statsRef, { views: FieldValue.increment(1), updatedAt: now }, { merge: true });
      } else {
        const oldReaction = previous.data()?.reaction;
        if (oldReaction === input.reaction) return;
        tx.set(ref, { linkId: token, listingId: listing.id, collaboratorUid: link.collaboratorUid, reaction: input.reaction, updatedAt: now }, { merge: true });
        tx.set(statsRef, { ...(oldReaction === 'like' ? { likes: FieldValue.increment(-1) } : oldReaction === 'dislike' ? { dislikes: FieldValue.increment(-1) } : {}), [input.reaction === 'like' ? 'likes' : 'dislikes']: FieldValue.increment(1), updatedAt: now }, { merge: true });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Cererea nu a putut fi procesată.' }, { status: error instanceof CollaborationError ? error.status : 400 });
  }
}
