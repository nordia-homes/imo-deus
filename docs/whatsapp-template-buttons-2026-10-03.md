# Template buttons

Implemented locally in the WhatsApp Studio template editor:

- Optional quick reply, fixed HTTPS URL, and phone number buttons.
- Conservative editor limits: up to three quick replies, or one URL plus one phone button. Mixed quick reply/CTA groups and dynamic URLs are not supported by this editor.
- Shared browser/server validation, trimmed labels up to 25 characters, international phone format, distinct labels, no credentials or placeholders in URLs.
- Preview under the message and display of buttons in the existing template library.
- Meta creation serializes a BUTTONS component only when buttons exist. Text-only creation remains unchanged.
- Message sending provides quick reply payloads with the indexes from the approved template. Static URL/phone buttons require no extra send parameters. Existing approval, consent, pricing and pilot checks remain in place.
- Incoming button text already uses the regular Inbox normalization path. This does not implement automatic viewing confirmation or other CRM actions.

Validation: 94 communications tests passed, two Firestore emulator tests skipped; communications TypeScript passed. New regression coverage tests rejected inputs, exact creation components and send component indexes. No live template was submitted and no customer message was sent. Not yet committed or deployed.

Provider references:
- https://www.postman.com/meta/whatsapp-business-platform/request/ep5w4rc/create-template-w-document-header-text-body-a-phone-number-button-and-a-url-button
- https://www.postman.com/meta/whatsapp-business-platform/request/lwtlz1k/send-message-template-interactive
