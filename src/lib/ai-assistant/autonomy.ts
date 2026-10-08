import { collectionFor, type AssistantContext } from './access';
import { actionSchema, normalized, type AssistantAction } from './contracts';
import { executeAction } from './actions';
import { resolveAction } from './dependencies';
import { continuePlanRevision } from './plan-revisions';
import { featureFlags } from './skills';
const SAFE_KINDS = new Set(['create_task', 'update_task', 'add_interaction', 'import_owner_listing', 'recommend_properties']);
const VIEWING_KINDS = new Set(['create_contact', 'schedule_viewing']);
export function safeAutonomousAction(action: AssistantAction) {
  return SAFE_KINDS.has(action.kind) || action.kind === 'existing_operation' && action.operation === 'owner_prospect' && action.body.action === 'add';
}
export function explicitlyRequestedSafeAction(action: AssistantAction, prompt: string) {
  const text = normalized(prompt);
  if (/\b(pregateste|preview|propune|arata|verifica|analizeaza)\b/.test(text)) return false;
  if (VIEWING_KINDS.has(action.kind) && /\bnu\s+(?:mai\s+)?(?:crea|creati|programa|programati|adauga|adaugati)\b/.test(text)) return false;
  const verbs = action.kind === 'import_owner_listing' ? 'importa|import|salveaza' : action.kind === 'recommend_properties' ? 'recomanda|adauga|recommend|add' : action.kind === 'update_task' ? 'marcheaza|finalizeaza|completeaza|actualizeaza|modifica|redeschide|muta|replanifica|complete|update' : action.kind === 'add_interaction' ? 'noteaza|adauga|inregistreaza|add|record' : 'creeaza|creaza|adauga|programeaza|fa|create|add|schedule';
  return new RegExp(`\\b(${verbs})\\b`).test(text) && !new RegExp(`\\b(nu|not|dont)\\s+(?:\\w+\\s+){0,2}(${verbs})\\b`).test(text);
}
export async function autonomyPolicy(ctx: AssistantContext) {
  const data = (await collectionFor(ctx, 'assistantPolicies').doc(ctx.uid).get()).data();
  const enabled = featureFlags().autonomousWorkflows && data?.ownerId === ctx.uid && data?.role === ctx.role && data?.enabled === true && data.expiresAt > Date.now();
  const viewings = enabled && data?.viewings === true;
  return { available: featureFlags().autonomousWorkflows, enabled, viewings, allowedKinds: [...SAFE_KINDS, 'owner_prospect:add', ...(viewings ? [...VIEWING_KINDS] : [])] };
}
export async function setAutonomy(ctx: AssistantContext, enabled: boolean, viewings = false) {
  if (enabled && !featureFlags().autonomousWorkflows) throw new Error('Execuția autonomă este dezactivată de configurația serverului.');
  await collectionFor(ctx, 'assistantPolicies').doc(ctx.uid).set({ ownerId: ctx.uid, role: ctx.role, enabled, viewings: enabled && viewings, version: '2', expiresAt: Date.now() + 30 * 86400000, updatedAt: new Date().toISOString() });
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
// Policy is set only by a dedicated authenticated UI action, never by an LLM tool.
export async function executeSafePrefix(ctx: AssistantContext, requestId: string, actions: AssistantAction[], prompt: string) {
  const results: Record<string, unknown>[] = [];
  const policy = await autonomyPolicy(ctx);
  if (!policy.enabled) return { actions, results, blocked: false };
  try {
    for (const action of actions.slice(0, 4)) {
      if (!(safeAutonomousAction(action) || policy.viewings && VIEWING_KINDS.has(action.kind)) || !explicitlyRequestedSafeAction(action, prompt)) break;
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
