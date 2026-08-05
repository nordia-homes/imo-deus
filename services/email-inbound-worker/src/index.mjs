import PostalMime from 'postal-mime';
import {
  InboundValidationError,
  assertWebhookConfiguration,
  classifyWebhookStatus,
  createInboundPayload,
  isAllowedRecipient,
  validateRawSize,
} from './core.mjs';

export default {
  async email(message, env) {
    if (!isAllowedRecipient(message.to)) {
      message.setReject('Destinatar Imodeus invalid.');
      return;
    }

    try {
      validateRawSize(message.rawSize);
      const endpoint = assertWebhookConfiguration(env);
      const parsed = await PostalMime.parse(message.raw);
      const payload = createInboundPayload(parsed, {
        from: message.from,
        to: message.to,
        subject: message.headers.get('subject'),
        messageId: message.headers.get('message-id'),
      });
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-imodeus-inbound-secret': env.IMODEUS_INBOUND_SECRET,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25_000),
      });
      const outcome = classifyWebhookStatus(response.status);
      if (outcome === 'accepted') return;
      if (outcome === 'reject') {
        message.setReject(`Imodeus nu a acceptat mesajul (${response.status}).`);
        return;
      }
      throw new Error(`Webhook-ul Imodeus a raspuns cu status ${response.status}.`);
    } catch (error) {
      if (error instanceof InboundValidationError) {
        message.setReject(error.message);
        return;
      }
      console.error('Imodeus inbound delivery failed', {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : 'Unknown failure',
      });
      throw error;
    }
  },
};
