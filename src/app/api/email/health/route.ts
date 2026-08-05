import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { agencyId, uid, adminDb } = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const connectionRef = adminDb.collection('agencies').doc(agencyId).collection('salesEmailConnections').doc(uid);
    const [connectionSnapshot, eventsSnapshot] = await Promise.all([
      connectionRef.get(),
      adminDb.collection('emailInboundEvents').where('connectionPath', '==', connectionRef.path).limit(20).get(),
    ]);
    const connection = connectionSnapshot.data() || null;
    const events: Array<Record<string, any> & { id: string }> = eventsSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
      .sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 5);
    const lastEventAt = events[0]?.createdAt || null;
    return NextResponse.json({
      status: connection?.status === 'connected' ? 'healthy' : connection ? 'setup_required' : 'not_configured',
      capabilities: {
        webhookSecretConfigured: Boolean(process.env.EMAIL_INBOUND_WEBHOOK_SECRET),
        inboundDomainConfigured: Boolean(process.env.EMAIL_INBOUND_DOMAIN),
        externalMalwareScannerConfigured: Boolean(process.env.SALES_DOCUMENT_SCAN_URL),
        ocrEnabled: process.env.SALES_DOCUMENT_OCR_ENABLED === 'true',
      },
      connection: connection ? { status: connection.status, lastForwardedAt: connection.lastForwardedAt || null, updatedAt: connection.updatedAt || null } : null,
      lastEventAt,
      recentEvents: events,
    });
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' ? error.status : 500;
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Starea inbound nu a putut fi verificată.' }, { status });
  }
}
