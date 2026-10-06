import { safeData } from './contracts';
// Expose confirmed IDs in a stable shape without changing domain responses.
const aliases: Record<string, [string, string]> = {
  meta_campaign_draft: ['campaign', 'campaignId'],
  tiktok_post_draft: ['draft', 'draftId'],
  video_create: ['job', 'jobId'],
  sales_template_create: ['template', 'templateId'],
  sales_template_action: ['template', 'templateId'],
  outreach_start: ['call', 'callId'],
  facebook_job_create: ['job', 'jobId'],
  tiktok_studio_project_create: ['project', 'projectId'],
};
export function operationResult(operation: string, raw: Record<string, any>, readOnly = false) {
  const result = safeData(raw), alias = aliases[operation];
  const state = result.status || result.job?.status || result.call?.status || result.draft?.status || result.campaign?.status || result.operation?.status || result.operation?.state;
  if (typeof state === 'string') result.businessStatus = state;
  const key = String(state || '').toLowerCase();
  const groups: Record<string, string[]> = { queued: ['queued', 'pending', 'scheduled', 'waiting'], running: ['running', 'processing', 'calling', 'rendering', 'uploading'], succeeded: ['succeeded', 'completed', 'sent', 'delivered', 'read', 'published', 'live', 'success'], failed: ['failed', 'error', 'rejected'], unknown: ['unknown', 'unknown_external_state', 'partial'], cancelled: ['cancelled', 'canceled'], draft: ['draft', 'ready', 'ready_to_publish', 'pending_approval'] };
  result.executionState = Object.entries(groups).find(([, values]) => values.includes(key))?.[0] || (readOnly ? 'observed' : 'accepted_unverified');
  if (operation === 'file_apply' && key === 'attached' && result.mutationRevision?.resource === 'properties') result.executionState = 'succeeded';
  if (result.call?.providerErrorCode === 'vapi_create_unknown') {
    result.executionState = 'unknown';
    result.note = 'Rezultatul lansării apelului este incert. Verifică furnizorul; apelul nu trebuie retrimis automat.';
  }
  result.verifiedAt = new Date().toISOString();
  result.evidenceSource = 'domain_handler';
  if (result.executionState === 'accepted_unverified') result.note = 'Handlerul a acceptat comanda. Nu a furnizat o stare finală de business; verifică resursa înainte de a declara un efect extern finalizat.';
  if (result.executionState !== 'unknown' && ['queued', 'pending', 'scheduled', 'running', 'processing', 'calling'].includes(String(state).toLowerCase())) result.note = 'Cererea a fost acceptată. Rezultatul final este încă în procesare; verifică starea înainte de a declara succes.';
  if (!alias) return result;
  const id = result[alias[0]]?.id;
  return typeof id === 'string' && /^[A-Za-z0-9_.:-]{1,180}$/.test(id) ? { ...result, [alias[1]]: id } : result;
}
