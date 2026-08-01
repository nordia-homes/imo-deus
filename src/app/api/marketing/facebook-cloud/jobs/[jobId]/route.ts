import { NextRequest, NextResponse } from 'next/server';
import type { FacebookCloudPublishingJob, FacebookGroup } from '@/lib/types';

export const runtime = 'nodejs';
type Context = { params: Promise<{ jobId: string }> };
function validateScheduledAt(value: unknown) {
  const parsed = value ? new Date(String(value)) : null;
  const scheduledAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null;
  if (!scheduledAt) return { message: 'Data programării nu este validă.' };
  const timestamp = new Date(scheduledAt).getTime();
  if (timestamp < Date.now() + 60_000) return { message: 'Alege o oră cu cel puțin un minut în viitor.' };
  if (timestamp > Date.now() + 366 * 24 * 60 * 60 * 1000) return { message: 'Programarea nu poate depăși un an.' };
  return { scheduledAt };
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const [{ requireAgencyUserFromBearerToken }, server] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/facebook-cloud-server'),
    ]);
    const { uid, agencyId, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const { jobId } = await context.params;
    const ref = adminDb.collection('agencies').doc(agencyId).collection('facebookCloudPublishingJobs').doc(jobId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return NextResponse.json({ message: 'Programarea nu a fost găsită.' }, { status: 404 });
    const existing = { id: snapshot.id, ...snapshot.data() } as FacebookCloudPublishingJob;
    if (existing.ownerUid !== uid) {
      return NextResponse.json({ message: 'Nu poți modifica această programare.' }, { status: 403 });
    }
    if (existing.status !== 'scheduled') {
      return NextResponse.json({ message: 'Doar o publicare care nu a început încă poate fi modificată.' }, { status: 409 });
    }

    const body = await request.json().catch(() => ({})) as {
      connectionId?: string;
      groupUrls?: string[];
      scheduledAt?: string;
    };
    const connectionId = String(body.connectionId || '');
    const groupUrls = Array.from(new Set(Array.isArray(body.groupUrls) ? body.groupUrls.map(String) : []));
    const schedule = validateScheduledAt(body.scheduledAt);
    if (!connectionId || !groupUrls.length) {
      return NextResponse.json({ message: 'Selectează contul și cel puțin un grup Facebook.' }, { status: 400 });
    }
    if (!('scheduledAt' in schedule)) {
      return NextResponse.json({ message: schedule.message }, { status: 400 });
    }

    const { connection } = await server.getOwnedConnection(adminDb, agencyId, uid, connectionId);
    if (connection.status !== 'connected') {
      return NextResponse.json({ message: 'Contul Facebook trebuie reconectat înainte de programare.' }, { status: 409 });
    }
    const agencySnapshot = await adminDb.collection('agencies').doc(agencyId).get();
    const agencyGroups = (agencySnapshot.data()?.facebookGroups || []) as FacebookGroup[];
    const groups = groupUrls.map((url) => agencyGroups.find((group) => group.url === url)).filter(Boolean) as FacebookGroup[];
    if (groups.length !== groupUrls.length) {
      return NextResponse.json({ message: 'Unul dintre grupurile selectate nu mai este configurat în agenție.' }, { status: 400 });
    }

    const result = await server.facebookRunnerRequest<{ job: FacebookCloudPublishingJob }>(`/v1/jobs/${jobId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        connectionId,
        groups: groups.map(({ name, url }) => ({ name, url })),
        scheduledAt: schedule.scheduledAt,
      }),
    });
    const job = {
      ...existing,
      ...result.job,
      connectionLabel: connection.label || connection.displayName,
    };
    await ref.set(job, { merge: true });
    return NextResponse.json({ job });
  } catch (error) {
    const { formatFacebookCloudError } = await import('@/lib/facebook-cloud-server');
    const formatted = formatFacebookCloudError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}


export async function DELETE(request: NextRequest, context: Context) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { facebookRunnerRequest }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/facebook-cloud-server'),
    ]);
    const { uid, agencyId, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const { jobId } = await context.params;
    const ref = adminDb.collection('agencies').doc(agencyId).collection('facebookCloudPublishingJobs').doc(jobId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return NextResponse.json({ message: 'Jobul nu a fost găsit.' }, { status: 404 });
    if (snapshot.data()?.ownerUid !== uid) return NextResponse.json({ message: 'Nu poți opri acest job.' }, { status: 403 });
    const result = await facebookRunnerRequest<{ job: FacebookCloudPublishingJob }>(`/v1/jobs/${jobId}/cancel`, {
      method: 'POST',
    });
    await ref.set(result.job, { merge: true });
    return NextResponse.json({ job: { ...snapshot.data(), ...result.job } });
  } catch (error) {
    const { formatFacebookCloudError } = await import('@/lib/facebook-cloud-server');
    const formatted = formatFacebookCloudError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
