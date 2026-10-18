import { expect, it, vi } from 'vitest';
vi.mock('@/lib/communications/server',()=>({CommunicationError:class extends Error{}}));
import { resolveNamedChoice } from '../named-choice';
import { choiceSources,namedChoiceText,namedGroupChoiceText,namedChoiceSchema } from '../named-choice-contract';
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

it('uses the explicit choice marker while preserving the original Facebook card source',()=>{
 const m=message('facebookConnections',[{id:'c',label:'Contul agenției'}]);m.cards![0].choiceSource='facebookPublicationAccount';
 const prompt=namedChoiceText('facebookPublicationAccount',m.cards![0].rows[0]);
 expect(resolveNamedChoice({messageId:m.id,source:'facebookPublicationAccount',rowId:'c'},prompt,[m])).toBe('Cont Facebook: c');
 delete m.cards![0].choiceSource;
 expect(()=>resolveNamedChoice({messageId:m.id,source:'facebookPublicationAccount',rowId:'c'},prompt,[m])).toThrow();
});

it('binds every selected group to the offer and replay hash',()=>{
 const rows=[{id:'a'.repeat(24),name:'Titan'},{id:'b'.repeat(24),name:'Cișmigiu'}];
 const m=message('facebookGroups',rows);m.cards![0].choiceSource='facebookPublicationGroups';
 const choice={messageId:m.id,source:'facebookPublicationGroups' as const,rowId:rows[0].id,rowIds:rows.map(row=>row.id)};
 const prompt=namedGroupChoiceText(rows);
 expect(resolveNamedChoice(choice,prompt,[m])).toBe('Grupuri Facebook: '+choice.rowIds.join(', '));
 const input={sessionId:'s',requestId:'r',prompt,choice};
 expect(requestCheckpointHash({...input,choice:{...choice,rowIds:[choice.rowId]}})).not.toBe(requestCheckpointHash(input));
 expect(()=>resolveNamedChoice({...choice,rowIds:[choice.rowId,'c'.repeat(24)]},prompt,[m])).toThrow();
 expect(()=>resolveNamedChoice(choice,prompt+' alt grup',[m])).toThrow();
 expect(()=>namedChoiceSchema.parse({...choice,rowIds:[choice.rowId,choice.rowId]})).toThrow();
 expect(()=>namedChoiceSchema.parse({...choice,source:'metaReviewSelection'})).toThrow();
 expect(()=>namedChoiceSchema.parse({...choice,rowId:rows[1].id})).toThrow();
 expect(()=>namedChoiceSchema.parse({...choice,rowIds:[]})).toThrow();
 expect(()=>namedChoiceSchema.parse({...choice,rowIds:Array.from({length:201},(_,i)=>i.toString(16).padStart(24,'0'))})).toThrow();
});

it('retains all 200 destinations while explicitly abbreviating only the visible message',()=>{
 const rows=Array.from({length:200},(_,i)=>({id:i.toString(16).padStart(24,'0'),name:'Grup '+i+' '+ 'x'.repeat(100)}));
 const m=message('facebookGroups',rows);m.cards![0].choiceSource='facebookPublicationGroups';
 const choice={messageId:m.id,source:'facebookPublicationGroups' as const,rowId:rows[0].id,rowIds:rows.map(row=>row.id)};
 const prompt=namedGroupChoiceText(rows);expect(prompt.length).toBeLessThan(6000);expect(prompt).toContain('încă 180');
 expect(resolveNamedChoice(choice,prompt,[m]).split(', ')).toHaveLength(200);
 expect(resolveNamedChoice(choice,prompt,[m])).toContain(rows[199].id);
});
