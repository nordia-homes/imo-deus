import { safeData } from './contracts';
// Expose confirmed IDs in a stable shape without changing domain responses.
const aliases: Record<string, [string, string]> = {
  meta_campaign_draft: ['campaign', 'campaignId'],
  tiktok_post_draft: ['draft', 'draftId'],
  video_create: ['job', 'jobId'],
  sales_template_create: ['template', 'templateId'],
  sales_template_action: ['template', 'templateId'],
};
export function operationResult(operation: string, raw: Record<string, any>) {
  const result = safeData(raw), alias = aliases[operation];
  if (!alias) return result;
  const id = result[alias[0]]?.id;
  return typeof id === 'string' && /^[A-Za-z0-9_.:-]{1,180}$/.test(id) ? { ...result, [alias[1]]: id } : result;
}
