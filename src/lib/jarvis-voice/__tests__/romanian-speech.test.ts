import {it,expect,vi} from 'vitest';
import {romanianSpeech} from '../romanian-speech';
import {humanReply} from '@/lib/ai-assistant/human-reply';
import {startVoiceProgress} from '../progress';
it.each([
 ['130000 euro','o sută treizeci de mii de euro'],['130.000 EUR','o sută treizeci de mii de euro'],['130,000 euro','o sută treizeci de mii de euro'],
 ['1.250,50 lei','o mie două sute cincizeci de lei și cincizeci de bani'],['1 euro','un euro'],['1 leu','un leu'],['20 €','douăzeci de euro'],
 ['0722 123 456','zero, șapte, doi, doi, unu, doi, trei, patru, cinci, șase'],
 ['+40722123456','plus patru, zero, șapte, doi, doi, unu, doi, trei, patru, cinci, șase'],
 ['0123123123','zero, unu, doi, trei, unu, doi, trei, unu, doi, trei'],['Am finalizat 1 pași','Am finalizat un pas'],['Sunt 1 clienți','Este un client'],['0 lei','zero lei'],['Sunt 1 rezervări','Este o rezervare'],['12 vizionări','douăsprezece vizionări'],['21 rezervări','douăzeci și una de rezervări'],['unu rezervare','o rezervare'],['1 rezervări','o rezervare'],['2 vizionări','două vizionări'],['07:30','șapte și treizeci']
 ])('speaks %s as %s',(input,expected)=>expect(romanianSpeech(input)).toBe(expected));
it('uses names without changing execution data or URLs',()=>{
 const row={id:'property-abc',title:'Cișmigiu | 2 camere'};
 expect(humanReply('Proprietatea property-abc: https://example.com/property-abc',[row])).toBe('Proprietatea Cișmigiu | 2 camere: https://example.com/property-abc');
 expect(humanReply('ID proprietate: property-abc',[row])).toBe('Cișmigiu | 2 camere');
 expect(row.id).toBe('property-abc');
});
it('hides unavailable IDs and corrects singular agreement in text',()=>{
 expect(humanReply('unu rezervare pentru contact-123',[{contactId:'contact-123'}])).toBe('o rezervare pentru înregistrarea selectată');
 expect(humanReply('ID publicare: 123456789.')).not.toContain('123456789');
});
it('never repeats narration during a long stage, including returning to a previous stage',async()=>{
 vi.useFakeTimers();const say=vi.fn(async(_text:string)=>{}),p=startVoiceProgress(say,()=>{});
 p.update('','search_properties');await vi.advanceTimersByTimeAsync(5000);
 p.update('','planning');await vi.advanceTimersByTimeAsync(10000);
 p.update('','search_properties');await vi.advanceTimersByTimeAsync(120000);
 expect(new Set(say.mock.calls.map(call=>call[0])).size).toBe(say.mock.calls.length);p.stop();vi.useRealTimers();
});

it.each([
 ['un (1) proprietăți','o proprietate'],['Sunt un (1) proprietati','Este o proprietate'],
 ['un proprietari','un proprietar'],['doi proprietar','doi proprietari'],['o proprietăți','o proprietate'],
 ['2 proprietate','două proprietăți'],['12 conturi','douăsprezece conturi'],['20 proprietate','douăzeci de proprietăți'],
 ['21 de proprietăți','douăzeci și una de proprietăți'],['101 proprietăți','o sută una proprietăți'],
 ['Am găsit 3 proprietate și un (1) cumpărători.','Am găsit trei proprietăți și un cumpărător.']
])('normalizes quantity agreement without duplicate numbers: %s',(input,expected)=>expect(romanianSpeech(input)).toBe(expected));
it('normalizes display agreement without changing unrelated numeric data',()=>{
 expect(humanReply('Sunt un (1) proprietăți. Am găsit 20 proprietate și doi cont.',[])).toBe('Este o proprietate. Am găsit 20 de proprietăți și două conturi.');
 expect(humanReply('Preț: 130000 euro; telefon 0722123456; 1,5 camere.',[])).toBe('Preț: 130000 euro; telefon 0722123456; 1,5 camere.');
});
