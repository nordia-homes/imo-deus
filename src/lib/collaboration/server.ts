import { randomBytes } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { verifyTokenAgainstAvailableBackends } from '@/lib/firebase-app-hosting';
import type { CollaborationAccount, CollaborationCase, CollaborationLead, CollaborationLink, CollaborationListing } from './model';
import { canAccessCase, canReadLead } from './policy';
import { listingIdFor } from './id';

export class CollaborationError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export { listingIdFor } from './id';

export async function actorFromBearer(header: string | null) {
  if (!header?.startsWith('Bearer ')) throw new CollaborationError('Autentificare necesară.', 401);
  const verified = await verifyTokenAgainstAvailableBackends(header.slice(7));
  const profile = await verified.adminDb.collection('users').doc(verified.decoded.uid).get();
  const data = profile.data() || {};
  if (data.role === 'platform_admin') throw new CollaborationError('Contul nu poate accesa colaborările.', 403);
  const agencyId = typeof data.agencyId === 'string' ? data.agencyId : undefined;
  if (!agencyId && !verified.decoded.email_verified) throw new CollaborationError('Verifică adresa de email.', 403);
  if (!agencyId && data.accountType !== 'collaborator_only') throw new CollaborationError('Finalizează onboardingul de colaborator.', 403);
  if (data.collaborationStatus === 'suspended') throw new CollaborationError('Contul de colaborare este suspendat.', 403);
  if (!agencyId) {
    const org = await verified.adminDb.collection('collaborationOrganizations').doc(String(data.collaborationOrganizationId || '')).get();
    const member = await org.ref.collection('members').doc(verified.decoded.uid).get();
    if (!org.exists || org.data()?.status !== 'active' || !member.exists || member.data()?.status !== 'active') throw new CollaborationError('Organizația colaboratorului nu este activă.', 403);
  }
  const account: CollaborationAccount = {
    uid: verified.decoded.uid,
    name: String(data.name || verified.decoded.name || ''),
    email: String(data.email || verified.decoded.email || ''),
    phone: String(data.phone || ''),
    organizationName: String(data.organizationName || data.agencyName || ''),
    organizationId: agencyId || String(data.collaborationOrganizationId || verified.decoded.uid),
    agencyId,
    accountType: agencyId ? 'crm' : 'collaborator_only',
  };
  if (agencyId) {
    const agency = await verified.adminDb.collection('agencies').doc(agencyId).get();
    account.organizationName = String(agency.data()?.name || account.organizationName);
  }
  return { account, db: verified.adminDb, role: String(data.role || '') };
}

export async function getActiveListing(db: Firestore, id: string): Promise<CollaborationListing> {
  const listingSnap = await db.collection('collaborationListings').doc(id).get();
  if (!listingSnap.exists) throw new CollaborationError('Proprietatea nu este disponibilă pentru colaborare.', 404);
  const listing = listingSnap.data() as CollaborationListing;
  if (listing.status !== 'active') throw new CollaborationError('Colaborarea pentru proprietate s-a încheiat.', 410);
  const propertySnap = await db.collection('agencies').doc(listing.sourceAgencyId).collection('properties').doc(listing.propertyId).get();
  if (!propertySnap.exists || propertySnap.data()?.status !== 'Activ') throw new CollaborationError('Proprietatea nu mai este disponibilă.', 410);
  const property = propertySnap.data() || {};
  if (property.agentId && property.agentId !== listing.ownerAgentUid) throw new CollaborationError('Agentul proprietății s-a schimbat. Fișa trebuie republicată.', 410);
  const owner = await db.collection('users').doc(listing.ownerAgentUid).get();
  if (!owner.exists || owner.data()?.agencyId !== listing.sourceAgencyId) throw new CollaborationError('Agentul proprietății nu mai este disponibil.', 410);
  if (!String(owner.data()?.phone || '').trim()) throw new CollaborationError('Telefonul agentului proprietății nu este disponibil.', 410);
  return {
    ...listing,
    price: Number(property.price || listing.price),
    title: String(property.title || listing.title),
    images: listing.images,
    ownerAgentName: String(owner.data()?.name || listing.ownerAgentName),
    ownerAgentPhone: String(owner.data()?.phone),
    ownerAgentEmail: String(owner.data()?.email || listing.ownerAgentEmail),
  };
}

