import type { Actor } from './model';
import { CommunicationError } from './server';

export const whatsappAppId = () => (process.env.META_WHATSAPP_APP_ID || '').trim();
export const whatsappAppSecret = () => (process.env.META_WHATSAPP_APP_SECRET || '').trim();
export const whatsappConfigId = () => (process.env.META_WHATSAPP_CONFIG_ID || '').trim();
const list = (value?: string) => (value || '').split(',').map(v => v.trim()).filter(Boolean);
export function whatsappAccess(actor?: Actor) {
  const configured = Boolean(whatsappAppId() && whatsappAppSecret() && whatsappConfigId());
  const mode = process.env.WHATSAPP_ONBOARDING_MODE || 'disabled';
  const productionReady = configured && mode === 'production' && process.env.WHATSAPP_META_APPROVALS_READY === 'true' && process.env.WHATSAPP_DIRECT_BILLING_READY === 'true';
  const agencies = list(process.env.WHATSAPP_TEST_AGENCY_IDS);
  const tester = Boolean(actor && actor.role === 'admin' && list(process.env.WHATSAPP_TEST_USER_IDS).includes(actor.uid) && (!agencies.length || agencies.includes(actor.agencyId)));
  return { whatsappConfigured: configured, whatsappProductionReady: productionReady, whatsappTestMode: mode === 'test', whatsappReady: configured && (productionReady || (mode === 'test' && tester)) };
}
export function assertWhatsAppAccess(actor: Actor) {
  const access = whatsappAccess(actor);
  if (!access.whatsappConfigured) throw new CommunicationError('Configurația aplicației WhatsApp este incompletă.', 503);
  if (!access.whatsappReady) throw new CommunicationError('Conectarea WhatsApp nu este disponibilă pentru acest cont. Contactează suportul ImoDeus.', 403);
}
