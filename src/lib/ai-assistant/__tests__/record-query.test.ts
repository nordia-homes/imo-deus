import { describe, it, expect, vi } from 'vitest';
vi.mock('../access', () => ({ collectionFor: (ctx:any)=>ctx.query, getResource:vi.fn() }));
import { queryRecords, recordDateRange } from '../record-query';
import { queryRecordsSchema } from '../contracts';
import { requestReservation, AgentBudget } from '../budget';
function database(rows:any[], filters:any[]=[] ,after?:string,limit=Infinity):any {
 const matching=()=>rows.filter(r=>(!after||r.id>after)&&filters.every(([f,op,v])=>op==='=='?r[f]===v:op==='>='?r[f]>=v:r[f]<v));
 return {where:(f:string,op:string,v:any)=>database(rows,[...filters,[f,op,v]],after,limit),orderBy:()=>database(rows,filters,after,limit),limit:(n:number)=>database(rows,filters,after,n),startAfter:(...v:string[])=>database(rows,filters,v.at(-1),limit),count:()=>({get:async()=>({data:()=>({count:matching().length})})}),get:async()=>{const data=matching().slice(0,limit);return {empty:!data.length,size:data.length,docs:data.map(r=>({id:r.id,data:()=>r}))};}};
}
describe('filtered calendar and measured token budget',()=>{
 it('preserves search continuation when the display fills before a small backend page is consumed',async()=>{
  const ctx={agencyId:'a',uid:'u',role:'agent',query:database(Array.from({length:7},(_,i)=>({id:String(i),name:'Client'})))} as any;
  const input=queryRecordsSchema.parse({resource:'contacts',search:'Client',limit:3});
  const first=await queryRecords(ctx,input);expect(first.rows.map(r=>r.id)).toEqual(['0','1','2']);expect(first.complete).toBe(false);expect(first.countScope).toBe('segment');
  const second=await queryRecords(ctx,{...input,cursor:first.nextCursor!});expect(second.rows.map(r=>r.id)).toEqual(['3','4','5']);expect(second.complete).toBe(false);
  const final=await queryRecords(ctx,{...input,cursor:second.nextCursor!});expect(final.rows.map(r=>r.id)).toEqual(['6']);expect(final.nextCursor).toBeNull();expect(final.complete).toBe(true);expect(final.summary.scope).toContain('segmentului final');
 });
 it('does not label a fallback count after a cursor as the complete corpus total',async()=>{
  const ctx={agencyId:'a',uid:'u',role:'agent',query:database(Array.from({length:10001},(_,i)=>({id:String(i).padStart(5,'0'),name:'Client'})))} as any;
  const input=queryRecordsSchema.parse({resource:'contacts',search:'Client',mode:'count',limit:1});
  const first=await queryRecords(ctx,input);expect(first.count).toBe(10000);expect(first.complete).toBe(false);
  const final=await queryRecords(ctx,{...input,cursor:first.nextCursor!});
  expect(final.count).toBe(1);expect(final.countScope).toBe('segment');expect(final.complete).toBe(false);expect(final.nextCursor).toBeNull();expect(final.summary.scope).toContain('nu totalul agenției');
 });
 it('invalidates continuation after a role change or a different resolved relative day',async()=>{
  vi.useFakeTimers({toFake:['Date']});
  try {
   vi.setSystemTime(new Date('2026-10-06T10:00:00Z'));
   const input=queryRecordsSchema.parse({resource:'viewings',dayOffset:1,limit:1});
   const range=recordDateRange(input);
   const ctx={agencyId:'a',uid:'u',role:'agent',query:database([{id:'0',viewingDate:range.from,contactName:'Client'},{id:'1',viewingDate:range.from,contactName:'Client'}])} as any;
   const first=await queryRecords(ctx,input);
   await expect(queryRecords({...ctx,role:'admin'},{...input,cursor:first.nextCursor!})).rejects.toThrow('Cursor invalid');
   vi.setSystemTime(new Date('2026-10-07T10:00:00Z'));
   await expect(queryRecords(ctx,{...input,cursor:first.nextCursor!})).rejects.toThrow('Cursor invalid');
  } finally {vi.useRealTimers();}
 });
 it('counts tomorrow without displaying 349 historical viewings',async()=>{
  const range=recordDateRange(queryRecordsSchema.parse({resource:'viewings',dayOffset:1}));
  const rows=Array.from({length:349},(_,i)=>({id:String(i).padStart(4,'0'),status:'scheduled',viewingDate:i<3?range.from:'2020-01-01T10:00:00.000Z',contactName:'Client',propertyTitle:'Apartament'}));
  const ctx={agencyId:'a',uid:'u',query:database(rows)} as any;
  const result=await queryRecords(ctx,queryRecordsSchema.parse({resource:'viewings',dayOffset:1,mode:'count',status:'scheduled'}));
  expect(result.count).toBe(3);expect(result.rows).toHaveLength(3);expect(result.scanned).toBe(3);expect(result.complete).toBe(true);
 });
 it('resolves a 23-hour Bucharest daylight-saving day correctly',()=>{
  const range=recordDateRange(queryRecordsSchema.parse({resource:'viewings',date:'2027-03-28'}));
  expect(Date.parse(range.to!)-Date.parse(range.from!)).toBe(23*3600000);
 });
 it('rejects reuse of a continuation for different filters',async()=>{
  const ctx={agencyId:'a',uid:'u',query:database(Array.from({length:12},(_,i)=>({id:String(i).padStart(4,'0'),status:'open'})))} as any;
  const input=queryRecordsSchema.parse({resource:'tasks',limit:5});const first=await queryRecords(ctx,input);
  expect((await queryRecords(ctx,{...input,cursor:first.nextCursor!})).rows.map(r=>r.id)).toEqual(['0005','0006','0007','0008','0009']);
  await expect(queryRecords(ctx,{...input,status:'completed',cursor:first.nextCursor!})).rejects.toThrow('Cursor invalid');
 });
 it('does not reserve base64 ciphertext as billable plaintext tokens',()=>{
  const input=[{type:'reasoning',encrypted_content:'x'.repeat(200000)},{type:'function_call_output',output:'three viewings'}];
  const reservation=requestReservation('rules',input,[],{plainBytes:100,inputTokens:6000,outputTokens:1000});
  expect(reservation.tokens).toBeLessThan(9000);expect(()=>new AgentBudget().reserve('gpt-6-luna',reservation.tokens,2200)).not.toThrow();
 });
});
