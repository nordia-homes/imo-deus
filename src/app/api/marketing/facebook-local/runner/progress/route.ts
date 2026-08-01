import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const TERMINAL_GROUP_STATUSES = new Set(['submitted', 'pending_approval', 'skipped', 'uncertain']);

export async function POST(request: NextRequest) {
  try {
    const local = await import('@/lib/facebook-local-server');
    const context = await local.requireFacebookLocalDevice(
      request.headers.get('authorization'),
      request.headers.get('x-imodeus-agency-id'),
      request.headers.get('x-imodeus-device-id')
    );
    const body = await request.json().catch(() => ({})) as {
      jobId?: string;
      leaseToken?: string;
      action?: 'submitting' | 'submitted' | 'skipped' | 'failed' | 'needs_reauthentication';
      message?: string | null;
      code?: string | null;
      currentUrl?: string | null;
    };
    const jobId = String(body.jobId || '');
    const leaseToken = String(body.leaseToken || '');
    if (!jobId || !leaseToken || !body.action) {
      return NextResponse.json({ message: 'Actualizarea jobului este incompleta.' }, { status: 400 });
    }
    const ref = context.adminDb.collection('agencies').doc(context.agencyId)
      .collection(local.FACEBOOK_JOB_COLLECTION).doc(jobId);
    const cooldown = local.randomCooldownIso();
    const result = await context.adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return { status: 404, message: 'Jobul nu mai exista.' };
      const job = { id: snapshot.id, ...snapshot.data() } as Record<string, any>;
      if (job.ownerUid !== context.ownerUid || job.deviceId !== context.deviceId) {
        return { status: 403, message: 'Jobul apartine altui runner.' };
      }
      const connectionRef = context.adminDb.collection('agencies').doc(context.agencyId)
        .collection(local.FACEBOOK_CONNECTION_COLLECTION).doc(String(job.connectionId));
      if (job.leaseToken !== leaseToken) {
        return { status: 409, message: 'Lease-ul jobului a expirat; rezultatul vechi a fost ignorat.' };
      }
      const index = Number(job.currentGroupIndex || 0);
      const groups = Array.isArray(job.groups) ? job.groups.map((group: Record<string, unknown>) => ({ ...group })) : [];
      if (!groups[index]) return { status: 409, message: 'Grupul curent nu mai exista.' };
      const timestamp = new Date().toISOString();

      if (body.action === 'submitting') {
        groups[index] = { ...groups[index], submissionPhase: 'submitting' };
        transaction.set(ref, {
          groups,
          leaseExpiresAt: new Date(Date.now() + local.FACEBOOK_LOCAL_LEASE_MS).toISOString(),
          updatedAt: timestamp,
        }, { merge: true });
        return { status: 200, job: { ...job, groups } };
      }

      if (body.action === 'submitted') {
        groups[index] = {
          ...groups[index],
          status: 'submitted',
          submissionPhase: 'confirmed',
          submittedAt: timestamp,
          errorMessage: null,
          currentUrl: body.currentUrl || null,
        };
      } else if (body.action === 'skipped') {
        groups[index] = {
          ...groups[index],
          status: 'skipped',
          failedAt: timestamp,
          submissionPhase: null,
          errorCode: body.code || null,
          errorMessage: body.message || 'Grupul a fost sarit.',
        };
      } else {
        groups[index] = {
          ...groups[index],
          status: body.action === 'needs_reauthentication' ? 'needs_reauthentication' : 'error',
          failedAt: timestamp,
          submissionPhase: null,
          errorCode: body.code || null,
          errorMessage: body.message || 'Publicarea a esuat.',
        };
        const jobStatus = body.action === 'needs_reauthentication' ? 'needs_reauthentication' : 'error';
        transaction.set(ref, {
          groups,
          status: jobStatus,
          errorMessage: groups[index].errorMessage,
          leaseToken: null,
          leaseExpiresAt: null,
          updatedAt: timestamp,
        }, { merge: true });
        if (body.action === 'needs_reauthentication') {
          transaction.set(connectionRef, {
            status: 'needs_reauthentication',
            lastError: groups[index].errorMessage,
            updatedAt: timestamp,
          }, { merge: true });
        }
        return { status: 200, job: { ...job, groups, status: jobStatus } };
      }

      let nextIndex = index + 1;
      while (nextIndex < groups.length && TERMINAL_GROUP_STATUSES.has(String(groups[nextIndex]?.status))) nextIndex += 1;
      const completed = nextIndex >= groups.length;
      transaction.set(connectionRef, {
        localNextAllowedAt: cooldown,
        updatedAt: timestamp,
      }, { merge: true });

      const updates = {
        groups,
        currentGroupIndex: completed ? groups.length : nextIndex,
        status: completed ? 'completed' : 'cooldown',
        completedAt: completed ? timestamp : null,
        nextRunAt: completed ? null : cooldown,
        errorMessage: null,
        leaseToken: null,
        leaseExpiresAt: null,
        updatedAt: timestamp,
      };
      transaction.set(ref, updates, { merge: true });
      return { status: 200, job: { ...job, ...updates } };
    });
    if (result.status !== 200) {
      return NextResponse.json({ message: result.message }, { status: result.status });
    }
    return NextResponse.json({ job: result.job });
  } catch (error) {
    const { localServerError } = await import('@/lib/facebook-local-server');
    const formatted = localServerError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

