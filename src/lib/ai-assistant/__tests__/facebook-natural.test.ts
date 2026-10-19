import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { facebookNaturalRequest, matchesFacebookProperty } from '../facebook-natural';
import { explicitlyRequestedSafeAction } from '../autonomy';
const command = 'Publică apartamentul din C.A. Rosetti, ultracentral, pe grupurile Facebook.';
describe('natural Facebook command', () => {
 it('recognizes the incident and authorizes the existing job only', () => {
  expect(facebookNaturalRequest(command)?.query).toBe('c.a. rosetti, ultracentral');
  expect(explicitlyRequestedSafeAction({kind:'existing_operation',operation:'facebook_job_create',params:{},query:{},body:{propertyId:'p',connectionId:'c',groupUrls:['https://www.facebook.com/groups/sale'],scheduledAt:null}} as any, command)).toBe(true);
 });
 it.each(['Nu publica apartamentul pe grupurile Facebook.', 'Arată apartamentul pe grupurile Facebook.', 'Publică apartamentul mâine pe grupurile Facebook.', 'Publică apartamentul pe grupurile Facebook și trimite WhatsApp.', 'Publică apartamentul doar pe grupurile Facebook.', 'Publică apartamentul pe grupul Facebook Titan.'])('does not drop restrictions: %s', prompt => expect(facebookNaturalRequest(prompt)).toBeNull());
 it('matches punctuation, initials, Romanian accents and compound spacing without changing the record', () => {
  const row = { title: 'CA Rosetti | Ultra central | Complet renovat | Balcon generos' };
  expect(matchesFacebookProperty(row, 'C.A. Rosetti, ultracentral')).toBe(true);
  expect(matchesFacebookProperty({title:'Apartament Cișmigiu'}, 'Cismigiu')).toBe(true);
  expect(matchesFacebookProperty(row, 'Rosetti Titan')).toBe(false);
 });
});

it('recognizes the Corbeanca wording and full or partial street addresses with exact numbers',()=>{
 expect(facebookNaturalRequest('Publică casa din Corbeanca pe grupurile de Facebook.')?.query).toBe('corbeanca');
 const row={title:'Casă Corbeanca',address:'Strada Florilor 12',location:'Corbeanca'};
 expect(matchesFacebookProperty(row,'Corbeanca, strada Florilor, numărul 12')).toBe(true);
 expect(matchesFacebookProperty(row,'Florilor 12')).toBe(true);
 expect(matchesFacebookProperty({...row,address:'Strada Florilor 120'},'Florilor 12')).toBe(false);
});
