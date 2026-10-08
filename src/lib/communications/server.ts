import { FieldPath, type Firestore } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import { isDemoAgencyId } from '@/lib/demo/guards';
import { advanceStatus, canReadConversation, type Actor, type Connection, type Conversation, type Message } from './model';
import { stableId } from './crypto';
import { correlatedJob } from './receipt-correlation';
import type { IncomingEvent } from './normalize';

export const nowIso = () => new Date().toISOString();
export const agencyCollection = (db: Firestore, agencyId: string, name: string) => db.collection('agencies').doc(agencyId).collection(name);
export class CommunicationError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function context(request: Request, admin = false) {
  const ctx = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
  if (isDemoAgencyId(ctx.agencyId)) throw new CommunicationError('Integrările externe nu sunt disponibile în contul demo.', 403);
  if (admin && ctx.role !== 'admin') throw new CommunicationError('Această acțiune necesită administratorul agenției.', 403);
  return ctx;
}
export async function getConversation(db: Firestore, actor: Actor, id: string) {
  const snap = await agencyCollection(db, actor.agencyId, 'conversations').doc(id).get();
  if (!snap.exists) throw new CommunicationError('Conversația nu există.', 404);
  const value = { ...snap.data(), id: snap.id } as Conversation;
  if (!canReadConversation(actor, value)) throw new CommunicationError('Nu ai acces la această conversație.', 403);
  return value;
}
export async function listConversations(db: Firestore, actor: Actor, params: URLSearchParams) {
  if (params.get('status') === 'unassigned') {
    if (actor.role !== 'admin') throw new CommunicationError('Administrator necesar pentru conversațiile neatribuite.', 403);
    let pending = agencyCollection(db, actor.agencyId, 'conversations').where('assigneeId', '==', null).orderBy('lastMessageAt', 'desc').orderBy(FieldPath.documentId(), 'desc');
    const cursor = params.get('cursor');
    if (cursor) { const previous = await getConversation(db, actor, cursor); pending = pending.startAfter(previous.lastMessageAt, cursor); }
    const docs = await pending.limit(30).get();
    return { conversations: docs.docs.map(d => ({ ...d.data(), id: d.id } as Conversation)), cursor: docs.size === 30 ? docs.docs.at(-1)!.id : null };
  }
  let query = agencyCollection(db, actor.agencyId, 'conversations').orderBy('lastMessageAt', 'desc').orderBy(FieldPath.documentId(), 'desc');
  if (actor.role !== 'admin') query = query.where('accessUids', 'array-contains', actor.uid);
  const channel = params.get('channel'); const state = params.get('status');
  if (channel && channel !== 'all') query = query.where('channel', '==', channel);
  if (state && state !== 'all') query = query.where('status', '==', state);
  if (params.get('contactId')) query = query.where('contactId', '==', params.get('contactId'));
  const cursor = params.get('cursor');
  if (cursor) { const previous = await getConversation(db, actor, cursor); query = query.startAfter(previous.lastMessageAt, cursor); }
  const docs = await query.limit(30).get();
  const rows = docs.docs.map(d => ({ ...d.data(), id: d.id } as Conversation)).filter(c => canReadConversation(actor, c) && (!params.get('propertyId') || c.propertyIds.includes(params.get('propertyId')!)));
  return { conversations: rows, cursor: docs.size === 30 ? docs.docs.at(-1)!.id : null };
}
export async function listMessages(db: Firestore, actor: Actor, id: string, cursor?: string | null, target?: string | null) {
  const conversation = await getConversation(db, actor, id);
  const ref = agencyCollection(db, actor.agencyId, 'conversations').doc(id);
  let query = ref.collection('messages').orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc');
  if (cursor) { const prev = await ref.collection('messages').doc(cursor).get(); if (prev.exists) query = query.startAfter(prev); }
  else if (target) { const anchor = await ref.collection('messages').doc(target).get(); if (anchor.exists) query = query.startAt(anchor); }
  const rows = await query.limit(50).get();
  return { conversation, messages: rows.docs.map(d => ({ ...d.data(), id: d.id })), cursor: rows.size === 50 ? rows.docs.at(-1)!.id : null };
}
const patchSchema = z.object({ status: z.enum(['new', 'open', 'waiting', 'snoozed', 'resolved', 'spam']).optional(), assigneeId: z.string().nullable().optional(), read: z.boolean().optional(), propertyId: z.string().optional(), version: z.number().int() });
export async function updateConversation(db: Firestore, actor: Actor, id: string, body: unknown) {
  const patch = patchSchema.parse(body);
  await getConversation(db, actor, id);
  if (patch.assigneeId !== undefined && actor.role !== 'admin') throw new CommunicationError('Numai administratorul poate realoca conversația.', 403);
  if (patch.assigneeId) {
    const profile = await db.collection('users').doc(patch.assigneeId).get();
    if (profile.data()?.agencyId !== actor.agencyId) throw new CommunicationError('Agentul nu aparține agenției.');
  }
  if (patch.propertyId && !(await agencyCollection(db, actor.agencyId, 'properties').doc(patch.propertyId).get()).exists) throw new CommunicationError('Proprietatea nu există.');
  const ref = agencyCollection(db, actor.agencyId, 'conversations').doc(id);
  await db.runTransaction(async tx => {
    const snap = await tx.get(ref); const row = snap.data() as Conversation;
    if (!canReadConversation(actor, row)) throw new CommunicationError('Acces revocat.', 403);
    if (row.version !== patch.version) throw new CommunicationError('Conversația a fost modificată. Reîncarcă înainte de salvare.', 409);
    const data: Record<string, unknown> = { version: row.version + 1 };
    if (patch.status) data.status = patch.status;
    if (patch.read) data.readBy = { ...row.readBy, [actor.uid]: nowIso() };
    if (patch.assigneeId !== undefined) { data.assigneeId = patch.assigneeId; data.accessUids = [...new Set([patch.assigneeId, ...row.collaboratorIds].filter(Boolean))]; }
    if (patch.propertyId) data.propertyIds = [...new Set([...row.propertyIds, patch.propertyId])];
    tx.update(ref, data);
  });
}
export async function addNote(db: Firestore, actor: Actor, id: string, text: string) {
  await getConversation(db, actor, id);
  const value = z.string().trim().min(1).max(10000).parse(text);
  await agencyCollection(db, actor.agencyId, 'conversations').doc(id).collection('notes').add({ text: value, authorId: actor.uid, createdAt: nowIso() });
}
export async function linkContact(db: Firestore, actor: Actor, id: string, body: unknown) {
  const data = z.object({ contactId: z.string().optional(), contactType: z.enum(['Cumparator', 'Client', 'Partener']).default('Cumparator') }).parse(body);
  const conversation = await getConversation(db, actor, id);
  const ref = agencyCollection(db, actor.agencyId, 'conversations').doc(id);
  const contactRef = agencyCollection(db, actor.agencyId, 'contacts').doc(data.contactId || stableId('conversation-contact', id));
  await db.runTransaction(async tx => {
    const [fresh, existing] = await Promise.all([tx.get(ref), tx.get(contactRef)]);
    if (!canReadConversation(actor, fresh.data() as Conversation)) throw new CommunicationError('Acces revocat.', 403);
    if (fresh.data()?.contactId) return;
    if (data.contactId && !existing.exists) throw new CommunicationError('Contactul ales nu există.');
    if (!existing.exists) tx.create(contactRef, { name: conversation.name, phone: conversation.phone || '', email: conversation.email || '', contactType: data.contactType, source: conversation.channel, status: 'Nou', createdAt: nowIso(), sourcePropertyId: conversation.propertyIds[0] || null });
    tx.update(ref, { contactId: contactRef.id, version: (fresh.data()?.version || 0) + 1 });
  });
  return { contactId: contactRef.id };
}

