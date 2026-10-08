import type { Channel, Message } from './model';
type ObjectValue = Record<string, any>; // Provider payloads are validated field-by-field below.
export type IncomingEvent = {
  replyTo?: string;
  channel: Channel; accountId: string; participantId: string; externalId: string;
  text: string; name?: string; direction: 'received' | 'sent'; createdAt: string;
  attachments: Message['attachments']; status?: Message['status']; error?: string; imported?: boolean; nativeEcho?: boolean; socialEcho?: boolean; sourceAppId?: string; correlation?: string;
};
function time(value: unknown, milliseconds = false) {
  const number = Number(value) * (milliseconds ? 1 : 1000);
  if (!Number.isFinite(number) || number <= 0 || !Number.isFinite(new Date(number).getTime())) throw new Error('Timestamp webhook invalid.');
  return new Date(number).toISOString();
}
function waMessage(message: ObjectValue, accountId: string, imported = false, echo = false): IncomingEvent | null {
  if (typeof message.id !== 'string') return null;
  const sent = echo || Boolean(message.to && message.from === accountId);
  const participantId = sent ? message.to : message.from;
  if (typeof participantId !== 'string') return null;
  const type = String(message.type || 'text');
  const media = ['image', 'video', 'audio', 'document', 'sticker'].includes(type) ? message[type] : null;
  return { channel: 'whatsapp', accountId, participantId, externalId: message.id,
    ...(typeof message.context?.id === 'string' ? { replyTo: message.context.id } : {}),
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
        const failure = status.status === 'failed' ? status.errors?.[0] : null;
        const error = failure ? [failure.code, failure.title || failure.message].filter(Boolean).join(': ').slice(0, 500) : undefined;
        result.push({ channel: 'whatsapp', accountId: account, participantId: String(status.recipient_id), externalId: String(status.id), text: '', direction: 'sent', createdAt: time(status.timestamp), attachments: [], status: status.status === 'sent' ? 'accepted' : status.status, ...(error ? { error } : {}), ...(typeof status.biz_opaque_callback_data === 'string' ? { correlation: status.biz_opaque_callback_data } : {}) });
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
        socialEcho: sent, ...(message.app_id != null ? { sourceAppId: String(message.app_id) } : {}),
        text: String(message.text || ''), attachments: (message.attachments || []).map((a: ObjectValue) => ({ name: String(a.type || 'Fișier'), type: String(a.type || 'file'), ...(typeof a.payload?.url === 'string' ? { url: a.payload.url } : {}) })) });
    }
  }
  return result;
}

export function isExternalSocialEcho(event: IncomingEvent, appId: string, mappedOrigin: string | null, possibleOutgoing: boolean) {
  if (!event.socialEcho || event.status || event.imported) return false;
  if (mappedOrigin === 'imodeus') return false;
  if (event.sourceAppId && appId) return event.sourceAppId !== appId;
  return !possibleOutgoing;
}

// Split provider batches so one malformed message cannot hide later messages or STOP.
export function normalizeWebhookSafely(payload: unknown): { events: IncomingEvent[]; errors: string[] } {
  const events: IncomingEvent[] = []; const errors: string[] = [];
  const parse = (part: ObjectValue) => { try { events.push(...normalizeWebhook(part)); } catch { errors.push('Eveniment webhook invalid.'); } };
  if (!payload || typeof payload !== 'object' || !Array.isArray((payload as ObjectValue).entry)) return { events, errors: ['Structură webhook invalidă.'] };
  const p = payload as ObjectValue;
  for (const entry of p.entry) {
    if (!entry || typeof entry !== 'object') { errors.push('Intrare webhook invalidă.'); continue; }
    if (Array.isArray(entry.messaging)) for (const item of entry.messaging) parse({ object: p.object, entry: [{ id: entry.id, messaging: [item] }] });
    if (Array.isArray(entry.changes)) for (const change of entry.changes) {
      const value = change?.value;
      if (!value || typeof value !== 'object') { errors.push('Valoare webhook invalidă.'); continue; }
      for (const key of ['messages', 'message_echoes', 'statuses', 'history']) {
        if (value[key] === undefined) continue;
        if (!Array.isArray(value[key])) { errors.push('Listă webhook invalidă.'); continue; }
        for (const item of value[key]) {
          const single: ObjectValue = { metadata: value.metadata, contacts: Array.isArray(value.contacts) ? value.contacts : [], [key]: [item] };
          if (!single.metadata?.phone_number_id) { errors.push('Identificatorul numărului lipsește din webhook.'); continue; }
          parse({ object: p.object, entry: [{ id: entry.id, changes: [{ field: change.field, value: single }] }] });
        }
      }
    }
  }
  return { events, errors };
}