export async function getActiveLink(db: Firestore, token: string) {
  if (!/^[A-Za-z0-9_-]{32,100}$/.test(token)) throw new CollaborationError('Link invalid.', 404);
  const snap = await db.collection('collaborationLinks').doc(token).get();
  if (!snap.exists || snap.data()?.status !== 'active') throw new CollaborationError('Linkul nu mai este disponibil.', 410);
  const link = { id: snap.id, ...snap.data() } as CollaborationLink;
  const collaborator = await db.collection('users').doc(link.collaboratorUid).get();
  const profile = collaborator.data();
  if (!profile || profile.collaborationStatus === 'suspended' || (profile.agencyId ? profile.agencyId !== link.collaboratorOrganizationId : profile.collaborationOrganizationId !== link.collaboratorOrganizationId)) {
    throw new CollaborationError('Linkul nu mai este disponibil.', 410);
  }
  if (!profile.agencyId) {
    const org = await db.collection('collaborationOrganizations').doc(link.collaboratorOrganizationId).get();
    const member = await org.ref.collection('members').doc(link.collaboratorUid).get();
    if (org.data()?.status !== 'active' || member.data()?.status !== 'active') throw new CollaborationError('Linkul nu mai este disponibil.', 410);
  }
  const listing = await getActiveListing(db, link.listingId);
  return { link, listing };
}

export async function notifyUser(db: Firestore, uid: string, title: string, body: string, href: string) {
  await db.collection('users').doc(uid).collection('notifications').add({
    eventId: randomBytes(12).toString('hex'), recipientId: uid, agencyId: '', type: 'collaboration', category: 'inboxMessages', priority: 'action_required', title, body, actionUrl: href, entityType: 'collaboration', entityId: href.split('/').pop() || '', isRead: false, createdAt: new Date().toISOString(),
  });
}

export async function createOrGetLink(db: Firestore, account: CollaborationAccount, listingId: string) {
  const listing = await getActiveListing(db, listingId);
  if (listing.ownerAgentUid === account.uid) throw new CollaborationError('Folosește linkul public al proprietății tale.', 400);
  if (!account.phone.trim()) throw new CollaborationError('Adaugă numărul tău de telefon în profil înainte de a genera linkul.', 400);
  const lookupId = listingIdFor(listingId, account.uid);
  const lookupRef = db.collection('collaborationLinkLookup').doc(lookupId);
  const now = new Date().toISOString();
  return db.runTransaction(async (tx) => {
    const lookup = await tx.get(lookupRef);
    if (lookup.exists) {
      const existingRef = db.collection('collaborationLinks').doc(String(lookup.data()?.linkId));
      const existing = await tx.get(existingRef);
      if (existing.exists && existing.data()?.status === 'active') {
        tx.update(existingRef, { collaboratorName: account.name, collaboratorPhone: account.phone, collaboratorEmail: account.email, updatedAt: now });
        return { id: existing.id, ...existing.data(), collaboratorName: account.name, collaboratorPhone: account.phone, collaboratorEmail: account.email } as CollaborationLink;
      }
    }
    const id = randomBytes(32).toString('base64url');
    const link: CollaborationLink = { id, listingId, collaboratorUid: account.uid, collaboratorOrganizationId: account.organizationId, collaboratorName: account.name, collaboratorPhone: account.phone, collaboratorEmail: account.email, status: 'active', createdAt: now, updatedAt: now };
    tx.set(db.collection('collaborationLinks').doc(id), link);
    tx.set(lookupRef, { linkId: id, collaboratorUid: account.uid, listingId });
    return link;
  });
}

