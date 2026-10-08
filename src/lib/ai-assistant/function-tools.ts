import { z } from 'zod';
import { coreToolSchemas, actionToolSchemas } from './tool-schemas';
const native = new Set(['integration_status', 'search_global', 'goal_coverage', 'resolve_matching_recipient', 'select_context', 'knowledge_search', 'legal_source_read', 'legal_source_search', 'data_catalog', 'capability_status', 'query_records', 'read', 'read_related', 'read_field', 'search_properties', 'match_contact', 'match_property', 'filter_existing_matches', 'operation_contract', 'discover_tools', 'remember_preference', 'forget_preference', 'insights', 'resolve_datetime', ...Object.keys(actionToolSchemas)]);
function strictSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = schema._def;
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) return { anyOf: [strictSchema(def.innerType), { type: 'null' }] };
  if (schema instanceof z.ZodEffects) return strictSchema(def.schema);
  if (schema instanceof z.ZodNullable) return { anyOf: [strictSchema(def.innerType), { type: 'null' }] };
  if (schema instanceof z.ZodUnion || schema instanceof z.ZodDiscriminatedUnion) return { anyOf: schema.options.map(strictSchema) };
  if (schema instanceof z.ZodObject) return { type: 'object', properties: Object.fromEntries(Object.entries(schema.shape).map(([key, value]) => [key, strictSchema(value as z.ZodTypeAny)])), required: Object.keys(schema.shape), additionalProperties: false };
  if (schema instanceof z.ZodEnum) return { type: 'string', enum: schema.options };
  if (schema instanceof z.ZodLiteral) return { const: schema.value, type: typeof schema.value };
  if (schema instanceof z.ZodArray) return { type: 'array', items: strictSchema(def.type) };
  if (schema instanceof z.ZodString) return { type: 'string' };
  if (schema instanceof z.ZodNumber) return { type: schema.isInt ? 'integer' : 'number', ...(schema.minValue !== null ? { minimum: schema.minValue } : {}), ...(schema.maxValue !== null ? { maximum: schema.maxValue } : {}) };
  if (schema instanceof z.ZodBoolean) return { type: 'boolean' };
  throw new Error('Schema cannot be advertised as a strict native function.');
}
export function functionDefinition(name: string) {
  const definition = coreToolSchemas[name as keyof typeof coreToolSchemas] || actionToolSchemas[name];
  if (!definition) throw new Error('Unknown core tool');
  // A required nullable field in a strict function cannot distinguish omission
  // from an intentional clear. Sparse action JSON preserves that distinction.
  const action = Object.hasOwn(actionToolSchemas, name);
  return { type: 'function', name, description: definition[2] + (action ? ' payload: JSON cu câmpurile acțiunii, fără kind. Omite câmpurile neschimbate; null numai pentru ștergere cerută explicit.' : ''), strict: true, parameters: native.has(name) && !action ? strictSchema(definition[0]) : { type: 'object', properties: { payload: { type: 'string', description: 'JSON conform operation_contract pentru unealta selectată.' } }, required: ['payload'], additionalProperties: false } };
}
function cleanArguments(value: unknown, schema: z.ZodTypeAny): unknown {
  // Strict function schemas use null for omitted optional fields. Actual nullable
  // domain fields must retain null (clear a field or remove an assignment).
  if (value === null) return schema.isNullable() ? null : schema.isOptional() ? undefined : null;
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault || schema instanceof z.ZodNullable) return cleanArguments(value, schema._def.innerType);
  if (schema instanceof z.ZodEffects) return cleanArguments(value, schema._def.schema);
  if (schema instanceof z.ZodDiscriminatedUnion && value && typeof value === 'object') {
    const discriminator = (value as Record<string, unknown>)[schema.discriminator];
    const selected = typeof discriminator === 'string' ? schema.optionsMap.get(discriminator) : undefined;
    return selected ? cleanArguments(value, selected) : value;
  }
  if (schema instanceof z.ZodObject && value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, schema.shape[key] ? cleanArguments(item, schema.shape[key]) : item]).filter(([, item]) => item !== undefined));
  }
  if (schema instanceof z.ZodArray && Array.isArray(value)) return value.map(item => cleanArguments(item, schema.element));
  if (schema instanceof z.ZodRecord && value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cleanArguments(item, schema._def.valueType)]));
  return value;
}
export function functionPayload(name: string, args: string) {
  const parsed = JSON.parse(args);
  // Sparse action payloads preserve omitted fields; reads also accept recorded wrappers.
  if (typeof parsed?.payload === 'string' && Object.keys(parsed).length === 1) {
    const payload = JSON.parse(parsed.payload);
    const definition = coreToolSchemas[name as keyof typeof coreToolSchemas] || actionToolSchemas[name];
    return definition ? cleanArguments(payload, definition[0]) : payload;
  }
  if (!native.has(name)) throw new Error('Instrumentul necesită payload JSON.');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Argumente invalide.');
  const definition = coreToolSchemas[name as keyof typeof coreToolSchemas] || actionToolSchemas[name];
  return cleanArguments(parsed, definition[0]);
}
