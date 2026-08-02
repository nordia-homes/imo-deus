import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';

export const runtime = 'nodejs';

const TERMINAL_GROUP_STATUSES = new Set(['submitted', 'pending_approval', 'skipped', 'uncertain']);

function normalizePropertyImageUrl(value: unknown) {
  const objectUrl = value && typeof value === 'object'
    ? (value as { url?: unknown }).url
    : null;
  const candidate = (typeof value === 'string' ? value : typeof objectUrl === 'string' ? objectUrl : '').trim();
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const local = await import('@/lib/facebook-local-server');
    const context = await local.requireFacebookLocalDevice(
      request.headers.get('authorization'),
      request.headers.get('x-imodeus-agency-id'),
      request.headers.get('x-imodeus-device-id')
    );
    const jobsCollection = context.adminDb.collection('agencies').doc(context.agencyId)
      .collection(local.FACEBOOK_JOB_COLLECTION);
    const snapshot = await jobsCollection.where('deviceId', '==', context.deviceId).get();
    const candidates = snapshot.docs
      .map((doc): { ref: typeof doc.ref; id: string } & Record<string, any> => ({ ref: doc.ref, id: doc.id, ...doc.data() }))
      .filter((job) => job.ownerUid === context.ownerUid
        && job.runnerMode === 'local'
        && ['scheduled', 'queued', 'running', 'cooldown'].includes(String(job.status))
        && local.localJobReadyAt(job) <= Date.now())
      .sort((a, b) => {
        const byReady = local.localJobReadyAt(a) - local.localJobReadyAt(b);
        return byReady || String(a.createdAt).localeCompare(String(b.createdAt));
      });

    for (const candidate of candidates) {
      const claimed = await context.adminDb.runTransaction<Record<string, any> | null>(async (transaction) => {
        const currentSnapshot = await transaction.get(candidate.ref);
        if (!currentSnapshot.exists) return null;
        const job = { id: currentSnapshot.id, ...currentSnapshot.data() } as Record<string, any>;
        const connectionRef = context.adminDb.collection('agencies').doc(context.agencyId)
          .collection(local.FACEBOOK_CONNECTION_COLLECTION).doc(String(job.connectionId));
        const connectionSnapshot = await transaction.get(connectionRef);
        const accountNextAllowedAt = connectionSnapshot.data()?.localNextAllowedAt;
        if (accountNextAllowedAt && new Date(accountNextAllowedAt).getTime() > Date.now()) {
          return null;
        }
        if (job.ownerUid !== context.ownerUid || job.deviceId !== context.deviceId || job.runnerMode !== 'local') return null;
        if (!['scheduled', 'queued', 'running', 'cooldown'].includes(String(job.status))) return null;
        if (local.localJobReadyAt(job) > Date.now()) return null;

        const leaseActive = job.leaseToken
          && job.leaseExpiresAt
          && new Date(job.leaseExpiresAt).getTime() > Date.now();
        if (leaseActive) return null;

        const groups = Array.isArray(job.groups) ? job.groups.map((group: Record<string, unknown>) => ({ ...group })) : [];
        let index = Math.max(0, Number(job.currentGroupIndex || 0));
        while (index < groups.length && TERMINAL_GROUP_STATUSES.has(String(groups[index]?.status))) index += 1;

        if (index < groups.length && groups[index]?.status === 'publishing') {
          if (groups[index]?.submissionPhase === 'submitting') {
            groups[index] = {
              ...groups[index],
              status: 'uncertain',
              failedAt: new Date().toISOString(),
              errorMessage: 'Publicarea a fost intrerupta dupa apasarea butonului Publica; nu este repetata pentru a evita un duplicat.',
            };
            index += 1;
            while (index < groups.length && TERMINAL_GROUP_STATUSES.has(String(groups[index]?.status))) index += 1;
          } else {
            groups[index] = { ...groups[index], status: 'queued', submissionPhase: null };
          }
        }

        if (index >= groups.length) {
          const completedAt = new Date().toISOString();
          transaction.set(candidate.ref, {
            groups,
            currentGroupIndex: groups.length,
            status: 'completed',
            completedAt,
            updatedAt: completedAt,
            nextRunAt: null,
            leaseToken: null,
            leaseExpiresAt: null,
          }, { merge: true });
          return null;
        }

        const leaseToken = crypto.randomBytes(24).toString('base64url');
        const claimedAt = new Date().toISOString();
        const leaseExpiresAt = new Date(Date.now() + local.FACEBOOK_LOCAL_LEASE_MS).toISOString();
        groups[index] = {
          ...groups[index],
          status: 'publishing',
          submissionPhase: 'preparing',
          startedAt: groups[index].startedAt || claimedAt,
          attemptCount: Number(groups[index].attemptCount || 0) + 1,
        };
        transaction.set(candidate.ref, {
          groups,
          currentGroupIndex: index,
          status: 'running',
          actualStartedAt: job.actualStartedAt || claimedAt,
          claimedAt,
          leaseToken,
          leaseExpiresAt,
          nextRunAt: null,
          updatedAt: claimedAt,
          errorMessage: null,
        }, { merge: true });
        return { ...job, groups, currentGroupIndex: index, status: 'running', claimedAt, leaseToken, leaseExpiresAt };
      });
      if (!claimed) continue;

      const [propertySnapshot, connectionSnapshot] = await Promise.all([
        context.adminDb.collection('agencies').doc(context.agencyId)
          .collection('properties').doc(String(claimed.propertyId)).get(),
        context.adminDb.collection('agencies').doc(context.agencyId)
          .collection(local.FACEBOOK_CONNECTION_COLLECTION).doc(String(claimed.connectionId)).get(),
      ]);
      if (!propertySnapshot.exists || !connectionSnapshot.exists) {
        return NextResponse.json({
          message: 'Proprietatea sau contul Facebook nu mai exista.',
          jobId: claimed.id,
          leaseToken: claimed.leaseToken,
        }, { status: 409 });
      }
      const property = propertySnapshot.data() || {};
      const connection = connectionSnapshot.data() || {};
      if (connection.status !== 'connected') {
        return NextResponse.json({
          message: 'Contul Facebook necesita reconectare.',
          code: 'NEEDS_REAUTHENTICATION',
          jobId: claimed.id,
          leaseToken: claimed.leaseToken,
        }, { status: 409 });
      }
      return NextResponse.json({
        claim: {
          jobId: claimed.id,
          leaseToken: claimed.leaseToken,
          connectionId: claimed.connectionId,
          groupIndex: claimed.currentGroupIndex,
          group: claimed.groups[claimed.currentGroupIndex],
          property: {
            id: claimed.propertyId,
            title: claimed.propertyTitle || property.title || '',
            description: property.description || '',
            images: Array.isArray(property.images)
              ? property.images.map(normalizePropertyImageUrl)
                .filter((image): image is string => Boolean(image)).slice(0, 16)
              : [],
          },
        },
      });
    }

    return NextResponse.json({ claim: null });
  } catch (error) {
    const { localServerError } = await import('@/lib/facebook-local-server');
    const formatted = localServerError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