export async function createLead(db: Firestore, link: CollaborationLink, listing: CollaborationListing, input: { name: string; email: string; phone: string; message: string; kind: 'message' | 'viewing' }) {
  const now = new Date().toISOString();
  const leadRef = db.collection('collaborationLeads').doc();
  const lead: CollaborationLead = { id: leadRef.id, listingId: listing.id, linkId: link.id, collaboratorUid: link.collaboratorUid, collaboratorOrganizationId: link.collaboratorOrganizationId, buyerName: input.name, buyerEmail: input.email, buyerPhone: input.phone, message: input.message, kind: input.kind, status: 'new', createdAt: now, updatedAt: now };
  await leadRef.set(lead);
  const collaboratorProfile = await db.collection('users').doc(link.collaboratorUid).get();
  const ownAgencyId = collaboratorProfile.data()?.agencyId;
  if (typeof ownAgencyId === 'string' && ownAgencyId !== listing.sourceAgencyId) {
    const contacts = db.collection('agencies').doc(ownAgencyId).collection('contacts');
    const existing = await contacts.where('email', '==', input.email).limit(1).get();
    if (existing.empty) await contacts.add({ name: input.name, email: input.email, phone: input.phone, source: 'Colaborare ImoDeus', sourcePropertyId: listing.propertyId, collaborationLeadId: lead.id, agentId: link.collaboratorUid, agentName: link.collaboratorName, contactType: 'Cumparator', status: 'Nou', description: input.message, createdAt: now });
  }
  await notifyUser(db, link.collaboratorUid, 'Solicitare nouă din colaborare', `${input.name} este interesat(ă) de ${listing.title}.`, '/collaboration?tab=leads').catch(() => {});
  return lead;
}

export async function createCase(db: Firestore, account: CollaborationAccount, leadId: string) {
  const leadSnap = await db.collection('collaborationLeads').doc(leadId).get();
  const lead = leadSnap.data() as CollaborationLead | undefined;
  if (!lead || !canReadLead(account, lead)) throw new CollaborationError('Solicitarea nu a fost găsită.', 404);
  const listing = await getActiveListing(db, lead.listingId);
  const now = new Date().toISOString();
  const ref = db.collection('collaborationCases').doc(leadId);
  const value: CollaborationCase = { id: ref.id, listingId: listing.id, leadId, collaboratorUid: account.uid, collaboratorOrganizationId: account.organizationId, ownerAgentUid: listing.ownerAgentUid, ownerAgencyId: listing.sourceAgencyId, propertyTitle: listing.title, collaboratorName: account.name, buyerName: lead.buyerName, buyerPhone: lead.buyerPhone, buyerEmail: lead.buyerEmail, status: 'requested', terms: listing.terms, termsAcceptedAt: now, createdAt: now, updatedAt: now };
  const created = await db.runTransaction(async tx => {
    const existing = await tx.get(ref);
    if (existing.exists) return existing.data() as CollaborationCase;
    tx.set(ref, value);
    tx.update(leadSnap.ref, { status: 'case_opened', updatedAt: now });
    return value;
  });
  if (created.createdAt === now) await notifyUser(db, listing.ownerAgentUid, 'Cerere de colaborare', `${account.name} solicită colaborarea pentru ${listing.title}.`, `/collaboration/cases/${ref.id}`).catch(() => {});
  return created;
}

export async function addCaseMessage(db: Firestore, actor: CollaborationAccount, role: string, caseId: string, text: string) {
  const ref = db.collection('collaborationCases').doc(caseId);
  const snap = await ref.get();
  const value = snap.data() as CollaborationCase | undefined;
  if (!value || !canAccessCase(actor, role, value)) throw new CollaborationError('Dosarul nu a fost găsit.', 404);
  if (value.status === 'cancelled' || value.status === 'declined') throw new CollaborationError('Dosarul este închis.', 409);
  const message = { authorUid: actor.uid, authorName: actor.name, text, createdAt: new Date().toISOString() };
  await ref.collection('messages').add(message);
  await ref.update({ updatedAt: message.createdAt, lastMessage: text.slice(0, 140) });
  await notifyUser(db, value.collaboratorUid === actor.uid ? value.ownerAgentUid : value.collaboratorUid, 'Mesaj nou în colaborare', `${actor.name}: ${text.slice(0, 100)}`, `/collaboration/cases/${caseId}`).catch(() => {});
  return message;
}
