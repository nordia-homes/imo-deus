import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const INVALID_IMAGE_OBJECT_ERROR = 'Failed to parse URL from [object Object]';

function invalidImageRecovery(job: Record<string, any>) {
  const index = Math.max(0, Number(job.currentGroupIndex || 0));
  const groups = Array.isArray(job.groups) ? job.groups.map((group: Record<string, unknown>) => ({ ...group })) : [];
  const group = groups[index];
  const errorMessage = String(job.errorMessage || group?.errorMessage || '');
  if (job.status !== 'error'
    || job.runnerMode !== 'local'
    || job.mediaUrlFormatRecoveredAt
    || !group
    || group.submissionPhase === 'submitting'
    || errorMessage !== INVALID_IMAGE_OBJECT_ERROR) return null;
  return { groups, index };
}

export async function POST(request: NextRequest) {
  try {
    const local = await import('@/lib/facebook-local-server');
    const context = await local.requireFacebookLocalDevice(
      request.headers.get('authorization'),
      request.headers.get('x-imodeus-agency-id'),
      request.headers.get('x-imodeus-device-id')
    );
    const body = await request.json().catch(() => ({})) as {
      appVersion?: string;
      powerSource?: 'ac' | 'battery' | 'unknown';
      wakeTimersEnabled?: boolean | null;
      nextWakeAt?: string | null;
      lastError?: string | null;
    };
    const timestamp = new Date().toISOString();
    const powerSource = body.powerSource === 'ac' || body.powerSource === 'battery' ? body.powerSource : 'unknown';
    await context.deviceRef.set({
      status: powerSource === 'battery' ? 'on_battery' : body.lastError ? 'error' : 'online',
      appVersion: String(body.appVersion || '').slice(0, 30) || null,
      powerSource,
      wakeTimersEnabled: typeof body.wakeTimersEnabled === 'boolean' ? body.wakeTimersEnabled : null,
      nextWakeAt: body.nextWakeAt || null,
      lastError: body.lastError || null,
      lastSeenAt: timestamp,
      updatedAt: timestamp,
    }, { merge: true });

    const [jobsSnapshot, connectionsSnapshot] = await Promise.all([
      context.adminDb.collection('agencies').doc(context.agencyId)
        .collection(local.FACEBOOK_JOB_COLLECTION)
        .where('deviceId', '==', context.deviceId)
        .get(),
      context.adminDb.collection('agencies').doc(context.agencyId)
        .collection(local.FACEBOOK_CONNECTION_COLLECTION)
        .where('deviceId', '==', context.deviceId)
        .get(),
    ]);
    const recoveredJobIds = new Set<string>();
    await Promise.all(jobsSnapshot.docs.map(async (doc) => {
      const snapshotJob = { id: doc.id, ...doc.data() } as Record<string, any>;
      if (snapshotJob.ownerUid !== context.ownerUid || snapshotJob.deviceId !== context.deviceId
        || !invalidImageRecovery(snapshotJob)) return;
      const didRecover = await context.adminDb.runTransaction(async (transaction) => {
        const currentSnapshot = await transaction.get(doc.ref);
        if (!currentSnapshot.exists) return false;
        const currentJob = { id: currentSnapshot.id, ...currentSnapshot.data() } as Record<string, any>;
        if (currentJob.ownerUid !== context.ownerUid || currentJob.deviceId !== context.deviceId
          || currentJob.runnerMode !== 'local') return false;
        const recovery = invalidImageRecovery(currentJob);
        if (!recovery) return false;
        recovery.groups[recovery.index] = {
          ...recovery.groups[recovery.index],
          status: 'queued',
          submissionPhase: null,
          errorCode: null,
          errorMessage: null,
        };
        transaction.set(doc.ref, {
          groups: recovery.groups,
          status: 'queued',
          errorMessage: null,
          nextRunAt: null,
          leaseToken: null,
          leaseExpiresAt: null,
          mediaUrlFormatRecoveredAt: timestamp,
          updatedAt: timestamp,
        }, { merge: true });
        return true;
      });
      if (didRecover) recoveredJobIds.add(doc.id);
    }));
    const connections = connectionsSnapshot.docs
      .map((doc): Record<string, any> & { id: string } => ({ id: doc.id, ...doc.data() }));
    const accountCooldown = new Map(connections.map((connection) => [
      connection.id,
      connection.localNextAllowedAt ? new Date(connection.localNextAllowedAt).getTime() : 0,
    ]));
    const effectiveReadyAt = (job: Record<string, any>) => Math.max(
      local.localJobReadyAt(job),
      accountCooldown.get(String(job.connectionId)) || 0
    );
    const activeJobs = jobsSnapshot.docs
      .map((doc): Record<string, any> & { id: string } => {
        const job = { id: doc.id, ...doc.data() };
        return recoveredJobIds.has(doc.id) ? { ...job, status: 'queued', nextRunAt: null, errorMessage: null } : job;
      })
      .filter((job) => job.ownerUid === context.ownerUid
        && job.runnerMode === 'local'
        && ['scheduled', 'queued', 'running', 'cooldown'].includes(String(job.status)));
    const future = activeJobs
      .map((job) => effectiveReadyAt(job))
      .filter((value) => Number.isFinite(value) && value > Date.now())
      .sort((a, b) => a - b)[0];
    const dueCount = activeJobs.filter((job) => effectiveReadyAt(job) <= Date.now()).length;
    const commands = connections
      .filter((connection) => connection.ownerUid === context.ownerUid
        && connection.runnerMode === 'local'
        && connection.localProfileDeleteRequestedAt
        && !connection.localProfileDeletedAt)
      .map((connection) => ({ type: 'delete_profile' as const, connectionId: connection.id }));

    return NextResponse.json({
      serverTime: timestamp,
      recoveredCount: recoveredJobIds.size,
      dueCount,
      nextScheduledAt: future ? new Date(future).toISOString() : null,
      commands,
    });
  } catch (error) {
    const { localServerError } = await import('@/lib/facebook-local-server');
    const formatted = localServerError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

