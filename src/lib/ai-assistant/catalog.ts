import { resourceNames } from './contracts';
import { capabilityScore } from './capability-discovery';
import { operations } from './operations';
import { requireTool } from './registry';
import { automationReadiness } from './readiness';
import type { AssistantContext } from './access';

export function dataCatalog(category = '') {
  const related: Record<string, string[]> = { sales: ['documents', 'emailMessages', 'audit'], conversations: ['messages', 'notes'], portals: ['recommendations'], aiOutreachCalls: ['audit', 'messages'], assistantAutomations: ['audit'] };
  return { resources: resourceNames.filter(name => !category || capabilityScore(category, name) > 0).map(name => ({ name, reads: ['read', 'read_field'], related: related[name] || [], authority: 'live_firestore', scope: ['profile', 'notificationPreferences', 'notifications', 'assistantAutomations', 'assistantUploads'].includes(name) ? 'authenticated_actor' : 'agency_and_entity_permissions' })), aggregateResources: ['contacts', 'properties', 'tasks', 'viewings'], propertySearch: { defaultSource: 'owners', crmSeparate: true, independentOfUiPagination: true }, timeline: ['contacts', 'properties', 'sales', 'conversations', 'aiOutreachCalls'], notes: ['Istoricul proiecțiilor este eventual consistent; entitățile sunt recitite înainte de execuție.', 'La complete=false folosește continuarea. Nu prezenta un segment drept toate datele.', 'Providerii și joburile au citiri dedicate în discover_tools. Documentele mari se citesc prin read_field.'] };
}
export async function capabilityStatus(ctx: AssistantContext, operation: string) {
  const checkedAt = new Date().toISOString();
  try { requireTool(operation, ctx.role || ''); }
  catch { return { operation, status: 'blocked_by_role_or_configuration', checkedAt, reason: 'Instrumentul nu este permis rolului sau este dezactivat.', executable: false }; }
  if (['create_automation', 'update_automation'].includes(operation)) {
    const readiness = await automationReadiness(ctx);
    return { operation, checkedAt, status: readiness.active ? 'available' : 'needs_worker', executable: readiness.active, worker: readiness, preconditionsChecked: ['role', 'flags', 'worker_heartbeat'], entityEligibilityChecked: false };
  }
  const provider = operation.startsWith('imobiliare_') ? 'imobiliare_status' : operation.startsWith('storia_') && operation !== 'storia_lead_action' ? 'storia_status' : operation.startsWith('romimo_') ? 'romimo_status' : operation.startsWith('tiktok_ads_') ? 'tiktok_capabilities' : operation.startsWith('tiktok_') ? 'tiktok_organic_status' : operation.startsWith('meta_') ? 'meta_status' : /^(message_|whatsapp_|conversation_|social_)/.test(operation) ? 'communications_status' : operation.startsWith('facebook_') ? 'facebook_connections' : null;
  const external = operations[operation]?.external || provider !== null;
  return { operation, checkedAt, status: external ? 'needs_provider_check' : 'available', executable: !external, preconditionsChecked: ['role', 'flags'], entityEligibilityChecked: false, ...(provider ? { nextRead: provider } : {}), ...(operation === 'message_send' ? { mandatoryPreview: 'message_preview', humanConsentTool: false } : {}), note: 'Disponibilitatea entității, costul, quota și versiunea se verifică prin serviciul domeniului înainte de mutație. OAuth și permisiunile dispozitivului necesită pașii umani din modulul CRM.' };
}
