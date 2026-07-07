import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : 'A aparut o eroare la joburile video.';
    return { status, message };
  }
  if (error instanceof Error) return { status: 500, message: error.message };
  return { status: 500, message: 'A aparut o eroare la joburile video.' };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ propertyId: string }> }
) {
  try {
    const [{ propertyId }, { requireAgencyUserFromBearerToken }, { getPropertyVideoTourJobs }] = await Promise.all([
      context.params,
      import('@/lib/firebase-app-hosting'),
      import('@/lib/property-video-tours'),
    ]);
    const authContext = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const jobs = await getPropertyVideoTourJobs(authContext.adminDb, authContext.agencyId, propertyId);
    return NextResponse.json({ jobs }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ propertyId: string }> }
) {
  try {
    const [{ propertyId }, { requireAgencyUserFromBearerToken }, { createPropertyVideoTourJob }] = await Promise.all([
      context.params,
      import('@/lib/firebase-app-hosting'),
      import('@/lib/property-video-tours'),
    ]);
    const authContext = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const body = await request.json().catch(() => ({}));
    const job = await createPropertyVideoTourJob({
      adminDb: authContext.adminDb,
      agencyId: authContext.agencyId,
      propertyId,
      requestedByUid: authContext.uid,
      format: body.format,
      style: body.style,
      quality: body.quality,
      targetDurationSeconds: body.targetDurationSeconds,
      includeText: body.includeText,
      includeBranding: body.includeBranding,
      includeMusic: body.includeMusic,
    });
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
