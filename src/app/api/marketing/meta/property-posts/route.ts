import { NextRequest, NextResponse } from 'next/server';
import { createDemoBlockedResponse, isDemoAgencyId } from '@/lib/demo/guards';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : 'A aparut o eroare la publicarea pe Facebook.';
    return { status, message };
  }
  if (error instanceof Error) return { status: 500, message: error.message };
  return { status: 500, message: 'A aparut o eroare la publicarea pe Facebook.' };
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { publishPropertyToFacebookPage }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/meta-marketing'),
    ]);

    const { agencyId, uid, role } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (role !== 'admin') {
      return NextResponse.json({ message: 'Doar administratorii agentiei pot publica pe pagina Facebook.' }, { status: 403 });
    }
    if (isDemoAgencyId(agencyId)) {
      return createDemoBlockedResponse('Publicarea pe Facebook este blocata in mediul demo.');
    }

    const body = await request.json().catch(() => ({}));
    const propertyId = typeof body.propertyId === 'string' ? body.propertyId : '';
    if (!propertyId) {
      return NextResponse.json({ message: 'propertyId lipseste.' }, { status: 400 });
    }

    const post = await publishPropertyToFacebookPage({
      agencyId,
      propertyId,
      requestedByUid: uid,
    });

    return NextResponse.json({ post }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
