import { coreToolSchemas as core, actionToolSchemas } from './tool-schemas';
import { z } from 'zod';
import { actionSchema, idSchema } from './contracts';
import { operations, isReadOperation, operationCatalog } from './operations';
import { featureFlags } from './skills';
import { VERSIONS } from './models';
import type { AssistantContext } from './access';
import type { AgentOptions } from './planner';
import type { ToolResult } from './tool-dispatch';
import { capabilityScore } from './capability-discovery';
export type RiskLevel = 'READ' | 'SAFE_WRITE' | 'SENSITIVE' | 'CRITICAL';
export type ToolDefinition = { name: string; version: string; description: string; inputSchema: z.ZodTypeAny; outputSchema: z.ZodTypeAny; handler: (ctx: AssistantContext, payload: unknown, prompt: string, options: AgentOptions) => Promise<ToolResult>; permissions: string[]; riskLevel: RiskLevel; timeoutMs: number; retryPolicy: { maxAttempts: number; retryable: string[] }; idempotencyPolicy: string; auditPolicy: string };
const objectOutput = z.record(z.unknown());
const documentAdminTools = ['file_docx_preview'];
const adminOnly = new Set(['update_agency', 'contract_template_action', 'storia_unpublish', 'meta_campaign_publish', 'sales_settings_update', 'agency_agent_create', 'agency_agent_update', 'agency_agent_remove', 'billing_change_plan', 'billing_change_seats', 'billing_checkout', 'billing_portal', 'social_create', 'social_publish', 'social_comment', 'social_reply', 'social_like', 'social_remove', 'social_destination_remove', 'whatsapp_template_create', 'tiktok_ads_resources', 'tiktok_ads_spend_authorization']);

const operationInput = z.object({ operation: idSchema, params: z.record(z.string().max(180)).default({}), query: z.record(z.string().max(2000)).default({}), body: z.record(z.unknown()).default({}) }).strict();

