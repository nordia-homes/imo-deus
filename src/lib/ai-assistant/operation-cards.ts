import type { AssistantCard } from './contracts';
import { safeData } from './contracts';

const arrays = ['rows', 'data', 'results', 'conversations', 'messages', 'posts', 'leads', 'contacts', 'properties', 'tasks', 'viewings', 'jobs', 'connections', 'drafts', 'assets', 'projects', 'templates', 'agents', 'advertisers'];
const objects = ['sale', 'job', 'call', 'draft', 'project', 'asset', 'template', 'campaign', 'connection', 'report'];
export function operationCards(operation: string, description: string, raw: Record<string, any>): AssistantCard[] {
  const data = safeData(raw), list = arrays.find(key => Array.isArray(data[key])), object = objects.find(key => data[key] && typeof data[key] === 'object' && !Array.isArray(data[key]));
  const rows = list ? data[list] : object ? [data[object]] : [data];
  const source = list && ['contacts', 'properties', 'tasks', 'viewings'].includes(list) ? list : operation;
  const title = description.split('.')[0] || 'Rezultate CRM';
  return [{ type: 'data', title, source, note: data.note || null, freshness: 'domain_handler', rows: rows.map((row: any) => typeof row !== 'object' || row === null ? { text: String(row ?? '') } : {
    ...row, imageUrl: row.imageUrl || row.thumbnailUrl || row.coverUrl || null,
    link: row.link || row.actionUrl || row.checkoutUrl || row.portalUrl || row.authorizationUrl || row.connectUrl || null,
    title: row.title || row.name || row.subject || row.propertyTitle || row.summary || title,
    description: row.description || row.summary || row.note || row.error || data.note || null,
    dueDate: row.viewingDate || row.dueDate || row.scheduledAt || row.createdAt || null,
  }), ...(typeof data.complete === 'boolean' ? { complete: data.complete } : {}) }];
}