export async function ingestMessage(db: Firestore, connection: Connection, event: IncomingEvent) {
  const id = stableId(connection.id, event.participantId);
  const ref = agencyCollection(db, connection.agencyId, 'conversations').doc(id);
  const mapping = db.collection('communicationMessageMappings').doc(stableId(connection.id, event.externalId));
  await db.runTransaction(async tx => {
    const map = await tx.get(mapping);
    const correlationId = event.status && event.channel === 'whatsapp' ? correlatedJob(event.correlation, connection.id) : null;
    const correlated = correlationId ? await tx.get(db.collection('communicationOutboundJobs').doc(correlationId)) : null;
    const correlatedData = correlated?.data();
    const matches = correlatedData && correlatedData.agencyId === connection.agencyId && correlatedData.connectionId === connection.id && correlatedData.conversationId === id && (!correlatedData.externalId || correlatedData.externalId === event.externalId);
    const messageId = matches ? correlationId! : map.data()?.messageId || stableId(connection.id, event.externalId);
    const messageRef = ref.collection('messages').doc(messageId);
    const [conversationDoc, existing] = await Promise.all([tx.get(ref), tx.get(messageRef)]);
    const current = conversationDoc.data() as Conversation | undefined;
    if (event.status) {
      if (existing.exists) {
        const status = advanceStatus(existing.data()!.status, event.status);
        const jobRef = db.collection('communicationOutboundJobs').doc(messageId);
        const job = existing.data()?.origin === 'imodeus' ? await tx.get(jobRef) : null;
        tx.set(mapping, { connectionId: connection.id, conversationId: id, messageId }, { merge: true });
        tx.update(messageRef, { status, externalId: event.externalId, ...(status === 'failed' && event.error ? { error: event.error } : {}) });
        if (job?.exists && ['accepted', 'delivered', 'read', 'failed'].includes(status)) {
          const previous = job.data()!;
          const reservationReleased = previous.reservationReleased ?? previous.budgetSettled ?? false;
          const settledAmountMicros = previous.settledAmountMicros ?? (previous.budgetSettled && ['delivered', 'read'].includes(previous.status) ? previous.estimate?.amount || 0 : 0);
          tx.update(jobRef, { status, externalId: event.externalId, reservationReleased, settledAmountMicros,
            budgetSettled: previous.status === status ? Boolean(previous.budgetSettled) : false, ...(status === 'failed' && event.error ? { error: event.error } : {}) });
        }
      }
      else tx.set(mapping, { connectionId: connection.id, conversationId: id, messageId, pendingStatus: advanceStatus(map.data()?.pendingStatus || 'queued', event.status), ...(event.error ? { pendingError: event.error } : {}) }, { merge: true });
      return;
    }
    if (existing.exists) {
      if (event.direction === 'sent') tx.update(messageRef, { status: advanceStatus(existing.data()!.status, 'accepted'), externalId: event.externalId });
      return;
    }
    const isLatest = !current || event.createdAt >= current.lastMessageAt;
    const inboundAt = event.direction === 'received' && (!current?.lastInboundAt || event.createdAt > current.lastInboundAt) ? event.createdAt : current?.lastInboundAt || null;
    const outboundAt = event.direction === 'sent' && (!current?.lastOutboundAt || event.createdAt > current.lastOutboundAt) ? event.createdAt : current?.lastOutboundAt || null;
    const row: Conversation = { id, agencyId: connection.agencyId, channel: connection.channel, connectionId: connection.id,
      externalParticipantId: event.participantId, name: event.name || current?.name || event.participantId,
      ...(connection.channel === 'whatsapp' ? { phone: event.participantId } : {}),
      contactId: current?.contactId || null, propertyIds: current?.propertyIds || [], assigneeId: current?.assigneeId || null,
      collaboratorIds: current?.collaboratorIds || [], readBy: current?.readBy || {},
      status: current?.status === 'spam' ? 'spam' : isLatest && event.direction === 'received' && !event.imported ? 'open' : current?.status || 'new',
      lastMessageAt: isLatest ? event.createdAt : current!.lastMessageAt, latestMessage: isLatest ? event.text || '[Atașament]' : current!.latestMessage,
      lastInboundAt: inboundAt, lastOutboundAt: outboundAt, needsReply: Boolean(inboundAt && (!outboundAt || inboundAt > outboundAt)),
      version: (current?.version || 0) + 1, createdAt: current?.createdAt || event.createdAt };
    const message: Message = { id: messageId, conversationId: id, agencyId: connection.agencyId, externalId: event.externalId,
      direction: event.direction, origin: event.direction === 'sent' ? 'native' : 'unknown', text: event.text,
      createdAt: event.createdAt, authorId: null, attachments: event.attachments, imported: Boolean(event.imported),
      status: event.direction === 'sent' ? advanceStatus('accepted', map.data()?.pendingStatus || 'accepted') : 'received',
      ...(event.direction === 'sent' && map.data()?.pendingStatus === 'failed' && map.data()?.pendingError ? { error: map.data()!.pendingError } : {}) };
    tx.set(ref, { ...row, accessUids: [...new Set([row.assigneeId, ...row.collaboratorIds].filter(Boolean))] }, { merge: true });
    tx.create(messageRef, message);
    if (event.channel === 'whatsapp' && event.direction === 'received' && !event.imported) {
      tx.create(db.collection('communicationViewingReplies').doc(stableId(connection.id, event.externalId)), { agencyId: connection.agencyId, connectionId: connection.id, conversationId: id, messageId, participantId: event.participantId, externalId: event.externalId, replyTo: event.replyTo || null, text: event.attachments.length ? '' : event.text, createdAt: event.createdAt, status: 'queued', attempts: 0 });
    }
    tx.set(mapping, { messageId, conversationId: id, connectionId: connection.id }, { merge: true });
    tx.set(db.collection('communicationSearchJobs').doc(stableId(id, messageId)), { agencyId: connection.agencyId, conversationId: id, messageId, status: 'queued', updatedAt: nowIso() });
  });
  return id;
}

