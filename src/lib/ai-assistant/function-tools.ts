import { z } from 'zod';
import { coreToolSchemas } from './tool-schemas';
const native = new Set(['read', 'read_related', 'read_field', 'search_properties', 'match_contact', 'match_property', 'filter_existing_matches', 'operation_contract', 'discover_tools', 'remember_preference', 'forget_preference', 'insights', 'resolve_datetime']);
function strictSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = schema._def;
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) return { anyOf: [strictSchema(def.innerType), { type: 'null' }] };
  if (schema instanceof z.ZodEffects) return strictSchema(def.schema);
  if (schema instanceof z.ZodObject) return { type: 'object', properties: Object.fromEntries(Object.entries(schema.shape).map(([key, value]) => [key, strictSchema(value as z.ZodTypeAny)])), required: Object.keys(schema.shape), additionalProperties: false };
  if (schema instanceof z.ZodEnum) return { type: 'string', enum: schema.options };
  if (schema instanceof z.ZodLiteral) return { const: schema.value, type: typeof schema.value };
  if (schema instanceof z.ZodArray) return { type: 'array', items: strictSchema(def.type) };
  if (schema instanceof z.ZodString) return { type: 'string' };
  if (schema instanceof z.ZodNumber) return { type: schema.isInt ? 'integer' : 'number' };
  if (schema instanceof z.ZodBoolean) return { type: 'boolean' };
  throw new Error('Schema cannot be advertised as a strict native function.');
}
export function functionDefinition(name: string) {
  const definition = coreToolSchemas[name as keyof typeof coreToolSchemas];
  if (!definition) throw new Error('Unknown core tool');
  return { type: 'function', name, description: definition[2], strict: true, parameters: native.has(name) ? strictSchema(definition[0]) : { type: 'object', properties: { payload: { type: 'string', description: 'JSON conform operation_contract pentru unealta selectată.' } }, required: ['payload'], additionalProperties: false } };
}
export function functionPayload(name: string, args: string) {
  const parsed = JSON.parse(args);
  // Recorded compatibility fixtures only; native tool definitions reject payload wrappers.
  if (typeof parsed?.payload === 'string' && Object.keys(parsed).length === 1) return JSON.parse(parsed.payload);
  if (!native.has(name)) throw new Error('Instrumentul necesită payload JSON.');
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Argumente invalide.');
  return Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== null));
}
