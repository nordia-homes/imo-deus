import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = typeof (error as { status?: unknown }).status === 'number' ? (error as { status: number }).status : 500;
    const message = error instanceof Error ? error.message : 'A aparut o eroare la citirea statusului Meta.';
    return { status, message };
  }
  if (error instanceof Error) return { status: 500, message: error.message };
  return { status: 500, message: 'A aparut o eroare la citirea statusului Meta.' };
}

export async function GET(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { getMetaMarketingStatus }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/meta-marketing'),
    ]);

    const { agencyId, role } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const status = await getMetaMarketingStatus(agencyId);
    return NextResponse.json({ ...status, role }, { status: 200 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
