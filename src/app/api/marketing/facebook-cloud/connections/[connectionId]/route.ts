import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

type Context = { params: Promise<{ connectionId: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { getOwnedConnection }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/facebook-cloud-server'),
    ]);
    const { uid, agencyId, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const { connectionId } = await context.params;
    const { ref, connection } = await getOwnedConnection(adminDb, agencyId, uid, connectionId);
    const body = await request.json().catch(() => ({})) as { label?: string; setDefault?: boolean };
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (typeof body.label === 'string' && body.label.trim()) updates.label = body.label.trim().slice(0, 80);
    await ref.set(updates, { merge: true });
    if (body.setDefault === true) {
      await adminDb.collection('users').doc(uid).set({
        defaultFacebookCloudConnectionId: connection.id,
      }, { merge: true });
    }
    return NextResponse.json({
      connection: { ...connection, ...updates },
      defaultConnectionId: body.setDefault ? connection.id : undefined,
    });
  } catch (error) {
    const { formatFacebookCloudError } = await import('@/lib/facebook-cloud-server');
    const formatted = formatFacebookCloudError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { getOwnedConnection, facebookRunnerRequest }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/facebook-cloud-server'),
    ]);
    const { uid, agencyId, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const { connectionId } = await context.params;
    const { ref } = await getOwnedConnection(adminDb, agencyId, uid, connectionId);
    await facebookRunnerRequest(`/v1/connections/${connectionId}`, { method: 'DELETE' });

    const propertiesSnapshot = await adminDb
      .collection('agencies').doc(agencyId).collection('properties')
      .where('defaultFacebookConnectionId', '==', connectionId)
      .get();
    const batch = adminDb.batch();
    propertiesSnapshot.docs.forEach((propertyDoc) => {
      batch.update(propertyDoc.ref, { defaultFacebookConnectionId: null });
    });
    batch.delete(ref);
    await batch.commit();

    const userRef = adminDb.collection('users').doc(uid);
    const userSnapshot = await userRef.get();
    if (userSnapshot.data()?.defaultFacebookCloudConnectionId === connectionId) {
      await userRef.set({ defaultFacebookCloudConnectionId: null }, { merge: true });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { formatFacebookCloudError } = await import('@/lib/facebook-cloud-server');
    const formatted = formatFacebookCloudError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
