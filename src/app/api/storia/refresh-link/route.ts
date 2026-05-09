import { NextRequest, NextResponse } from 'next/server';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : 'A aparut o eroare neasteptata la resincronizarea linkului Storia.';
    return { status, message };
  }
  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }
  return { status: 500, message: 'A aparut o eroare neasteptata la resincronizarea linkului Storia.' };
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { refreshPropertyStoriaPublicUrl }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/storia'),
    ]);

    const { agencyId } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (!agencyId) {
      return NextResponse.json({ message: 'Utilizatorul nu este asociat unei agentii.' }, { status: 403 });
    }
    if (isDemoAgencyId(agencyId)) {
      return createDemoBlockedResponse('Linkurile publice din Storia nu sunt disponibile in mediul demo.');
    }

    const body = await request.json().catch(() => ({}));
    const propertyId = typeof body?.propertyId === 'string' ? body.propertyId.trim() : '';
    if (!propertyId) {
      return NextResponse.json({ message: 'Lipseste propertyId.' }, { status: 400 });
    }

    const result = await refreshPropertyStoriaPublicUrl({ agencyId, propertyId });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
