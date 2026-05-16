import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import type { Firestore } from 'firebase-admin/firestore';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { withDefaultAiOutreachSettings } from '@/lib/ai-outreach/defaults';
import { createVapiOutboundCall } from '@/lib/ai-outreach/vapi';
import type { AiOutreachCall, AiOwnerListingSnapshot } from '@/lib/ai-outreach/types';

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

function normalizePhone(phone?: string) {
  return (phone || '').replace(/[^\d+]/g, '').trim();
}

async function getAgencyName(adminDb: Firestore, agencyId: string) {
  const snapshot = await adminDb.collection('agencies').doc(agencyId).get();
  const data = snapshot.data() as { name?: string; agencyName?: string } | undefined;
  return data?.name || data?.agencyName || 'Agentie imobiliara';
}

async function getAgentName(adminDb: Firestore, uid: string) {
  const snapshot = await adminDb.collection('users').doc(uid).get();
  const data = snapshot.data() as { name?: string; displayName?: string; email?: string } | undefined;
  return data?.name || data?.displayName || data?.email || 'Agent';
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
    const ownerPhone = normalizePhone(ownerListing.ownerPhone);

    if (!ownerPhone) {
      return NextResponse.json({ message: 'Anuntul nu are numar de telefon valid pentru apel AI.' }, { status: 400 });
    }

    const settingsRef = context.adminDb.collection('agencies').doc(context.agencyId).collection('aiOutreach').doc('settings');
    const settingsSnapshot = await settingsRef.get();
    const settings = withDefaultAiOutreachSettings(context.agencyId, settingsSnapshot.data());

    if (!settings.enabled) {
      return NextResponse.json({ message: 'Apelurile AI nu sunt activate pentru aceasta agentie.' }, { status: 403 });
    }

    const timestamp = new Date().toISOString();
    const callRef = context.adminDb.collection('agencies').doc(context.agencyId).collection('aiOutreachCalls').doc();
    const agentName = await getAgentName(context.adminDb, context.uid);
    const agencyName = await getAgencyName(context.adminDb, context.agencyId);
    const call: AiOutreachCall = {
      id: callRef.id,
      agencyId: context.agencyId,
      agentId: context.uid,
      agentName,
      ownerListingId: ownerListing.id,
      ownerListingTitle: ownerListing.title,
      ownerListingLocation: ownerListing.location || '',
      ownerListingPrice: ownerListing.price || '',
      ownerPhone,
      callerNumber: null,
      phoneNumberId: null,
      vapiCallId: null,
      status: body.scheduledAt ? 'scheduled' : 'queued',
      outcome: 'queued',
      attemptNumber: 1,
      templateId: settings.defaultTemplateId,
      scheduledAt: body.scheduledAt || null,
      startedAt: null,
      endedAt: null,
      durationSeconds: null,
      cost: null,
      summary: '',
      transcript: '',
      recordingUrl: null,
      endedReason: null,
      providerErrorCode: null,
      providerErrorMessage: null,
      result: {
        desiredCommission: settings.desiredCommissionValue,
        minimumCommission: settings.minimumCommissionValue,
      },
      createdBy: context.uid,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    await callRef.set(call);

    const ownerListingRef = context.adminDb.collection('ownerListings').doc(ownerListing.id);
    await ownerListingRef.set(
      {
        latestAiCallId: callRef.id,
        aiOutreachStatus: call.status,
        aiOutreachOutcome: call.outcome,
        aiOutreachUpdatedAt: timestamp,
        aiDoNotCall: false,
      },
      { merge: true },
    );

    if (body.scheduledAt) {
      return NextResponse.json({ call }, { status: 201 });
    }

    try {
      const vapiResult = await createVapiOutboundCall({ call, settings, agencyName });

      if (vapiResult.mode === 'not_configured') {
        const failedUpdate = {
          status: 'failed',
          outcome: 'failed',
          providerErrorCode: 'vapi_not_configured',
          providerErrorMessage: vapiResult.message,
          endedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await callRef.set(failedUpdate, { merge: true });
        await ownerListingRef.set(
          {
            aiOutreachStatus: failedUpdate.status,
            aiOutreachOutcome: failedUpdate.outcome,
            aiOutreachUpdatedAt: failedUpdate.updatedAt,
          },
          { merge: true },
        );
        return NextResponse.json({ call: { ...call, ...failedUpdate }, warning: vapiResult.message }, { status: 201 });
      }

      const liveUpdate = {
        status: 'calling',
        outcome: 'calling',
        vapiCallId: vapiResult.vapiCallId,
        callerNumber: vapiResult.callerNumber || null,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await callRef.set(
        {
          ...liveUpdate,
          providerRawCreateResponse: vapiResult.raw,
        },
        { merge: true },
      );
      await ownerListingRef.set(
        {
          aiOutreachStatus: liveUpdate.status,
          aiOutreachOutcome: liveUpdate.outcome,
          aiOutreachUpdatedAt: liveUpdate.updatedAt,
        },
        { merge: true },
      );

      return NextResponse.json({ call: { ...call, ...liveUpdate } }, { status: 201 });
    } catch (providerError) {
      const failedUpdate = {
        status: 'failed',
        outcome: 'failed',
        providerErrorCode: 'vapi_create_failed',
        providerErrorMessage: providerError instanceof Error ? providerError.message : 'Vapi call create failed.',
        endedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await callRef.set(failedUpdate, { merge: true });
      await ownerListingRef.set(
        {
          aiOutreachStatus: failedUpdate.status,
          aiOutreachOutcome: failedUpdate.outcome,
          aiOutreachUpdatedAt: failedUpdate.updatedAt,
        },
        { merge: true },
      );
      return NextResponse.json({ call: { ...call, ...failedUpdate }, message: failedUpdate.providerErrorMessage }, { status: 201 });
    }
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
