import type { Firestore } from 'firebase-admin/firestore';
import { agencyCollection, CommunicationError } from './server';
import { canReadConversation, normalizeSearch, type Actor, type Conversation } from './model';

async function typesense(path: string, method = 'GET', body?: unknown) {
  const base = process.env.TYPESENSE_URL; const key = process.env.TYPESENSE_API_KEY;
  if (!base || !key) throw new CommunicationError('Căutarea în mesaje nu este configurată. Navigarea și mesajele rămân disponibile.', 503);
  if (!base.startsWith('https://')) throw new CommunicationError('Typesense necesită HTTPS.', 503);
  const response = await fetch(`${base.replace(/\/$/, '')}${path}`, { method, headers: { 'X-TYPESENSE-API-KEY': key, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new CommunicationError('Căutarea în mesaje este temporar indisponibilă.', 503);
  return response.json();
}
export async function initializeSearch() {
  const collections = await typesense('/collections');
  if (!collections.some((c: { name: string }) => c.name === 'imodeus_messages')) await typesense('/collections', 'POST', { name: 'imodeus_messages', fields: [
    { name: 'agencyId', type: 'string', facet: true }, { name: 'conversationId', type: 'string' }, { name: 'messageId', type: 'string' },
    { name: 'channel', type: 'string', facet: true }, { name: 'text', type: 'string' }, { name: 'contact', type: 'string' }, { name: 'reference', type: 'string' },
    { name: 'createdAt', type: 'int64' },
  ] });
}
export async function drainSearch(db: Firestore) {
  if (!process.env.TYPESENSE_URL || !process.env.TYPESENSE_API_KEY) return 0;
  await initializeSearch();
  const jobs = await db.collection('communicationSearchJobs').where('status', '==', 'queued').limit(50).get();
  for (const job of jobs.docs) {
    const data = job.data(); const ref = agencyCollection(db, data.agencyId, 'conversations').doc(data.conversationId);
    const [conversation, message] = await Promise.all([ref.get(), ref.collection('messages').doc(data.messageId).get()]);
    if (!conversation.exists || !message.exists) {
      await typesense(`/collections/imodeus_messages/documents?filter_by=id:=${encodeURIComponent(job.id)}`, 'DELETE');
    } else {
      const c = conversation.data()!; const m = message.data()!;
      await typesense('/collections/imodeus_messages/documents?action=upsert', 'POST', { id: job.id, agencyId: data.agencyId, conversationId: data.conversationId, messageId: data.messageId,
        channel: c.channel, text: normalizeSearch(`${m.text} ${(m.attachments || []).map((a: { name: string }) => a.name).join(' ')}`),
        contact: normalizeSearch([c.name, c.phone, c.email].filter(Boolean).join(' ')), reference: (c.propertyIds || []).join(' '), createdAt: Date.parse(m.createdAt) });
    }
    await db.runTransaction(async tx => { const fresh = await tx.get(job.ref); if (fresh.data()?.updatedAt === data.updatedAt) tx.update(job.ref, { status: 'completed' }); });
  }
  return jobs.size;
}
export async function searchMessages(db: Firestore, actor: Actor, q: string, page = 1) {
  if (q.trim().length < 2) return { results: [] };
  // Agency identifiers are never accepted from client query parameters.
  if (!/^[a-zA-Z0-9_-]+$/.test(actor.agencyId)) throw new CommunicationError('Identificator agenție invalid.');
  const params = new URLSearchParams({ q: normalizeSearch(q).slice(0, 200), query_by: 'contact,reference,text', filter_by: `agencyId:=${actor.agencyId}`, per_page: '20', page: String(Math.max(1, Math.min(page, 100))), num_typos: /^\+?\d+$/.test(q) ? '0' : '2' });
  const data = await typesense(`/collections/imodeus_messages/documents/search?${params}`);
  const results = [];
  for (const hit of data.hits || []) {
    const index = hit.document;
    const ref = agencyCollection(db, actor.agencyId, 'conversations').doc(index.conversationId);
    const [c, m] = await Promise.all([ref.get(), ref.collection('messages').doc(index.messageId).get()]);
    if (!c.exists || !m.exists || !canReadConversation(actor, c.data() as Conversation)) continue;
    // Return current authorized content, never snippets or aggregate counts from the stale index.
    results.push({ conversationId: c.id, messageId: m.id, name: c.data()!.name, text: String(m.data()!.text).slice(0, 500), createdAt: m.data()!.createdAt });
  }
  return { results, nextPage: (data.hits || []).length === 20 ? page + 1 : null };
}
