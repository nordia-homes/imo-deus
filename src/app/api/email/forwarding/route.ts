import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { createInboundToken, hashInboundToken } from '@/lib/sales-inbound';

export const runtime = 'nodejs';

function formatError(error: unknown) {
  const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' ? error.status : 500;
  return { status, message: error instanceof Error ? error.message : 'Configurarea forwardingului a eșuat.' };
}

export async function GET(request: NextRequest) {
  try {
    const { agencyId, uid, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const snapshot = await adminDb.collection('agencies').doc(agencyId).collection('salesEmailConnections').doc(uid).get();
    return NextResponse.json({ connection: snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { agencyId, uid, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const connectionRef = adminDb.collection('agencies').doc(agencyId).collection('salesEmailConnections').doc(uid);
    const existing = await connectionRef.get();
    if (existing.exists && existing.data()?.inboundAddress) {
      return NextResponse.json({ connection: { id: existing.id, ...existing.data() } });
    }
    const token = createInboundToken();
    const tokenHash = hashInboundToken(token);
    const domain = String(process.env.EMAIL_INBOUND_DOMAIN || 'reply.imodeus.ro').trim().toLowerCase();
    const inboundAddress = `inbox+${token}@${domain}`;
    const now = new Date().toISOString();
    const connection = {
      agencyId,
      ownerUid: uid,
      inboundAddress,
      status: 'awaiting_gmail_verification',
      verificationCode: null,
      verificationMessageReceivedAt: null,
      lastForwardedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const batch = adminDb.batch();
    batch.set(connectionRef, connection);
    batch.set(adminDb.collection('emailInboundAliases').doc(tokenHash), {
      agencyId,
      ownerUid: uid,
      connectionPath: connectionRef.path,
      active: true,
      createdAt: now,
    });
    await batch.commit();
    return NextResponse.json({ connection: { id: uid, ...connection } }, { status: 201 });
  } catch (error) {
    const formatted = formatError(error);
    return NextResponse.json({ message: formatted.message }, { status: formatted.status });
  }
}
