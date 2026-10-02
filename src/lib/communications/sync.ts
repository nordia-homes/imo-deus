import type { Firestore } from 'firebase-admin/firestore';
import { agencyCollection, CommunicationError, getConversation, ingestMessage, nowIso } from './server';
import { connectionToken, graph } from './meta';
import type { Actor, Connection } from './model';
export async function syncConversation(db: Firestore, actor: Actor, id: string) {
  const conversation = await getConversation(db, actor, id);
  if (!['messenger', 'instagram'].includes(conversation.channel)) throw new CommunicationError('Istoricul acestui canal este primit prin webhook.');
  const ref = agencyCollection(db, actor.agencyId, 'conversations').doc(id);
  const claim = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if ((snap.data()?.nextSyncAt || 0) > Date.now()) return false;
    tx.update(ref, { nextSyncAt: Date.now() + 60000 }); return true;
  });
  if (!claim) return { throttled: true };
  const { connection, token } = await connectionToken(db, actor, conversation.connectionId, 'send');
  const account = connection.channel === 'instagram' ? connection.parentId || connection.externalId : connection.externalId;
  const result = await graph<{ data: Array<{ id: string }> }>(`/${account}/conversations?platform=${connection.channel === 'instagram' ? 'instagram' : 'messenger'}&user_id=${encodeURIComponent(conversation.externalParticipantId)}&fields=id`, token);
  if (!result.data.length) return { imported: 0 };
  let cursor = ''; let count = 0;
  for (let page = 0; page < 5; page++) {
    const messages = await graph<{ data: Array<{ id: string; message?: string; from?: { id: string; name?: string }; created_time: string }>; paging?: { cursors?: { after?: string }; next?: string } }>(`/${result.data[0].id}/messages?fields=id,message,from,created_time&limit=50${cursor ? `&after=${encodeURIComponent(cursor)}` : ''}`, token);
    for (const message of messages.data) {
      const sent = [connection.externalId, connection.parentId].includes(message.from?.id);
      await ingestMessage(db, connection, { channel: connection.channel, accountId: connection.externalId, participantId: conversation.externalParticipantId, externalId: message.id,
        text: message.message || '[Mesaj fără text]', name: sent ? undefined : message.from?.name, direction: sent ? 'sent' : 'received', createdAt: new Date(message.created_time).toISOString(), attachments: [], imported: true });
      count++;
    }
    if (!messages.paging?.next || !messages.paging.cursors?.after) break;
    cursor = messages.paging.cursors.after;
  }
  await ref.update({ lastSyncAt: nowIso(), historyImportLimit: 250 });
  return { imported: count, limit: 250 };
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
