import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/firebase/admin';
import { requirePlatformAdminFromBearerToken } from '@/lib/firebase-app-hosting';

export const runtime = 'nodejs';

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('reset-frontier-job'),
    jobId: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal('pause-frontier-job'),
    jobId: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal('resume-frontier-job'),
    jobId: z.string().trim().min(1),
  }),
  z.object({
    action: z.literal('rerun-scope-frontier'),
    scopeKey: z.string().trim().min(1),
  }),
]);

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    return {
      status,
      message: error instanceof Error ? error.message : 'Actiunea de scraping a esuat.',
    };
  }

  if (error instanceof z.ZodError) {
    return {
      status: 400,
      message: error.issues[0]?.message || 'Payload invalid pentru actiunea de scraping.',
    };
  }

  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }

  return { status: 500, message: 'Actiunea de scraping a esuat.' };
}

function nowIso() {
  return new Date().toISOString();
}

async function resetFrontierJob(jobId: string) {
  const timestamp = nowIso();
  await adminDb.collection('ownerListingScrapeFrontier').doc(jobId).set(
    {
      status: 'pending',
      nextPage: 1,
      consecutiveEmptyPages: 0,
      consecutiveDuplicateHeavyPages: 0,
      lastError: FieldValue.delete(),
      lockedAt: FieldValue.delete(),
      lockedBy: FieldValue.delete(),
      nextRunAt: timestamp,
      updatedAt: timestamp,
      firestoreUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function pauseFrontierJob(jobId: string) {
  const timestamp = nowIso();
  await adminDb.collection('ownerListingScrapeFrontier').doc(jobId).set(
    {
      status: 'cooldown',
      nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      lockedAt: FieldValue.delete(),
      lockedBy: FieldValue.delete(),
      updatedAt: timestamp,
      firestoreUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function resumeFrontierJob(jobId: string) {
  const timestamp = nowIso();
  await adminDb.collection('ownerListingScrapeFrontier').doc(jobId).set(
    {
      status: 'pending',
      nextRunAt: timestamp,
      lockedAt: FieldValue.delete(),
      lockedBy: FieldValue.delete(),
      updatedAt: timestamp,
      firestoreUpdatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function rerunScopeFrontier(scopeKey: string) {
  const snapshot = await adminDb.collection('ownerListingScrapeFrontier').where('scopeKey', '==', scopeKey).get();
  const timestamp = nowIso();

  for (let index = 0; index < snapshot.docs.length; index += 400) {
    const batch = adminDb.batch();
    for (const docSnapshot of snapshot.docs.slice(index, index + 400)) {
      batch.set(
        docSnapshot.ref,
        {
          status: 'pending',
          nextPage: 1,
          consecutiveEmptyPages: 0,
          consecutiveDuplicateHeavyPages: 0,
          lastError: FieldValue.delete(),
          lockedAt: FieldValue.delete(),
          lockedBy: FieldValue.delete(),
          nextRunAt: timestamp,
          updatedAt: timestamp,
          firestoreUpdatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }
    await batch.commit();
  }

  return snapshot.size;
}

export async function POST(request: NextRequest) {
  try {
    await requirePlatformAdminFromBearerToken(request.headers.get('authorization'));
    const body = actionSchema.parse(await request.json().catch(() => ({})));

    if (body.action === 'reset-frontier-job') {
      await resetFrontierJob(body.jobId);
      return NextResponse.json({ ok: true, action: body.action, jobId: body.jobId }, { status: 200 });
    }

    if (body.action === 'pause-frontier-job') {
      await pauseFrontierJob(body.jobId);
      return NextResponse.json({ ok: true, action: body.action, jobId: body.jobId }, { status: 200 });
    }

    if (body.action === 'resume-frontier-job') {
      await resumeFrontierJob(body.jobId);
      return NextResponse.json({ ok: true, action: body.action, jobId: body.jobId }, { status: 200 });
    }

    const updated = await rerunScopeFrontier(body.scopeKey);
    return NextResponse.json({ ok: true, action: body.action, scopeKey: body.scopeKey, updated }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
