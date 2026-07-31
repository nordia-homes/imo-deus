import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
type Context = { params: Promise<{ jobId: string }> };

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
    await facebookRunnerRequest(`/v1/jobs/${jobId}/cancel`, { method: 'POST' });
    await ref.set({ status: 'cancelled', updatedAt: new Date().toISOString() }, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { formatFacebookCloudError } = await import('@/lib/facebook-cloud-server');
    const formatted = formatFacebookCloudError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
