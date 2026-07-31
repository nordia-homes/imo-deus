import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
type Context = { params: Promise<{ connectionId: string }> };

async function handle(request: NextRequest, context: Context, open: boolean) {
  const [{ requireAgencyUserFromBearerToken }, { getOwnedConnection, facebookRunnerRequest }] = await Promise.all([
    import('@/lib/firebase-app-hosting'),
    import('@/lib/facebook-cloud-server'),
  ]);
  const { uid, agencyId, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
  const { connectionId } = await context.params;
  const { ref, connection } = await getOwnedConnection(adminDb, agencyId, uid, connectionId);
  const status = await facebookRunnerRequest<{
    status: string;
    facebookUserId?: string | null;
    displayName?: string | null;
    currentUrl?: string | null;
  }>(`/v1/connections/${connectionId}/${open ? 'open' : 'status'}`, open ? {
    method: 'POST',
    body: JSON.stringify({ agencyId, ownerUid: uid, label: connection.label }),
  } : undefined);
  const updatedAt = new Date().toISOString();
  await ref.set({
    status: status.status,
    facebookUserId: status.facebookUserId || null,
    displayName: status.displayName || connection.displayName || null,
    currentUrl: status.currentUrl || null,
    lastVerifiedAt: updatedAt,
    lastError: null,
    updatedAt,
  }, { merge: true });

  if (status.status === 'connected') {
    const jobsSnapshot = await adminDb.collection('agencies').doc(agencyId)
      .collection('facebookCloudPublishingJobs')
      .where('connectionId', '==', connectionId)
      .get();
    const resumableJobs = jobsSnapshot.docs.filter((jobDoc) => {
      const job = jobDoc.data();
      return job.ownerUid === uid && job.status === 'needs_reauthentication';
    });
    for (const jobDoc of resumableJobs) {
      await facebookRunnerRequest(`/v1/jobs/${jobDoc.id}/resume`, { method: 'POST' });
      await jobDoc.ref.set({
        status: 'queued',
        errorMessage: null,
        updatedAt,
      }, { merge: true });
    }
  }
  return { ...connection, ...status, updatedAt };
}

export async function GET(request: NextRequest, context: Context) {
  try {
    return NextResponse.json({ connection: await handle(request, context, false) });
  } catch (error) {
    const { formatFacebookCloudError } = await import('@/lib/facebook-cloud-server');
    const formatted = formatFacebookCloudError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    return NextResponse.json({ connection: await handle(request, context, true) });
  } catch (error) {
    const { formatFacebookCloudError } = await import('@/lib/facebook-cloud-server');
    const formatted = formatFacebookCloudError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
