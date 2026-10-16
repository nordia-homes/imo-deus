import { NextRequest, NextResponse } from 'next/server';
import type { FacebookCloudPublishingJob } from '@/lib/types';


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
    const [{ requireAgencyUserFromBearerToken }, server, { createFacebookJob }] = await Promise.all([
      import('@/lib/firebase-app-hosting'), import('@/lib/facebook-cloud-server'), import('@/lib/facebook-job-create'),
    ]);
    const { uid, agencyId, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const body = await request.json().catch(() => ({}));
    const result = await createFacebookJob(adminDb, agencyId, uid, body, (path, options) => server.facebookRunnerRequest(path, options));
    return NextResponse.json({ job: result.job }, { status: result.created ? 201 : 200 });
  } catch (error) {
    const { formatFacebookCloudError } = await import('@/lib/facebook-cloud-server');
    const formatted = formatFacebookCloudError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}