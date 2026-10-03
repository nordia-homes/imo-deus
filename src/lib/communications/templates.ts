import { z } from 'zod';
import { templateButtonsSchema } from './template-buttons';
import { CommunicationError } from './server';
import { graph } from './meta';

export type WhatsAppTemplate = {
  name: string; language: string; status: string; category: string;
  components?: Array<{ type: string; text?: string; format?: string; buttons?: Array<{ type: string; text?: string; url?: string }> }>;
};

export function bodyParameterCount(template: WhatsAppTemplate): number | null {
  const components = template.components || [];
  // This editor only supports positional BODY variables and static text/buttons.
  if (components.some(c => /{{(?!\d+}})/.test(c.text || '') || !['BODY', 'HEADER', 'FOOTER', 'BUTTONS'].includes(c.type.toUpperCase()))) return null;
  if (components.some(c => c.type.toUpperCase() === 'BUTTONS' && c.buttons?.some(b => !['URL', 'PHONE_NUMBER', 'QUICK_REPLY'].includes(b.type.toUpperCase()) || /{{/.test(b.url || '')))) return null;
  for (const component of components) {
    const type = component.type.toUpperCase();
    if (type === 'HEADER' && (component.format?.toUpperCase() !== 'TEXT' || /{{\d+}}/.test(component.text || ''))) return null;
    if (type === 'BUTTONS' && component.buttons?.some(button => /{{\d+}}/.test(button.url || ''))) return null;
  }
  const body = components.find(component => component.type.toUpperCase() === 'BODY');
  if (!body) return 0;
  const indexes = [...(body.text || '').matchAll(/{{(\d+)}}/g)].map(match => Number(match[1]));
  const count = Math.max(0, ...indexes);
  return indexes.every(index => index >= 1) && new Set(indexes).size === count ? count : null;
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

export const templateCreationSchema = z.object({
  buttons: templateButtonsSchema.default([]),
  name: z.string().regex(/^[a-z][a-z0-9_]{1,99}$/),
  language: z.enum(['ro', 'en_US']),
  category: z.enum(['UTILITY', 'MARKETING']),
  body: z.string().trim().min(1).max(1024).refine(v => !/[{}]/.test(v), 'Acest formular creează șabloane text fără variabile.'),
});
export async function createWhatsAppTemplate(wabaId: string, token: string, body: unknown) {
  if (!/^\d+$/.test(wabaId)) throw new CommunicationError('WABA invalid.');
  const input = templateCreationSchema.parse(body);
  const result = await graph<{ id?: string; status?: string; category?: string }>('/' + wabaId + '/message_templates', token,
    { name: input.name, language: input.language, category: input.category, components: [{ type: 'BODY', text: input.body }, ...(input.buttons.length ? [{ type: 'BUTTONS', buttons: input.buttons }] : [])] });
  if (!result.id) throw new CommunicationError('Meta nu a confirmat crearea șablonului.', 502);
  return { id: result.id, status: result.status || 'PENDING', category: result.category || input.category };
}

// Static CTA buttons are already part of the approved template. Quick replies
// receive a deterministic payload so the callback remains useful to the Inbox.
export function templateSendComponents(template: WhatsAppTemplate, parameters: string[]) {
  const components: Array<Record<string, unknown>> = parameters.length ? [{ type: 'body', parameters: parameters.map(text => ({ type: 'text', text })) }] : [];
  const buttons = template.components?.find(c => c.type.toUpperCase() === 'BUTTONS')?.buttons || [];
  buttons.forEach((button, index) => { if (button.type.toUpperCase() === 'QUICK_REPLY') components.push({ type: 'button', sub_type: 'quick_reply', index: String(index), parameters: [{ type: 'payload', payload: button.text || 'reply_' + index }] }); });
  return components;
}
