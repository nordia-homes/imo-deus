import { NextRequest, NextResponse } from 'next/server';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : 'A aparut o eroare neasteptata la deconectarea contului imobiliare.ro.';
    return { status, message };
  }
  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }
  return { status: 500, message: 'A aparut o eroare neasteptata la deconectarea contului imobiliare.ro.' };
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyAdminFromBearerToken }, { disconnectAgencyImobiliareAccount }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/imobiliare'),
    ]);

    const { agencyId } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));

    if (isDemoAgencyId(agencyId)) {
      return createDemoBlockedResponse('Deconectarea integrarii imobiliare.ro este blocata in mediul demo.');
    }

    await disconnectAgencyImobiliareAccount(agencyId);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