export const coreToolNames = [...Object.keys(core), ...Object.keys(actionToolSchemas)];
// Schemas are disclosed on demand, rather than injecting all CRM contracts each turn.
function jsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = schema._def;
  if (schema instanceof z.ZodNullable) return { anyOf: [jsonSchema(def.innerType), { type: 'null' }] };
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) return jsonSchema(def.innerType);
  if (schema instanceof z.ZodEffects) return jsonSchema(def.schema);
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    return { type: 'object', properties: Object.fromEntries(Object.entries(shape).map(([key, value]) => [key, jsonSchema(value as z.ZodTypeAny)])), required: Object.entries(shape).filter(([, value]) => !(value as z.ZodTypeAny).isOptional()).map(([key]) => key), additionalProperties: def.unknownKeys !== 'strict' };
  }
  if (schema instanceof z.ZodArray) return { type: 'array', items: jsonSchema(def.type), ...(def.maxLength ? { maxItems: def.maxLength.value } : {}) };
  if (schema instanceof z.ZodEnum) return { type: 'string', enum: schema.options };
  if (schema instanceof z.ZodLiteral) return { const: schema.value };
  if (schema instanceof z.ZodUnion || schema instanceof z.ZodDiscriminatedUnion) return { anyOf: schema.options.map(jsonSchema) };
  if (schema instanceof z.ZodRecord) return { type: 'object', additionalProperties: jsonSchema(def.valueType) };
  if (schema instanceof z.ZodString) return { type: 'string', ...Object.fromEntries(def.checks.flatMap((check: any) => check.kind === 'min' ? [['minLength', check.value]] : check.kind === 'max' ? [['maxLength', check.value]] : check.kind === 'datetime' ? [['format', 'date-time']] : check.kind === 'email' ? [['format', 'email']] : [])) };
  if (schema instanceof z.ZodNumber) return { type: schema.isInt ? 'integer' : 'number', ...Object.fromEntries(def.checks.flatMap((check: any) => check.kind === 'min' ? [[check.inclusive ? 'minimum' : 'exclusiveMinimum', check.value]] : check.kind === 'max' ? [[check.inclusive ? 'maximum' : 'exclusiveMaximum', check.value]] : [])) };
  if (schema instanceof z.ZodBoolean) return { type: 'boolean' };
  return {};
}
export function inputContract(name: string, actionKind?: string) {
  const tool = toolRegistry.get(name);
  if (!tool) throw new Error('Instrument necunoscut.');
  const action = actionKind ? actionSchema.options.find(schema => schema.shape.kind.value === actionKind) : undefined;
  if (actionKind && !action) throw new Error('Tip de acțiune necunoscut.');
  return { operation: name, version: tool.version, inputSchema: jsonSchema(action || tool.inputSchema), ...(action ? { actionKind } : {}) };
}
function definition(name: string, schema: z.ZodTypeAny, output: z.ZodTypeAny, description: string, risk: RiskLevel): ToolDefinition { return { name, version: VERSIONS.tools, description, inputSchema: schema, outputSchema: output, handler: async (ctx, payload, prompt, options) => {
  const { dispatchTool } = await import('./tool-dispatch');
  if (Object.hasOwn(core, name)) return dispatchTool(name, ctx, schema.parse(payload), prompt, options);
  if (Object.hasOwn(actionToolSchemas, name)) return dispatchTool('propose_actions', ctx, { actions: [actionSchema.parse({ ...schema.parse(payload), kind: name })] }, prompt, options);
  if (!isReadOperation(name)) throw new Error('Scrierile necesită plan confirmat și ledger, nu apel direct din model.');
  return dispatchTool('existing_read', ctx, { ...operationInput.parse(payload), operation: name }, prompt, options);
}, permissions: adminOnly.has(name) || documentAdminTools.includes(name) ? ['admin'] : ['agent', 'admin'], riskLevel: risk, timeoutMs: risk === 'READ' ? 20000 : 60000, retryPolicy: { maxAttempts: risk === 'READ' ? 2 : 1, retryable: ['temporary', 'rate_limit'] }, idempotencyPolicy: risk === 'READ' ? 'read_only' : 'execution_ledger', auditPolicy: 'metadata_only_no_pii' }; }
export const toolRegistry: ReadonlyMap<string, ToolDefinition> = new Map([
  ...Object.entries(core).map(([name, [schema, output, description]]) => [name, definition(name, schema, output, description, name === 'propose_actions' ? 'SENSITIVE' : ['remember_preference', 'forget_preference'].includes(name) ? 'SAFE_WRITE' : 'READ')] as const),
  ...Object.entries(actionToolSchemas).map(([name, [schema, output, description]]) => [name, definition(name, schema, output, description, 'SENSITIVE')] as const),
  ...Object.entries(operations).map(([name, op]) => [name, definition(name, operationInput, objectOutput, op.description, isReadOperation(name) ? 'READ' : /publish|remove|delete|pause/.test(name) ? 'CRITICAL' : op.external ? 'SENSITIVE' : 'SAFE_WRITE')] as const),
]);
export function requireTool(name: string, role: string) {
  const flags = featureFlags();
  if (name === 'remember_preference' && !flags.memory) throw new Error('Memoria este dezactivată.');
  if (['create_automation', 'update_automation'].includes(name) && !flags.automations) throw new Error('Automatizările sunt dezactivate.');
  if ((name === 'delegate_read' && !flags.subagents) || (name === 'insights' && !flags.proactiveInsights) || (name.startsWith('mcp_') && !flags.mcp)) throw new Error('Capabilitatea este dezactivată.');
  const tool = toolRegistry.get(name);
  if (!tool || !tool.permissions.includes(role) || (process.env.JARVIS_DISABLED_TOOLS || '').split(',').map(x => x.trim()).includes(name)) throw new Error('Tool indisponibil sau neautorizat.');
  return tool;
}
export function discoverTools(category = '', cursor = 0, limit = 12, role = 'agent') {
  const catalog = [...operationCatalog(), ...Object.keys(actionToolSchemas).map(id => ({ id, method: 'ACTION', readOnly: false, description: `Acțiune CRM ${id.replaceAll('_', ' ')}`, params: [], external: false }))]
    .filter(op => { try { requireTool(op.id, role); return true; } catch { return false; } })
    .map(op => ({ ...op, score: category ? capabilityScore(category, op.id, op.description) : 0 }))
    .filter(op => !category || op.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return { tools: catalog.slice(cursor, cursor + limit), nextCursor: cursor + limit < catalog.length ? cursor + limit : null, total: catalog.length };
}
export function actionRisk(action: z.infer<typeof actionSchema>): RiskLevel {
  if (action.kind === 'update_property' && action.patch.price !== undefined) return 'SENSITIVE';
  return action.kind === 'existing_operation' ? toolRegistry.get(action.operation)?.riskLevel || 'SENSITIVE' : ['delete_task', 'delete_viewing', 'delete_offer'].includes(action.kind) ? 'CRITICAL' : ['create_property', 'update_property', 'update_property_status', 'set_property_featured', 'archive_contact', 'assign_record', 'activate_property', 'create_automation', 'update_automation', 'update_agency', 'portal_action', 'update_prospect', 'create_sale', 'update_offer'].includes(action.kind) ? 'SENSITIVE' : 'SAFE_WRITE';
}
