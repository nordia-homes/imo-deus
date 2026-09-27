import { adminStorage } from '@/firebase/admin';
import type { Firestore } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { agencyCollection, CommunicationError, getConversation } from './server';
import { connectionToken, graph } from './meta';
import type { Actor } from './model';
const MAX_BYTES = 10 * 1024 * 1024;
export async function saveAttachment(db: Firestore, actor: Actor, conversationId: string, file: File) {
  await getConversation(db, actor, conversationId);
  if (file.size > MAX_BYTES || file.size === 0) throw new CommunicationError('Fișierul trebuie să aibă maximum 10 MB.');
  const bytes = Buffer.from(await file.arrayBuffer());
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const pdf = bytes.subarray(0, 5).toString() === '%PDF-';
  const mime = png ? 'image/png' : jpeg ? 'image/jpeg' : pdf ? 'application/pdf' : null;
  if (!mime) throw new CommunicationError('Formate acceptate: JPEG, PNG și PDF.');
  if (pdf) {
    const scanner = process.env.COMMUNICATIONS_SCAN_URL;
    if (!scanner?.startsWith('https://')) throw new CommunicationError('Trimiterea PDF necesită configurarea scanării de siguranță.', 503);
    const response = await fetch(scanner, { method: 'POST', headers: { 'Content-Type': mime, Authorization: `Bearer ${process.env.COMMUNICATIONS_SCAN_TOKEN || ''}` }, body: bytes, signal: AbortSignal.timeout(20000) });
    const result = await response.json(); if (!response.ok || result.safe !== true) throw new CommunicationError('Fișierul nu a trecut verificarea de siguranță.');
  }
  const id = randomUUID(); const path = `privateCommunications/${actor.agencyId}/${conversationId}/${id}`;
  await adminStorage.bucket().file(path).save(bytes, { metadata: { contentType: mime, cacheControl: 'private, no-store' } });
  const name = file.name.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 120);
  await agencyCollection(db, actor.agencyId, 'communicationMedia').doc(id).create({ conversationId, path, mime, name, size: bytes.length, createdBy: actor.uid, createdAt: new Date().toISOString() });
  return { attachmentId: id, name };
}
export async function attachmentForSend(db: Firestore, actor: Actor, conversationId: string, id: string) {
  const ref = await agencyCollection(db, actor.agencyId, 'communicationMedia').doc(id).get();
  const media = ref.data();
  if (!media || media.conversationId !== conversationId) throw new CommunicationError('Atașamentul nu aparține conversației.');
  const [url] = await adminStorage.bucket().file(media.path).getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60000 });
  return { url, type: media.mime.startsWith('image/') ? 'image' : 'document', name: media.name as string };
}
function trustedMediaUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !['facebook.com','fbcdn.net','fbsbx.com','cdninstagram.com'].some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) throw new CommunicationError('Adresa atașamentului nu este acceptată.');
  return url;
}
export async function downloadAttachment(db: Firestore, actor: Actor, conversationId: string, messageId: string, index: number) {
  const conversation = await getConversation(db, actor, conversationId);
  const message = await agencyCollection(db, actor.agencyId, 'conversations').doc(conversationId).collection('messages').doc(messageId).get();
  const attachment = message.data()?.attachments?.[index];
  if (!attachment) throw new CommunicationError('Atașament indisponibil.', 404);
  if (attachment.localId) {
    const media = await agencyCollection(db, actor.agencyId, 'communicationMedia').doc(attachment.localId).get();
    if (media.data()?.conversationId !== conversationId) throw new CommunicationError('Atașament indisponibil.', 404);
    const [buffer] = await adminStorage.bucket().file(media.data()!.path).download();
    return { bytes: buffer, name: media.data()!.name, mime: media.data()!.mime };
  }
  let url = attachment.url; let token = '';
  if (conversation.channel === 'whatsapp' && attachment.id) {
    const credentials = await connectionToken(db, actor, conversation.connectionId, 'send'); token = credentials.token;
    const media = await graph(`/${encodeURIComponent(attachment.id)}`, token); url = media.url;
  }
  if (!url) throw new CommunicationError('Atașamentul nu mai este disponibil.', 404);
  let response: Response | null = null;
  for (let count = 0; count < 3; count++) {
    const safe = trustedMediaUrl(url);
    response = await fetch(safe, { redirect: 'manual', headers: token && safe.hostname === 'lookaside.fbsbx.com' ? { Authorization: `Bearer ${token}` } : {}, signal: AbortSignal.timeout(15000) });
    if (response.status >= 300 && response.status < 400) { url = new URL(response.headers.get('location') || '', safe).toString(); continue; }
    break;
  }
  if (!response?.ok || !response.body) throw new CommunicationError('Descărcarea atașamentului a eșuat.', 502);
  const chunks: Uint8Array[] = []; let length = 0; const reader = response.body.getReader();
  while (true) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > MAX_BYTES) { await reader.cancel(); throw new CommunicationError('Atașamentul depășește 10 MB.'); } chunks.push(value); }
  return { bytes: Buffer.concat(chunks), name: attachment.name || 'fisier', mime: response.headers.get('content-type') || 'application/octet-stream' };
}
