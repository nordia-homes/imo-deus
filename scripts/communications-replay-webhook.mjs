import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const id = process.argv.find(argument => /^[a-f0-9]{64}$/.test(argument));
if (!id) throw new Error('Usage: node scripts/communications-replay-webhook.mjs <64-character-event-id> [--write]');
initializeApp({ credential: applicationDefault() });
const db = getFirestore();
const ref = db.collection('communicationWebhookEvents').doc(id);
const snapshot = await ref.get();
if (!snapshot.exists) throw new Error('Webhook event not found.');
const event = snapshot.data();
console.log(JSON.stringify({ id, status: event.status, attempts: event.attempts, createdAt: event.createdAt, error: event.error }, null, 2));
if (event.status !== 'failed') throw new Error('Only failed webhook events can be replayed.');
if (process.argv.includes('--write')) {
  await db.runTransaction(async transaction => {
    const fresh = await transaction.get(ref);
    if (fresh.data()?.status !== 'failed') throw new Error('Status changed; replay cancelled.');
    transaction.update(ref, { status: 'queued', attempts: 0, replayedAt: new Date().toISOString(), error: null });
  });
  console.log('Webhook event queued for replay.');
} else {
  console.log('Dry run. Add --write to queue this event after checking its account and payload in the restricted operator console.');
}
