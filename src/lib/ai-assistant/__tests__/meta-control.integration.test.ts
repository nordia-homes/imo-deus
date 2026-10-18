import { namedChoiceText } from '../named-choice-contract';
import { createCipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
const mocks=vi.hoisted(()=>({actor:null as any,db:null as any,fetch:vi.fn()}));
vi.mock('@/lib/firebase-app-hosting',()=>({requireAgencyUserFromBearerToken:async()=>mocks.actor}));
vi.mock('@/firebase/admin',()=>({adminAuth:{},get adminDb(){return mocks.db;}}));
import { chatTurn } from '../workspace';
import { prepareMetaControl } from '../meta-control';
import { executeAction } from '../actions';
import { VERSIONS } from '../models';
import corpus from '../../../../docs/jarvis/evals/master-scenarios.json';
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('persisted Jarvis campaign control',()=>{
 let db:Firestore;const agencies:string[]=[],users:string[]=[];
 beforeAll(()=>{if(!/^(localhost|127[.]0[.]0[.]1):[0-9]+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw new Error('Local emulator required');db=new Firestore({projectId:'demo-imodeus-meta-control'});mocks.db=db;vi.stubEnv('META_TOKEN_ENCRYPTION_KEY','synthetic-control-key');vi.stubGlobal('fetch',mocks.fetch);});
 afterAll(async()=>{if(!db)return;for(const id of agencies){await db.recursiveDelete(db.collection('agencies').doc(id));await db.collection('agencyPrivateIntegrations').doc(id+'__meta').delete();}for(const id of users)await db.collection('users').doc(id).delete();await db.terminate();vi.unstubAllGlobals();vi.unstubAllEnvs();});
 async function fixture(){
  const agencyId=randomUUID(),uid=randomUUID();agencies.push(agencyId);users.push(uid);const ctx={agencyId,uid,role:'agent',adminDb:db} as any;mocks.actor=ctx;
  const agency=db.collection('agencies').doc(agencyId),profile=db.collection('users').doc(uid),campaign=agency.collection('metaCampaignDrafts').doc('selected'),other=agency.collection('metaCampaignDrafts').doc('other'),property=agency.collection('properties').doc('property');
  await agency.set({name:'Synthetic'});await profile.set({agencyId,role:'agent'});await property.set({agencyId,title:'Cișmigiu',status:'Activ',metaMarketing:{latestCampaignDraftId:'other',status:'published'}});
  await campaign.set({agencyId,propertyId:'property',status:'published',metaCampaignId:'123',campaignName:'Selectată',updatedAt:'before'});await other.set({agencyId,propertyId:'property',status:'published',metaCampaignId:'999',campaignName:'Alta',updatedAt:'before'});
  const grant=db.collection('agencyPrivateIntegrations').doc(agencyId+'__meta'),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',createHash('sha256').update('synthetic-control-key').digest(),iv),encrypted=Buffer.concat([cipher.update('synthetic-token'),cipher.final()]);
  await grant.set({agencyId,connected:true,selectedAdAccount:{id:'act_456'},encryptedAccessToken:`v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${encrypted.toString('base64')}`});
  let paused=false;mocks.fetch.mockReset().mockImplementation(async(url:string,init?:RequestInit)=>{const u=new URL(url);expect(u.origin).toBe('https://graph.facebook.com');expect(u.pathname).toBe('/v23.0/123');if(init?.method==='POST'){expect(String(init.body)).toBe('status=PAUSED');paused=true;return Response.json({success:true});}return Response.json({id:'123',account_id:'456',status:paused?'PAUSED':'ACTIVE',effective_status:paused?'PAUSED':'ACTIVE'});});
  const sessionId=randomUUID(),currentRecord={resource:'properties',id:'property'} as const;
  const send=(prompt:string,requestId=randomUUID())=>chatTurn(ctx,{sessionId,requestId,prompt,currentRecord});
  const history=[{id:'current-page-context',role:'assistant',cards:[{source:'properties',rows:[{id:'property'}]}]}] as any;
  return {ctx,agency,profile,campaign,other,property,grant,send,history,sessionId};
 }
 it('executes the named choice through persisted chat and keeps IDs out of user text',async()=>{
  const f=await fixture(),offered=await f.send('Pune campania pe pauză.');
  const row=offered.message.cards!.find(card=>card.source==='metaPauseSelection')!.rows.find(row=>row.id==='selected')!;
  const choice={messageId:offered.message.id,source:'metaPauseSelection' as const,rowId:'selected'};
  const input={sessionId:f.sessionId,requestId:randomUUID(),prompt:namedChoiceText(choice.source,row),choice,currentRecord:{resource:'properties',id:'property'} as const};
  const result=await chatTurn(f.ctx,input);
  expect(result.message.text).toContain('Meta a confirmat pauza');expect((await f.campaign.get()).data()?.status).toBe('paused');
  const user=(await f.agency.collection('assistantSessions').doc(f.sessionId).collection('messages').doc(input.requestId+'-user').get()).data()!;
  expect(user.text).toBe('Confirmă pauza: Selectată');expect(user.text).not.toContain('selected');expect(user.choice).toEqual(choice);
  expect((await f.other.get()).data()?.status).toBe('published');
  expect((await chatTurn(f.ctx,input)).message.id).toBe(result.message.id);
  expect(mocks.fetch.mock.calls.filter(([,init])=>init.method==='POST')).toHaveLength(1);
  await expect(chatTurn(f.ctx,{...input,choice:{...choice,rowId:'other'}})).rejects.toThrow('altui mesaj');
 });
 it('still validates current campaign revision for named choices',async()=>{
  const f=await fixture(),offered=await f.send('Pune campania pe pauză.');
  const row=offered.message.cards![0].rows.find(row=>row.id==='selected')!;
  await f.campaign.update({campaignName:'Changed after presentation'});
  const result=await chatTurn(f.ctx,{sessionId:f.sessionId,requestId:randomUUID(),prompt:namedChoiceText('metaPauseSelection',row),choice:{messageId:offered.message.id,source:'metaPauseSelection',rowId:'selected'}});
  expect(result.message.text).toContain('schimbat');expect(mocks.fetch).not.toHaveBeenCalled();expect((await f.campaign.get()).data()?.status).toBe('published');
 });
 it('rejects invented choices before planning or saving a user message',async()=>{
  const f=await fixture(),offered=await f.send('Pune campania pe pauză.'),requestId=randomUUID();
  await expect(chatTurn(f.ctx,{sessionId:f.sessionId,requestId,prompt:'Confirmă pauza: Inventată',choice:{messageId:offered.message.id,source:'metaPauseSelection',rowId:'foreign'}})).rejects.toThrow('Opțiunea');
  expect((await f.agency.collection('assistantSessions').doc(f.sessionId).collection('messages').doc(requestId+'-user').get()).exists).toBe(false);
  expect(mocks.fetch).not.toHaveBeenCalled();
 });
 for(const n of [413,414,440,441])it('executes original master-'+String(n).padStart(4,'0'),async()=>{
  const f=await fixture(),scenarioId='master-'+String(n).padStart(4,'0'),prompt=corpus.scenarios.find(row=>row.id===scenarioId)!.text,runs:any[]=[];
  const otherBefore=(await f.other.get()).data(),propertyBefore=(await f.property.get()).data();
  if(n===414||n===441){const setup=await f.send('Pune campania pe pauză.');runs.push({phase:'context',final:setup.message});const pause=await f.send('Confirm pauza Meta: selected');runs.push({phase:'pause',final:pause.message});expect(pause.message.text).toContain('Meta a confirmat pauza');}
  const requestId=randomUUID(),result=await f.send(prompt,requestId);runs.push({phase:'original',final:result.message});
  if(n===413||n===440){expect(result.message.cards?.[0].source).toBe('metaPauseSelection');expect(mocks.fetch).not.toHaveBeenCalled();const pause=await f.send('Confirm pauza Meta: selected');runs.push({phase:'confirmation',final:pause.message});expect(pause.message.text).toContain('Meta a confirmat pauza');expect(pause.message.planId).toBeUndefined();}
  else expect(result.message.text).toContain('nu am modificat');
  expect((await f.campaign.get()).data()?.status).toBe('paused');expect((await f.other.get()).data()).toEqual(otherBefore);expect((await f.property.get()).data()).toEqual(propertyBefore);expect(mocks.fetch.mock.calls.filter(([,init])=>init.method==='POST')).toHaveLength(1);
  expect((await f.send(prompt,requestId)).message.id).toBe(result.message.id);
  await mkdir('.tmp/jarvis-meta-control',{recursive:true});await writeFile('.tmp/jarvis-meta-control/'+scenarioId+'.json',JSON.stringify({scenarioId,prompt,versions:VERSIONS,executionVerified:true,environment:'Persisted application chat, actual pause route and local Firestore; synthetic Meta preflight, write and readback. No real campaign changes.',runs},null,2));
 });
 it('executes the direct request without another approval when only one campaign is eligible',async()=>{const f=await fixture();await f.other.update({status:'draft',metaCampaignId:null});const result=await f.send('Pune campania pe pauză.');expect(result.message.text).toContain('Meta a confirmat pauza');expect(result.message.planId).toBeUndefined();});
 it('requires the requested explicit confirmation even for a single campaign',async()=>{const f=await fixture();await f.other.update({status:'draft',metaCampaignId:null});const result=await f.send('Oprește campania dacă am confirmat explicit.');expect(result.message.cards?.[0].source).toBe('metaPauseSelection');expect(mocks.fetch).not.toHaveBeenCalled();});
 it('rejects a campaign changed after selection',async()=>{const f=await fixture();await f.send('Pune campania pe pauză.');await f.campaign.update({campaignName:'Changed'});const result=await f.send('Confirm pauza Meta: selected');expect(result.message.text).toContain('schimbat');expect(mocks.fetch).not.toHaveBeenCalled();});
 it('rejects a forged selection without pending options',async()=>{const f=await fixture();const result=await f.send('Confirm pauza Meta: selected');expect(result.message.text).toContain('schimbat');expect(mocks.fetch).not.toHaveBeenCalled();});
 it('checks the revision again at execution and does not call the provider',async()=>{const f=await fixture();await f.other.update({status:'draft',metaCampaignId:null});const plan=await prepareMetaControl(f.ctx,'Pune campania pe pauză.',f.history);await f.campaign.update({headline:'changed'});await expect(executeAction(f.ctx,plan!.actions[0],randomUUID())).rejects.toThrow();expect(mocks.fetch).not.toHaveBeenCalled();});
 it('checks fresh membership immediately before the external write',async()=>{const f=await fixture();await f.other.update({status:'draft',metaCampaignId:null});const original=mocks.fetch.getMockImplementation()!;mocks.fetch.mockImplementation(async(url,init)=>{const response=await original(url,init);await f.profile.update({agencyId:'other'});return response;});await expect(f.send('Pune campania pe pauză.')).rejects.toThrow('Acces revocat');expect(mocks.fetch).toHaveBeenCalledTimes(1);expect((await f.campaign.get()).data()?.status).toBe('published');});
 it('does not repeat the provider write for concurrent execution keys',async()=>{const f=await fixture();await f.other.update({status:'draft',metaCampaignId:null});const plan=await prepareMetaControl(f.ctx,'Pune campania pe pauză.',f.history),key=randomUUID();await Promise.allSettled([executeAction(f.ctx,plan!.actions[0],key),executeAction(f.ctx,plan!.actions[0],key)]);expect(mocks.fetch.mock.calls.filter(([,init])=>init.method==='POST')).toHaveLength(1);});
 it('rejects a selection after changing the current property',async()=>{const f=await fixture();await f.send('Pune campania pe pauză.');await f.agency.collection('properties').doc('another').set({agencyId:f.ctx.agencyId,title:'Alta',status:'Activ'});const result=await chatTurn(f.ctx,{sessionId:f.sessionId,requestId:randomUUID(),prompt:'Confirm pauza Meta: selected',currentRecord:{resource:'properties',id:'another'}});expect(result.message.text).toContain('schimbat');expect(mocks.fetch).not.toHaveBeenCalled();});
 it('does not accept an ID absent from the offered choices',async()=>{const f=await fixture();await f.send('Pune campania pe pauză.');const result=await f.send('Confirm pauza Meta: forged');expect(result.message.text).toContain('schimbat');expect(mocks.fetch).not.toHaveBeenCalled();});
 it('keeps an ambiguous provider outcome unconfirmed and never retries on chat replay',async()=>{const f=await fixture();await f.other.update({status:'draft',metaCampaignId:null});mocks.fetch.mockImplementation(async()=>Response.json({id:'123',account_id:'456',status:'ACTIVE',effective_status:'ACTIVE'}));const requestId=randomUUID(),result=await f.send('Pune campania pe pauză.',requestId);expect(result.message.text).not.toContain('Meta a confirmat pauza');expect((await f.campaign.get()).data()?.status).toBe('published');expect((await f.send('Pune campania pe pauză.',requestId)).message.id).toBe(result.message.id);expect(mocks.fetch.mock.calls.filter(([,init])=>init.method==='POST')).toHaveLength(1);});

 it.each(['Nu opri celelalte campanii.','Nu o șterge dacă am spus doar pauză.'])('retains the pending target after the constraint: %s',async constraint=>{const f=await fixture();await f.send('Pune campania pe pauză.');const guard=await f.send(constraint);expect(guard.message.cards?.[0].source).toBe('metaPauseSelection');expect(mocks.fetch).not.toHaveBeenCalled();const result=await f.send('Confirm pauza Meta: selected');expect(result.message.text).toContain('Meta a confirmat pauza');expect((await f.other.get()).data()?.status).toBe('published');});

});
