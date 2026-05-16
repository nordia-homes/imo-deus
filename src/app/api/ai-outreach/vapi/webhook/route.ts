import { NextRequest, NextResponse } from 'next/server';
import { normalizeVapiEndedReason } from '@/lib/ai-outreach/status';
import { adminDb } from '@/firebase/admin';
import type { AiOutreachCallResult, AiOutreachOutcome } from '@/lib/ai-outreach/types';
import { updateAiOutreachOwnerListingStatus } from '@/lib/ai-outreach/server';

export const runtime = 'nodejs';

function getString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function getNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getRecord(value: unknown) {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function getNestedRecord(payload: Record<string, unknown>, path: string[]) {
  let current: unknown = payload;
  for (const segment of path) {
    const record = getRecord(current);
    if (!record) return null;
    current = record[segment];
  }
  return getRecord(current);
}

function getNestedString(payload: Record<string, unknown>, paths: string[][]) {
  for (const path of paths) {
    let current: unknown = payload;
    for (const segment of path) {
      const record = getRecord(current);
      current = record?.[segment];
    }
    const value = getString(current);
    if (value) return value;
  }
  return '';
}

function getNestedNumber(payload: Record<string, unknown>, paths: string[][]) {
  for (const path of paths) {
    let current: unknown = payload;
    for (const segment of path) {
      const record = getRecord(current);
      current = record?.[segment];
    }
    const value = getNumber(current);
    if (value !== null) return value;
  }
  return null;
}

function extractCallId(payload: Record<string, unknown>) {
  const call = getRecord(payload.call);
  const messageCall = getNestedRecord(payload, ['message', 'call']);

  return getString(payload.callId) || getString(payload.id) || getString(call?.id) || getString(messageCall?.id);
}

function extractInternalCallId(payload: Record<string, unknown>) {
  const metadata = getNestedRecord(payload, ['call', 'metadata']) || getNestedRecord(payload, ['message', 'call', 'metadata']);
  return getString(metadata?.aiOutreachCallId) || getNestedString(payload, [['metadata', 'aiOutreachCallId']]);
}

function inferOutcome(payload: Record<string, unknown>): AiOutreachOutcome {
  const analysis = getRecord(payload.analysis) || getNestedRecord(payload, ['message', 'analysis']);
  const structured = getRecord(analysis?.structuredData);
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

  return normalizeVapiEndedReason(getNestedString(payload, [['endedReason'], ['message', 'endedReason']]));
}

function extractResult(payload: Record<string, unknown>, outcome: AiOutreachOutcome): AiOutreachCallResult {
  const analysis = getRecord(payload.analysis) || getNestedRecord(payload, ['message', 'analysis']);
  const structured = getRecord(analysis?.structuredData);

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
  const messageType = getNestedString(payload, [['type'], ['message', 'type']]);
  const endedReason = getNestedString(payload, [['endedReason'], ['message', 'endedReason']]);
  const isEnded = messageType.includes('end') || Boolean(endedReason);

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
    update.endedReason = endedReason || null;
    update.durationSeconds = getNestedNumber(payload, [['durationSeconds'], ['duration'], ['message', 'durationSeconds'], ['message', 'duration']]);
    update.cost = getNestedNumber(payload, [['cost'], ['message', 'cost']]);
    update.summary = getNestedString(payload, [['summary'], ['analysis', 'summary'], ['message', 'summary'], ['message', 'analysis', 'summary']]);
    update.transcript = getNestedString(payload, [['transcript'], ['artifact', 'transcript'], ['message', 'transcript'], ['message', 'artifact', 'transcript']]);
    update.recordingUrl = getNestedString(payload, [['recordingUrl'], ['artifact', 'recordingUrl'], ['message', 'recordingUrl'], ['message', 'artifact', 'recordingUrl']]) || null;
    update.result = result;

    if (callData.agencyId && callData.ownerListingId) {
      await updateAiOutreachOwnerListingStatus(adminDb, callData.agencyId, callData.ownerListingId, {
        latestAiCallId: callDoc.id,
        aiOutreachStatus: 'completed',
        aiOutreachOutcome: outcome,
        aiOutreachUpdatedAt: timestamp,
        aiCollaborationStatus: result.collaborationStatus,
        aiAcceptedCommissionValue: result.acceptedCommissionValue || null,
        aiDoNotCall: Boolean(result.doNotCall),
      });
    }
  } else if (messageType.includes('start') || messageType.includes('in-progress')) {
    update.status = 'calling';
    update.outcome = 'calling';
    update.startedAt = timestamp;

    if (callData.agencyId && callData.ownerListingId) {
      await updateAiOutreachOwnerListingStatus(adminDb, callData.agencyId, callData.ownerListingId, {
        latestAiCallId: callDoc.id,
        aiOutreachStatus: 'calling',
        aiOutreachOutcome: 'calling',
        aiOutreachUpdatedAt: timestamp,
      });
    }
  }

  await callDoc.ref.set(update, { merge: true });
  await callDoc.ref.collection('events').add({ payload, createdAt: timestamp });

  return NextResponse.json({ ok: true }, { status: 200 });
}
