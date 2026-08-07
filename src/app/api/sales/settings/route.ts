import { NextRequest, NextResponse } from 'next/server';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';

export const runtime = 'nodejs';

const defaults = { id: 'default', inboundProvider: 'generic', attachmentRetentionDays: 365, completedSaleRetentionDays: 1825, ocrEnabled: false, malwareScanRequired: false, dailyDigestHour: 8 };

function errorResponse(error: unknown, fallback: string) {
  const status = error && typeof error === 'object' && 'status' in error && typeof error.status === 'number' ? error.status : 500;
  return NextResponse.json({ message: error instanceof Error ? error.message : fallback }, { status });
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    const snapshot = await auth.adminDb.collection('agencies').doc(auth.agencyId).collection('salesSettings').doc('default').get();
    return NextResponse.json({ settings: { ...defaults, ...(snapshot.data() || {}) } });
  } catch (error) {
    return errorResponse(error, 'Setările nu au putut fi citite.');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
    if (auth.role !== 'admin' && auth.role !== 'platform_admin') return NextResponse.json({ message: 'Doar administratorul poate schimba setările.' }, { status: 403 });
    const input = await request.json() as Record<string, unknown>;
    const integer = (key: string, fallback: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(Number(input[key])) ? Math.round(Number(input[key])) : fallback));
    const settings = {
      inboundProvider: ['generic', 'mailgun', 'sendgrid'].includes(String(input.inboundProvider)) ? input.inboundProvider : 'generic',
      attachmentRetentionDays: integer('attachmentRetentionDays', 365, 30, 3650),
      completedSaleRetentionDays: integer('completedSaleRetentionDays', 1825, 365, 3650),
      ocrEnabled: input.ocrEnabled === true,
      malwareScanRequired: input.malwareScanRequired === true,
      dailyDigestHour: integer('dailyDigestHour', 8, 0, 23),
      updatedAt: new Date().toISOString(),
      updatedByUid: auth.uid,
    };
    const settingsRef = auth.adminDb.collection('agencies').doc(auth.agencyId).collection('salesSettings').doc('default');
    const activeSales = await auth.adminDb.collection('agencies').doc(auth.agencyId).collection('sales').where('stage', 'in', ['preparing', 'reservation', 'precontract', 'contract', 'documents', 'notary_scheduling', 'ready_to_sign']).limit(400).get();
    const batch = auth.adminDb.batch();
    batch.set(settingsRef, settings, { merge: true });
    for (const sale of activeSales.docs) batch.set(sale.ref, { retentionPolicy: { attachmentRetentionDays: settings.attachmentRetentionDays, completedSaleRetentionDays: settings.completedSaleRetentionDays }, updatedAt: settings.updatedAt }, { merge: true });
    await batch.commit();
    return NextResponse.json({ settings: { id: 'default', ...settings } });
  } catch (error) {
    return errorResponse(error, 'Setările nu au putut fi salvate.');
  }
}
