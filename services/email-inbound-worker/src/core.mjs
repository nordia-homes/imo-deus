export const MAX_RAW_BYTES = 35 * 1024 * 1024;
export const MAX_ATTACHMENT_COUNT = 12;
export const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
export const MAX_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_TEXT_LENGTH = 1_000_000;
export const MAX_HTML_LENGTH = 2_000_000;

const RECIPIENT_PATTERN = /^inbox\+([a-zA-Z0-9_-]{12,})@reply\.imodeus\.ro$/i;

export class InboundValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InboundValidationError';
  }
}

export function isAllowedRecipient(recipient) {
  return RECIPIENT_PATTERN.test(String(recipient || '').trim());
}

export function validateRawSize(rawSize) {
  if (!Number.isFinite(rawSize) || rawSize < 0) {
    throw new InboundValidationError('Dimensiunea mesajului este invalida.');
  }
  if (rawSize > MAX_RAW_BYTES) {
    throw new InboundValidationError('Mesajul depaseste limita de dimensiune acceptata.');
  }
}

function toBytes(content) {
  if (content instanceof Uint8Array) return content;
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  if (ArrayBuffer.isView(content)) {
    return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
  }
  throw new InboundValidationError('Continutul unui atasament este invalid.');
}

export function encodeBase64(content) {
  const bytes = toBytes(content);
  const chunkSize = 24_576;
  const encoded = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    let binary = '';
    for (let index = 0; index < chunk.length; index += 1) {
      binary += String.fromCharCode(chunk[index]);
    }
    encoded.push(btoa(binary));
  }
  return encoded.join('');
}

function shouldIncludeAttachment(attachment) {
  const disposition = String(attachment?.disposition || '').toLowerCase();
  if (attachment?.related === true || disposition === 'inline') return false;
  return disposition === 'attachment' || Boolean(attachment?.filename);
}

function formatMailbox(mailbox, fallback) {
  const address = String(mailbox?.address || fallback || '').trim();
  const name = String(mailbox?.name || '').replace(/[\r\n<>]/g, ' ').trim();
  return name && address ? `${name} <${address}>` : address;
}

function normalizeAttachment(attachment, index) {
  const bytes = toBytes(attachment.content);
  return {
    name: String(attachment.filename || `document-${index + 1}`).slice(0, 180),
    type: String(attachment.mimeType || 'application/octet-stream').slice(0, 160),
    bytes,
  };
}

export function createInboundPayload(parsed, envelope) {
  const recipient = String(envelope?.to || '').trim();
  if (!isAllowedRecipient(recipient)) {
    throw new InboundValidationError('Destinatarul Imodeus este invalid.');
  }

  const attachments = (Array.isArray(parsed?.attachments) ? parsed.attachments : [])
    .filter(shouldIncludeAttachment)
    .map(normalizeAttachment);

  const totalBytes = attachments.reduce((total, attachment) => total + attachment.bytes.length, 0);
  if (attachments.length > MAX_ATTACHMENT_COUNT) {
    throw new InboundValidationError('Mesajul contine prea multe atasamente.');
  }
  if (attachments.some((attachment) => attachment.bytes.length > MAX_ATTACHMENT_BYTES)) {
    throw new InboundValidationError('Un atasament depaseste limita acceptata.');
  }
  if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
    throw new InboundValidationError('Atasamentele depasesc limita totala acceptata.');
  }

  return {
    recipient,
    sender: formatMailbox(parsed?.from, envelope?.from),
    subject: String(parsed?.subject || envelope?.subject || '').slice(0, 998),
    bodyText: String(parsed?.text || '').slice(0, MAX_TEXT_LENGTH),
    bodyHtml: String(parsed?.html || '').slice(0, MAX_HTML_LENGTH),
    providerMessageId: String(parsed?.messageId || envelope?.messageId || crypto.randomUUID()).slice(0, 998),
    attachments: attachments.map((attachment) => ({
      name: attachment.name,
      type: attachment.type,
      base64: encodeBase64(attachment.bytes),
    })),
  };
}

export function classifyWebhookStatus(status) {
  if (status >= 200 && status < 300) return 'accepted';
  if ([400, 404, 413, 422].includes(status)) return 'reject';
  return 'retry';
}

export function assertWebhookConfiguration(env) {
  if (!env?.IMODEUS_INBOUND_SECRET) {
    throw new Error('Secretul webhook nu este configurat.');
  }
  const endpoint = new URL(String(env.IMODEUS_INBOUND_URL || ''));
  if (endpoint.protocol !== 'https:') {
    throw new Error('Endpoint-ul inbound trebuie sa foloseasca HTTPS.');
  }
  return endpoint.toString();
}
