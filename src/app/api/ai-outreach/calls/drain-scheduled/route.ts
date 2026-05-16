import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin';
import {
  assertCanCreateAiOutreachCall,
  getAgencyName,
  getAiOutreachSettings,
  launchAiOutreachCall,
  updateAiOutreachOwnerListingStatus,
} from '@/lib/ai-outreach/server';
import type { AiOutreachCall } from '@/lib/ai-outreach/types';

export const runtime = 'nodejs';

function isAuthorized(request: NextRequest) {
  const secret = process.env.AI_OUTREACH_CRON_SECRET || process.env.OWNER_LISTINGS_CRON_SECRET;
  if (!secret) return false;
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const headerSecret = request.headers.get('x-cron-secret');
  return bearer === secret || headerSecret === secret;
}

function getAgencyIdFromCallDoc(callRefPath: string) {
  const parts = callRefPath.split('/');
  const agencyIndex = parts.indexOf('agencies');
  return agencyIndex >= 0 ? parts[agencyIndex + 1] : '';
}

async function failScheduledCall(call: AiOutreachCall, message: string) {
  const timestamp = new Date().toISOString();
  await adminDb.collection('agencies').doc(call.agencyId).collection('aiOutreachCalls').doc(call.id).set(
    {
      status: 'failed',
      outcome: 'failed',
      providerErrorCode: 'scheduled_guard_failed',
      providerErrorMessage: message,
      endedAt: timestamp,
      updatedAt: timestamp,
    },
    { merge: true },
  );
  await updateAiOutreachOwnerListingStatus(adminDb, call.agencyId, call.ownerListingId, {
    latestAiCallId: call.id,
    aiOutreachStatus: 'failed',
    aiOutreachOutcome: 'failed',
    aiOutreachUpdatedAt: timestamp,
  });
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ message: 'Neautorizat.' }, { status: 401 });
  }

  const now = new Date();
  const snapshot = await adminDb
    .collectionGroup('aiOutreachCalls')
    .where('status', '==', 'scheduled')
    .limit(100)
    .get();

  const results: Array<{ id: string; status: string; message?: string }> = [];

  for (const docSnapshot of snapshot.docs.filter((doc) => {
    const scheduledAt = (doc.data() as { scheduledAt?: string | null }).scheduledAt;
    return scheduledAt && scheduledAt <= now.toISOString();
  }).slice(0, 25)) {
    const data = docSnapshot.data() as AiOutreachCall;
    const agencyId = data.agencyId || getAgencyIdFromCallDoc(docSnapshot.ref.path);
    const call: AiOutreachCall = { ...data, id: data.id || docSnapshot.id, agencyId };

    try {
      const settings = await getAiOutreachSettings(adminDb, agencyId);
      await assertCanCreateAiOutreachCall({
        adminDb,
        agencyId,
        ownerListingId: call.ownerListingId,
        settings,
        excludeCallId: call.id,
      });
      const agencyName = await getAgencyName(adminDb, agencyId);
      const result = await launchAiOutreachCall({ adminDb, callRef: docSnapshot.ref, call, settings, agencyName });
      results.push({ id: call.id, status: result.call.status, message: result.warning || result.message });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Apelul programat nu a putut fi pornit.';
      await failScheduledCall(call, message);
      results.push({ id: call.id, status: 'failed', message });
    }
  }

  return NextResponse.json({ ok: true, processed: results.length, results }, { status: 200 });
}

export async function GET(request: NextRequest) {
  return POST(request);
}
