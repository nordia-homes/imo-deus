import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : 'A aparut o eroare neasteptata la publicarea in imobiliare.ro.';
    const details = 'payload' in error ? (error as { payload?: unknown }).payload : null;
    return { status, message, details };
  }
  if (error instanceof Error) {
    return { status: 500, message: error.message, details: null };
  }
  return { status: 500, message: 'A aparut o eroare neasteptata la publicarea in imobiliare.ro.', details: null };
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { publishPropertyToImobiliare }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/imobiliare'),
    ]);

    const { agencyId, uid } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const body = await request.json().catch(() => ({}));
    const propertyId = typeof body?.propertyId === 'string' ? body.propertyId.trim() : '';

    if (!propertyId) {
      return NextResponse.json({ message: 'Lipseste proprietatea pentru publicare.' }, { status: 400 });
    }

    const result = await publishPropertyToImobiliare({
      agencyId,
      propertyId,
      requestedByUid: uid,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message, details: formatted.details }, { status: formatted.status });
  }
}
