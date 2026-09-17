import type { JsonSchema } from './types';

export type TikTokRow = { id: string; name: string; status: string; campaignId?: string; adgroupId?: string; propertyId?: string | null; budget?: string; scheduleEnd?: string; rejection?: string; url?: string; metrics?: Record<string, string>; };
export type AdDraft = { name: string; propertyId: string; assetId: string; identityId: string; objective: 'TRAFFIC' | 'LEAD_GENERATION' | 'VIDEO_VIEWS'; text: string; url: string; formId: string; locationIds: string[]; budget: string; start: string; end: string; cta: string; mode: 'video' | 'post'; postId: string; adgroupId: string; };
export const emptyAdDraft: AdDraft = { name: '', propertyId: '', assetId: '', identityId: '', objective: 'TRAFFIC', text: '', url: '', formId: '', locationIds: [], budget: '', start: '', end: '', cta: 'LEARN_MORE', mode: 'video', postId: '', adgroupId: '' };

export function resolveSchema(schema: JsonSchema): JsonSchema {
  return (schema.allOf || []).reduce<JsonSchema>((base, part) => ({ ...base, ...part, properties: { ...base.properties, ...part.properties }, required: [...new Set([...(base.required || []), ...(part.required || [])])] }), { ...schema, allOf: undefined });
}

// Product fields are mapped only to fields present in the discovered contract.
// In particular, creative arrays receive structured objects, never JSON text.
export function schemaInput(schema: JsonSchema | undefined, values: Record<string, unknown>): Record<string, unknown> {
  if (!schema) throw new Error('TikTok nu a furnizat configurația necesară. Sincronizează contul.');
  const resolved = resolveSchema(schema);
  const result: Record<string, unknown> = {};
  for (const [key, definition] of Object.entries(resolved.properties || {})) {
    if (Object.hasOwn(values, key) && values[key] !== undefined && values[key] !== '') {
      result[key] = values[key];
    } else if (definition.properties || definition.allOf) {
      const child = schemaInput(definition, values);
      if (Object.keys(child).length) result[key] = child;
    } else if (definition.items?.properties) {
      const child = schemaInput(definition.items, values);
      if (Object.keys(child).length) result[key] = [child];
    }
  }
  return result;
}

export function schemaMissing(schema: JsonSchema | undefined, value: Record<string, unknown>, supplied: string[] = []): string[] {
  if (!schema) return ['Configurația TikTok indisponibilă'];
  const resolved = resolveSchema(schema);
  const missing = (resolved.required || []).filter(key => !supplied.includes(key) && (value[key] == null || value[key] === '' || Array.isArray(value[key]) && !(value[key] as unknown[]).length));
  for (const [key, child] of Object.entries(resolved.properties || {})) {
    if (Array.isArray(value[key]) && child.items) for (const item of value[key] as unknown[]) {
      if (item && typeof item === 'object') missing.push(...schemaMissing(child.items, item as Record<string, unknown>, supplied).map(field => `${key}.${field}`));
    }
    else if (value[key] && typeof value[key] === 'object') missing.push(...schemaMissing(child, value[key] as Record<string, unknown>, supplied).map(field => `${key}.${field}`));
  }
  return missing;
}

export function records(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(records);
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  return [record, ...Object.values(record).filter(child => child && typeof child === 'object').flatMap(records)];
}

export function rowsFor(value: unknown, kind: 'campaign' | 'adgroup' | 'ad' | 'post' | 'form' | 'location'): TikTokRow[] {
  const idKeys = { campaign: ['campaign_id'], adgroup: ['adgroup_id'], ad: ['ad_id'], post: ['item_id', 'tiktok_item_id'], form: ['page_id', 'form_id'], location: ['location_id', 'region_id'] }[kind];
  const rows = records(value).flatMap(record => {
    const id = idKeys.map(key => record[key]).find(value => typeof value === 'string' || typeof value === 'number');
    if (!id) return [];
    const name = record[`${kind}_name`] || record.name || record.title || record.display_name || record.region_name || id;
    return [{ id: String(id), name: String(name), status: String(record.operation_status || record.secondary_status || record.status || 'UNKNOWN'), campaignId: record.campaign_id ? String(record.campaign_id) : undefined, adgroupId: record.adgroup_id ? String(record.adgroup_id) : undefined, budget: record.budget == null ? undefined : String(record.budget), scheduleEnd: record.schedule_end_time ? String(record.schedule_end_time) : undefined, rejection: record.rejection_reason ? String(record.rejection_reason) : undefined, url: typeof record.video_url === 'string' ? record.video_url : undefined }];
  });
  // A response may repeat only an ID inside metadata. Keep the richer resource.
  const byId = new Map<string, TikTokRow>();
  for (const row of rows) {
    const existing = byId.get(row.id);
    const score = (item: TikTokRow) => Number(item.name !== item.id) + Number(item.status !== 'UNKNOWN') + Number(item.budget !== undefined);
    if (!existing || score(row) > score(existing)) byId.set(row.id, row);
  }
  return [...byId.values()];
}

