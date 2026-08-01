import { NextRequest, NextResponse } from 'next/server';
import type { FacebookCloudPublishingJob, FacebookGroup, Property } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { facebookRunnerRequest }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/facebook-cloud-server'),
    ]);
    const { uid, agencyId, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const propertyId = request.nextUrl.searchParams.get('propertyId');
    let query = adminDb.collection('agencies').doc(agencyId).collection('facebookCloudPublishingJobs')
      .where('ownerUid', '==', uid);
    const snapshot = await query.get();
    const jobDocs = snapshot.docs
      .map((doc) => ({ doc, job: { id: doc.id, ...doc.data() } as FacebookCloudPublishingJob }))
      .filter(({ job }) => !propertyId || job.propertyId === propertyId)
      .sort((a, b) => b.job.createdAt.localeCompare(a.job.createdAt))
      .slice(0, 250);
    const reconciled = new Map<string, FacebookCloudPublishingJob>();
    await Promise.allSettled(jobDocs
      .filter(({ job }) => (
        job.runnerMode !== 'local'
        && ['scheduled', 'queued', 'running', 'cooldown', 'needs_reauthentication'].includes(job.status)))
      .map(async ({ doc, job }) => {
        const result = await facebookRunnerRequest<{ job: FacebookCloudPublishingJob }>(`/v1/jobs/${job.id}`);
        const merged = { ...job, ...result.job };
        reconciled.set(job.id, merged);
        await doc.ref.set(result.job, { merge: true });
      }));
    const jobs = jobDocs.map(({ job }) => reconciled.get(job.id) || job);
    return NextResponse.json({ jobs });
  } catch (error) {
    const { formatFacebookCloudError } = await import('@/lib/facebook-cloud-server');
    const formatted = formatFacebookCloudError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, server] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/facebook-cloud-server'),
    ]);
    const { uid, agencyId, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const body = await request.json().catch(() => ({})) as {
      propertyId?: string;
      connectionId?: string;
      groupUrls?: string[];
      scheduledAt?: string | null;
    };
    const propertyId = String(body.propertyId || '');
    const connectionId = String(body.connectionId || '');
    const groupUrls = Array.from(new Set(Array.isArray(body.groupUrls) ? body.groupUrls.map(String) : []));
    const requestedSchedule = body.scheduledAt ? new Date(String(body.scheduledAt)) : null;
    const scheduledAt = requestedSchedule && !Number.isNaN(requestedSchedule.getTime())
      ? requestedSchedule.toISOString()
      : null;
    if (body.scheduledAt && !scheduledAt) {
      return NextResponse.json({ message: 'Data programării nu este validă.' }, { status: 400 });
    }
    if (scheduledAt && new Date(scheduledAt).getTime() < Date.now() + 60_000) {
      return NextResponse.json({ message: 'Alege o oră cu cel puțin un minut în viitor.' }, { status: 400 });
    }
    if (scheduledAt && new Date(scheduledAt).getTime() > Date.now() + 366 * 24 * 60 * 60 * 1000) {
      return NextResponse.json({ message: 'Programarea nu poate depăși un an.' }, { status: 400 });
    }
    if (!propertyId || !connectionId || !groupUrls.length) {
      return NextResponse.json({ message: 'Selectează contul și cel puțin un grup Facebook.' }, { status: 400 });
    }

    const { connection } = await server.getOwnedConnection(adminDb, agencyId, uid, connectionId);
    if (connection.status !== 'connected') {
      return NextResponse.json({ message: 'Contul Facebook trebuie reconectat înainte de publicare.' }, { status: 409 });
    }
    if (connection.runnerMode === 'local') {
      const deviceId = String(connection.deviceId || '');
      const deviceSnapshot = await adminDb.collection('agencies').doc(agencyId)
        .collection('facebookLocalRunnerDevices').doc(deviceId).get();
      if (!deviceSnapshot.exists || deviceSnapshot.data()?.ownerUid !== uid || deviceSnapshot.data()?.revokedAt) {
        return NextResponse.json({
          message: 'Laptopul asociat contului Facebook nu mai este inregistrat.',
        }, { status: 409 });
      }
    }

    const [propertySnapshot, agencySnapshot] = await Promise.all([
      adminDb.collection('agencies').doc(agencyId).collection('properties').doc(propertyId).get(),
      adminDb.collection('agencies').doc(agencyId).get(),
    ]);
    if (!propertySnapshot.exists) {
      return NextResponse.json({ message: 'Proprietatea nu a fost găsită.' }, { status: 404 });
    }
    const property = { id: propertySnapshot.id, ...propertySnapshot.data() } as Property;
    const agencyGroups = (agencySnapshot.data()?.facebookGroups || []) as FacebookGroup[];
    const groups = groupUrls.map((url) => agencyGroups.find((group) => group.url === url)).filter(Boolean) as FacebookGroup[];
    if (groups.length !== groupUrls.length) {
      return NextResponse.json({ message: 'Unul dintre grupurile selectate nu mai este configurat în agenție.' }, { status: 400 });
    }

    const existingJobsSnapshot = await adminDb.collection('agencies').doc(agencyId)
      .collection('facebookCloudPublishingJobs')
      .where('ownerUid', '==', uid)
      .get();
    const duplicate = existingJobsSnapshot.docs.some((jobDoc) => {
      const existingJob = jobDoc.data();
      return existingJob.propertyId === propertyId
        && existingJob.connectionId === connectionId
        && ['scheduled', 'queued', 'running', 'cooldown'].includes(existingJob.status);
    });
    if (duplicate) {
      return NextResponse.json({
        message: 'Această proprietate este deja în curs de publicare cu contul selectat.',
      }, { status: 409 });
    }

    const ref = adminDb.collection('agencies').doc(agencyId).collection('facebookCloudPublishingJobs').doc();
    const timestamp = new Date().toISOString();
    const job: FacebookCloudPublishingJob = {
      id: ref.id,
      agencyId,
      ownerUid: uid,
      connectionId,
      connectionLabel: connection.label || connection.displayName,
      runnerMode: connection.runnerMode === 'local' ? 'local' : 'cloud',
      deviceId: connection.runnerMode === 'local' ? connection.deviceId || null : null,
      propertyId,
      propertyTitle: property.title,
      status: scheduledAt ? 'scheduled' : 'queued',
      groups: groups.map((group) => ({ ...group, status: 'queued' })),
      currentGroupIndex: 0,
      scheduledAt,
      nextRunAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await ref.set(job);
    if (job.runnerMode !== 'local') {
      try {
      const runnerResult = await server.facebookRunnerRequest<{ job: FacebookCloudPublishingJob }>('/v1/jobs', {
        method: 'POST',
        body: JSON.stringify(server.toRunnerJob(job, property, uid)),
      });
      await ref.set(runnerResult.job, { merge: true });
    } catch (runnerError) {
      await ref.set({
        status: 'error',
        errorMessage: runnerError instanceof Error ? runnerError.message : 'Runner indisponibil.',
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      throw runnerError;
      }
    }
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    const { formatFacebookCloudError } = await import('@/lib/facebook-cloud-server');
    const formatted = formatFacebookCloudError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
