import { NextRequest, NextResponse } from 'next/server';
import type { FacebookLocalRunnerDevice } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, local] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/facebook-local-server'),
    ]);
    const { uid, agencyId, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const snapshot = await adminDb.collection('agencies').doc(agencyId)
      .collection(local.FACEBOOK_LOCAL_DEVICE_COLLECTION)
      .where('ownerUid', '==', uid)
      .get();
    const devices = snapshot.docs.map((doc) => {
      const device = local.publicDevice(doc.id, doc.data());
      if (!local.isDeviceOnline(device) && device.status === 'online') {
        return { ...device, status: 'offline' as const };
      }
      return device;
    }).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
    return NextResponse.json({ devices });
  } catch (error) {
    const { localServerError } = await import('@/lib/facebook-local-server');
    const formatted = localServerError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const [{ requireAgencyUserFromBearerToken }, local] = await Promise.all([
      import('@/lib/firebase-app-hosting'),
      import('@/lib/facebook-local-server'),
    ]);
    const { uid, agencyId, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const body = await request.json().catch(() => ({})) as {
      deviceId?: string;
      name?: string;
      appVersion?: string;
    };
    const deviceId = String(body.deviceId || '').trim();
    if (!/^[A-Za-z0-9_-]{8,160}$/.test(deviceId)) {
      return NextResponse.json({ message: 'Identificatorul laptopului nu este valid.' }, { status: 400 });
    }
    const collection = adminDb.collection('agencies').doc(agencyId)
      .collection(local.FACEBOOK_LOCAL_DEVICE_COLLECTION);
    const ref = collection.doc(deviceId);
    const existing = await ref.get();
    if (existing.exists && existing.data()?.ownerUid !== uid) {
      return NextResponse.json({ message: 'Acest laptop este asociat altui agent.' }, { status: 409 });
    }

    const token = local.createDeviceToken();
    const timestamp = new Date().toISOString();
    const otherDevices = await collection.where('ownerUid', '==', uid).get();
    const batch = adminDb.batch();
    otherDevices.docs.forEach((doc) => {
      if (doc.id !== deviceId) batch.set(doc.ref, { isPrimary: false, updatedAt: timestamp }, { merge: true });
    });
    const raw = {
      id: deviceId,
      agencyId,
      ownerUid: uid,
      name: String(body.name || 'Laptop Windows').trim().slice(0, 80) || 'Laptop Windows',
      platform: 'windows',
      appVersion: String(body.appVersion || '').slice(0, 30) || null,
      timezone: 'Europe/Bucharest',
      status: 'online',
      isPrimary: true,
      tokenHash: local.hashDeviceToken(token),
      revokedAt: null,
      lastSeenAt: timestamp,
      createdAt: existing.data()?.createdAt || timestamp,
      updatedAt: timestamp,
    };
    batch.set(ref, raw, { merge: true });
    await batch.commit();
    return NextResponse.json({
      device: local.publicDevice(deviceId, raw),
      deviceToken: token,
    }, { status: existing.exists ? 200 : 201 });
  } catch (error) {
    const { localServerError } = await import('@/lib/facebook-local-server');
    const formatted = localServerError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

