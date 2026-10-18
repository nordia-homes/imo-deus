import { expect, it } from 'vitest';
import { bindSemanticAuthority, semanticActionDecision } from '../semantic-authority';
import { validateGoalCoverage } from '../goal-coverage';
import type { AssistantAction } from '../contracts';
const action = {kind:'create_contact',name:'Matei Alin',phone:'0123123123'} as AssistantAction;
const request = 'Aș vrea să-l avem pe Matei Alin în lista de cumpărători.';
function coverage(mode: 'execute'|'prepare'|'prohibited' = 'execute', conditions: any[] = []) {
 return validateGoalCoverage({requirements:[{id:'buyer',sourceQuote:request,description:'Adăugare cumpărător',resolution:'planned',steps:[1],evidenceCallIds:[],execution:{mode,conditions}}]},request,1,new Set(['read-contact']));
}
it('binds semantic intent to the exact request and prepared action without a command-verb allowlist',()=>{
 const authority=bindSemanticAuthority(request,[action],coverage());
 expect(semanticActionDecision(authority,request,action)).toBe(true);
 expect(semanticActionDecision(authority,request+' Nu îl adăuga.',action)).toBe(false);
 expect(semanticActionDecision(authority,request,{...action,name:'Alt client'} as AssistantAction)).toBe(false);
});
it.each(['prepare','prohibited'] as const)('does not authorize %s intent',mode=>{
 expect(semanticActionDecision(bindSemanticAuthority(request,[action],coverage(mode)),request,action)).toBe(false);
});
it('does not authorize an unresolved condition or a partially annotated plan',()=>{
 const conditional=coverage('execute',[{sourceQuote:request,satisfied:false,evidenceCallIds:[]}]);
 expect(semanticActionDecision(bindSemanticAuthority(request,[action],conditional),request,action)).toBe(false);
 const mixed=coverage(); mixed.requirements.push({...mixed.requirements[0],id:'another',execution:undefined});
 expect(semanticActionDecision(bindSemanticAuthority(request,[action],mixed),request,action)).toBe(false);
});
it('rejects invented conditional evidence and accepts only current successful reads',()=>{
 expect(()=>coverage('execute',[{sourceQuote:request,satisfied:true,evidenceCallIds:[]}])).toThrow('dovezi');
 expect(()=>coverage('execute',[{sourceQuote:request,satisfied:true,evidenceCallIds:['invented']}])).toThrow('necunoscută');
 expect(()=>coverage('execute',[{sourceQuote:'invented quote',satisfied:false,evidenceCallIds:[]}])).toThrow('originală');
 expect(semanticActionDecision(bindSemanticAuthority(request,[action],coverage('execute',[{sourceQuote:request,satisfied:true,evidenceCallIds:['read-contact']}])),request,action)).toBe(true);
});
it('preserves legacy behavior only when no semantic contract was supplied',()=>{
 expect(semanticActionDecision(undefined,request,action)).toBeUndefined();
});

it('binds identical payloads separately to their plan steps',()=>{
 const value=coverage();value.requirements.push({...value.requirements[0],id:'draft',steps:[2],execution:{mode:'prepare',conditions:[]}});
 const authority=bindSemanticAuthority(request,[action,action],value);
 expect(semanticActionDecision(authority,request,action,1)).toBe(true);
 expect(semanticActionDecision(authority,request,action,2)).toBe(false);
 expect(semanticActionDecision(authority,request,action,3)).toBe(false);
});
