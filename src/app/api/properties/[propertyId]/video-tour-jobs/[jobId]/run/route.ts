import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : 'A aparut o eroare la randarea video.';
    return { status, message };
  }
  if (error instanceof Error) return { status: 500, message: error.message };
  return { status: 500, message: 'A aparut o eroare la randarea video.' };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ propertyId: string; jobId: string }> }
) {
  let routeParams: { propertyId: string; jobId: string } | null = null;
  try {
    const [{ propertyId, jobId }, { requireAgencyUserFromBearerToken }, { runPropertyVideoTourJob }] = await Promise.all([
      context.params,
      import('@/lib/firebase-app-hosting'),
      import('@/lib/property-video-tours'),
    ]);
    routeParams = { propertyId, jobId };
    const authContext = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const job = await runPropertyVideoTourJob({
      adminDb: authContext.adminDb,
      agencyId: authContext.agencyId,
      propertyId,
      jobId,
    });
    return NextResponse.json({ job }, { status: 200 });
  } catch (error) {
    console.error('[property-video-tour-run]', {
      propertyId: routeParams?.propertyId,
      jobId: routeParams?.jobId,
      error,
    });
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
