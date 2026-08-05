import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './index.mjs';

function createMessage({ to = 'inbox+abcDEF_123456789@reply.imodeus.ro', raw }) {
  const rejected = [];
  return {
    from: 'ion@example.com',
    to,
    headers: new Headers({
      subject: 'Documente IMD-V12345',
      'message-id': '<worker-test@example.com>',
    }),
    raw: new Response(raw).body,
    rawSize: new TextEncoder().encode(raw).byteLength,
    setReject(reason) {
      rejected.push(reason);
    },
    rejected,
  };
}

test('parseaza un MIME real si livreaza payload-ul autentificat', async () => {
  const raw = [
    'From: Ion Popescu <ion@example.com>',
    'To: inbox+abcDEF_123456789@reply.imodeus.ro',
    'Subject: Documente IMD-V12345',
    'Message-ID: <worker-test@example.com>',
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="imodeus-boundary"',
    '',
    '--imodeus-boundary',
    'Content-Type: text/plain; charset=utf-8',
    '',
    'Am atasat documentul.',
    '--imodeus-boundary',
    'Content-Type: application/pdf; name="contract.pdf"',
    'Content-Disposition: attachment; filename="contract.pdf"',
    'Content-Transfer-Encoding: base64',
    '',
    'AQID',
    '--imodeus-boundary--',
    '',
  ].join('\r\n');
  const message = createMessage({ raw });
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options, payload: JSON.parse(options.body) };
    return new Response(JSON.stringify({ accepted: true }), { status: 200 });
  };

  try {
    await worker.email(message, {
      IMODEUS_INBOUND_URL: 'https://example.com/api/email/inbound',
      IMODEUS_INBOUND_SECRET: 'test-secret',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(message.rejected.length, 0);
  assert.equal(request.url, 'https://example.com/api/email/inbound');
  assert.equal(request.options.headers['x-imodeus-inbound-secret'], 'test-secret');
  assert.equal(request.payload.sender, 'Ion Popescu <ion@example.com>');
  assert.equal(request.payload.providerMessageId, '<worker-test@example.com>');
  assert.equal(request.payload.attachments.length, 1);
  assert.equal(request.payload.attachments[0].name, 'contract.pdf');
  assert.equal(request.payload.attachments[0].base64, 'AQID');
});

test('refuza aliasurile fara token inainte de parsare sau livrare', async () => {
  const message = createMessage({
    to: 'inbox@reply.imodeus.ro',
    raw: 'From: ion@example.com\r\nMessage-ID: <invalid@example.com>\r\n\r\nTest',
  });
  await worker.email(message, {});
  assert.equal(message.rejected.length, 1);
  assert.match(message.rejected[0], /invalid/i);
});
