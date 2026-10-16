import { randomUUID } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { agencyCollection, CommunicationError, getConversation, ingestMessage, nowIso } from './server';
import { connectionToken, graph } from './meta';
import { canReadConversation, type Actor, type Connection, type Conversation } from './model';
import { stableId } from './crypto';

export async function syncConversation(db: Firestore, actor: Actor, id: string) {
  const conversation = await getConversation(db, actor, id);
  if (!['messenger', 'instagram'].includes(conversation.channel)) return { status: 'webhook_only', complete: true, processed: 0, conversationId: id };
  if (stableId(conversation.connectionId, conversation.externalParticipantId) !== id) throw new CommunicationError('Identitatea conversației nu corespunde furnizorului.', 409);
  const ref = agencyCollection(db, actor.agencyId, 'conversations').doc(id), claimId = randomUUID();
  const binding = JSON.stringify([conversation.connectionId, conversation.externalParticipantId, conversation.channel]);
  const checkpoint = await db.runTransaction(async tx => {
    const [snap, member] = await Promise.all([tx.get(ref), tx.get(db.collection('users').doc(actor.uid))]);
    const row = snap.data();
    if (!row || !['agent', 'admin'].includes(actor.role || '') || member.data()?.agencyId !== actor.agencyId || member.data()?.role !== actor.role || !canReadConversation(actor, row as Conversation)) throw new CommunicationError('Acces revocat.', 403);
    if (JSON.stringify([row.connectionId, row.externalParticipantId, row.channel]) !== binding) throw new CommunicationError('Conversația s-a schimbat.', 409);
    if ((row.nextSyncAt || 0) > Date.now()) return null;
    tx.update(ref, { nextSyncAt: Date.now() + 120000, syncClaimId: claimId, syncStatus: 'running', lastSyncAttemptAt: nowIso(), syncErrorCode: null });
    return row.syncBinding === binding ? { cursor: String(row.syncCursor || ''), threadId: String(row.syncThreadId || '') } : { cursor: '', threadId: '' };
  });
  if (!checkpoint) return { status: 'throttled', complete: false, processed: 0, conversationId: id };
  let processed = 0;
  const persist = async (patch: Record<string, unknown>) => db.runTransaction(async tx => {
    const [snap, member] = await Promise.all([tx.get(ref), tx.get(db.collection('users').doc(actor.uid))]);
    const row = snap.data();
    if (!row || row.syncClaimId !== claimId || member.data()?.agencyId !== actor.agencyId || member.data()?.role !== actor.role || !canReadConversation(actor, row as Conversation) || JSON.stringify([row.connectionId, row.externalParticipantId, row.channel]) !== binding) throw new CommunicationError('Accesul sau conversația s-a schimbat.', 403);
    tx.update(ref, { ...patch, syncBinding: binding });
  });
  try {
    const { connection, token } = await connectionToken(db, actor, conversation.connectionId, 'send');
    if (connection.id !== conversation.connectionId || connection.agencyId !== actor.agencyId || connection.channel !== conversation.channel) throw new CommunicationError('Conexiune incompatibilă.', 409);
    const account = connection.channel === 'instagram' ? connection.parentId || connection.externalId : connection.externalId;
    let threadId = checkpoint.threadId, cursor = checkpoint.cursor;
    if (!threadId) {
      const result = await graph<{ data: Array<{ id: string }> }>('/' + account + '/conversations?platform=' + connection.channel + '&user_id=' + encodeURIComponent(conversation.externalParticipantId) + '&fields=id', token);
      if (!Array.isArray(result.data) || result.data.length > 1 || result.data.some(row => typeof row.id !== 'string' || !row.id)) throw new CommunicationError('Identitatea istoricului nu este unică.', 409);
      threadId = result.data[0]?.id || '';
    }
    for (let page = 0; threadId && page < 20; page++) {
      const messages = await graph<{ data: Array<{ id: string; message?: string; from?: { id: string; name?: string }; created_time: string }>; paging?: { cursors?: { after?: string }; next?: string } }>('/' + encodeURIComponent(threadId) + '/messages?fields=id,message,from,created_time&limit=50' + (cursor ? '&after=' + encodeURIComponent(cursor) : ''), token);
      if (!Array.isArray(messages.data) || messages.data.length > 50) throw new CommunicationError('Pagină de istoric invalidă.', 502);
      for (const message of messages.data) {
        if (!message.id || !Number.isFinite(Date.parse(message.created_time))) throw new CommunicationError('Mesaj de istoric invalid.', 502);
        const sent = [connection.externalId, connection.parentId].filter(Boolean).includes(message.from?.id);
        if (!sent && message.from?.id !== conversation.externalParticipantId) throw new CommunicationError('Participantul istoricului nu corespunde.', 409);
        await ingestMessage(db, connection, { channel: connection.channel, accountId: connection.externalId, participantId: conversation.externalParticipantId, externalId: message.id,
          text: message.message || '[Mesaj fără text]', name: sent ? undefined : message.from?.name, direction: sent ? 'sent' : 'received', createdAt: new Date(message.created_time).toISOString(), attachments: [], imported: true }, { actor, conversationId: id });
        processed++;
      }
      const next = messages.paging?.next ? messages.paging.cursors?.after : '';
      if (messages.paging?.next && (!next || next === cursor)) throw new CommunicationError('Cursor de istoric invalid.', 502);
      cursor = next || '';
      await persist({ syncCursor: cursor, syncThreadId: cursor ? threadId : '', nextSyncAt: Date.now() + 120000 });
      if (!cursor) break;
    }
    const complete = !cursor;
    await persist({ syncStatus: complete ? 'completed' : 'partial', syncProcessed: processed, syncCursor: cursor, syncThreadId: cursor ? threadId : '', nextSyncAt: complete ? Date.now() + 60000 : 0, ...(complete ? { lastSyncAt: nowIso() } : {}) });
    return { status: complete ? 'completed' : 'partial', complete, processed, conversationId: id };
  } catch (error) {
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (snap.data()?.syncClaimId === claimId) tx.update(ref, { syncStatus: 'failed', syncErrorCode: error instanceof CommunicationError && error.status === 403 ? 'access_changed' : 'provider_or_data_error', syncProcessed: processed, nextSyncAt: 0 });
    });
    throw new CommunicationError('Sincronizarea nu s-a încheiat. Progresul salvat permite reluarea fără dublarea mesajelor.', 502);
  }
}
export async function disconnectCommunicationsByMetaUser(db: Firestore, metaUserId: string, appId?: string) {
  const secrets = await db.collection('communicationSecrets').where('metaUserId', '==', metaUserId).get();
  for (const secret of secrets.docs) {
    const data = secret.data();
    const legacyAppId = process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || '';
    if (appId && (data.appId || legacyAppId) !== appId) continue;
    const ref = agencyCollection(db, data.agencyId, 'channelConnections').doc(secret.id);
    const snapshot = await ref.get();
    if (snapshot.exists) {
      const connection = snapshot.data() as Connection;
      await ref.update({ status: 'disconnected', capabilities: Object.fromEntries(Object.keys(connection.capabilities).map(key => [key, { status: 'reconnect_required', reason: 'Accesul Meta a fost revocat.' }])) });
    }
    await secret.ref.delete();
  }
  const grants = await db.collection('communicationGrants').where('metaUserId', '==', metaUserId).get();
  for (const grant of grants.docs) {
    const legacyAppId = process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || '';
    if (!appId || (grant.data().appId || legacyAppId) === appId) await grant.ref.delete();
  }
}
