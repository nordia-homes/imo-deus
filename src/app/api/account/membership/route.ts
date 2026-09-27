import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { verifyTokenAgainstAvailableBackends } from '@/lib/firebase-app-hosting';
export const runtime = 'nodejs';
const agencyFields = z.object({
  name: z.string().trim().min(1).max(200), agencyDescription: z.string().max(20000).optional(),
  legalCompanyName: z.string().max(300).optional(), companyTaxId: z.string().max(30).optional(),
  tradeRegisterNumber: z.string().max(100).optional(), registeredOffice: z.string().max(1000).optional(),
  legalRepresentative: z.string().max(300).optional(), termsAndConditions: z.string().max(50000).optional(),
  privacyPolicy: z.string().max(50000).optional(), city: z.string().max(200).optional(),
  email: z.string().max(300).optional(), phone: z.string().max(40).optional(), address: z.string().max(1000).optional(),
  logoUrl: z.string().max(2000).optional(), primaryColor: z.string().max(20).optional(),
  themePreset: z.enum(['classic', 'forest', 'agentfinder']).optional(), facebookUrl: z.string().max(2000).optional(),
  instagramUrl: z.string().max(2000).optional(), linkedinUrl: z.string().max(2000).optional(),
});
export async function POST(request: NextRequest) {
  try {
    const bearer = request.headers.get('authorization');
    if (!bearer?.startsWith('Bearer ')) return NextResponse.json({ message: 'Autentificare necesară.' }, { status: 401 });
    const { decoded, adminDb: db } = await verifyTokenAgainstAvailableBackends(bearer.slice(7));
    const body = await request.json();
    const profile = db.collection('users').doc(decoded.uid);
    const result = await db.runTransaction(async tx => {
      const user = await tx.get(profile);
      if (body.action === 'createAgency') {
        if (user.data()?.agencyId || user.data()?.role === 'platform_admin') throw new Error('Contul are deja o apartenență.');
        const values = agencyFields.parse(body.values);
        const ref = db.collection('agencies').doc(decoded.uid); // Stable ID makes retries safe.
        const previous = await tx.get(ref);
        if (previous.exists && previous.data()?.ownerId !== decoded.uid) throw new Error('Agenție indisponibilă.');
        tx.set(ref, { ...values, ownerId: decoded.uid, agentIds: [decoded.uid], billingProvider: 'stripe', billingPlan: 'esential', billingStatus: 'inactive', billingInterval: 'month', billingCurrency: 'EUR', purchasedSeats: 1, seatUsageCount: 1, id: ref.id }, { merge: true });
        tx.set(profile, { agencyId: ref.id, role: 'admin', email: decoded.email || '', name: user.data()?.name || decoded.name || decoded.email || '', photoUrl: decoded.picture || '' }, { merge: true });
        tx.set(db.collection('publicAgentProfiles').doc(decoded.uid), { agencyId: ref.id, name: user.data()?.name || decoded.name || '', email: decoded.email || '', photoUrl: decoded.picture || '', updatedAt: new Date().toISOString() }, { merge: true });
        return { agencyId: ref.id };
      }
      if (body.action === 'repairOwner') {
        const agencyId = z.string().min(1).max(200).parse(body.agencyId);
        const agency = await tx.get(db.collection('agencies').doc(agencyId));
        if (!agency.exists || agency.data()?.ownerId !== decoded.uid || (user.data()?.agencyId && user.data()?.agencyId !== agencyId) || user.data()?.role === 'platform_admin') throw new Error('Apartenența nu poate fi modificată.');
        tx.set(profile, { agencyId, role: 'admin' }, { merge: true });
        tx.update(agency.ref, { agentIds: FieldValue.arrayUnion(decoded.uid) }); return { agencyId };
      }
      if (body.action !== 'acceptInvite') throw new Error('Acțiune invalidă.');
      if (!decoded.email || !decoded.email_verified) throw new Error('Verifică adresa de email înainte să accepți invitația.');
      if (user.data()?.role === 'platform_admin') throw new Error('Contul nu poate accepta invitații.');
      const inviteRef = db.collection('invites').doc(Buffer.from(decoded.email).toString('base64'));
      const invite = await tx.get(inviteRef); const value = invite.data();
      if (!value) return { accepted: false };
      if (value.email && String(value.email).toLowerCase() !== decoded.email.toLowerCase()) throw new Error('Invitație invalidă.');
      if (!['admin', 'agent'].includes(value.role)) throw new Error('Rol invalid în invitație.');
      if (user.data()?.agencyId && user.data()?.agencyId !== value.agencyId) throw new Error('Contul aparține deja altei agenții.');
      const agency = await tx.get(db.collection('agencies').doc(value.agencyId));
      if (!agency.exists) throw new Error('Agenția nu mai există.');
      const ids: string[] = agency.data()?.agentIds || [];
      tx.set(profile, { agencyId: value.agencyId, role: value.role, agencyName: value.agencyName || '', email: decoded.email }, { merge: true });
      tx.update(agency.ref, { agentIds: FieldValue.arrayUnion(decoded.uid), seatUsageCount: ids.includes(decoded.uid) ? agency.data()?.seatUsageCount || ids.length : (agency.data()?.seatUsageCount || ids.length) + 1 });
      tx.delete(inviteRef); return { accepted: true, agencyId: value.agencyId };
    });
    return NextResponse.json(result);
  } catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : 'Apartenența nu a putut fi actualizată.' }, { status: 400 }); }
}