export function reportingRows(value: unknown) {
  return records(value).filter(row => row.metrics && typeof row.metrics === 'object').map(row => ({ ...(row.dimensions as object || {}), ...(row.metrics as object) }));
}

export function statusLabel(status: string) {
  return ({ ENABLE: 'Activă', STATUS_ENABLE: 'Activă', DISABLE: 'Oprită', STATUS_DISABLE: 'Oprită', draft: 'Draft', queued: 'În așteptare', rendering: 'Se generează', ready: 'Pregătit', succeeded: 'Finalizat', failed: 'Eșuat', error: 'Eroare', pending_recovery: 'Necesită verificare', in_progress: 'În curs', UNKNOWN: 'Stare necunoscută' } as Record<string, string>)[status] || status;
}

// TikTok accepts UTC timestamps while the editor displays the advertiser's zone.
// Reject nonexistent/ambiguous DST times instead of silently moving a campaign.
export function accountTimeToUtc(value: string, timezone: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.length === 16 ? `${value}:00` : value;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) throw new Error('Data programării nu este validă.');
  const wallTime = Date.parse(`${normalized}Z`);
  if (!Number.isFinite(wallTime) || new Date(wallTime).toISOString().slice(0, 19) !== normalized) throw new Error('Data programării nu este validă.');
  let formatter: Intl.DateTimeFormat;
  try { formatter = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }); }
  catch { throw new Error('Fusul orar al contului nu este recunoscut. Sincronizează contul.'); }
  const local = (date: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(date).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  };
  const offsets = new Set([-86400000, 0, 86400000].map(delta => Date.parse(`${local(wallTime + delta)}Z`) - (wallTime + delta)));
  const candidates = [...offsets].map(offset => wallTime - offset).filter(candidate => local(candidate) === normalized);
  if (candidates.length !== 1) throw new Error('Ora este ambiguă sau inexistentă la schimbarea orei. Alege o altă oră.');
  return new Date(candidates[0]).toISOString().slice(0, 19).replace('T', ' ');
}

export function buildAdInputs(draft: AdDraft, schemas: Partial<Record<string, JsonSchema>>, timezone = 'UTC') {
  const ad = schemaInput(schemas.AD_CREATE, { ad_name: draft.name, ad_text: draft.text, ad_format: 'SINGLE_VIDEO', call_to_action: draft.cta, landing_page_url: draft.url || undefined, page_id: draft.formId || undefined, adgroup_id: draft.mode === 'post' ? draft.adgroupId : undefined, tiktok_item_id: draft.mode === 'post' ? draft.postId : undefined });
  if (draft.mode === 'post') return { campaign: {}, adGroup: {}, video: {}, ad };
  const scheduleTime = (value: string) => accountTimeToUtc(value, timezone);
  const common = { campaign_name: draft.name, objective_type: draft.objective, campaign_type: 'REGULAR_CAMPAIGN', is_search_campaign: false, budget_mode: 'BUDGET_MODE_INFINITE' };
  const campaign = schemaInput(schemas.CAMPAIGN_CREATE, common);
  const adGroup = schemaInput(schemas.ADGROUP_CREATE, { adgroup_name: draft.name, budget: draft.budget, budget_mode: 'BUDGET_MODE_DAY', schedule_type: draft.end ? 'SCHEDULE_START_END' : 'SCHEDULE_FROM_NOW', schedule_start_time: scheduleTime(draft.start), schedule_end_time: scheduleTime(draft.end), location_ids: draft.locationIds, placement_type: 'PLACEMENT_TYPE_NORMAL', placements: ['PLACEMENT_TIKTOK'], promotion_type: draft.objective === 'LEAD_GENERATION' ? 'LEAD_GENERATION' : draft.objective === 'VIDEO_VIEWS' ? undefined : 'WEBSITE', promotion_target_type: draft.objective === 'LEAD_GENERATION' ? 'INSTANT_PAGE' : undefined, optimization_goal: draft.objective === 'TRAFFIC' ? 'CLICK' : draft.objective === 'VIDEO_VIEWS' ? 'ENGAGED_VIEW' : 'LEAD_GENERATION', billing_event: draft.objective === 'VIDEO_VIEWS' ? 'CPV' : draft.objective === 'TRAFFIC' ? 'CPC' : 'OCPM', bid_type: 'BID_TYPE_NO_BID', pacing: 'PACING_MODE_SMOOTH' });
  const video = schemaInput(schemas.CREATIVE_UPLOAD, { upload_type: 'UPLOAD_BY_URL', file_name: draft.name.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 80) + '.mp4' });
  return { campaign, adGroup, video, ad };
}
