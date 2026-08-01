import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
type Context = { params: Promise<{ connectionId: string }> };

export async function POST(request: NextRequest, routeContext: Context) {
  try {
    const local = await import('@/lib/facebook-local-server');
    const context = await local.requireFacebookLocalDevice(
      request.headers.get('authorization'),
      request.headers.get('x-imodeus-agency-id'),
      request.headers.get('x-imodeus-device-id')
    );
    const { connectionId } = await routeContext.params;
    const ref = context.adminDb.collection('agencies').doc(context.agencyId)
      .collection(local.FACEBOOK_CONNECTION_COLLECTION).doc(connectionId);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.ownerUid !== context.ownerUid || snapshot.data()?.deviceId !== context.deviceId) {
      return NextResponse.json({ message: 'Contul Facebook nu apartine acestui runner.' }, { status: 404 });
    }
    const body = await request.json().catch(() => ({})) as {
      status?: 'connecting' | 'connected' | 'needs_reauthentication' | 'error' | 'disconnected';
      facebookUserId?: string | null;
      displayName?: string | null;
      currentUrl?: string | null;
      lastError?: string | null;
      profileDeleted?: boolean;
    };
    const timestamp = new Date().toISOString();
    const updates = {
      status: body.status || snapshot.data()?.status || 'error',
      facebookUserId: body.facebookUserId || null,
      displayName: body.displayName || snapshot.data()?.displayName || null,
      currentUrl: body.currentUrl || null,
      lastError: body.lastError || null,
      lastVerifiedAt: body.status === 'connected' ? timestamp : snapshot.data()?.lastVerifiedAt || null,
      localProfileDeletedAt: body.profileDeleted ? timestamp : snapshot.data()?.localProfileDeletedAt || null,
      updatedAt: timestamp,
    };
    await ref.set(updates, { merge: true });
    return NextResponse.json({ connection: { id: snapshot.id, ...snapshot.data(), ...updates } });
  } catch (error) {
    const { localServerError } = await import('@/lib/facebook-local-server');
    const formatted = localServerError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

