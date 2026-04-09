import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : 'A aparut o eroare neasteptata la retry job pentru imobiliare.ro.';
    return { status, message };
  }
  if (error instanceof Error) {
    return { status: 500, message: error.message };
  }
  return { status: 500, message: 'A aparut o eroare neasteptata la retry job pentru imobiliare.ro.' };
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyAdminFromBearerToken }, { retryAgencyImobiliareSync }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/imobiliare'),
    ]);

    const { agencyId, uid } = await requireAgencyAdminFromBearerToken(request.headers.get('authorization'));
    const body = await request.json().catch(() => ({}));
    const limit = typeof body?.limit === 'number' && Number.isFinite(body.limit) ? body.limit : 10;
    const result = await retryAgencyImobiliareSync({ agencyId, requestedByUid: uid, limit });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
