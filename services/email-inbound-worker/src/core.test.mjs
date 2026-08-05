import assert from 'node:assert/strict';
import test from 'node:test';
import {
  InboundValidationError,
  MAX_ATTACHMENT_BYTES,
  classifyWebhookStatus,
  createInboundPayload,
  encodeBase64,
  isAllowedRecipient,
  validateRawSize,
} from './core.mjs';

test('accepta exclusiv aliasuri Imodeus cu plus-addressing', () => {
  assert.equal(isAllowedRecipient('inbox+abcDEF_123456789@reply.imodeus.ro'), true);
  assert.equal(isAllowedRecipient('inbox@reply.imodeus.ro'), false);
  assert.equal(isAllowedRecipient('inbox+abcDEF_123456789@imodeus.ro'), false);
});

test('creeaza payload-ul si elimina imaginile inline din semnatura', () => {
  const payload = createInboundPayload({
    from: { name: 'Ion Popescu', address: 'ion@example.com' },
    subject: 'Documente IMD-V12345',
    text: 'Am atasat documentele.',
    html: '<p>Am atasat documentele.</p>',
    messageId: '<message@example.com>',
    attachments: [
      { filename: 'contract.pdf', mimeType: 'application/pdf', disposition: 'attachment', content: Uint8Array.from([1, 2, 3]) },
      { filename: 'logo.png', mimeType: 'image/png', disposition: 'inline', related: true, content: Uint8Array.from([4, 5]) },
    ],
  }, {
    from: 'ion@example.com',
    to: 'inbox+abcDEF_123456789@reply.imodeus.ro',
  });

  assert.equal(payload.sender, 'Ion Popescu <ion@example.com>');
  assert.equal(payload.attachments.length, 1);
  assert.equal(payload.attachments[0].name, 'contract.pdf');
  assert.equal(payload.attachments[0].base64, 'AQID');
});

test('codifica base64 corect inclusiv peste limita unui chunk', () => {
  const bytes = new Uint8Array(30_001).map((_, index) => index % 251);
  assert.equal(encodeBase64(bytes), Buffer.from(bytes).toString('base64'));
});

test('respinge atasamentele individuale prea mari', () => {
  assert.throws(() => createInboundPayload({
    attachments: [{ filename: 'mare.pdf', disposition: 'attachment', content: new Uint8Array(MAX_ATTACHMENT_BYTES + 1) }],
  }, {
    to: 'inbox+abcDEF_123456789@reply.imodeus.ro',
  }), InboundValidationError);
});

test('clasifica raspunsurile webhook pentru acceptare, refuz sau retry', () => {
  assert.equal(classifyWebhookStatus(200), 'accepted');
  assert.equal(classifyWebhookStatus(404), 'reject');
  assert.equal(classifyWebhookStatus(401), 'retry');
  assert.equal(classifyWebhookStatus(503), 'retry');
});

test('respinge mesajele brute peste limita configurata', () => {
  assert.doesNotThrow(() => validateRawSize(1024));
  assert.throws(() => validateRawSize(Number.MAX_SAFE_INTEGER), InboundValidationError);
});
