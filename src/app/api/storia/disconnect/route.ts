import { NextRequest, NextResponse } from 'next/server';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : 'A aparut o eroare neasteptata la deconectarea contului Storia.';
    return { status, message };
  }
  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }
  return { status: 500, message: 'A aparut o eroare neasteptata la deconectarea contului Storia.' };
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyAdminFromBearerToken }, { disconnectAgencyStoriaAccount }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/storia'),
    ]);

    const { agencyId } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    if (isDemoAgencyId(agencyId)) {
      return createDemoBlockedResponse('Deconectarea integrarii Storia este blocata in mediul demo.');
    }

    await disconnectAgencyStoriaAccount(agencyId);
    return NextResponse.json({ connected: false }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
