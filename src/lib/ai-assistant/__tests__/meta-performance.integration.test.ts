import { createCipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
const mocks=vi.hoisted(()=>({actor:null as any,db:null as any,fetch:vi.fn()}));
vi.mock('@/lib/firebase-app-hosting',()=>({requireAgencyUserFromBearerToken:async()=>mocks.actor}));
vi.mock('@/firebase/admin',()=>({adminAuth:{},get adminDb(){return mocks.db;}}));
import { chatTurn } from '../workspace';
import { metaComparisonPeriods } from '@/lib/meta-insights-period';
import { VERSIONS } from '../models';
import corpus from '../../../../docs/jarvis/evals/master-scenarios.json';
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('persisted Jarvis performance comparisons',()=>{
 let db:Firestore;const agencies:string[]=[],users:string[]=[];
 beforeAll(()=>{if(!/^(localhost|127[.]0[.]0[.]1):[0-9]+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw new Error('Local emulator required');db=new Firestore({projectId:'demo-imodeus-meta-performance'});mocks.db=db;vi.stubEnv('META_TOKEN_ENCRYPTION_KEY','synthetic-control-key');vi.stubGlobal('fetch',mocks.fetch);});
 afterAll(async()=>{if(!db)return;for(const id of agencies){await db.recursiveDelete(db.collection('agencies').doc(id));await db.collection('agencyPrivateIntegrations').doc(id+'__meta').delete();}for(const id of users)await db.collection('users').doc(id).delete();await db.terminate();vi.unstubAllGlobals();vi.unstubAllEnvs();});
 async function fixture(){
  const agencyId=randomUUID(),uid=randomUUID();agencies.push(agencyId);users.push(uid);const ctx={agencyId,uid,role:'agent',adminDb:db} as any;mocks.actor=ctx;
  const agency=db.collection('agencies').doc(agencyId),profile=db.collection('users').doc(uid),campaign=agency.collection('metaCampaignDrafts').doc('selected'),other=agency.collection('metaCampaignDrafts').doc('other'),property=agency.collection('properties').doc('property');
  await agency.set({name:'Synthetic'});await profile.set({agencyId,role:'agent'});await property.set({agencyId,title:'Cișmigiu',status:'Activ',metaMarketing:{latestCampaignDraftId:'other',status:'published'}});
  await campaign.set({agencyId,propertyId:'property',status:'published',metaCampaignId:'123',campaignName:'Selectată',updatedAt:'before'});await other.set({agencyId,propertyId:'outside',status:'published',metaCampaignId:'999',campaignName:'Alta',updatedAt:'before'});
  const grant=db.collection('agencyPrivateIntegrations').doc(agencyId+'__meta'),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',createHash('sha256').update('synthetic-control-key').digest(),iv),encrypted=Buffer.concat([cipher.update('synthetic-token'),cipher.final()]);
  await grant.set({agencyId,connected:true,selectedAdAccount:{id:'act_456'},encryptedAccessToken:`v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`});
  let paused=false;mocks.fetch.mockReset().mockImplementation(async(url:string,init?:RequestInit)=>{const u=new URL(url);expect(u.origin).toBe('https://graph.facebook.com');expect(u.pathname).toBe('/v23.0/123');if(init?.method==='POST'){expect(String(init.body)).toBe('status=PAUSED');paused=true;return Response.json({success:true});}return Response.json({id:'123',account_id:'456',status:paused?'PAUSED':'ACTIVE',effective_status:paused?'PAUSED':'ACTIVE'});});
  const sessionId=randomUUID(),currentRecord={resource:'properties',id:'property'} as const;
  const send=(prompt:string,requestId=randomUUID())=>chatTurn(ctx,{sessionId,requestId,prompt,currentRecord});
  const history=[{id:'current-page-context',role:'assistant',cards:[{source:'properties',rows:[{id:'property'}]}]}] as any;
  return {ctx,agency,profile,campaign,other,property,grant,send,history,sessionId};
 }


 async function performanceFixture(){
  const f=await fixture();
  await f.other.update({propertyId:'property'});
  const calls:URL[]=[];
  mocks.fetch.mockImplementation(async(url:string,init?:RequestInit)=>{
   expect(init?.method||'GET').toBe('GET');const u=new URL(url);calls.push(u);expect(u.origin).toBe('https://graph.facebook.com');
   if(u.pathname==='/v23.0/act_456')return Response.json({id:'act_456',account_id:'456',currency:'EUR',timezone_name:'Europe/Bucharest'});
   const id=u.pathname.split('/')[2];expect(['123','999','888']).toContain(id);
   if(!u.pathname.endsWith('/insights'))return Response.json({id,account_id:'456',status:'ACTIVE',effective_status:'ACTIVE'});
   expect(u.searchParams.get('action_attribution_windows')).toBe('["7d_click","1d_view"]');expect(u.searchParams.get('action_report_time')).toBe('impression');
   const period=JSON.parse(u.searchParams.get('time_range')!),isCurrent=period.since===metaComparisonPeriods().current.since;
   return Response.json({data:[{campaign_id:id,account_id:'456',account_currency:'EUR',date_start:period.since,date_stop:period.until,spend:isCurrent?'120':'100',impressions:'1000',clicks:'30',actions:[{action_type:'lead',value:isCurrent?'4':'2'},{action_type:'onsite_conversion.lead_grouped',value:'4'}]}]});
  });return {...f,calls};
 }
 for(const n of [420,436])it('executes original master-'+n,async()=>{
  const f=await performanceFixture();if(n===436)await f.other.update({propertyId:'outside'});
  const before=(await f.campaign.get()).data(),scenarioId='master-'+String(n).padStart(4,'0'),prompt=corpus.scenarios.find(row=>row.id===scenarioId)!.text,requestId=randomUUID();
  const result=await f.send(prompt,requestId),card=result.message.cards?.[0];expect(card?.source).toBe('metaPerformanceReview');expect(card?.rows).toHaveLength(n===420?2:1);expect(card?.rows[0].current).toMatchObject({spend:120,leads:4,costPerLead:30});if(n===436){expect(card?.rows[0].previous).toMatchObject({spend:100,leads:2,costPerLead:50});expect(card?.rows[0].changes).toMatchObject({costPerLead:{difference:-20,percent:-40}});}expect(result.message.text).toContain('București');expect(result.message.planId).toBeUndefined();expect((await f.campaign.get()).data()).toEqual(before);
  const count=mocks.fetch.mock.calls.length;expect((await f.send(prompt,requestId)).message.id).toBe(result.message.id);expect(mocks.fetch).toHaveBeenCalledTimes(count);
  await mkdir('.tmp/jarvis-meta-performance',{recursive:true});await writeFile('.tmp/jarvis-meta-performance/'+scenarioId+'.json',JSON.stringify({scenarioId,prompt,versions:VERSIONS,executionVerified:true,environment:'Persisted application chat, real local Firestore and synthetic Meta account/campaign/Insights GET responses. Explicit periods, attribution, identity checks and no campaign mutations.',runs:[{phase:'original',final:result.message}]},null,2));
 });
 it('selects two campaigns from three without stopping after first selection',async()=>{const f=await performanceFixture();await f.agency.collection('metaCampaignDrafts').doc('third').set({agencyId:f.ctx.agencyId,propertyId:'property',status:'published',metaCampaignId:'888'});expect((await f.send('Compară două campanii Meta.')).message.cards?.[0].source).toBe('metaPerformanceSelection');expect(mocks.fetch).not.toHaveBeenCalled();expect((await f.send('Statistici Meta: selected')).message.cards?.[0].source).toBe('metaPerformanceSelection');expect(mocks.fetch).not.toHaveBeenCalled();const result=await f.send('Statistici Meta: other');expect(result.message.cards?.[0].rows.map(row=>row.id)).toEqual(['selected','other']);expect(mocks.fetch).toHaveBeenCalledTimes(8);});
 it('selects a campaign for period comparison',async()=>{const f=await performanceFixture();await f.send('Compară ultimele șapte zile cu precedentele șapte.');expect((await f.send('Statistici Meta: selected')).message.cards?.[0].source).toBe('metaPerformanceReview');});
 it('rejects a stale selection',async()=>{const f=await performanceFixture();await f.send('Compară ultimele șapte zile cu precedentele șapte.');await f.campaign.update({campaignName:'changed'});expect((await f.send('Statistici Meta: selected')).message.text).toContain('Nu pot confirma');expect(mocks.fetch).not.toHaveBeenCalled();});
 it('rejects an unoffered selection',async()=>{const f=await performanceFixture();expect((await f.send('Statistici Meta: selected')).message.text).toContain('Nu pot confirma');expect(mocks.fetch).not.toHaveBeenCalled();});
 it.each(['timezone','account','campaign','period','currency','pagination','duplicate'])('rejects inconsistent %s evidence',async kind=>{const f=await performanceFixture();await f.other.update({propertyId:'outside'});const original=mocks.fetch.getMockImplementation()!;mocks.fetch.mockImplementation(async(url,init)=>{const response=await original(url,init),payload=await response.json();if(new URL(url).pathname.endsWith('/act_456')){if(kind==='timezone')payload.timezone_name='UTC';if(kind==='account')payload.account_id='999';}if(payload.data?.length){if(kind==='campaign')payload.data[0].campaign_id='999';if(kind==='period')payload.data[0].date_start='2020-01-01';if(kind==='currency')payload.data[0].account_currency='RON';if(kind==='pagination')payload.paging={next:'https://example.invalid'};if(kind==='duplicate')payload.data.push(payload.data[0]);}return Response.json(payload);});expect((await f.send('Compară ultimele șapte zile cu precedentele șapte.')).message.text).toContain('Nu pot confirma');});
 it.each(['campaign','grant','member'])('rejects changes during Insights reads: %s',async kind=>{const f=await performanceFixture();await f.other.update({propertyId:'outside'});const original=mocks.fetch.getMockImplementation()!;mocks.fetch.mockImplementation(async(url,init)=>{const response=await original(url,init);if(new URL(url).pathname.endsWith('/insights')){if(kind==='campaign')await f.campaign.update({headline:'changed'});if(kind==='grant')await f.grant.update({connected:false});if(kind==='member')await f.profile.update({role:'viewer'});}return response;});if(kind==='member')await expect(f.send('Compară ultimele șapte zile cu precedentele șapte.')).rejects.toThrow();else expect((await f.send('Compară ultimele șapte zile cu precedentele șapte.')).message.text).toContain('Nu pot confirma');});
 it('keeps empty provider reports unavailable rather than zero',async()=>{const f=await performanceFixture();await f.other.update({propertyId:'outside'});const original=mocks.fetch.getMockImplementation()!;mocks.fetch.mockImplementation(async(url,init)=>new URL(url).pathname.endsWith('/insights')?Response.json({data:[]}):original(url,init));const result=await f.send('Compară ultimele șapte zile cu precedentele șapte.');expect(result.message.cards?.[0].rows[0].current).toMatchObject({spend:null,leads:null,costPerLead:null});});
 it('redacts provider failures',async()=>{const f=await performanceFixture();mocks.fetch.mockRejectedValue(new Error('access_token=synthetic-secret'));expect(JSON.stringify(await f.send('Compară două campanii Meta.'))).not.toContain('synthetic-secret');});

 it('does not compare two CRM aliases of the same remote campaign',async()=>{const f=await performanceFixture();await f.other.update({metaCampaignId:'123'});expect((await f.send('Compară două campanii Meta.')).message.text).toContain('Nu pot confirma');expect(mocks.fetch).not.toHaveBeenCalled();});
 it('does not select a foreign agency campaign',async()=>{const f=await performanceFixture();await f.other.update({agencyId:'foreign'});expect((await f.send('Compară două campanii Meta.')).message.text).toContain('Nu există suficiente');expect(mocks.fetch).not.toHaveBeenCalled();});
});
