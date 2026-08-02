import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { uid, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const notifications = adminDb.collection('users').doc(uid).collection('notifications');
    let updated = 0;
    for (let page = 0; page < 10; page += 1) {
      const snapshot = await notifications.where('isRead', '==', false).limit(400).get();
      if (snapshot.empty) break;
      const batch = adminDb.batch();
      for (const item of snapshot.docs) {
        batch.update(item.ref, { isRead: true, readAt: FieldValue.serverTimestamp() });
      }
      await batch.commit();
      updated += snapshot.size;
      if (snapshot.size < 400) break;
    }
    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
      ? error.status
      : 500;
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Nu am putut marca notificarile drept citite.' },
      { status },
    );
  }
}
