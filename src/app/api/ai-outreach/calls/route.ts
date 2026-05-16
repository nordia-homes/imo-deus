import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import {
  assertCanCreateAiOutreachCall,
  buildAiOutreachCall,
  getAgencyName,
  getAgentName,
  getAiOutreachSettings,
  getListingAttemptNumber,
  launchAiOutreachCall,
  normalizeAiOutreachPhone,
  updateAiOutreachOwnerListingStatus,
} from '@/lib/ai-outreach/server';
import type { AiOwnerListingSnapshot } from '@/lib/ai-outreach/types';

export const runtime = 'nodejs';

const callSchema = z.object({
  ownerListing: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    price: z.string().optional(),
    location: z.string().optional(),
    link: z.string().optional(),
    ownerPhone: z.string().optional(),
    description: z.string().optional(),
  }),
  scheduledAt: z.string().nullable().optional(),
});

function formatError(error: unknown) {
  if (error instanceof z.ZodError) {
    return { status: 400, message: error.issues[0]?.message || 'Payload invalid pentru apel.' };
  }

  if (error && typeof error === 'object' && 'status' in error && typeof (error as { status?: unknown }).status === 'number') {
    return { status: (error as { status: number }).status, message: error instanceof Error ? error.message : 'Cererea a esuat.' };
  }

  return { status: 500, message: error instanceof Error ? error.message : 'Cererea a esuat.' };
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const snapshot = await context.adminDb
      .collection('agencies')
      .doc(context.agencyId)
      .collection('aiOutreachCalls')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get();

    return NextResponse.json({ calls: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const body = callSchema.parse(await request.json().catch(() => ({})));
    const ownerListing: AiOwnerListingSnapshot = body.ownerListing;
    const ownerPhone = normalizeAiOutreachPhone(ownerListing.ownerPhone);

    if (!ownerPhone) {
      return NextResponse.json({ message: 'Anuntul nu are numar de telefon valid pentru apel AI.' }, { status: 400 });
    }

    const settings = await getAiOutreachSettings(context.adminDb, context.agencyId);
    await assertCanCreateAiOutreachCall({
      adminDb: context.adminDb,
      agencyId: context.agencyId,
      ownerListingId: ownerListing.id,
      settings,
      scheduledAt: body.scheduledAt,
    });

    const timestamp = new Date().toISOString();
    const callRef = context.adminDb.collection('agencies').doc(context.agencyId).collection('aiOutreachCalls').doc();
    const agentName = await getAgentName(context.adminDb, context.uid);
    const agencyName = await getAgencyName(context.adminDb, context.agencyId);
    const attemptNumber = await getListingAttemptNumber(context.adminDb, context.agencyId, ownerListing.id);
    const call = buildAiOutreachCall({
      agencyId: context.agencyId,
      uid: context.uid,
      agentName,
      ownerListing,
      ownerPhone,
      settings,
      callId: callRef.id,
      attemptNumber,
      scheduledAt: body.scheduledAt,
      timestamp,
    });

    await callRef.set(call);
    await updateAiOutreachOwnerListingStatus(context.adminDb, context.agencyId, ownerListing.id, {
      latestAiCallId: callRef.id,
      aiOutreachStatus: call.status,
      aiOutreachOutcome: call.outcome,
      aiOutreachUpdatedAt: timestamp,
      createdAt: timestamp,
      aiDoNotCall: false,
    });

    if (body.scheduledAt) {
      return NextResponse.json({ call }, { status: 201 });
    }

    const result = await launchAiOutreachCall({ adminDb: context.adminDb, callRef, call, settings, agencyName });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
