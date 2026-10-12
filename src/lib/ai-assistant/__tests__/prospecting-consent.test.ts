import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: vi.fn(), getResource: vi.fn() }));
import { requestsWhatsappProspecting } from '../prospecting-consent';

it.each([
  'Găsește 3 apartamente în Titan sub 130000 euro și contactează proprietarii pe whatsapp',
  'Trimite proprietarului template de prospectare WhatsApp',
  'Scrie proprietarilor pe WhatsApp',
  'Găsește doar 3 apartamente și contactează proprietarii pe WhatsApp',
  'Trimite numai proprietarilor template de prospectare WhatsApp',
  'Găsește 3 apartamente fără intermediari și contactează proprietarii pe WhatsApp',
  'Găsește apartamente fără comision și scrie proprietarilor pe WhatsApp',
  'Găsește apartamente fără agenții și contactează proprietarii pe WhatsApp',
  'Contactează proprietarii pe WhatsApp fără previzualizare',
  'Trimite proprietarilor șablonul WhatsApp fără previzualizarea mesajului',
  'Contactează proprietarii pe WhatsApp fără să îmi ceri confirmare',
  'Contactează proprietarii pe WhatsApp fără să îmi mai soliciți o altă aprobare',
  'Nu îmi cere confirmare; trimite proprietarilor șablonul de prospectare WhatsApp',
  'Nu îmi mai solicita aprobarea. Contactează proprietarii pe WhatsApp fără previzualizare',
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
  'Când își dau acordul, contactează proprietarii pe WhatsApp',
  'Găsește apartamente fără intermediari, nu trimite proprietarilor pe WhatsApp',
  'Contactează proprietarii pe WhatsApp fără acord',
  'Găsește apartamente fără comision și contactează proprietarii pe WhatsApp fără acord',
  'Dacă acceptă, contactează proprietarii apartamentelor fără intermediari pe WhatsApp',
  'Pregătește o ciornă WhatsApp pentru proprietarii apartamentelor fără comision, apoi trimite',
  'Ca exemplu, contactează proprietarii apartamentelor fără agenții pe WhatsApp',
  'Contactează proprietarii pe WhatsApp fără comisioane de trimitere',
  'Fără previzualizare, nu trimite proprietarilor pe WhatsApp',
  'Nu îmi cere confirmare și nu trimite proprietarilor pe WhatsApp',
  'Contactează proprietarii pe WhatsApp fără acord, fără previzualizare',
  'Contactează proprietarii pe WhatsApp fără să ceri acordul proprietarilor',
  'Dacă acceptă proprietarii, contactează-i pe WhatsApp fără previzualizare',
  'Ca exemplu: contactează proprietarii pe WhatsApp fără să îmi ceri confirmare',
  'Pregătește mesajul proprietarilor pe WhatsApp, fără previzualizare, apoi trimite',
])('does not infer an attestation from %s', prompt => {
  expect(requestsWhatsappProspecting(prompt)).toBe(false);
});
