import { expect, it, vi } from 'vitest';
vi.mock('@/lib/communications/server',()=>({CommunicationError:class extends Error{}}));
import { resolveNamedChoice } from '../named-choice';
import { choiceSources,namedChoiceText,namedChoiceSchema } from '../named-choice-contract';
import { requestCheckpointHash } from '../request-checkpoint';
import type { AssistantMessage } from '../contracts';
const message=(source:string,rows:any[]=[{id:'opaque',campaignName:'Cișmigiu'}]):AssistantMessage=>({id:'offer',role:'assistant',text:'Alege',createdAt:'2026-10-18T10:00:00Z',cards:[{type:'data',source,title:'Opțiuni',rows}]});
it.each(choiceSources)('resolves only an offered %s choice from the current response',source=>{
 const m=message(source),row=m.cards![0].rows[0],choice={messageId:m.id,source,rowId:'opaque'};
 const visible=namedChoiceText(source,row);
 expect(visible).toContain('Cișmigiu');expect(visible).not.toContain('opaque');
 expect(resolveNamedChoice(choice,visible,[m])).toMatch(/: opaque$/);
});
it('never falls back to an identifier when names are missing',()=>{
 const text=namedChoiceText('metaImageApproval',{id:'private',campaignName:'private'});
 expect(text).not.toContain('private');expect(text).toContain('elementul afișat');
});
it.each(['old-message','wrong-source','missing-row','duplicate','redacted','changed-text'])('rejects %s selection rather than guessing',mode=>{
 const m=message('metaReviewSelection');const choice={messageId:'offer',source:'metaReviewSelection' as const,rowId:'opaque'};
 const prompt=namedChoiceText(choice.source,m.cards![0].rows[0]);
 if(mode==='old-message')choice.messageId='old';if(mode==='wrong-source')m.cards![0].source='metaPublishSelection';if(mode==='missing-row')choice.rowId='foreign';if(mode==='duplicate')m.cards![0].rows.push(m.cards![0].rows[0]);if(mode==='redacted')m.cards=[];
 expect(()=>resolveNamedChoice(choice,mode==='changed-text'?'Nu executa':prompt,[m])).toThrow();
});
it('rejects older valid choices after another assistant reply',()=>{
 const m=message('metaReviewSelection');const newer={...m,id:'newer',cards:[]};
 expect(()=>resolveNamedChoice({messageId:'offer',source:'metaReviewSelection',rowId:'opaque'},namedChoiceText('metaReviewSelection',m.cards![0].rows[0]),[m,newer])).toThrow();
});
it('supports opaque optimization references without treating them as document paths',()=>{
 const m=message('metaImageResumeSelection',[{id:'campaign/'+'a'.repeat(64),campaignName:'Cișmigiu'}]);
 const choice={messageId:m.id,source:'metaImageResumeSelection' as const,rowId:String(m.cards![0].rows[0].id)};
 expect(resolveNamedChoice(choice,namedChoiceText(choice.source,m.cards![0].rows[0]),[m])).toBe('Reia optimizarea Meta: '+choice.rowId);
 expect(()=>namedChoiceSchema.parse({...choice,messageId:'other/path'})).toThrow();
});
it('binds replay to exact source message, source and selected row',()=>{
 const input={sessionId:'s',requestId:'r',prompt:'Selectează',choice:{messageId:'m',source:'metaReviewSelection' as const,rowId:'c'}};
 const hash=requestCheckpointHash(input);
 for(const patch of [{messageId:'other'},{source:'metaPublishSelection' as const},{rowId:'other'}]) expect(requestCheckpointHash({...input,choice:{...input.choice,...patch}})).not.toBe(hash);
});

it('normalizes label whitespace consistently with API prompt trimming',()=>{
 const m=message('metaReviewSelection',[{id:'c',campaignName:'  Cișmigiu  '}]);
 const prompt=namedChoiceText('metaReviewSelection',m.cards![0].rows[0]);
 expect(prompt).toBe('Selectează campania: Cișmigiu');
 expect(resolveNamedChoice({messageId:'offer',source:'metaReviewSelection',rowId:'c'},prompt.trim(),[m])).toBe('Campanie Meta: c');
});
