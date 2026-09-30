import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyTokenAgainstAvailableBackends } from '@/lib/firebase-app-hosting';

export const runtime = 'nodejs';

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(8).max(40),
  organizationName: z.string().trim().min(2).max(180),
  organizationType: z.enum(['agency', 'independent']),
  companyTaxId: z.string().trim().max(30).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const header = request.headers.get('authorization');
    if (!header?.startsWith('Bearer ')) return NextResponse.json({ message: 'Autentificare necesară.' }, { status: 401 });
    const { decoded, adminDb } = await verifyTokenAgainstAvailableBackends(header.slice(7));
    if (!decoded.email_verified) return NextResponse.json({ message: 'Verifică adresa de email înainte de activare.' }, { status: 403 });
    const input = schema.parse(await request.json());
    const userRef = adminDb.collection('users').doc(decoded.uid);
    const now = new Date().toISOString();
    await adminDb.runTransaction(async tx => {
      const user = await tx.get(userRef);
      if (user.data()?.agencyId || user.data()?.role === 'platform_admin' || user.data()?.accountType === 'collaborator_only' || user.data()?.collaborationOrganizationId || user.data()?.collaborationStatus === 'suspended') {
        throw new Error('Contul este deja asociat unei organizații sau este suspendat.');
      }
      tx.set(userRef, { name: input.name, email: decoded.email || '', phone: input.phone, organizationName: input.organizationName, collaborationOrganizationId: decoded.uid, accountType: 'collaborator_only', role: 'collaborator', collaborationStatus: 'active', updatedAt: now }, { merge: true });
      tx.set(adminDb.collection('collaborationOrganizations').doc(decoded.uid), { id: decoded.uid, ownerUid: decoded.uid, name: input.organizationName, type: input.organizationType, companyTaxId: input.companyTaxId || '', status: 'active', createdAt: now, updatedAt: now }, { merge: true });
      tx.set(adminDb.collection('collaborationOrganizations').doc(decoded.uid).collection('members').doc(decoded.uid), { uid: decoded.uid, email: decoded.email || '', name: input.name, role: 'admin', status: 'active', joinedAt: now }, { merge: true });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Onboardingul nu a putut fi finalizat.' }, { status: 400 });
  }
}
