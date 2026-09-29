import type { Firestore } from 'firebase-admin/firestore';
import { agencyCollection, nowIso } from './server';
import { stableId } from './crypto';
import type { Connection } from './model';
import type { IncomingEvent } from './normalize';

const stopWords = new Set(['stop', 'dezabonare', 'dezaboneaza', 'nu mai vreau mesaje', 'nu mai doresc mesaje', 'nu ma mai contactati']);

function normalizedCommand(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[.!\s]+$/g, '');
}

export async function recordInboundOptOut(db: Firestore, connection: Connection, event: IncomingEvent) {
  if (connection.channel !== 'whatsapp' || event.direction !== 'received' || event.imported || event.status) return false;
  const command = normalizedCommand(event.text);
  if (!stopWords.has(command)) return false;
  const ref = agencyCollection(db, connection.agencyId, 'communicationConsents')
    .doc(stableId(connection.id, event.participantId, 'all'));
  const history = ref.collection('history').doc(stableId(connection.id, event.externalId, 'optout'));
  return db.runTransaction(async tx => {
    const [current, previous] = await Promise.all([tx.get(ref), tx.get(history)]);
    if (previous.exists) return false;
    const record = { status: 'revoked', purpose: 'all', source: 'whatsapp_inbound',
      connectionId: connection.id, participantId: event.participantId, externalMessageId: event.externalId,
      evidence: event.text.slice(0, 200), recordedAt: event.createdAt, processedAt: nowIso() };
    tx.create(history, record);
    if (!current.exists || !current.data()?.recordedAt || current.data()!.recordedAt <= event.createdAt) tx.set(ref, record);
    return true;
  });
}
