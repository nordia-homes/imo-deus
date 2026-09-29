import { CommunicationError } from './server';
import { graph } from './meta';

export type WhatsAppTemplate = {
  name: string; language: string; status: string; category: string;
  components?: Array<{ type: string; text?: string; format?: string; buttons?: Array<{ type: string; url?: string }> }>;
};

export function bodyParameterCount(template: WhatsAppTemplate): number | null {
  const components = template.components || [];
  for (const component of components) {
    const type = component.type.toUpperCase();
    if (type === 'HEADER' && (component.format?.toUpperCase() !== 'TEXT' || /{{\d+}}/.test(component.text || ''))) return null;
    if (type === 'BUTTONS' && component.buttons?.some(button => /{{\d+}}/.test(button.url || ''))) return null;
  }
  const body = components.find(component => component.type.toUpperCase() === 'BODY');
  if (!body) return 0;
  const indexes = [...(body.text || '').matchAll(/{{(\d+)}}/g)].map(match => Number(match[1]));
  const count = Math.max(0, ...indexes);
  return indexes.every(index => index >= 1 && index <= count) ? count : null;
}

export function renderTemplateBody(template: WhatsAppTemplate, parameters: string[]): string {
  const body = template.components?.find(component => component.type.toUpperCase() === 'BODY')?.text || '';
  return body.replace(/{{(\d+)}}/g, (_, index: string) => parameters[Number(index) - 1] || '');
}
export async function listWhatsAppTemplates(wabaId: string, token: string, name?: string): Promise<WhatsAppTemplate[]> {
  if (!/^\d+$/.test(wabaId)) throw new CommunicationError('WABA invalid.');
  const templates: WhatsAppTemplate[] = [];
  const cursors = new Set<string>();
  let after = '';
  for (let page = 0; page < 20; page++) {
    const query = new URLSearchParams({ fields: 'name,language,status,category,components', limit: '100' });
    if (name) query.set('name', name);
    if (after) query.set('after', after);
    const response = await graph<{ data: WhatsAppTemplate[]; paging?: { cursors?: { after?: string }; next?: string } }>(`/${wabaId}/message_templates?${query}`, token);
    templates.push(...response.data);
    const next = response.paging?.next && response.paging.cursors?.after;
    if (!next || cursors.has(next)) return templates;
    cursors.add(next); after = next;
  }
  throw new CommunicationError('Lista șabloanelor este prea mare pentru verificare completă.', 409);
}