export async function migrateStoria(db: Firestore, actor: Actor, cursor?: string, onlyId?: string) {
  if (actor.role !== 'admin') throw new CommunicationError('Administrator necesar.', 403);
  let query = agencyCollection(db, actor.agencyId, 'storiaInboxLeads').orderBy(FieldPath.documentId());
  if (cursor) query = query.startAfter(cursor);
  const page = onlyId ? null : await query.limit(20).get();
  const docs = onlyId ? [await agencyCollection(db, actor.agencyId, 'storiaInboxLeads').doc(onlyId).get()].filter(d => d.exists) : page!.docs;
  const connection: Connection = { id: stableId('storia', actor.agencyId), agencyId: actor.agencyId, channel: 'storia', externalId: actor.agencyId, name: 'Storia', status: 'connected', updatedAt: nowIso(), capabilities: { receive: { status: 'active', reason: 'Import din integrarea Storia existentă' }, send: { status: 'unavailable', reason: 'Răspunsul se continuă pe platformă.' } } };
  for (const lead of docs) {
    const value = lead.data()!;
    for (const message of value.messages || []) {
      const date = Date.parse(message.createdAt || value.lastMessageAt);
      await ingestMessage(db, connection, { channel: 'storia', accountId: actor.agencyId, participantId: lead.id, externalId: String(message.id), text: String(message.text || ''), name: value.senderName || 'Client Storia', direction: message.direction === 'sent' ? 'sent' : 'received', createdAt: Number.isFinite(date) ? new Date(date).toISOString() : nowIso(), attachments: [], imported: true });
    }
    const id = stableId(connection.id, lead.id);
    const ref = agencyCollection(db, actor.agencyId, 'conversations').doc(id);
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref); if (!snap.exists) return;
      const property = value.propertyId ? await tx.get(agencyCollection(db, actor.agencyId, 'properties').doc(value.propertyId)) : null;
      const agentId = property?.data()?.agentId;
      const agent = agentId ? await tx.get(db.collection('users').doc(agentId)) : null;
      const assignment = !snap.data()?.legacyStoriaId && agent?.data()?.agencyId === actor.agencyId ? { assigneeId: agentId, accessUids: [agentId] } : {};
      tx.set(ref, { phone: String(value.senderPhone || ''), email: value.senderEmail || '',
        ...assignment,
        propertyIds: [...new Set([...(snap.data()?.propertyIds || []), value.propertyId].filter(Boolean))],
        externalUrl: 'https://www.storia.ro/myaccount/', legacyStoriaId: lead.id }, { merge: true });
    });
  }
  return { imported: docs.length, cursor: !onlyId && docs.length === 20 ? docs.at(-1)!.id : null };
}

