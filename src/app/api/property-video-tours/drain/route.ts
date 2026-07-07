import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/firebase/admin';

export const runtime = 'nodejs';
export const maxDuration = 300;

function isAuthorizedCron(request: NextRequest) {
  const expected = process.env.PROPERTY_VIDEO_TOUR_CRON_SECRET || process.env.OWNER_LISTINGS_FUNCTIONS_CRON_SECRET;
  if (!expected) return false;
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  return bearer === expected;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorizedCron(request)) {
      return NextResponse.json({ message: 'Neautorizat.' }, { status: 401 });
    }
    const { drainPropertyVideoTourJobs } = await import('@/lib/property-video-tours');
    const body = await request.json().catch(() => ({}));
    const result = await drainPropertyVideoTourJobs({
      adminDb,
      agencyId: typeof body.agencyId === 'string' ? body.agencyId : null,
      limit: Number(body.limit) || 1,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Nu am putut procesa coada video.' },
      { status: 500 }
    );
  }
}
