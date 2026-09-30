import { randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { actorFromBearer, CollaborationError } from '@/lib/collaboration/server';
import { adminDb } from '@/firebase/admin';
import { verifyTokenAgainstAvailableBackends } from '@/lib/firebase-app-hosting';

export const runtime = 'nodejs';

function fail(error: unknown) { return NextResponse.json({ message: error instanceof Error ? error.message : 'Cererea nu a putut fi procesată.' }, { status: error instanceof CollaborationError ? error.status : 400 }); }

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (token) {
      if (!/^[A-Za-z0-9_-]{25,100}$/.test(token)) throw new CollaborationError('Invitație invalidă.', 404);
      const invite = await adminDb.collection('collaborationInvites').doc(token).get();
      if (!invite.exists || invite.data()?.status !== 'active' || Date.parse(String(invite.data()?.expiresAt || '')) < Date.now()) throw new CollaborationError('Invitația a expirat.', 410);
      const org = await adminDb.collection('collaborationOrganizations').doc(String(invite.data()?.organizationId)).get();
      if (!org.exists || org.data()?.status !== 'active') throw new CollaborationError('Agenția nu este activă.', 410);
      return NextResponse.json({ email: invite.data()?.email, organizationName: org.data()?.name });
    }
    const { account, db } = await actorFromBearer(request.headers.get('authorization'));
    if (account.accountType !== 'collaborator_only') throw new CollaborationError('Echipa este administrată din CRM.', 403);
    const org = db.collection('collaborationOrganizations').doc(account.organizationId);
    const [members, self] = await Promise.all([org.collection('members').get(), org.collection('members').doc(account.uid).get()]);
    return NextResponse.json({ members: members.docs.map(doc => doc.data()), organizationId: account.organizationId, canManage: self.data()?.role === 'admin' });
  } catch (error) { return fail(error); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body.action === 'accept') {
      const input = z.object({ token: z.string().min(25), name: z.string().trim().min(2).max(120), phone: z.string().trim().min(8).max(40) }).parse(body);
      const header = request.headers.get('authorization');
      if (!header?.startsWith('Bearer ')) throw new CollaborationError('Autentificare necesară.', 401);
      const { decoded, adminDb: db } = await verifyTokenAgainstAvailableBackends(header.slice(7));
      if (!decoded.email_verified) throw new CollaborationError('Verifică adresa de email.', 403);
      const inviteRef = db.collection('collaborationInvites').doc(input.token);
      const invite = await inviteRef.get(); const data = invite.data();
      if (!data || data.status !== 'active' || Date.parse(String(data.expiresAt)) < Date.now() || String(data.email).toLowerCase() !== String(decoded.email).toLowerCase()) throw new CollaborationError('Invitația nu mai este validă.', 403);
      const orgRef = db.collection('collaborationOrganizations').doc(String(data.organizationId));
      const userRef = db.collection('users').doc(decoded.uid);
      const now = new Date().toISOString();
      await db.runTransaction(async tx => {
        const [currentInvite, org, user] = await Promise.all([tx.get(inviteRef), tx.get(orgRef), tx.get(userRef)]);
        if (currentInvite.data()?.status !== 'active' || Date.parse(String(currentInvite.data()?.expiresAt || '')) < Date.now() || String(currentInvite.data()?.email || '').toLowerCase() !== String(decoded.email || '').toLowerCase() || !org.exists || org.data()?.status !== 'active' || user.data()?.agencyId || user.data()?.accountType === 'collaborator_only' || user.data()?.collaborationStatus === 'suspended' || user.data()?.collaborationOrganizationId) throw new CollaborationError('Invitația nu poate fi acceptată.', 409);
        tx.update(inviteRef, { status: 'accepted', acceptedBy: decoded.uid, acceptedAt: now });
        tx.set(userRef, { name: input.name, phone: input.phone, email: decoded.email || '', organizationName: org.data()?.name || '', collaborationOrganizationId: orgRef.id, accountType: 'collaborator_only', role: 'collaborator', collaborationStatus: 'active', updatedAt: now }, { merge: true });
        tx.set(orgRef.collection('members').doc(decoded.uid), { uid: decoded.uid, email: decoded.email || '', name: input.name, role: 'member', status: 'active', joinedAt: now });
      });
      return NextResponse.json({ ok: true });
    }
    const { account, db } = await actorFromBearer(request.headers.get('authorization'));
    if (account.accountType !== 'collaborator_only') throw new CollaborationError('Acțiune disponibilă doar agențiilor externe.', 403);
    const orgRef = db.collection('collaborationOrganizations').doc(account.organizationId);
    const member = await orgRef.collection('members').doc(account.uid).get();
    if (member.data()?.role !== 'admin') throw new CollaborationError('Doar administratorul agenției poate gestiona echipa.', 403);
    if (body.action === 'invite') {
      const email = z.string().email().max(200).parse(body.email).toLowerCase();
      const token = randomBytes(32).toString('base64url');
      await db.collection('collaborationInvites').doc(token).set({ token, organizationId: account.organizationId, email, invitedBy: account.uid, status: 'active', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString() });
      return NextResponse.json({ token, url: `${request.nextUrl.origin}/join-collaboration/${token}` });
    }
    if (body.action === 'remove') {
      const uid = z.string().min(1).parse(body.uid);
      if (uid === account.uid) throw new CollaborationError('Nu îți poți elimina propriul cont.', 409);
      const target = orgRef.collection('members').doc(uid);
      const snap = await target.get();
      if (!snap.exists) throw new CollaborationError('Membrul nu a fost găsit.', 404);
      await target.update({ status: 'suspended', updatedAt: new Date().toISOString() });
      await db.collection('users').doc(uid).update({ collaborationStatus: 'suspended' });
      const links = await db.collection('collaborationLinks').where('collaboratorUid', '==', uid).get();
      for (const chunk of Array.from({ length: Math.ceil(links.size / 400) }, (_, i) => links.docs.slice(i * 400, (i + 1) * 400))) { const batch = db.batch(); chunk.forEach(doc => batch.update(doc.ref, { status: 'revoked', updatedAt: new Date().toISOString() })); await batch.commit(); }
      return NextResponse.json({ ok: true });
    }
    throw new CollaborationError('Acțiune invalidă.');
  } catch (error) { return fail(error); }
}
