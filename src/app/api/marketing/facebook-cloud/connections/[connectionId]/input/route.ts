import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
type Context = { params: Promise<{ connectionId: string }> };

export async function POST(request: NextRequest, context: Context) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { getOwnedConnection, facebookRunnerRequest }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/facebook-cloud-server'),
    ]);
    const { uid, agencyId, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const { connectionId } = await context.params;
    await getOwnedConnection(adminDb, agencyId, uid, connectionId);
    const input = await request.json();
    const result = await facebookRunnerRequest(`/v1/connections/${connectionId}/input`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return NextResponse.json(result);
  } catch (error) {
    const { formatFacebookCloudError } = await import('@/lib/facebook-cloud-server');
    const formatted = formatFacebookCloudError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
