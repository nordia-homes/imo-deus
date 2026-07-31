import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
type Context = { params: Promise<{ connectionId: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { getOwnedConnection, facebookRunnerBinary }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/facebook-cloud-server'),
    ]);
    const { uid, agencyId, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const { connectionId } = await context.params;
    await getOwnedConnection(adminDb, agencyId, uid, connectionId);
    const runnerResponse = await facebookRunnerBinary(`/v1/connections/${connectionId}/snapshot`);
    return new NextResponse(await runnerResponse.arrayBuffer(), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error) {
    const { formatFacebookCloudError } = await import('@/lib/facebook-cloud-server');
    const formatted = formatFacebookCloudError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
