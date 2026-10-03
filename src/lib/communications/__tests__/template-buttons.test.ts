import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: vi.fn() }));
import { templateButtonsSchema } from '../template-buttons';
import { bodyParameterCount, createWhatsAppTemplate, templateSendComponents } from '../templates';

describe('WhatsApp template buttons', () => {
 afterEach(() => vi.unstubAllGlobals());
 const link = { type: 'URL', text: 'Vezi proprietatea', url: 'https://example.com/proprietate/123' };
 const call = { type: 'PHONE_NUMBER', text: 'Sună agentul', phone_number: '+40712345678' };
 const replies = [{ type: 'QUICK_REPLY', text: 'Confirm vizionarea' }, { type: 'QUICK_REPLY', text: 'Reprogramează' }];
 it('supports no buttons, quick replies, or static CTA buttons', () => {
  for (const buttons of [[], replies, [link, call]]) expect(templateButtonsSchema.safeParse(buttons).success).toBe(true);
 });
 it.each(['javascript:alert(1)', 'http://example.com', 'https://u:pass@example.com', 'https://example.com/{{1}}', 'https://example.com/%7B%7B1%7D%7D'])('rejects unsupported URL %s', url => {
  expect(templateButtonsSchema.safeParse([{ ...link, url }]).success).toBe(false);
 });
 it.each(['0712345678', '+400abc', '+0123456789', '+1234567890123456'])('requires international phone format: %s', phone_number => {
  expect(templateButtonsSchema.safeParse([{ ...call, phone_number }]).success).toBe(false);
 });
 it('rejects blank/long labels, duplicates, invalid types and unsupported combinations', () => {
  for (const buttons of [[{ ...link, text: '  ' }], [{ ...link, text: 'a'.repeat(26) }], [{ ...link, text: '{{1}}' }], [link, link], [call, call], [link, ...replies], [...replies, ...replies], [{ type:'COPY_CODE', text:'Copy' }]]) expect(templateButtonsSchema.safeParse(buttons).success).toBe(false);
 });
 it.each([[link, call], replies])('serializes approved creation fields to Meta', async (...buttons) => {
  const fetcher = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ id: '123', status: 'PENDING' }) }));
  vi.stubGlobal('fetch', fetcher);
  await createWhatsAppTemplate('10', 'test-token', { name:'confirmare_test', language:'ro', category:'UTILITY', body:'Confirmarea solicitată.', buttons });
  const init = (fetcher.mock.calls as unknown as Array<[string, RequestInit]>)[0][1];
  expect(JSON.parse(String(init.body)).components).toEqual([{ type:'BODY', text:'Confirmarea solicitată.' }, { type:'BUTTONS', buttons }]);
 });
 it('rejects invalid buttons before any Meta request', async () => {
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
  await expect(createWhatsAppTemplate('10','test',{name:'test_name',language:'ro',category:'UTILITY',body:'Text',buttons:[{...link,url:'javascript:alert(1)'}]})).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('preserves actual quick reply indexes and body parameters when sending', () => {
  const template={name:'test',language:'ro',status:'APPROVED',category:'UTILITY',components:[{type:'BODY',text:'Bună {{1}}'},{type:'BUTTONS',buttons:[link,...replies]}]};
  expect(bodyParameterCount(template)).toBe(1);
  expect(templateSendComponents(template,['Ana'])).toEqual([
   {type:'body',parameters:[{type:'text',text:'Ana'}]},
   {type:'button',sub_type:'quick_reply',index:'1',parameters:[{type:'payload',payload:'Confirm vizionarea'}]},
   {type:'button',sub_type:'quick_reply',index:'2',parameters:[{type:'payload',payload:'Reprogramează'}]},
  ]);
 });
 it('needs no send parameters for static link and call buttons', () => {
  const template={name:'test',language:'ro',status:'APPROVED',category:'UTILITY',components:[{type:'BODY',text:'Text'},{type:'BUTTONS',buttons:[link,call]}]};
  expect(bodyParameterCount(template)).toBe(0);expect(templateSendComponents(template,[])).toEqual([]);
  expect(bodyParameterCount({...template,components:[{type:'BUTTONS',buttons:[{...link,url:'https://example.com/{{1}}'}]}]})).toBeNull();
 });
});
