import type { Channel, Message } from './model';
type ObjectValue = Record<string, any>; // Provider payloads are validated field-by-field below.
export type IncomingEvent = {
  channel: Channel; accountId: string; participantId: string; externalId: string;
  text: string; name?: string; direction: 'received' | 'sent'; createdAt: string;
  attachments: Message['attachments']; status?: Message['status']; imported?: boolean; nativeEcho?: boolean;
};
function time(value: unknown, milliseconds = false) {
  const number = Number(value) * (milliseconds ? 1 : 1000);
  return Number.isFinite(number) && number > 0 ? new Date(number).toISOString() : new Date().toISOString();
}
function waMessage(message: ObjectValue, accountId: string, imported = false, echo = false): IncomingEvent | null {
  if (typeof message.id !== 'string') return null;
  const sent = echo || Boolean(message.to && message.from === accountId);
  const participantId = sent ? message.to : message.from;
  if (typeof participantId !== 'string') return null;
  const type = String(message.type || 'text');
  const media = ['image', 'video', 'audio', 'document', 'sticker'].includes(type) ? message[type] : null;
  return { channel: 'whatsapp', accountId, participantId, externalId: message.id,
    direction: sent ? 'sent' : 'received', text: String(message.text?.body || media?.caption || message.button?.text || message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || (media ? '' : `[${type}]`)),
    createdAt: time(message.timestamp), imported, nativeEcho: echo && !imported,
    attachments: media?.id ? [{ id: String(media.id), name: String(media.filename || type), type }] : [] };
}
export function normalizeWebhook(payload: ObjectValue): IncomingEvent[] {
  const result: IncomingEvent[] = [];
  for (const entry of Array.isArray(payload.entry) ? payload.entry : []) {
    for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
      const value = change.value || {};
      const account = String(value.metadata?.phone_number_id || '');
      if (!account) continue;
      for (const message of [...(value.messages || []), ...(value.message_echoes || [])]) {
        const event = waMessage(message, account, false, change.field === 'smb_message_echoes' || change.field === 'message_echoes');
        if (event) { event.name = value.contacts?.find((c: ObjectValue) => c.wa_id === event.participantId)?.profile?.name; result.push(event); }
      }
      for (const status of value.statuses || []) {
        if (!['sent', 'delivered', 'read', 'failed'].includes(status.status) || !status.id || !status.recipient_id) continue;
        result.push({ channel: 'whatsapp', accountId: account, participantId: String(status.recipient_id), externalId: String(status.id), text: '', direction: 'sent', createdAt: time(status.timestamp), attachments: [], status: status.status === 'sent' ? 'accepted' : status.status });
      }
      for (const history of value.history || []) for (const thread of history.threads || []) for (const message of thread.messages || []) {
        const echo = message.from !== thread.id;
        const event = waMessage({ ...message, to: echo ? thread.id : message.to }, account, true, echo);
        if (event) result.push(event);
      }
    }
    for (const event of Array.isArray(entry.messaging) ? entry.messaging : []) {
      if (Array.isArray(event.delivery?.mids)) for (const mid of event.delivery.mids) {
        result.push({ channel: payload.object === 'instagram' ? 'instagram' : 'messenger', accountId: String(entry.id), participantId: String(event.sender?.id || ''), externalId: String(mid), text: '', direction: 'sent', createdAt: time(event.timestamp, true), attachments: [], status: 'delivered' });
      }
      const message = event.message;
      if (!message?.mid) continue;
      const accountId = String(entry.id || '');
      const sent = Boolean(message.is_echo) || String(event.sender?.id) === accountId;
      const participantId = String((sent ? event.recipient : event.sender)?.id || '');
      if (!accountId || !participantId) continue;
      result.push({ channel: payload.object === 'instagram' ? 'instagram' : 'messenger', accountId, participantId,
        externalId: String(message.mid), direction: sent ? 'sent' : 'received', createdAt: time(event.timestamp, true),
        text: String(message.text || ''), attachments: (message.attachments || []).map((a: ObjectValue) => ({ name: String(a.type || 'Fișier'), type: String(a.type || 'file'), ...(typeof a.payload?.url === 'string' ? { url: a.payload.url } : {}) })) });
    }
  }
  return result;
}