export async function connectionList(db: Firestore, agencyId: string) {
  const rows = await agencyCollection(db, agencyId, 'channelConnections').get();
  return rows.docs.map(d => ({ ...d.data(), id: d.id } as Connection));
}
export const newId = randomUUID;

export async function startContactConversation(db: Firestore, actor: Actor, body: unknown) {
  const data = z.object({ contactId: z.string().min(1), connectionId: z.string().min(1), propertyId: z.string().optional() }).parse(body);
  const [contact, connection] = await Promise.all([agencyCollection(db, actor.agencyId, 'contacts').doc(data.contactId).get(), agencyCollection(db, actor.agencyId, 'channelConnections').doc(data.connectionId).get()]);
  if (!contact.exists || connection.data()?.channel !== 'whatsapp' || connection.data()?.status !== 'connected') throw new CommunicationError('Alege un contact și un număr WhatsApp conectat.');
  const raw = String(contact.data()?.phone || '').replace(/[\s().-]/g, '');
  const phone = raw.startsWith('+') ? raw.slice(1) : raw.startsWith('00') ? raw.slice(2) : raw;
  if (!/^[1-9]\d{7,14}$/.test(phone)) throw new CommunicationError('Completează telefonul contactului în format internațional, de exemplu +407…');
  if (data.propertyId && !(await agencyCollection(db, actor.agencyId, 'properties').doc(data.propertyId).get()).exists) throw new CommunicationError('Proprietatea nu există.');
  const id = stableId(data.connectionId, phone); const ref = agencyCollection(db, actor.agencyId, 'conversations').doc(id);
  await db.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (current.exists) { if (!canReadConversation(actor, current.data() as Conversation)) throw new CommunicationError('Conversația este atribuită altui agent.', 403); return; }
    const createdAt = nowIso();
    tx.create(ref, { id, agencyId: actor.agencyId, channel: 'whatsapp', connectionId: data.connectionId, externalParticipantId: phone,
      name: contact.data()?.name || phone, phone, email: contact.data()?.email || '', contactId: data.contactId,
      propertyIds: data.propertyId ? [data.propertyId] : [], assigneeId: actor.uid, collaboratorIds: [], accessUids: [actor.uid],
      status: 'new', lastMessageAt: createdAt, latestMessage: '', lastInboundAt: null, lastOutboundAt: null, needsReply: false,
      readBy: {}, version: 1, createdAt });
  });
  return { conversationId: id };
}
