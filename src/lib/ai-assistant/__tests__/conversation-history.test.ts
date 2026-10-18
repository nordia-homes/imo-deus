import { expect, it, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: vi.fn(), referencesAllowed: vi.fn() }));
vi.mock('@/lib/communications/server', () => ({ CommunicationError: class extends Error {} }));
import { originalFragment, conversationHistorySchema, readConversationHistory } from '../conversation-history';
import { collectionFor, referencesAllowed } from '../access';
it('recovers an entire long message including a late negation without silent truncation', () => {
 const text = 'Publică proprietatea. '.repeat(200) + 'Dar NU în grupul Titan.';
 let combined = '', offset = 0;
 for (;;) { const fragment = originalFragment(text, offset); combined += fragment.value; if (fragment.complete) break; offset = fragment.nextOffset!; }
 expect(combined).toBe(text);
 expect(combined).toContain('NU în grupul Titan');
});
it('preserves Unicode across fragment boundaries and validates offsets',()=>{
 const text = 'a'.repeat(999) + '🏠Cișmigiu';
 const first = originalFragment(text);
 expect(first.value).toHaveLength(999);
 expect(first.value+originalFragment(text,first.nextOffset!).value).toBe(text);
 expect(()=>originalFragment(text,text.length+1)).toThrow();
 expect(()=>conversationHistorySchema.parse({offset:10})).toThrow();
 expect(()=>conversationHistorySchema.parse({messageId:'m',before:'b'})).toThrow();
});
it('refuses another user session before reading its messages', async()=>{
 const collection=vi.fn();
 vi.mocked(collectionFor).mockReturnValue({doc:()=>({get:async()=>({exists:true,data:()=>({ownerId:'other'})}),collection})} as any);
 await expect(readConversationHistory({uid:'me',prospectingRequest:{sessionId:'s'}} as any,{})).rejects.toThrow('accesibilă');
 expect(collection).not.toHaveBeenCalled();
});
it('revalidates resource access before returning original text', async()=>{
 vi.mocked(referencesAllowed).mockResolvedValue(false);
 const message={exists:true,id:'m',data:()=>({text:'private',accessRefs:[{resource:'properties',id:'p'}]})};
 vi.mocked(collectionFor).mockReturnValue({doc:()=>({get:async()=>({exists:true,data:()=>({ownerId:'me'})}),collection:()=>({doc:()=>({get:async()=>message})})})} as any);
 await expect(readConversationHistory({uid:'me',prospectingRequest:{sessionId:'s'}} as any,{messageId:'m'})).rejects.toThrow('accesibil');
});

async function searchHistory(ctx: Parameters<typeof readConversationHistory>[0], input: Parameters<typeof readConversationHistory>[1]) {
 const result=await readConversationHistory(ctx,input);
 if (!('rows' in result.data)) throw new Error('Expected a history search page.');
 return {...result,data:result.data};
}
function historyFixture(rows: Array<{id:string;text:string;accessRefs?:any[]}>) {
 let cursor: string | undefined, limit=0;
 const query:any={orderBy:()=>query,startAfter:(doc:any)=>{cursor=doc.id;return query;},limit:(n:number)=>{limit=n;return query;},get:async()=>{
  const start=cursor ? rows.findIndex(row=>row.id===cursor)+1 : 0;
  const docs=rows.slice(start,start+limit).map(row=>({id:row.id,data:()=>({...row,role:'user'})}));
  return {docs,size:docs.length};
 }};
 const messages={...query,doc:(id:string)=>({get:async()=>({id,exists:rows.some(row=>row.id===id)})})};
 vi.mocked(collectionFor).mockReturnValue({doc:()=>({get:async()=>({exists:true,data:()=>({ownerId:'me'})}),collection:()=>messages})} as any);
 vi.mocked(referencesAllowed).mockImplementation(async (_ctx,refs:any)=>!refs.some((ref:any)=>ref.id==='private'));
 return {ctx:{uid:'me',prospectingRequest:{sessionId:'s'}} as any,limit:()=>limit};
}
it('searches full original text beyond excerpts with Romanian spelling normalization',async()=>{
 const f=historyFixture([{id:'m',text:'Introducere. '.repeat(300)+'Apartamentul din Cişmigiu pentru Ștefan.'}]);
 const result=await searchHistory(f.ctx,{query:'CISMIGIU stefan'});
 expect(result.data.rows?.map(row=>row.messageId)).toEqual(['m']);
 expect(result.data).toMatchObject({complete:true,query:'CISMIGIU stefan'});
 expect(f.limit()).toBe(50);
});
it('does not lose matches when the result limit stops within a scanned page',async()=>{
 const f=historyFixture(Array.from({length:25},(_,i)=>({id:'m'+i,text:'Titan'})));
 const first=await searchHistory(f.ctx,{query:'Titan'});
 expect(first.data.rows).toHaveLength(10);
 expect(first.data.nextCursor).toBe('m9');
 const second=await searchHistory(f.ctx,{query:'Titan',before:first.data.nextCursor!});
 expect(second.data.rows?.map(row=>row.messageId)).toEqual(Array.from({length:10},(_,i)=>'m'+(i+10)));
 const third=await searchHistory(f.ctx,{query:'Titan',before:second.data.nextCursor!});
 expect(third.data.rows).toHaveLength(5);
 expect(third.data.complete).toBe(true);
});
it('continues across a full page with no matches and does not claim absence',async()=>{
 const f=historyFixture([...Array.from({length:50},(_,i)=>({id:'m'+i,text:'Titan'})),{id:'old',text:'Rosetti'}]);
 const first=await searchHistory(f.ctx,{query:'Rosetti'});
 expect(first.data).toMatchObject({rows:[],complete:false,nextCursor:'m49',scanned:50});
 const next=await searchHistory(f.ctx,{query:'Rosetti',before:first.data.nextCursor!});
 expect(next.data.rows?.map(row=>row.messageId)).toEqual(['old']);
});
it('filters revoked resources and carries only returned result references',async()=>{
 const f=historyFixture([{id:'private',text:'Titan',accessRefs:[{resource:'properties',id:'private'}]}, {id:'irrelevant',text:'Rosetti',accessRefs:[{resource:'properties',id:'other'}]}, {id:'visible',text:'Titan',accessRefs:[{resource:'properties',id:'visible'}]}]);
 const result=await searchHistory(f.ctx,{query:'Titan'});
 expect(result.data.rows?.map(row=>row.messageId)).toEqual(['visible']);
 expect(result.refs).toEqual([{resource:'properties',id:'visible'}]);
});
it('requires every search term and rejects invalid search/read combinations',async()=>{
 const f=historyFixture([{id:'m1',text:'Titan'},{id:'m2',text:'Titan vizionare'}]);
 expect((await searchHistory(f.ctx,{query:'Titan vizionare'})).data.rows?.map(row=>row.messageId)).toEqual(['m2']);
 for(const value of [{query:'   '},{query:'!!!'},{query:'Titan',messageId:'m'},{query:'Titan',offset:10}]) expect(()=>conversationHistorySchema.parse(value)).toThrow();
});
