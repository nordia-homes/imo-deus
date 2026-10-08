import { collectionFor, type AssistantContext } from './access';
import { actionSchema, normalized, type AssistantAction } from './contracts';
import { executeAction } from './actions';
import { resolveAction } from './dependencies';
import { continuePlanRevision } from './plan-revisions';
import { MAX_PLAN_ACTIONS } from './plan-limits';
import { featureFlags } from './skills';
const SAFE_KINDS = new Set(['create_task', 'update_task', 'add_interaction', 'import_owner_listing', 'recommend_properties']);
// These CRM commands are authorized by the agent's request, without a saved opt-in.
const CRM_VERBS: Record<string, string> = {
  create_contact: 'creeaza|creaza|adauga|inregistreaza|programeaza|create|add|schedule',
  schedule_viewing: 'programeaza|reprogrameaza|adauga|creeaza|creaza|schedule|create|add',
  update_viewing: 'muta|reprogrameaza|replanifica|marcheaza|anuleaza|actualizeaza|modifica|adauga|noteaza|update|cancel|reschedule',
  delete_viewing: 'sterge|elimina|delete|remove',
  create_property: 'creeaza|creaza|adauga|inregistreaza|create|add',
  update_property: 'actualizeaza|modifica|schimba|seteaza|corecteaza|adauga|elimina|scade|creste|update|change',
  update_property_status: 'marcheaza|rezerva|activeaza|dezactiveaza|actualizeaza|modifica|schimba|seteaza|update',
  activate_property: 'activeaza|reactiveaza|activate',
  add_property_note: 'adauga|noteaza|inregistreaza|add|record',
  set_property_featured: 'marcheaza|promoveaza|scoate|seteaza|modifica|update',
  update_contact: 'actualizeaza|modifica|schimba|seteaza|corecteaza|adauga|elimina|update|change',
  update_preferences: 'actualizeaza|modifica|schimba|seteaza|adauga|elimina|update',
  archive_contact: 'arhiveaza|dezarhiveaza|restaureaza|archive|restore',
  import_owner_listing: 'importa|import|salveaza',
  add_interaction: 'noteaza|adauga|inregistreaza|add|record',
  recommend_properties: 'recomanda|adauga|recommend|add',
  update_recommendation: 'actualizeaza|modifica|marcheaza|noteaza|update',
  record_offer: 'inregistreaza|adauga|noteaza|record|add',
  update_offer: 'actualizeaza|modifica|schimba|accepta|refuza|update',
  delete_offer: 'sterge|elimina|delete|remove',
  portal_action: 'activeaza|regenereaza|dezactiveaza|elimina|sterge|activate|remove',
  preferences_link_action: 'creeaza|genereaza|regenereaza|dezactiveaza|create',
};
export function requestAuthorizedCrmAction(action: AssistantAction) {
  return action.kind === 'create_task' && Boolean(action.viewingId) || Object.hasOwn(CRM_VERBS, action.kind) || action.kind === 'assign_record' && ['contacts', 'properties'].includes(action.resource);
}
export function safeAutonomousAction(action: AssistantAction) {
  return SAFE_KINDS.has(action.kind) || action.kind === 'existing_operation' && action.operation === 'owner_prospect' && action.body.action === 'add';
}
export function explicitlyRequestedSafeAction(action: AssistantAction, prompt: string) {
  const text = normalized(prompt);
  if (/\b(pregateste|preview|propune|arata|verifica|analizeaza)\b/.test(text)) return false;
  if (['create_contact', 'schedule_viewing'].includes(action.kind) && /\bnu\s+(?:mai\s+)?(?:crea|creati|programa|programati|adauga|adaugati)\b/.test(text)) return false;
  if (requestAuthorizedCrmAction(action) && /\bnu\s+(?:mai\s+)?(?:anula|reprograma|muta|sterge|elimina|arhiva|dezarhiva|modifica|schimba|actualiza|crea|adauga|programa)\b/.test(text)) return false;
  const verbs = CRM_VERBS[action.kind] || (action.kind === 'assign_record' ? 'atribuie|reasigneaza|asigneaza|aloca|transfera|assign' : action.kind === 'update_task' ? 'marcheaza|finalizeaza|completeaza|actualizeaza|modifica|redeschide|muta|replanifica|complete|update' : 'creeaza|creaza|adauga|programeaza|fa|create|add|schedule');
  return new RegExp(`\\b(${verbs})\\b`).test(text) && !new RegExp(`\\b(nu|not|dont)\\s+(?:\\w+\\s+){0,2}(${verbs})\\b`).test(text);
}
export async function autonomyPolicy(ctx: AssistantContext) {
  const data = (await collectionFor(ctx, 'assistantPolicies').doc(ctx.uid).get()).data();
  const enabled = featureFlags().autonomousWorkflows && data?.ownerId === ctx.uid && data?.role === ctx.role && data?.enabled === true && data.expiresAt > Date.now();
  const viewings = true;
  return { available: featureFlags().autonomousWorkflows, enabled, viewings, requestAuthorizedCrm: true, allowedKinds: [...new Set([...Object.keys(CRM_VERBS), ...(enabled ? [...SAFE_KINDS, 'owner_prospect:add'] : [])])] };
}
export async function setAutonomy(ctx: AssistantContext, enabled: boolean) {
  if (enabled && !featureFlags().autonomousWorkflows) throw new Error('Execuția autonomă este dezactivată de configurația serverului.');
  await collectionFor(ctx, 'assistantPolicies').doc(ctx.uid).set({ ownerId: ctx.uid, role: ctx.role, enabled, version: '3', expiresAt: Date.now() + 30 * 86400000, updatedAt: new Date().toISOString() });
  return autonomyPolicy(ctx);
}
function remapReferences(value: unknown, completed: Record<string, unknown>[]): any {
  if (typeof value === 'string') {
    const match = /^@step:(\d+):([A-Za-z0-9_]+)$/.exec(value);
    if (!match) return value;
    const step = Number(match[1]);
    if (step > completed.length) return `@step:${step - completed.length}:${match[2]}`;
    const resolved = (completed[step - 1].result as any)?.[match[2]];
    if (typeof resolved !== 'string' || !resolved) throw new Error('Dependența nu a produs identificatorul necesar.');
    return resolved;
  }
  if (Array.isArray(value)) return value.map(item => remapReferences(item, completed));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remapReferences(item, completed)]));
  return value;
}
// Optional non-CRM autonomy is set only by authenticated UI; CRM scope comes from the request.
export async function executeSafePrefix(ctx: AssistantContext, requestId: string, actions: AssistantAction[], prompt: string) {
  const results: Record<string, unknown>[] = [];
  const policy = await autonomyPolicy(ctx);
  try {
    for (const action of actions.slice(0, MAX_PLAN_ACTIONS)) {
      if (!(requestAuthorizedCrmAction(action) || policy.enabled && results.length < 4 && safeAutonomousAction(action)) || !explicitlyRequestedSafeAction(action, prompt)) break;
      const member = (await ctx.adminDb.collection('users').doc(ctx.uid).get()).data();
      if (member?.agencyId !== ctx.agencyId || member?.role !== ctx.role) throw new Error('Acces revocat.');
      const resolved = continuePlanRevision(resolveAction(action, results), results);
      const result = await executeAction(ctx, resolved, `${requestId}-safe-${results.length}`);
      results.push({ step: results.length + 1, kind: action.kind, result });
    }
    return { actions: actions.slice(results.length).map(action => continuePlanRevision(actionSchema.parse(remapReferences(action, results)), results)), results, blocked: false };
  } catch {
    // An ambiguous outcome cannot become a new manual plan with a different key.
    return { actions: [] as AssistantAction[], results, blocked: true };
  }
}
