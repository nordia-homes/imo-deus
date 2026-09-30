import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { actorFromBearer, addCaseMessage, CollaborationError, createCase, createOrGetLink, getActiveListing, listingIdFor, notifyUser } from '@/lib/collaboration/server';
import type { CollaborationCase, CollaborationListing } from '@/lib/collaboration/model';
import { canAccessCase, canPublishProperty } from '@/lib/collaboration/policy';

export const runtime = 'nodejs';

function errorResponse(error: unknown) {
  return NextResponse.json({ message: error instanceof Error ? error.message : 'Cererea nu a putut fi procesată.' }, { status: error instanceof CollaborationError ? error.status : 400 });
}

const publishSchema = z.object({ propertyId: z.string().min(1), terms: z.string().trim().min(5).max(3000), description: z.string().trim().max(10000).optional(), imageUrls: z.array(z.string().url()).max(20).optional() });

export async function GET(request: NextRequest) {
  try {
    const { account, db, role } = await actorFromBearer(request.headers.get('authorization'));
    const view = request.nextUrl.searchParams.get('view') || 'catalog';
    const id = request.nextUrl.searchParams.get('id') || '';
    if (view === 'me') return NextResponse.json({ account, role });
    if (view === 'catalog') {
      const cursor = request.nextUrl.searchParams.get('cursor');
      let query = db.collection('collaborationListings').where('status', '==', 'active').orderBy('__name__').limit(60);
      if (cursor) {
        const cursorSnap = await db.collection('collaborationListings').doc(cursor).get();
        if (!cursorSnap.exists) throw new CollaborationError('Pagina solicitată nu mai există.', 400);
        query = query.startAfter(cursorSnap);
      }
      const snapshot = await query.get();
      const listings = (await Promise.all(snapshot.docs.map(async snap => { try { return await getActiveListing(db, snap.id); } catch { return null; } }))).filter(Boolean);
      return NextResponse.json({ listings, nextCursor: snapshot.size === 60 ? snapshot.docs.at(-1)?.id || null : null });
    }
    if (view === 'listing') return NextResponse.json({ listing: await getActiveListing(db, id) });
    if (view === 'my-listing') {
      if (!account.agencyId) throw new CollaborationError('Doar agențiile CRM pot publica proprietăți.', 403);
      const listingSnap = await db.collection('collaborationListings').doc(listingIdFor(account.agencyId, id)).get();
      return NextResponse.json({ listing: listingSnap.exists ? listingSnap.data() : null });
    }
    if (view === 'link') {
      const lookupId = listingIdFor(id, account.uid);
      const lookup = await db.collection('collaborationLinkLookup').doc(lookupId).get();
      const link = lookup.exists ? await db.collection('collaborationLinks').doc(String(lookup.data()?.linkId)).get() : null;
      return NextResponse.json({ link: link?.exists && link.data()?.status === 'active' ? link.data() : null });
    }
    if (view === 'link-activity') {
      const lookup = await db.collection('collaborationLinkLookup').doc(listingIdFor(id, account.uid)).get();
      if (!lookup.exists) return NextResponse.json({ views: 0, likes: 0, dislikes: 0 });
      const linkId = String(lookup.data()?.linkId || '');
      const snap = await db.collection('collaborationLinkStats').doc(linkId).get();
      const stats = snap.data() || {};
      return NextResponse.json({ views: Number(stats.views || 0), likes: Number(stats.likes || 0), dislikes: Number(stats.dislikes || 0) });
    }
    if (view === 'leads') {
      const snap = await db.collection('collaborationLeads').where('collaboratorUid', '==', account.uid).limit(200).get();
      return NextResponse.json({ leads: snap.docs.map(doc => doc.data()).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))) });
    }
    if (view === 'notifications') {
      const snap = await db.collection('users').doc(account.uid).collection('notifications').where('type', '==', 'collaboration').limit(100).get();
      return NextResponse.json({ notifications: snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as { id: string; createdAt?: string })).sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt))) });
    }
    if (view === 'cases') {
      const mine = await db.collection('collaborationCases').where('collaboratorUid', '==', account.uid).limit(200).get();
      const owned = role === 'admin' && account.agencyId ? await db.collection('collaborationCases').where('ownerAgencyId', '==', account.agencyId).limit(200).get() : await db.collection('collaborationCases').where('ownerAgentUid', '==', account.uid).limit(200).get();
      const cases = new Map<string, unknown>();
      [...mine.docs, ...owned.docs].forEach(doc => cases.set(doc.id, doc.data()));
      return NextResponse.json({ cases: [...cases.values()] });
    }
    if (view === 'case') {
      const snap = await db.collection('collaborationCases').doc(id).get();
      const value = snap.data() as CollaborationCase | undefined;
      if (!value || !canAccessCase(account, role, value)) throw new CollaborationError('Dosarul nu a fost găsit.', 404);
      const messages = await snap.ref.collection('messages').orderBy('createdAt', 'asc').limit(200).get();
      return NextResponse.json({ case: value, messages: messages.docs.map(doc => ({ id: doc.id, ...doc.data() })) });
    }
    throw new CollaborationError('Vizualizare invalidă.');
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const { account, db, role } = await actorFromBearer(request.headers.get('authorization'));
    const body = await request.json();
    const action = String(body.action || '');
    if (action === 'publish') {
      if (!account.agencyId) throw new CollaborationError('Doar agențiile CRM pot publica proprietăți.', 403);
      const input = publishSchema.parse(body);
      const propertySnap = await db.collection('agencies').doc(account.agencyId).collection('properties').doc(input.propertyId).get();
      const property = propertySnap.data();
      if (!property || property.status !== 'Activ') throw new CollaborationError('Proprietatea trebuie să fie activă.', 409);
      const ownerUid = String(property.agentId || account.uid);
      if (!canPublishProperty(account, role, account.agencyId, ownerUid)) throw new CollaborationError('Doar agentul proprietății sau administratorul o poate publica.', 403);
      const owner = await db.collection('users').doc(ownerUid).get();
      const ownerData = owner.data() || {};
      if (ownerData.agencyId !== account.agencyId) throw new CollaborationError('Agentul proprietății nu aparține agenției.', 409);
      if (!String(ownerData.phone || '').trim()) throw new CollaborationError('Agentul proprietății trebuie să aibă un număr de telefon în profil.', 409);
      const sourceImages = Array.isArray(property.images) ? property.images.filter((image: unknown) => image && typeof image === 'object' && typeof (image as {url?: unknown}).url === 'string') as {url: string; alt?: string}[] : [];
      const allowedUrls = new Set(sourceImages.map(image => image.url));
      const selectedUrls = input.imageUrls || sourceImages.slice(0, 20).map(image => image.url);
      if (selectedUrls.some(url => !allowedUrls.has(url))) throw new CollaborationError('Fotografiile trebuie selectate din proprietatea originală.', 400);
      const id = listingIdFor(account.agencyId, input.propertyId);
      const ref = db.collection('collaborationListings').doc(id);
      const previous = await ref.get();
      const now = new Date().toISOString();
      const listing: CollaborationListing = {
        id, sourceAgencyId: account.agencyId, propertyId: input.propertyId, ownerAgentUid: ownerUid,
        ownerAgencyName: account.organizationName, ownerAgentName: String(ownerData.name || property.agentName || ''), ownerAgentPhone: String(ownerData.phone), ownerAgentEmail: String(ownerData.email || ''),
        title: String(property.title || ''), description: input.description || String(property.description || ''), city: String(property.city || ''), zone: String(property.zone || ''),
        price: Number(property.price || 0), rooms: Number(property.rooms || 0), squareFootage: Number(property.squareFootage || 0),
        propertyType: String(property.propertyType || ''), transactionType: String(property.transactionType || ''),
        images: sourceImages.filter(image => selectedUrls.includes(image.url)).slice(0, 20).map(image => ({ url: image.url, alt: image.alt || '' })),
        terms: input.terms, status: 'active', createdAt: String(previous.data()?.createdAt || now), updatedAt: now,
      };
      await ref.set(listing);
      return NextResponse.json({ listing });
    }
    if (action === 'close') {
      const id = z.string().min(1).parse(body.listingId);
      const ref = db.collection('collaborationListings').doc(id);
      const snap = await ref.get();
      const listing = snap.data() as CollaborationListing | undefined;
      if (!listing || listing.sourceAgencyId !== account.agencyId || (role !== 'admin' && listing.ownerAgentUid !== account.uid)) throw new CollaborationError('Proprietatea nu a fost găsită.', 404);
      await ref.update({ status: 'closed', updatedAt: new Date().toISOString() });
      const links = await db.collection('collaborationLinks').where('listingId', '==', id).get();
      await Promise.all(links.docs.filter(doc => doc.data().status === 'active').map(doc => notifyUser(db, String(doc.data().collaboratorUid), 'Proprietate retrasă din colaborare', `${listing.title} nu mai este disponibilă.`, '/collaboration').catch(() => {})));
      return NextResponse.json({ ok: true });
    }
    if (action === 'profile') {
      const input = z.object({ name: z.string().trim().min(2).max(120), phone: z.string().trim().min(8).max(40) }).parse(body);
      const now = new Date().toISOString();
      await db.collection('users').doc(account.uid).update({ name: input.name, phone: input.phone, updatedAt: now });
      const links = await db.collection('collaborationLinks').where('collaboratorUid', '==', account.uid).get();
      for (const chunk of Array.from({ length: Math.ceil(links.size / 400) }, (_, i) => links.docs.slice(i * 400, (i + 1) * 400))) {
        const batch = db.batch();
        chunk.forEach(doc => batch.update(doc.ref, { collaboratorName: input.name, collaboratorPhone: input.phone, updatedAt: now }));
        await batch.commit();
      }
      return NextResponse.json({ ok: true });
    }
    if (action === 'link') {
      const listingId = z.string().min(1).parse(body.listingId);
      return NextResponse.json({ link: await createOrGetLink(db, account, listingId) });
    }
    if (action === 'read-notification') {
      const id = z.string().min(1).parse(body.notificationId);
      const ref = db.collection('users').doc(account.uid).collection('notifications').doc(id);
      const snap = await ref.get();
      if (!snap.exists || snap.data()?.recipientId !== account.uid) throw new CollaborationError('Notificarea nu a fost găsită.', 404);
      await ref.update({ isRead: true, readAt: new Date().toISOString() });
      return NextResponse.json({ ok: true });
    }
    if (action === 'revoke-link') {
      const token = z.string().min(1).parse(body.linkId);
      const ref = db.collection('collaborationLinks').doc(token);
      const snap = await ref.get();
      if (!snap.exists || snap.data()?.collaboratorUid !== account.uid) throw new CollaborationError('Linkul nu a fost găsit.', 404);
      await ref.update({ status: 'revoked', updatedAt: new Date().toISOString() });
      return NextResponse.json({ ok: true });
    }
    if (action === 'case') {
      if (body.acceptedTerms !== true) throw new CollaborationError('Acceptă condițiile de colaborare înainte de a deschide dosarul.', 400);
      return NextResponse.json({ case: await createCase(db, account, z.string().min(1).parse(body.leadId)) });
    }
    if (action === 'message') return NextResponse.json({ message: await addCaseMessage(db, account, role, z.string().min(1).parse(body.caseId), z.string().trim().min(1).max(5000).parse(body.text)) });
    if (action === 'case-status') {
      const id = z.string().min(1).parse(body.caseId);
      const status = z.enum(['accepted', 'declined', 'completed', 'cancelled']).parse(body.status);
      const ref = db.collection('collaborationCases').doc(id);
      const snap = await ref.get();
      const value = snap.data() as CollaborationCase | undefined;
      if (!value) throw new CollaborationError('Dosarul nu a fost găsit.', 404);
      const isOwner = value.ownerAgentUid === account.uid || (role === 'admin' && value.ownerAgencyId === account.agencyId);
      const isCollaborator = value.collaboratorUid === account.uid;
      if ((!isOwner && !isCollaborator) || (['accepted', 'declined', 'completed'].includes(status) && !isOwner)) throw new CollaborationError('Nu ai permisiunea de a modifica dosarul.', 403);
      if ((['accepted', 'declined'].includes(status) && value.status !== 'requested') || (status === 'completed' && value.status !== 'accepted') || (status === 'cancelled' && !['requested', 'accepted'].includes(value.status))) throw new CollaborationError('Tranziție de status invalidă.', 409);
      await ref.update({ status, updatedAt: new Date().toISOString() });
      await notifyUser(db, isOwner ? value.collaboratorUid : value.ownerAgentUid, 'Status colaborare actualizat', `${value.propertyTitle}: ${status}.`, `/collaboration/cases/${id}`).catch(() => {});
      return NextResponse.json({ ok: true });
    }
    if (action === 'offer') {
      const id = z.string().min(1).parse(body.caseId);
      const offerAmount = z.number().positive().max(1_000_000_000).parse(body.offerAmount);
      const ref = db.collection('collaborationCases').doc(id);
      const snap = await ref.get();
      const value = snap.data() as CollaborationCase | undefined;
      if (!value || value.collaboratorUid !== account.uid || value.status !== 'accepted') throw new CollaborationError('Oferta nu poate fi trimisă.', 403);
      await ref.update({ offerAmount, offerStatus: 'pending', updatedAt: new Date().toISOString() });
      await notifyUser(db, value.ownerAgentUid, 'Ofertă nouă', `${account.name} a înregistrat o ofertă pentru ${value.propertyTitle}.`, `/collaboration/cases/${id}`).catch(() => {});
      return NextResponse.json({ ok: true });
    }
    if (action === 'offer-status') {
      const id = z.string().min(1).parse(body.caseId);
      const offerStatus = z.enum(['accepted', 'declined']).parse(body.offerStatus);
      const ref = db.collection('collaborationCases').doc(id);
      const snap = await ref.get(); const value = snap.data() as CollaborationCase | undefined;
      if (!value || value.status !== 'accepted' || !value.offerAmount || value.offerStatus !== 'pending' || (value.ownerAgentUid !== account.uid && !(role === 'admin' && value.ownerAgencyId === account.agencyId))) throw new CollaborationError('Oferta nu poate fi tratată.', 403);
      await ref.update({ offerStatus, updatedAt: new Date().toISOString() });
      await notifyUser(db, value.collaboratorUid, 'Răspuns la ofertă', `${value.propertyTitle}: ofertă ${offerStatus === 'accepted' ? 'acceptată' : 'refuzată'}.`, `/collaboration/cases/${id}`).catch(() => {});
      return NextResponse.json({ ok: true });
    }
    if (action === 'viewing') {
      const id = z.string().min(1).parse(body.caseId);
      const viewingAt = z.string().datetime().parse(body.viewingAt);
      if (Date.parse(viewingAt) <= Date.now()) throw new CollaborationError('Vizionarea trebuie programată în viitor.', 400);
      const ref = db.collection('collaborationCases').doc(id);
      const snap = await ref.get(); const value = snap.data() as CollaborationCase | undefined;
      if (!value || value.status !== 'accepted' || !canAccessCase(account, role, value)) throw new CollaborationError('Vizionarea nu poate fi programată.', 403);
      await ref.update({ viewingAt, updatedAt: new Date().toISOString() });
      await notifyUser(db, value.collaboratorUid === account.uid ? value.ownerAgentUid : value.collaboratorUid, 'Vizionare programată', `${value.propertyTitle}: ${new Date(viewingAt).toLocaleString('ro-RO')}.`, `/collaboration/cases/${id}`).catch(() => {});
      return NextResponse.json({ ok: true });
    }
    throw new CollaborationError('Acțiune invalidă.');
  } catch (error) { return errorResponse(error); }
}
