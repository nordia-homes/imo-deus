import { NextRequest, NextResponse } from 'next/server';
import { normalizeVapiEndedReason } from '@/lib/ai-outreach/status';
import { adminDb } from '@/firebase/admin';
import type { AiOutreachCallResult, AiOutreachOutcome } from '@/lib/ai-outreach/types';

export const runtime = 'nodejs';

function getString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function getNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function extractCallId(payload: Record<string, unknown>) {
  const call = payload.call && typeof payload.call === 'object' ? (payload.call as Record<string, unknown>) : null;
  const message = payload.message && typeof payload.message === 'object' ? (payload.message as Record<string, unknown>) : null;
  const messageCall = message?.call && typeof message.call === 'object' ? (message.call as Record<string, unknown>) : null;

  return getString(payload.callId) || getString(payload.id) || getString(call?.id) || getString(messageCall?.id);
}

function extractInternalCallId(payload: Record<string, unknown>) {
  const call = payload.call && typeof payload.call === 'object' ? (payload.call as Record<string, unknown>) : null;
  const metadata = call?.metadata && typeof call.metadata === 'object' ? (call.metadata as Record<string, unknown>) : null;
  return getString(metadata?.aiOutreachCallId);
}

function inferOutcome(payload: Record<string, unknown>): AiOutreachOutcome {
  const analysis = payload.analysis && typeof payload.analysis === 'object' ? (payload.analysis as Record<string, unknown>) : null;
  const structured = analysis?.structuredData && typeof analysis.structuredData === 'object' ? (analysis.structuredData as Record<string, unknown>) : null;
  const explicitOutcome = getString(structured?.outcome) as AiOutreachOutcome;
  const known: AiOutreachOutcome[] = [
    'collaborates',
    'does_not_collaborate',
    'call_later',
    'no_answer',
    'busy',
    'wrong_number',
    'invalid_number',
    'already_sold',
    'already_has_agency',
    'do_not_call',
    'verbal_agreement',
    'negotiation_success',
    'negotiation_blocked',
    'needs_human_review',
    'failed',
  ];

  if (known.includes(explicitOutcome)) {
    return explicitOutcome;
  }

  return normalizeVapiEndedReason(getString(payload.endedReason));
}

function extractResult(payload: Record<string, unknown>, outcome: AiOutreachOutcome): AiOutreachCallResult {
  const analysis = payload.analysis && typeof payload.analysis === 'object' ? (payload.analysis as Record<string, unknown>) : null;
  const structured = analysis?.structuredData && typeof analysis.structuredData === 'object' ? (analysis.structuredData as Record<string, unknown>) : null;

  return {
    collaborationStatus:
      outcome === 'collaborates' || outcome === 'verbal_agreement' || outcome === 'negotiation_success'
        ? 'yes'
        : outcome === 'does_not_collaborate'
          ? 'no'
          : outcome === 'call_later'
            ? 'call_later'
            : 'unknown',
    exactAddress: getString(structured?.exactAddress),
    viewingAvailability: getString(structured?.viewingAvailability),
    acceptedCommissionValue: getString(structured?.acceptedCommissionValue),
    wantsHumanCallback: Boolean(structured?.wantsHumanCallback),
    doNotCall: outcome === 'do_not_call' || Boolean(structured?.doNotCall),
    alreadyHasAgency: outcome === 'already_has_agency' || Boolean(structured?.alreadyHasAgency),
    alreadySold: outcome === 'already_sold' || Boolean(structured?.alreadySold),
    confidence: getNumber(structured?.confidence) ?? undefined,
  };
}

export async function POST(request: NextRequest) {
  const configuredSecret = process.env.VAPI_WEBHOOK_SECRET;
  const providedSecret = request.headers.get('x-vapi-secret') || request.headers.get('x-webhook-secret');

  if (configuredSecret && providedSecret !== configuredSecret) {
    return NextResponse.json({ message: 'Webhook neautorizat.' }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const vapiCallId = extractCallId(payload);
  const internalCallId = extractInternalCallId(payload);

  if (!vapiCallId && !internalCallId) {
    return NextResponse.json({ message: 'Webhook fara ID de apel.' }, { status: 400 });
  }

  const querySnapshot = internalCallId
    ? await adminDb.collectionGroup('aiOutreachCalls').where('id', '==', internalCallId).limit(1).get()
    : await adminDb.collectionGroup('aiOutreachCalls').where('vapiCallId', '==', vapiCallId).limit(1).get();

  if (querySnapshot.empty) {
    return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
  }

  const callDoc = querySnapshot.docs[0];
  const callData = callDoc.data() as { agencyId?: string; ownerListingId?: string };
  const timestamp = new Date().toISOString();
  const messageType = getString(payload.type) || getString((payload.message as Record<string, unknown> | undefined)?.type);
  const isEnded = messageType.includes('end') || Boolean(payload.endedReason);

  const update: Record<string, unknown> = {
    updatedAt: timestamp,
    lastWebhookType: messageType || null,
  };

  if (vapiCallId) {
    update.vapiCallId = vapiCallId;
  }

  if (isEnded) {
    const outcome = inferOutcome(payload);
    const result = extractResult(payload, outcome);
    update.status = 'completed';
    update.outcome = outcome;
    update.endedAt = timestamp;
    update.endedReason = getString(payload.endedReason) || null;
    update.durationSeconds = getNumber(payload.durationSeconds);
    update.cost = getNumber(payload.cost);
    update.summary = getString(payload.summary) || getString((payload.analysis as Record<string, unknown> | undefined)?.summary);
    update.transcript = getString(payload.transcript);
    update.recordingUrl = getString(payload.recordingUrl) || null;
    update.result = result;

    if (callData.ownerListingId) {
      await adminDb.collection('ownerListings').doc(callData.ownerListingId).set(
        {
          latestAiCallId: callDoc.id,
          aiOutreachStatus: 'completed',
          aiOutreachOutcome: outcome,
          aiOutreachUpdatedAt: timestamp,
          aiCollaborationStatus: result.collaborationStatus,
          aiAcceptedCommissionValue: result.acceptedCommissionValue || null,
          aiDoNotCall: Boolean(result.doNotCall),
        },
        { merge: true },
      );
    }
  } else if (messageType.includes('start') || messageType.includes('in-progress')) {
    update.status = 'calling';
    update.outcome = 'calling';
    update.startedAt = timestamp;
  }

  await callDoc.ref.set(update, { merge: true });
  await callDoc.ref.collection('events').add({ payload, createdAt: timestamp });

  return NextResponse.json({ ok: true }, { status: 200 });
}
