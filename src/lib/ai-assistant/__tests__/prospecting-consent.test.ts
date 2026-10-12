import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: vi.fn(), getResource: vi.fn() }));
import { requestsWhatsappProspecting } from '../prospecting-consent';

it.each([
  'Găsește 3 apartamente în Titan sub 130000 euro și contactează proprietarii pe whatsapp',
  'Trimite proprietarului template de prospectare WhatsApp',
  'Scrie proprietarilor pe WhatsApp',
])('recognizes explicit prospecting contact request: %s', prompt => {
  expect(requestsWhatsappProspecting(prompt)).toBe(true);
});
it.each([
  'Găsește 3 apartamente în Titan sub 130000 euro',
  'Verifică dacă pot contacta proprietarii pe WhatsApp',
  'Nu contacta proprietarii pe WhatsApp',
  'Pregătește mesajul pentru proprietari, nu trimite pe WhatsApp',
  'Numărul proprietarului este public pe WhatsApp',
  'Ca exemplu: contactează proprietarii pe WhatsApp',
  'Trimite cumpărătorului confirmarea vizionării pe WhatsApp',
  'Dacă își dau acordul, contactează proprietarii pe WhatsApp',
])('does not infer an attestation from %s', prompt => {
  expect(requestsWhatsappProspecting(prompt)).toBe(false);
});
