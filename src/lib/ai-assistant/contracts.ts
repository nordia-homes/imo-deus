import { z } from 'zod';

export const idSchema = z.string().min(1).max(180).regex(/^[^/]+$/);
export const resourceNames = ['contacts', 'properties', 'tasks', 'viewings', 'ownerListingFavorites', 'sales', 'contractTemplates', 'generatedContracts', 'conversations', 'channelConnections', 'socialPosts', 'assistantAutomations', 'pricingAnalysisSnapshots', 'pricingAnalysisBacktests', 'propertyStatusEvents', 'propertyDeletionEvents', 'metaCampaignDrafts', 'salesEmailTemplates', 'salesSettings', 'salesTemplateAudit', 'agency', 'agents', 'notifications', 'portals'] as const;
export const readSchema = z.object({ resource: z.enum(resourceNames), id: idSchema.optional(), search: z.string().max(300).optional(), cursor: idSchema.optional(), limit: z.number().int().min(1).max(100).default(30) }).strict();
export const relatedSchema = z.object({ resource: z.enum(['sales', 'conversations']), id: idSchema, collection: z.enum(['documents', 'messages', 'emailMessages', 'audit', 'notes']), cursor: idSchema.optional(), limit: z.number().int().min(1).max(100).default(30) }).strict();
export type AssistantRelated = z.infer<typeof relatedSchema>;
export const fieldSchema = z.object({ resource: z.enum(resourceNames), id: idSchema, collection: z.enum(['documents', 'messages', 'emailMessages', 'audit', 'notes']).optional(), documentId: idSchema.optional(), versionId: idSchema.optional(), field: z.array(z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/)).min(1).max(8), offset: z.number().int().nonnegative().default(0), limit: z.number().int().min(1).max(12000).default(100) }).strict();
export function cardPreview(value: unknown, depth = 0): any {
  if (typeof value === 'string') return value.length > 2000 ? value.slice(0, 2000) + '… [previzualizare]' : value;
  if (!value || typeof value !== 'object') return value ?? null;
  if (depth > 4) return '[folosește read_field pentru detalii]';
  if (Array.isArray(value)) return value.slice(0, 5).map(v => cardPreview(v, depth + 1));
  const entries = Object.entries(value).slice(0, 40);
  return { ...Object.fromEntries(entries.map(([key, v]) => [key, cardPreview(v, depth + 1)])), ...('id' in value ? { id: (value as { id: unknown }).id } : {}) };
}
export const searchSchema = z.object({ source: z.enum(['owners', 'crm']).default('owners'), scopeKey: idSchema.optional(), zone: z.string().trim().max(100).optional(), propertyType: z.enum(['apartment', 'house', 'land', 'commercial']).optional(), transactionType: z.enum(['sale', 'rent']).default('sale'), rooms: z.number().int().min(1).max(30).optional(), priceMin: z.number().nonnegative().optional(), priceMax: z.number().positive().optional(), limit: z.number().int().min(1).max(100).default(5), cursor: idSchema.optional() }).strict();
const date = z.string().datetime({ offset: true }).transform(value => new Date(value).toISOString());
const timing = { nextRunAt: date, intervalMinutes: z.number().int().min(30).max(43200).optional(), maxRuns: z.number().int().min(1).max(365).default(1) };
export const automationSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('followup_task'), ...timing, contactId: idSchema, description: z.string().trim().min(1).max(2000) }).strict(),
  z.object({ type: z.literal('owner_watch'), ...timing, search: searchSchema }).strict(),
  z.object({ type: z.literal('insight_report'), ...timing, limit: z.number().int().min(1).max(30).default(10) }).strict(),
  z.object({ type: z.literal('matching_watch'), ...timing, contactId: idSchema, threshold: z.number().min(0).max(100).default(60), limit: z.number().int().min(1).max(30).default(10) }).strict(),
  z.object({ type: z.literal('whatsapp_template'), ...timing, conversationId: idSchema, stopOnReply: z.boolean().default(true), template: z.object({ name: z.string().min(1).max(200), language: z.string().min(2).max(20), parameters: z.array(z.string().max(1000)).max(20).default([]) }).strict() }).strict(),
]);
const contactPatch = z.object({ name: z.string().trim().min(1).max(200).optional(), phone: z.string().max(40).optional(), email: z.string().email().optional(), status: z.enum(['Nou', 'Contactat', 'Vizionare', 'În negociere', 'Câștigat', 'Pierdut']).optional(), priority: z.enum(['Scăzută', 'Medie', 'Ridicată']).optional(), tags: z.array(z.string().max(80)).max(30).optional(), budget: z.number().nonnegative().optional(), city: z.string().max(100).optional(), zones: z.array(z.string().max(100)).max(30).optional(), description: z.string().max(10000).optional() }).strict();
const preferences = z.object({ desiredPriceRangeMin: z.number().nonnegative().optional(), desiredPriceRangeMax: z.number().nonnegative().optional(), desiredRooms: z.number().int().nonnegative().max(30).optional(), desiredBathrooms: z.number().int().nonnegative().max(30).optional(), desiredSquareFootageMin: z.number().nonnegative().optional(), desiredSquareFootageMax: z.number().nonnegative().optional(), desiredFeatures: z.string().max(4000).optional(), locationPreferences: z.string().max(4000).optional() }).strict();
const propertyPatch = z.object({ title: z.string().trim().min(1).max(300).optional(), address: z.string().trim().min(1).max(500).optional(), images: z.array(z.object({ url: z.string().url(), alt: z.string().max(500) }).strict()).max(40).optional(), description: z.string().max(20000).optional(), price: z.number().positive().max(1e9).optional(), notes: z.string().max(10000).optional(), featured: z.boolean().optional(), rooms: z.number().int().nonnegative().max(100).optional(), bathrooms: z.number().int().nonnegative().max(100).optional(), squareFootage: z.number().positive().max(1e7).optional() }).strict();
export const actionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('create_contact'), name: z.string().trim().min(1).max(200), phone: z.string().max(40).default(''), email: z.string().email().or(z.literal('')).default(''), contactType: z.enum(['Cumparator', 'Client', 'Partener']).default('Cumparator') }).strict(),
  z.object({ kind: z.literal('archive_contact'), contactId: idSchema, archived: z.boolean() }).strict(),
  z.object({ kind: z.literal('assign_record'), resource: z.enum(['contacts', 'properties', 'tasks']), id: idSchema, agentId: idSchema }).strict(),
  z.object({ kind: z.literal('create_property'), property: z.object({ title: z.string().trim().min(1).max(300), address: z.string().trim().min(1).max(500), location: z.string().trim().min(1).max(500), city: z.string().max(100).optional(), zone: z.string().max(100).optional(), price: z.number().positive().max(1e9), rooms: z.number().int().nonnegative().max(100), bathrooms: z.number().int().nonnegative().max(100), squareFootage: z.number().positive().max(1e7), propertyType: z.enum(['Apartament', 'Casa', 'Teren', 'Spatiu comercial', 'Birou']), transactionType: z.enum(['Vanzare', 'Inchiriere']), description: z.string().max(20000).default(''), images: z.array(z.object({ url: z.string().url(), alt: z.string().max(500) }).strict()).max(40).default([]) }).strict() }).strict(),
  z.object({ kind: z.literal('update_contact'), contactId: idSchema, patch: contactPatch.refine(p => Object.keys(p).length > 0) }).strict(),
  z.object({ kind: z.literal('update_preferences'), contactId: idSchema, preferences: preferences.refine(p => Object.keys(p).length > 0) }).strict(),
  z.object({ kind: z.literal('update_property'), propertyId: idSchema, patch: propertyPatch.refine(p => Object.keys(p).length > 0) }).strict(),
  z.object({ kind: z.literal('import_owner_listing'), listingId: idSchema }).strict(),
  z.object({ kind: z.literal('activate_property'), propertyId: idSchema }).strict(),
  z.object({ kind: z.literal('record_offer'), contactId: idSchema, propertyId: idSchema, price: z.number().positive().max(1e9) }).strict(),
  z.object({ kind: z.literal('add_interaction'), contactId: idSchema, notes: z.string().trim().min(1).max(10000), type: z.enum(['Apel telefonic', 'Email', 'WhatsApp', 'Notiță', 'Întâlnire', 'Vizionare', 'Ofertă']).default('Notiță') }).strict(),
  z.object({ kind: z.literal('create_task'), description: z.string().trim().min(1).max(2000), dueDate: date, contactId: idSchema.optional(), propertyId: idSchema.optional() }).strict(),
  z.object({ kind: z.literal('update_task'), taskId: idSchema, status: z.enum(['open', 'completed']), dueDate: date.optional() }).strict(),
  z.object({ kind: z.literal('schedule_viewing'), contactId: idSchema, propertyId: idSchema, viewingDate: date, duration: z.number().int().min(15).max(240).default(60), notes: z.string().max(3000).default('') }).strict(),
  z.object({ kind: z.literal('update_viewing'), viewingId: idSchema, status: z.enum(['scheduled', 'completed', 'cancelled']), viewingDate: date.optional(), duration: z.number().int().min(15).max(240).optional(), notes: z.string().max(3000).optional() }).strict(),
  z.object({ kind: z.literal('recommend_properties'), contactId: idSchema, propertyIds: z.array(idSchema).min(1).max(30) }).strict(),
  z.object({ kind: z.literal('create_automation'), automation: automationSchema }).strict(),
  z.object({ kind: z.literal('update_automation'), automationId: idSchema, status: z.enum(['active', 'paused']) }).strict(),
  z.object({ kind: z.literal('existing_operation'), operation: idSchema, params: z.record(z.string().max(180)).default({}), query: z.record(z.string().max(2000)).default({}), body: z.record(z.unknown()).default({}) }).strict(),
]);
export type AssistantAction = z.infer<typeof actionSchema>;
export type AssistantSearch = z.infer<typeof searchSchema>;
export type AssistantRead = z.infer<typeof readSchema>;
export type StructuredOutputType = 'TEXT' | 'PROPERTY_CARD' | 'PROPERTY_LIST' | 'PROPERTY_MATCH_LIST' | 'CLIENT_CARD' | 'CLIENT_LIST' | 'VIEWING_CARD' | 'TASK_CARD' | 'CAMPAIGN_CARD' | 'CONFIRMATION_CARD' | 'ACTION_RESULT' | 'PROGRESS_EVENT' | 'ERROR_EVENT' | 'INSIGHT_CARD' | 'ANALYTICS_CARD';
export type AssistantCard = { type: 'results' | 'data'; outputType?: StructuredOutputType; resultSetId?: string; title: string; source: string; rows: Record<string, unknown>[]; nextCursor?: string | null; search?: AssistantSearch; complete?: boolean };
export type AccessReference = { resource: 'sales' | 'conversations' | 'socialPosts' | 'salesTemplateAudit' | 'assistantAutomations'; id: string };
export type AssistantMessage = { id: string; role: 'user' | 'assistant'; outputType?: StructuredOutputType; text: string; createdAt: string; cards?: AssistantCard[]; planId?: string; actions?: AssistantAction[]; accessRefs?: AccessReference[] };
export type AssistantPlan = { id: string; outputType?: 'CONFIRMATION_CARD' | 'ACTION_RESULT'; status: 'pending' | 'running' | 'completed' | 'failed' | 'unknown' | 'cancelled'; actions: AssistantAction[]; risks?: string[]; externalCostNote?: string; results?: Record<string, unknown>[]; stoppedStep?: { step: number; result: Record<string, unknown> }; error?: string; createdAt: string };

// Never send integration credentials to a model, browser or persisted result card.
export function safeData(value: unknown, depth = 0): any {
  if (depth > 10) return '[nested]';
  if (value === null || typeof value !== 'object') return value ?? null;
  if (typeof (value as { toDate?: unknown }).toDate === 'function') return (value as { toDate(): Date }).toDate().toISOString();
  if (Array.isArray(value)) return value.map(v => safeData(v, depth + 1));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => !/token|secret|password|credential|privatekey|apikey|authorization/i.test(key)).map(([key, v]) => [key, safeData(v, depth + 1)]));
}
export function normalized(value: unknown) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim(); }
export function overlaps(start: string, duration: number, otherStart: string, otherDuration = 60) {
  const a = Date.parse(start), b = Date.parse(otherStart);
  return a < b + otherDuration * 60000 && b < a + duration * 60000;
}
