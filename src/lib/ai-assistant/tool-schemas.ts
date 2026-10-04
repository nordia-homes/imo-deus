import { z } from 'zod';
import { actionSchema, readSchema, relatedSchema, fieldSchema, searchSchema, idSchema, queryRecordsSchema } from './contracts';
import { analysisSchema, datetimeSchema } from './deterministic-contracts';
const objectOutput = z.record(z.unknown());
const rowsOutput = z.object({ rows: z.array(z.record(z.unknown())) }).passthrough();
const operationInput = z.object({ operation: idSchema, params: z.record(z.string().max(180)).default({}), query: z.record(z.string().max(2000)).default({}), body: z.record(z.unknown()).default({}) }).strict();
export const coreToolSchemas = {
  analyze_records: [analysisSchema, rowsOutput, 'Filtrare, sortare și statistici deterministe pe ID-uri autorizate deja identificate. Nu este un total al agenției.'],
  resolve_datetime: [datetimeSchema, objectOutput, 'Dată și oră Europe/Bucharest convertite determinist în ISO; detectează ambiguitatea DST. date sau dayOffset (mâine=1), time HH:mm.'],
  read: [readSchema, rowsOutput, 'Citește înregistrări autorizate, cu paginare.'],
  query_records: [queryRecordsSchema, rowsOutput, 'Filtrează CRM PE SERVER și numără exact prin agregare. Pentru câte vizionări mâine: resource=viewings, dayOffset=1, mode=count. Nu citi întregul calendar. Pentru liste folosește mode=list. Datele relative sunt calculate în Europe/Bucharest.'],
  read_related: [relatedSchema, rowsOutput, 'Documente, mesaje și audit ale unei resurse autorizate.'],
  read_field: [fieldSchema, objectOutput, 'Citește câmpuri mari în porții, fără secrete.'],
  search_properties: [searchSchema, rowsOutput, 'Caută proprietari implicit sau CRM explicit.'],
  match_contact: [z.object({ contactId: idSchema, limit: z.number().int().min(1).max(100).default(30) }).strict(), rowsOutput, 'Preia exclusiv matching-ul existent ImoDeus.'],
  match_property: [z.object({ propertyId: idSchema, limit: z.number().int().min(1).max(100).default(30) }).strict(), rowsOutput, 'Cumpărători potriviți prin algoritmul existent ImoDeus.'],
  filter_existing_matches: [z.object({ resultSetId: idSchema, priceMax: z.number().positive().optional(), zone: z.string().max(100).optional(), limit: z.number().int().min(1).max(100).default(5), sortBy: z.enum(['existing_order', 'score', 'price']).default('existing_order') }).strict(), rowsOutput, 'Filtrează setul existent fără recalculare; păstrează ordinea ImoDeus implicit. sortBy score/price numai dacă se cere explicit.'],
  operation_contract: [z.object({ operation: idSchema, actionKind: idSchema.optional() }).strict(), objectOutput, 'Schema unui instrument sau handler existent.'],
  parallel_read: [z.object({ calls: z.array(z.object({ operation: z.enum(['read', 'read_related', 'search_properties', 'match_contact', 'match_property', 'insights']), payload: z.record(z.unknown()) }).strict()).min(1).max(3) }).strict(), objectOutput, 'Execută maximum trei citiri independente în paralel.'],
  discover_tools: [z.object({ category: z.string().max(60).default(''), cursor: z.number().int().nonnegative().default(0), limit: z.number().int().min(1).max(20).default(12) }).strict(), objectOutput, 'Descoperă handler-ele pe categorii; schema se cere separat.'],
  existing_read: [operationInput, objectOutput, 'Apelează numai handler-ele readOnly autorizate.'],
  propose_actions: [z.object({ actions: z.array(actionSchema).min(1).max(12) }).strict(), objectOutput, 'Pregătește acțiuni; nu execută. Obligatoriu payload este JSON {"actions":[{"kind":"...",...}]}, inclusiv pentru o singură acțiune. Consultă operation_contract pentru schema acțiunii.'],
  remember_preference: [z.object({ key: z.enum(['preferred_language', 'preferred_search_zone', 'preferred_property_source', 'preferred_response_style']), value: z.string().trim().min(1).max(200) }).strict(), objectOutput, 'Salvează numai preferința cerută explicit; nu date CRM.'],
  forget_preference: [z.object({ key: z.enum(['preferred_language', 'preferred_search_zone', 'preferred_property_source', 'preferred_response_style']) }).strict(), objectOutput, 'Șterge exclusiv preferința proprie, numai la cererea explicită a agentului.'],
  delegate_read: [z.object({ goal: z.string().min(1).max(1000), tools: z.array(z.enum(['read', 'read_related', 'search_properties', 'filter_existing_matches', 'read_field', 'existing_read', 'discover_tools', 'insights', 'analyze_records'])).min(1).max(3), resultSetId: idSchema.optional() }).strict(), objectOutput, 'Subagent limitat la citiri, cu același tenant și buget comun; fără recalculare matching.'],
  insights: [z.object({ limit: z.number().int().min(1).max(30).default(10) }).strict(), rowsOutput, 'Insight-uri deterministe din date reale ale agenției. payload={limit: numărul cerut, 1..30}.'],
  mcp_discover: [z.object({ serverId: idSchema }).strict(), objectOutput, 'Descoperă tools externe read-only explicit autorizate agenției.'],
  mcp_read: [z.object({ serverId: idSchema, tool: idSchema, arguments: z.record(z.unknown()).default({}) }).strict(), objectOutput, 'Tool MCP read-only allowlisted; fără URL-uri sau servere din prompt.'],
} as const;
export const actionToolSchemas = Object.fromEntries(actionSchema.options.filter(schema => !['existing_operation', 'create_automation'].includes(schema.shape.kind.value)).map(schema => [schema.shape.kind.value, [(schema as z.AnyZodObject).omit({ kind: true }), objectOutput, `Pregătește ${schema.shape.kind.value} în planul confirmabil. Nu execută direct. ID-uri reale sau @step:N:contactId. Nu refuza o acțiune disponibilă.`] as const]));
