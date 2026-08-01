import { NextRequest, NextResponse } from 'next/server';
import type { FacebookCloudConnection } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { formatFacebookCloudError }] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/facebook-cloud-server'),
    ]);
    const { uid, agencyId, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const [connectionsSnapshot, userSnapshot] = await Promise.all([
      adminDb.collection('agencies').doc(agencyId).collection('facebookCloudConnections').where('ownerUid', '==', uid).get(),
      adminDb.collection('users').doc(uid).get(),
    ]);
    const connections = connectionsSnapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }) as FacebookCloudConnection)
      .filter((connection) => !connection.deletedAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return NextResponse.json({
      connections,
      defaultConnectionId: userSnapshot.data()?.defaultFacebookCloudConnectionId || null,
    });
  } catch (error) {
    const { formatFacebookCloudError } = await import('@/lib/facebook-cloud-server');
    const formatted = formatFacebookCloudError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, { facebookRunnerRequest }, local] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/facebook-cloud-server'),
      import('@/lib/facebook-local-server'),
    ]);
    const { uid, agencyId, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const body = await request.json().catch(() => ({})) as {
      label?: string;
      runnerMode?: 'cloud' | 'local';
      deviceId?: string | null;
    };
    const label = String(body.label || '').trim().slice(0, 80) || 'Cont Facebook';
    const runnerMode = body.runnerMode === 'local' ? 'local' : 'cloud';
    const deviceId = runnerMode === 'local' ? String(body.deviceId || '') : '';
    if (runnerMode === 'local') {
      const deviceSnapshot = await adminDb.collection('agencies').doc(agencyId)
        .collection(local.FACEBOOK_LOCAL_DEVICE_COLLECTION).doc(deviceId).get();
      if (!deviceSnapshot.exists || deviceSnapshot.data()?.ownerUid !== uid || deviceSnapshot.data()?.revokedAt) {
        return NextResponse.json({
          message: 'Runnerul local trebuie activat pe laptop inainte de conectarea contului.',
        }, { status: 409 });
      }
    }
    const ref = adminDb.collection('agencies').doc(agencyId).collection('facebookCloudConnections').doc();
    const timestamp = new Date().toISOString();
    const connection: FacebookCloudConnection = {
      id: ref.id,
      agencyId,
      ownerUid: uid,
      label,
      status: 'connecting',
      runnerMode,
      deviceId: runnerMode === 'local' ? deviceId : null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await ref.set(connection);
    if (runnerMode === 'cloud') {
      try {
      await facebookRunnerRequest(`/v1/connections/${ref.id}/open`, {
        method: 'POST',
        body: JSON.stringify({ agencyId, ownerUid: uid, label }),
      });
    } catch (runnerError) {
      await ref.set({
        status: 'error',
        lastError: runnerError instanceof Error ? runnerError.message : 'Runner indisponibil.',
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      throw runnerError;
      }
    }
    return NextResponse.json({
      connection,
      connectHref: `/marketing/facebook-accounts/${ref.id}/connect`,
    }, { status: 201 });
  } catch (error) {
    const { formatFacebookCloudError } = await import('@/lib/facebook-cloud-server');
    const formatted = formatFacebookCloudError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
