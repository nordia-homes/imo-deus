import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { agencyCollection, addNote, CommunicationError, connectionList, context, getConversation, linkContact, listConversations, listMessages, migrateStoria, nowIso, startContactConversation, updateConversation } from '@/lib/communications/server';
import { finishWhatsApp, graph, listAssets, onboardingConfig, selectPage, startAuthorization, connectionToken } from '@/lib/communications/meta';
import { queueMessage } from '@/lib/communications/outbound';
import { searchMessages } from '@/lib/communications/search';
import { createSocialPost, postInteraction, propertyImageUrls, publishDraft } from '@/lib/communications/social';
import { stableId } from '@/lib/communications/crypto';
import { syncConversation } from '@/lib/communications/sync';
export const runtime = 'nodejs';
type RouteContext = { params: Promise<{ path: string[] }> };
async function handle(request: NextRequest, route: RouteContext) {
  try {
    const { path } = await route.params; const [resource, id, action] = path;
    const isRead = request.method === 'GET';
    const admin = ['connect', 'assets', 'whatsapp', 'budget', 'posts', 'migrate', 'consent'].includes(resource) || (resource === 'connections' && !isRead);
    const actor = await context(request, admin); const db = actor.adminDb;
    const body = isRead ? null : await request.json();
    const params = request.nextUrl.searchParams;
    let result: unknown;
    if (resource === 'dashboard' && isRead) {
      const [connections, budgets] = await Promise.all([connectionList(db, actor.agencyId), agencyCollection(db, actor.agencyId, 'communicationBudgets').get()]);
      result = { connections, budgets: budgets.docs.map(d => ({ id: d.id, ...d.data() })), config: onboardingConfig(), admin: actor.role === 'admin' };
    } else if (resource === 'conversations' && isRead && !id) result = await listConversations(db, actor, params);
    else if (resource === 'conversations' && request.method === 'POST' && !id) result = await startContactConversation(db, actor, body);
    else if (resource === 'conversations' && id && isRead && action === 'messages') result = await listMessages(db, actor, id, params.get('cursor'), params.get('target'));
    else if (resource === 'conversations' && id && !isRead && action === 'sync') result = await syncConversation(db, actor, id);
    else if (resource === 'conversations' && id && isRead && action === 'notes') {
      await getConversation(db, actor, id); const notes = await agencyCollection(db, actor.agencyId, 'conversations').doc(id).collection('notes').orderBy('createdAt', 'desc').limit(50).get(); result = { notes: notes.docs.map(d => ({ id: d.id, ...d.data() })) };
    } else if (resource === 'conversations' && id && request.method === 'PATCH') { await updateConversation(db, actor, id, body); result = { updated: true }; }
    else if (resource === 'conversations' && id && !isRead && action === 'notes') { await addNote(db, actor, id, body.text); result = { added: true }; }
    else if (resource === 'conversations' && id && !isRead && action === 'contact') result = await linkContact(db, actor, id, body);
    else if (resource === 'conversations' && id && !isRead && ['messages', 'preview'].includes(action)) result = await queueMessage(db, actor, id, body, action === 'preview');
    else if (resource === 'search' && isRead) result = await searchMessages(db, actor, params.get('q') || '', Number(params.get('page')) || 1);
    else if (resource === 'connect' && request.method === 'POST') result = await startAuthorization(db, actor, body);
    else if (resource === 'assets' && isRead) result = await listAssets(db, actor.agencyId);
    else if (resource === 'assets' && request.method === 'POST') result = await selectPage(db, actor, body.pageId);
    else if (resource === 'whatsapp' && request.method === 'POST') {
      if (!onboardingConfig().whatsappReady) throw new CommunicationError('Onboardingul WhatsApp și plata directă trebuie configurate pe server.', 503);
      result = await finishWhatsApp(db, actor, body);
    } else if (resource === 'templates' && id && isRead) {
      const { connection, token } = await connectionToken(db, actor, id, 'templates');
      result = await graph(`/${connection.parentId}/message_templates?fields=name,language,status,category,components&limit=100`, token);
    } else if (resource === 'connections' && id && request.method === 'DELETE') {
      const ref = agencyCollection(db, actor.agencyId, 'channelConnections').doc(id); const existing = await ref.get();
      if (!existing.exists) throw new CommunicationError('Conexiune inexistentă.', 404);
      await ref.update({ status: 'disconnected', updatedAt: nowIso() }); await db.collection('communicationSecrets').doc(id).delete(); result = { disconnected: true };
    } else if (resource === 'budget' && request.method === 'POST') {
      const value = z.object({ limitMicros: z.number().int().min(0).max(1000000000000), currency: z.string().regex(/^[A-Z]{3}$/) }).parse(body);
      await agencyCollection(db, actor.agencyId, 'communicationBudgets').doc(`${nowIso().slice(0, 7)}-${value.currency}`).set({ ...value, updatedBy: actor.uid, updatedAt: nowIso() }, { merge: true }); result = { saved: true };
    } else if (resource === 'consent' && request.method === 'POST') {
      const value = z.object({ conversationId: z.string(), purpose: z.enum(['marketing', 'service']), status: z.enum(['granted', 'revoked']), evidence: z.string().trim().min(10).max(2000) }).parse(body);
      const c = await getConversation(db, actor, value.conversationId);
      const ref = agencyCollection(db, actor.agencyId, 'communicationConsents').doc(stableId(c.connectionId, c.externalParticipantId, value.purpose));
      const batch = db.batch(); const record = { ...value, recordedBy: actor.uid, recordedAt: nowIso() };
      batch.set(ref, record); batch.create(ref.collection('history').doc(), record); await batch.commit(); result = { saved: true };
    } else if (resource === 'migrate' && request.method === 'POST') result = await migrateStoria(db, actor, body.cursor);
    else if (resource === 'posts' && isRead) {
      if (id && (action === 'comments' || action === 'insights')) return NextResponse.json(await postInteraction(db, actor, id, params.get('connectionId') || '', action), { headers: { 'Cache-Control': 'no-store' } });
      const rows = await agencyCollection(db, actor.agencyId, 'socialPosts').orderBy('createdAt', 'desc').limit(50).get(); result = { posts: rows.docs.map(d => ({ id: d.id, ...d.data() })) };
    } else if (resource === 'posts' && !id && request.method === 'POST') result = await createSocialPost(db, actor, body);
    else if (resource === 'posts' && id && action === 'publish' && request.method === 'POST') result = await publishDraft(db, actor, id);
    else if (resource === 'posts' && id && action === 'comments' && request.method === 'POST') result = await postInteraction(db, actor, id, body.connectionId, 'comments', body.text);
    else if (resource === 'posts' && id && request.method === 'DELETE') {
      const ref = agencyCollection(db, actor.agencyId, 'socialPosts').doc(id);
      await db.runTransaction(async tx => { const snap = await tx.get(ref); if (!snap.exists || !['draft', 'queued'].includes(snap.data()?.status)) throw new CommunicationError('Publicarea a început și nu mai poate fi anulată.', 409); tx.update(ref, { status: 'cancelled' }); }); result = { cancelled: true };
    } else if (resource === 'properties' && isRead) {
      if (id) {
        const snap = await agencyCollection(db, actor.agencyId, 'properties').doc(id).get();
        if (!snap.exists || snap.data()?.status !== 'Activ') throw new CommunicationError('Proprietatea nu mai este activa.', 404);
        const p = snap.data()!;
        result = { property: { id: snap.id, title: p.title || '', description: p.description || '', location: p.location || p.address || '', price: p.price ?? null, images: propertyImageUrls(p.images || []) } };
      } else {
        const rows = await agencyCollection(db, actor.agencyId, 'properties').where('status', '==', 'Activ').limit(300).get();
        result = { properties: rows.docs.map(d => ({ id: d.id, title: d.data().title || '', location: d.data().location || d.data().address || '', thumbnailUrl: propertyImageUrls(d.data().images || [])[0] || null })) };
      }
    } else if (resource === 'agents' && isRead) {
      if (actor.role !== 'admin') throw new CommunicationError('Administrator necesar.', 403);
      const users = await db.collection('users').where('agencyId', '==', actor.agencyId).get(); result = { agents: users.docs.map(d => ({ id: d.id, name: d.data().name || d.id })) };
    } else throw new CommunicationError('Acțiune indisponibilă.', 404);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : 'Operația a eșuat.' }, { status: error instanceof CommunicationError ? error.status : error instanceof z.ZodError ? 400 : 500 });
  }
}
export const GET = handle; export const POST = handle; export const PATCH = handle; export const DELETE = handle;
