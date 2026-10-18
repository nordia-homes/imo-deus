import { beginRequestRecovery, readRequestRecovery } from '../request-recovery';
import { saveRequestCheckpoint } from '../request-checkpoint';
import { executionScope } from '../execution-scope';
import * as plannerModule from '../planner';
import { dispatchTool } from '../tool-dispatch';
import { OpenAIAdapter } from '../provider';
import { namedChoiceText, namedGroupChoiceText } from '../named-choice-contract';
import { prepareFacebookPublication } from '../facebook-natural';
import { executeSafePrefix } from '../autonomy';
import { bindSemanticAuthority } from '../semantic-authority';
import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { NextRequest } from 'next/server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ actor: null as any, fetch: vi.fn(), runner: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: async () => mocks.actor }));
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
vi.mock('@/lib/facebook-cloud-server', async importOriginal => ({ ...await importOriginal<any>(), facebookRunnerRequest: mocks.runner }));
vi.mock('@/lib/facebook-local-server', async importOriginal => ({ ...await importOriginal<any>(), requireFacebookLocalDevice: async () => ({ adminDb: mocks.actor.adminDb, agencyId: mocks.actor.agencyId, ownerUid: mocks.actor.uid, deviceId: 'device' }) }));
import { POST } from '@/app/api/marketing/facebook-cloud/jobs/route';
import { POST as claimLocalJob } from '@/app/api/marketing/facebook-local/runner/claim/route';
import { createFacebookJob } from '@/lib/facebook-job-create';
import { chatTurn } from '../workspace';
import { tomorrowBucharest } from '../facebook-monitor';
import { bucharestInputFromIso } from '@/lib/bucharest-time';
import { VERSIONS } from '../models';
import corpus from '../../../../docs/jarvis/evals/master-scenarios.json';
import { mkdir, writeFile } from 'node:fs/promises';
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Facebook creation through real application handlers', () => {
  let db: Firestore; const agencies: string[] = [], users: string[] = [];
  beforeAll(() => {
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required');
    db = new Firestore({ projectId: 'demo-imodeus-facebook-create' }); vi.stubGlobal('fetch', mocks.fetch);
  });
  beforeEach(() => { mocks.fetch.mockReset().mockRejectedValue(new Error('External requests forbidden')); mocks.runner.mockReset(); });
  afterAll(async () => { if (!db) return; for (const id of agencies) await db.recursiveDelete(db.collection('agencies').doc(id)); for (const id of users) await db.collection('users').doc(id).delete(); await db.terminate(); vi.unstubAllGlobals(); });
  async function fixture(mode = 'local') {
    const agencyId = randomUUID(), uid = randomUUID(); agencies.push(agencyId); users.push(uid);
    const ctx = { uid, agencyId, role: 'agent', adminDb: db, authorization: 'Bearer fixture' } as any; mocks.actor = ctx;
    const agency = db.collection('agencies').doc(agencyId), profile = db.collection('users').doc(uid);
    const groups = [{ name: 'Vânzări', url: 'https://www.facebook.com/groups/sale', purpose: 'sale' }, { name: 'Chirii', url: 'https://www.facebook.com/groups/rent', purpose: 'rent' }];
    await agency.set({ facebookGroups: groups }); await profile.set({ agencyId, role: 'agent' });
    const property = agency.collection('properties').doc('property'); await property.set({ title: 'Apartament Cișmigiu', transactionType: 'Vanzare', defaultFacebookConnectionId: 'connection' });
    const connection = agency.collection('facebookCloudConnections').doc('connection');
    await connection.set({ agencyId, ownerUid: uid, status: 'connected', runnerMode: mode, deviceId: 'device', label: 'Cont' });
    const device = agency.collection('facebookLocalRunnerDevices').doc('device'); await device.set({ ownerUid: uid, status: 'online' });
    mocks.runner.mockImplementation(async (_path, options) => { const data = JSON.parse(options.body); return { job: { ...data, status: data.scheduledAt ? 'scheduled' : 'queued', groups: data.groups.map((g: any) => ({ ...g, status: 'queued' })), leaseToken: 'DO-NOT-COPY' } }; });
    const body = { propertyId: 'property', connectionId: 'connection', groupUrls: [groups[0].url], scheduledAt: tomorrowBucharest(new Date()) + 'T04:00:00.000Z', requestId: randomUUID() };
    return { ctx, agency, profile, property, connection, device, body, jobs: agency.collection('facebookCloudPublishingJobs') };
  }
  it('persists all group choices, publishes only selected groups and rejects changed replay', async()=>{
    const f=await fixture('cloud'),sessionId=randomUUID();
    const configured=Array.from({length:8},(_,i)=>({name:'Grupul '+(i+1),url:'https://www.facebook.com/groups/group'+i,purpose:'sale'}));
    await f.agency.update({facebookGroups:configured});
    await f.property.update({description:'Descriere originală',images:['https://example.com/original.jpg']});
    const first=await chatTurn(f.ctx,{sessionId,requestId:randomUUID(),prompt:'Publică proprietatea acum în grupurile selectate',currentRecord:{resource:'properties',id:'property'}});
    const card=first.message.cards!.find(card=>card.choiceSource==='facebookPublicationGroups')!;
    expect(card.rows).toHaveLength(8);
    const selected=card.rows.filter((_,i)=>i!==1);
    const input={sessionId,requestId:randomUUID(),prompt:namedGroupChoiceText(selected),currentRecord:null,choice:{messageId:first.message.id,source:'facebookPublicationGroups' as const,rowId:String(selected[0].id),rowIds:selected.map(row=>String(row.id))}};
    const result=await chatTurn(f.ctx,input);expect(result.message.text).toContain('a fost creat');
    const payload=JSON.parse(mocks.runner.mock.calls[0][1].body);
    expect(payload.groups.map((row:any)=>row.url)).toEqual(selected.map(row=>row.url));
    expect(payload.propertyDescription).toBe('Descriere originală');expect(payload.propertyImages).toEqual(['https://example.com/original.jpg']);
    await chatTurn(f.ctx,input);expect((await f.jobs.get()).size).toBe(1);expect(mocks.runner).toHaveBeenCalledTimes(1);
    await expect(chatTurn(f.ctx,{...input,choice:{...input.choice,rowIds:input.choice.rowIds.slice(0,1)}})).rejects.toThrow();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('persists semantic clarification and resumes the complete original request without granting publication',async()=>{
    const f=await fixture(),sessionId=randomUUID();
    await f.property.update({defaultFacebookConnectionId:null});
    await f.agency.collection('facebookCloudConnections').doc('second').set({...((await f.connection.get()).data()),label:'Al doilea cont'});
    const original='Pentru apartamentele Cișmigiu și Titan pregătește publicarea doar în grupul de vânzări, dar nu publica încă. Apoi verifică vizionările.';
    const preflight=await dispatchTool('facebook_publication_preflight',f.ctx,{query:'Cișmigiu',groupUrls:f.body.groupUrls},original,{});
    const card=preflight.cards.find(card=>card.choiceSource==='facebookSemanticAccount')!;
    expect(card.rows).toHaveLength(2);expect(preflight.refs).toContainEqual({resource:'properties',id:'property'});
    await f.agency.collection('properties').doc('other').set({...((await f.property.get()).data()),title:'Apartament Titan'});
    const other=await dispatchTool('facebook_publication_preflight',f.ctx,{query:'Titan',groupUrls:f.body.groupUrls},original,{});
    const otherCard=other.cards.find(card=>card.choiceSource==='facebookSemanticAccount')!;
    expect(otherCard.choiceOfferId).not.toBe(card.choiceOfferId);
    expect(card.title).toContain('Cișmigiu');expect(otherCard.title).toContain('Titan');
    const session=f.agency.collection('assistantSessions').doc(sessionId);
    await session.set({ownerId:f.ctx.uid});
    await session.collection('messages').doc('offer').set({role:'assistant',text:'Alege contul',cards:[...preflight.cards,...other.cards],accessRefs:[...preflight.refs,...other.refs],createdAt:new Date().toISOString()});
    const selected=card.rows[1];
    vi.stubEnv('OPENAI_API_KEY','test-only');
    const model=vi.spyOn(OpenAIAdapter.prototype,'respond').mockResolvedValue({items:[],calls:[],text:'Clarificare păstrată.',intentStatus:'clarification',usage:{inputTokens:100,outputTokens:20,cachedTokens:0,cacheWriteTokens:0,estimated:false},latencyMs:1,status:'completed'});
    try {
      const input={sessionId,requestId:randomUUID(),prompt:namedChoiceText('facebookSemanticAccount',selected),choice:{messageId:'offer',source:'facebookSemanticAccount' as const,rowId:String(selected.id),offerId:card.choiceOfferId},currentRecord:null};
      const firstReply=await chatTurn(f.ctx,input);
      expect(firstReply.message.executionScope).toMatch(/^[a-f0-9]{64}$/);
      const remaining=firstReply.message.cards!.filter(card=>card.choiceSource==='facebookSemanticAccount');
      expect(remaining).toHaveLength(1);expect(remaining[0].choiceOfferId).toBe(otherCard.choiceOfferId);
      const secondRow=remaining[0].rows[0];
      const secondReply=await chatTurn(f.ctx,{sessionId,requestId:randomUUID(),prompt:namedChoiceText('facebookSemanticAccount',secondRow),choice:{messageId:firstReply.message.id,source:'facebookSemanticAccount',rowId:String(secondRow.id),offerId:remaining[0].choiceOfferId},currentRecord:null});
      expect(secondReply.message.executionScope).toBe(firstReply.message.executionScope);
      expect(model).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(model.mock.calls[1])).toContain('other');
      expect(model).toHaveBeenCalled();const supplied=JSON.stringify(model.mock.calls);
      expect(supplied).toContain(original);expect(supplied).toContain('facebook_publication_preflight');expect(supplied).toContain(f.body.groupUrls[0]);
      expect((await f.jobs.get()).empty).toBe(true);expect(mocks.runner).not.toHaveBeenCalled();expect(mocks.fetch).not.toHaveBeenCalled();
      const saved=(await session.collection('messages').doc(input.requestId+'-user').get()).data();expect(saved?.text).toBe(input.prompt);expect(saved?.text).not.toContain(selected.id);
    } finally {model.mockRestore();vi.unstubAllEnvs();}
  });
  it('checkpoints mixed prepared actions without executing or exposing a partial plan, then restores them to planning',async()=>{
    const f=await fixture(),sessionId=randomUUID();
    await f.property.update({defaultFacebookConnectionId:null});
    await f.agency.collection('facebookCloudConnections').doc('second').set({...((await f.connection.get()).data()),label:'Al doilea cont'});
    const original='Adaugă cumpărătorii și pregătește publicarea apartamentului Cișmigiu.';
    const offer=await dispatchTool('facebook_publication_preflight',f.ctx,{query:'Cișmigiu',groupUrls:f.body.groupUrls},original,{});
    const actions=Array.from({length:8},(_,i)=>({kind:'create_contact' as const,name:'Cumpărător '+i,phone:'0712345678'}));
    const fakeResult={text:'Plan pregătit.',cards:offer.cards,actions,accessRefs:offer.refs,metrics:{status:'success',models:[],tools:[],elapsedMs:1}};
    const planner=vi.spyOn(plannerModule,'planTurn').mockResolvedValueOnce(fakeResult as any).mockResolvedValue({text:'Date recuperate.',cards:[],actions:[],accessRefs:offer.refs,metrics:{status:'clarification',models:[],tools:[],elapsedMs:1}} as any);
    try {
      const input={sessionId,requestId:randomUUID(),prompt:original,currentRecord:null};
      const first=await chatTurn(f.ctx,input);expect(first.message.planId).toBeUndefined();expect(first.message.actions).toBeUndefined();
      const deferred=first.message.cards!.find(card=>card.source==='semanticDeferredActions')!;
      expect(deferred.rows[0].actions).toHaveLength(8);
      expect((await f.agency.collection('contacts').get()).empty).toBe(true);expect((await f.agency.collection('assistantPlans').get()).empty).toBe(true);
      const checkpoint=(await f.agency.collection('assistantSessions').doc(sessionId).collection('requests').doc(input.requestId).get()).data()!;
      expect(checkpoint.result.actions).toEqual([]);expect(checkpoint.result.semanticAuthority).toBeUndefined();
      expect(checkpoint.result.cards.find((card:any)=>card.source==='semanticDeferredActions').rows[0].actions).toHaveLength(8);
      await chatTurn(f.ctx,input);expect(planner).toHaveBeenCalledTimes(1);
      const card=first.message.cards!.find(card=>card.choiceSource==='facebookSemanticAccount')!,row=card.rows[0];
      await chatTurn(f.ctx,{sessionId,requestId:randomUUID(),prompt:namedChoiceText('facebookSemanticAccount',row),choice:{messageId:first.message.id,source:'facebookSemanticAccount',rowId:String(row.id),offerId:card.choiceOfferId},currentRecord:null});
      expect(planner.mock.calls[1][1]).toContain('Cumpărător 7');expect(planner.mock.calls[1][1]).toContain('NEEXECUTAȚI');
      expect((await f.agency.collection('contacts').get()).empty).toBe(true);expect((await f.jobs.get()).empty).toBe(true);expect(mocks.fetch).not.toHaveBeenCalled();
    } finally {planner.mockRestore();}
  });
  it('reuses a completed buyer creation across continuation request IDs and separates a new goal',async()=>{
    const f=await fixture(),scope=executionScope('session','original');
    const ctx={...f.ctx,executionScope:scope};
    const action={kind:'create_contact' as const,name:'Matei Alin',phone:'0712345678'};
    const first=await executeSafePrefix(ctx,'first',[action],'Adaugă cumpărătorul Matei Alin.');
    expect(first.results).toHaveLength(1);expect(first.blocked).toBe(false);
    const again=await executeSafePrefix(ctx,'second',[action],'Adaugă cumpărătorul Matei Alin.');
    expect(again.results[0]).toMatchObject({reused:true,result:first.results[0].result});
    expect((await f.agency.collection('contacts').get()).size).toBe(1);
    await f.property.update({status:'Activ'});
    const viewing={kind:'schedule_viewing' as const,propertyId:'property',contactId:'@step:1:contactId',viewingDate:'2030-01-01T05:30:00.000Z',duration:60,notes:''};
    const scheduled=await executeSafePrefix(ctx,'viewing',[action,viewing],'Adaugă cumpărătorul și programează vizionarea.');
    expect(scheduled.blocked).toBe(false);expect(scheduled.results).toHaveLength(2);expect(scheduled.results[0].reused).toBe(true);
    const repeated=await executeSafePrefix(ctx,'viewing-retry',[action,viewing],'Adaugă cumpărătorul și programează vizionarea.');
    expect(repeated.results).toHaveLength(2);expect(repeated.results.every(row=>row.reused)).toBe(true);
    expect((await f.agency.collection('viewings').get()).size).toBe(1);expect((await f.agency.collection('contacts').get()).size).toBe(1);
    const independent=await executeSafePrefix({...ctx,executionScope:executionScope('session','new')},'third',[action],'Adaugă cumpărătorul Matei Alin.');
    expect(independent.blocked).toBe(true);expect(independent.results).toEqual([]);
    expect((await f.agency.collection('contacts').get()).size).toBe(1);
    const id=(first.results[0].result as any).contactId;
    await f.agency.collection('contacts').doc(id).delete();
    const missing=await executeSafePrefix(ctx,'fourth',[action],'Adaugă cumpărătorul Matei Alin.');
    expect(missing.blocked).toBe(true);expect(missing.results).toEqual([]);
    expect((await f.agency.collection('contacts').get()).size).toBe(0);expect(mocks.fetch).not.toHaveBeenCalled();
  });

  function modelCall(name: string, payload: unknown) {
    const id=randomUUID(), args=JSON.stringify({payload:JSON.stringify(payload)});
    return {calls:[{id,name,arguments:args}],items:[{type:'function_call',call_id:id,name,arguments:args}],text:'',usage:{inputTokens:100,outputTokens:20,cachedTokens:0,cacheWriteTokens:0,estimated:false},status:'completed',latencyMs:1};
  }
  async function recoveryFixture(actions: any[] = [], frozen=true) {
    const f=await fixture(), sessionId=randomUUID(), requestId=randomUUID();
    const input={sessionId,requestId,prompt:'Creează sarcina de apel și adaugă cumpărătorul Matei Alin.',currentRecord:null};
    const session=f.agency.collection('assistantSessions').doc(sessionId);
    await session.set({ownerId:f.ctx.uid,turnId:requestId,busyUntil:0});
    const ctx={...f.ctx,executionScope:executionScope(sessionId,requestId),prospectingRequest:{sessionId,requestId,prompt:input.prompt}};
    await beginRequestRecovery(ctx,{input,planningPrompt:input.prompt,executionPrompt:input.prompt,authorityPrompt:input.prompt,executionScope:ctx.executionScope,accessRefs:[]});
    const planned={text:'Pregătit.',cards:[],actions,accessRefs:[],metrics:{status:'success',models:[],tools:[],elapsedMs:1}};
    if(frozen) await saveRequestCheckpoint(ctx,input,planned as any);
    return {...f,ctx,session,input,planned};
  }
  it.each(['Continuă.','Du până la capăt ce am început.','Reia de unde s-a întrerupt, fără să refaci pașii terminați.'])('recovers frozen execution through the real planner and workspace: %s',async(prompt)=>{
    const actions=[{kind:'create_task',description:'Apel proprietar',dueDate:'2030-01-01',propertyId:'property',participantSource:'property_owner'},{kind:'create_contact',name:'Matei Alin',phone:'0712345678'}];
    const f=await recoveryFixture(actions);
    await f.property.update({ownerName:'Proprietar',ownerPhone:'0712345679'});
    const done=await executeSafePrefix(f.ctx,f.input.requestId,[actions[0]] as any,f.input.prompt);
    expect(done.results).toHaveLength(1);
    vi.stubEnv('OPENAI_API_KEY','test-only');
    const model=vi.spyOn(OpenAIAdapter.prototype,'respond').mockResolvedValueOnce(modelCall('request_recovery',{mode:'inspect'}) as any).mockResolvedValueOnce(modelCall('request_recovery',{mode:'resume',requestId:f.input.requestId}) as any);
    try {
      const input={sessionId:f.input.sessionId,requestId:randomUUID(),prompt,currentRecord:null};
      const result=await chatTurn(f.ctx,input);
      expect(result.message.outputType).not.toBe('ERROR_EVENT');
      expect(result.message.text).toContain('Pași confirmați din execuții anterioare: 1');
      expect((await f.agency.collection('tasks').get()).size).toBe(1);
      expect((await f.agency.collection('contacts').get()).size).toBe(1);
      expect((await f.session.collection('recoveries').doc(f.input.requestId).get()).data()?.status).toBe('complete');
      await chatTurn(f.ctx,input);expect(model).toHaveBeenCalledTimes(2);
      expect(mocks.fetch).not.toHaveBeenCalled();expect(mocks.runner).not.toHaveBeenCalled();
    } finally {model.mockRestore();vi.unstubAllEnvs();}
  });
  it('restarts interrupted planning with the full original request and saves it before execution',async()=>{
    const f=await recoveryFixture([{kind:'create_contact',name:'Matei Alin',phone:'0712345678'}],false);
    const planner=vi.spyOn(plannerModule,'planTurn').mockResolvedValueOnce({...f.planned,actions:[],recoveryRequestId:f.input.requestId} as any).mockResolvedValueOnce(f.planned as any);
    try {
      const result=await chatTurn(f.ctx,{sessionId:f.input.sessionId,requestId:randomUUID(),prompt:'Termină ce mai rămăsese.',currentRecord:null});
      expect(result.message.outputType).not.toBe('ERROR_EVENT');
      expect(planner).toHaveBeenCalledTimes(2);expect(planner.mock.calls[1][1]).toBe(f.input.prompt);
      expect((await f.session.collection('requests').doc(f.input.requestId).get()).exists).toBe(true);
      expect((await f.agency.collection('contacts').get()).size).toBe(1);
    } finally {planner.mockRestore();}
  });
  it('preserves the unfinished request across unrelated successful answers and beyond recent history',async()=>{
    const f=await recoveryFixture();
    const planner=vi.spyOn(plannerModule,'planTurn').mockResolvedValue({...f.planned,text:'Răspuns la întrebare.'} as any);
    try {
      await chatTurn(f.ctx,{sessionId:f.input.sessionId,requestId:randomUUID(),prompt:'Care este starea calendarului?',currentRecord:null});
      expect((await f.session.get()).data()?.pendingRecoveryId).toBe(f.input.requestId);
      const newId=randomUUID();await f.session.update({turnId:newId});
      await beginRequestRecovery({...f.ctx,prospectingRequest:{...f.ctx.prospectingRequest,requestId:newId}},{input:{...f.input,requestId:newId,prompt:'Continuă'},planningPrompt:'Continuă',executionPrompt:'Continuă',authorityPrompt:'Continuă',executionScope:executionScope(f.input.sessionId,newId),accessRefs:[]});
      const recovered=await readRequestRecovery({...f.ctx,prospectingRequest:{...f.ctx.prospectingRequest,requestId:newId}});
      expect(recovered?.requestId).toBe(f.input.requestId);
      expect(recovered?.record.planningPrompt).toBe(f.input.prompt);
    } finally {planner.mockRestore();}
  });
  it('rejects recovery across owners, sessions, versions and revoked resource access',async()=>{
    const f=await recoveryFixture();
    const current={...f.ctx,prospectingRequest:{...f.ctx.prospectingRequest,requestId:randomUUID()}};
    await expect(readRequestRecovery({...current,uid:'other'},f.input.requestId)).rejects.toThrow();
    await expect(readRequestRecovery({...current,prospectingRequest:{...current.prospectingRequest,sessionId:randomUUID()}},f.input.requestId)).rejects.toThrow();
    const record=f.session.collection('recoveries').doc(f.input.requestId);
    await record.update({version:'old'});await expect(readRequestRecovery(current,f.input.requestId)).rejects.toThrow('Versiunea');
    await record.update({version:JSON.stringify(VERSIONS),accessRefs:[{resource:'properties',id:'missing'}]});
    await expect(readRequestRecovery(current,f.input.requestId)).rejects.toThrow('revocat');
  });


  it('replans an interrupted partial plan without exposing or executing the incomplete actions',async()=>{
    const f=await fixture(),input={sessionId:randomUUID(),requestId:randomUUID(),prompt:'Adaugă cumpărătorul Matei Alin.',currentRecord:null};
    const complete={text:'Pregătit.',cards:[],actions:[{kind:'create_contact',name:'Matei Alin',phone:'0712345678'}],accessRefs:[],metrics:{status:'success',models:[],tools:[],elapsedMs:1}};
    const planner=vi.spyOn(plannerModule,'planTurn').mockResolvedValueOnce({...complete,metrics:{...complete.metrics,status:'partial'}} as any).mockResolvedValueOnce({...complete,actions:[],recoveryRequestId:input.requestId} as any).mockResolvedValueOnce(complete as any);
    try {
      const first=await chatTurn(f.ctx,input);expect(first.message.planId).toBeUndefined();expect((await f.agency.collection('contacts').get()).size).toBe(0);
      const session=f.agency.collection('assistantSessions').doc(input.sessionId);
      expect((await session.collection('requests').doc(input.requestId).get()).data()?.phase).toBe('planning_incomplete');
      const resumed=await chatTurn(f.ctx,{...input,requestId:randomUUID(),prompt:'Poți duce la capăt ce a rămas?'});
      expect(resumed.message.outputType).not.toBe('ERROR_EVENT');expect((await f.agency.collection('contacts').get()).size).toBe(1);
      expect((await session.collection('requests').doc(input.requestId).get()).data()?.phase).toBe('planned');
      expect(planner.mock.calls[2][1]).toBe(input.prompt);
    } finally {planner.mockRestore();}
  });
  it('does not honor a model recovery directive without inspecting the original request first',async()=>{
    const f=await recoveryFixture();
    const current={...f.ctx,prospectingRequest:{...f.ctx.prospectingRequest,requestId:randomUUID()}};
    const final={calls:[],items:[],text:'Nu am reluat.',intentStatus:'clarification',usage:{inputTokens:100,outputTokens:20,cachedTokens:0,cacheWriteTokens:0,estimated:false},status:'completed',latencyMs:1};
    const respond=vi.fn().mockResolvedValueOnce(modelCall('request_recovery',{mode:'resume',requestId:f.input.requestId})).mockResolvedValue(final);
    const result=await plannerModule.planTurn(current,'Continuă',[],{provider:{id:'fixture',respond}});
    expect(result.recoveryRequestId).toBeUndefined();expect(result.actions).toEqual([]);
    expect(result.metrics.tools).toContainEqual(expect.objectContaining({name:'request_recovery',status:'failed'}));
  });


  it('does not claim a deleted completed task still exists or recreate it on recovery',async()=>{
    const actions=[{kind:'create_task' as const,description:'Apel proprietar',dueDate:'2030-01-01',propertyId:'property',participantSource:'property_owner' as const}];
    const f=await recoveryFixture(actions);await f.property.update({ownerName:'Proprietar'});
    const first=await executeSafePrefix(f.ctx,f.input.requestId,actions,f.input.prompt);expect(first.results).toHaveLength(1);
    await f.agency.collection('tasks').doc((first.results[0].result as any).taskId).delete();
    const repeated=await executeSafePrefix(f.ctx,f.input.requestId,actions,f.input.prompt);
    expect(repeated.blocked).toBe(true);expect(repeated.results).toEqual([]);expect((await f.agency.collection('tasks').get()).size).toBe(0);
  });
  it('passes the complete saved request to the model, including constraints beyond the ordinary tool preview',async()=>{
    const f=await recoveryFixture();
    const original='Context detaliat. '.repeat(500)+'Nu contacta proprietarul și nu publica nimic.';
    await f.session.collection('recoveries').doc(f.input.requestId).update({planningPrompt:original});
    const current={...f.ctx,prospectingRequest:{...f.ctx.prospectingRequest,requestId:randomUUID()}};
    const final={calls:[],items:[],text:'Nu am reluat.',intentStatus:'clarification',usage:{inputTokens:100,outputTokens:20,cachedTokens:0,cacheWriteTokens:0,estimated:false},status:'completed',latencyMs:1};
    const respond=vi.fn().mockResolvedValueOnce(modelCall('request_recovery',{mode:'inspect',requestId:f.input.requestId})).mockResolvedValue(final);
    await plannerModule.planTurn(current,'Ce rămăsese neterminat?',[],{provider:{id:'fixture',respond}});
    const input=JSON.stringify(respond.mock.calls[1]);expect(input).toContain(original);
    expect((await f.agency.collection('contacts').get()).size).toBe(0);expect(mocks.fetch).not.toHaveBeenCalled();
  });

  async function call(body: any) { return POST(new NextRequest('http://localhost/api/marketing/facebook-cloud/jobs', { method: 'POST', headers: { authorization: 'Bearer fixture', 'content-type': 'application/json' }, body: JSON.stringify(body) })); }
  it('executes master-0395 after scheduling and detects a subsequent persisted time change', async () => {
    const f = await fixture('cloud'), sessionId = randomUUID();
    await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: corpus.scenarios.find(row => row.id === 'master-0357')!.text, currentRecord: null });
    const job = (await f.jobs.get()).docs[0], raw = job.data();
    await f.jobs.doc('another').set({ ...raw, id: 'another', propertyId: 'other' });
    const scenarioId = 'master-0395', prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const input = { sessionId, requestId: randomUUID(), prompt, currentRecord: null };
    const result = await chatTurn(f.ctx, input);
    expect(result.message.cards?.[0].rows).toHaveLength(1);
    expect(result.message.cards?.[0].rows[0]).toMatchObject({ id: job.id, scheduleMatches: true, activeScheduleConfirmed: true, publicationConfirmed: false });
    expect(result.message.text).toContain('07:00');
    expect((await job.ref.get()).data()).toEqual(raw);
    expect((await chatTurn(f.ctx, input)).message.id).toBe(result.message.id);
    await job.ref.update({ scheduledAt: new Date(Date.parse(raw.scheduledAt) + 3600000).toISOString() });
    const changed = await chatTurn(f.ctx, { ...input, requestId: randomUUID() });
    expect(changed.message.text).toContain('DIFERĂ'); expect(changed.message.cards?.[0].rows[0].scheduleMatches).toBe(false);
    expect(mocks.runner).toHaveBeenCalledTimes(1); expect(mocks.fetch).not.toHaveBeenCalled();
    await mkdir('.tmp/jarvis-facebook-schedule-check', { recursive: true });
    await writeFile('.tmp/jarvis-facebook-schedule-check/master-0395.json', JSON.stringify({ scenarioId, prompt, versions: VERSIONS, executionVerified: true, environment: 'Actual scheduling through chat/executor/POST, followed by persisted-time reread and comparison on local Firestore. Cloud transport simulated.', runs: [{ phase: 'original', final: result.message }, { phase: 'changed-time', final: changed.message }] }, null, 2));
  });
  for (const mode of ['local', 'cloud']) it.each(['deleted', 'foreign-agency', 'Vândut', 'Închiriat', 'Inactiv'])('refuses unavailable property before reservation (' + mode + '): %s', async variant => {
    const f = await fixture(mode);
    await f.property.update(variant === 'deleted' ? { deletedAt: 'now' } : variant === 'foreign-agency' ? { agencyId: 'other' } : { status: variant });
    const response = await call(f.body);
    expect(response.status).toBeGreaterThanOrEqual(400); expect((await f.jobs.get()).empty).toBe(true); expect(mocks.runner).not.toHaveBeenCalled();
  });
  for (const scenarioId of ['master-0358', 'master-0362']) it('continues original immediate creation after group selection: ' + scenarioId, async () => {
    const f = await fixture('cloud'), sessionId = randomUUID(), prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    await f.property.update({ description: 'Descriere CRM exactă\nCu paragrafe.', images: ['https://example.com/photo.jpg'] });
    const first = await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt, currentRecord: { resource: 'properties', id: 'property' } });
    const groups = first.message.cards?.find(card => card.source === 'facebookGroups')?.rows || [];
    expect(groups).toHaveLength(1); expect((await f.jobs.get()).empty).toBe(true);
    const input = { sessionId, requestId: randomUUID(), prompt: namedGroupChoiceText(groups), choice: {messageId:first.message.id,source:'facebookPublicationGroups' as const,rowId:String(groups[0].id),rowIds:groups.map(row=>String(row.id))}, currentRecord: null };
    const final = await chatTurn(f.ctx, input);
    expect(final.message.planId).toBeUndefined();
    expect(final.message.text).toContain('a fost creat');
    expect(final.message.text).not.toContain('Nu au fost trimise mesaje sau publicate anunțuri');
    const jobs = await f.jobs.get(); expect(jobs.size).toBe(1);
    expect(jobs.docs[0].data()).toMatchObject({ propertyId: 'property', scheduledAt: null, status: 'queued' });
    const payload = JSON.parse(mocks.runner.mock.calls[0][1].body);
    expect(payload.propertyDescription).toBe('Descriere CRM exactă\nCu paragrafe.'); expect(payload.propertyImages).toEqual(['https://example.com/photo.jpg']);
    expect(payload.groups.map((g: any) => g.url)).toEqual(f.body.groupUrls);
    await chatTurn(f.ctx, input); expect(mocks.runner).toHaveBeenCalledTimes(1); expect(mocks.fetch).not.toHaveBeenCalled();
    await mkdir('.tmp/jarvis-facebook-create', { recursive: true });
    await writeFile('.tmp/jarvis-facebook-create/' + scenarioId + '-cloud.json', JSON.stringify({ scenarioId, prompt, versions: VERSIONS, executionVerified: true, environment: 'Chat, explicit group selection, autonomous executor and real POST on local Firestore; cloud transport simulated. Job creation only, not Facebook publication certification.', runs: [{ phase: 'original', final: first.message }, { phase: 'selection', final: final.message }] }, null, 2));
  });
  it('executes the real Rosetti command without a model, preserves CRM content and never duplicates the job', async () => {
    const f = await fixture('cloud'), sessionId = randomUUID();
    await f.property.update({ title: 'CA Rosetti | Ultra central | Complet renovat | Balcon generos', propertyType: 'Garsonieră', description: 'Text CRM EXACT.\nFără rescriere.', images: ['https://example.com/2.jpg','https://example.com/1.jpg'] });
    await f.agency.collection('properties').doc('house').set({title:'CA Rosetti | Ultra central',propertyType:'Casa',transactionType:'Vanzare'});
    for (let i=0;i<12;i++) await f.agency.collection('facebookCloudConnections').doc('extra'+i).set({ agencyId:f.ctx.agencyId,ownerUid:f.ctx.uid,status:'connected',runnerMode:'cloud' });
    const input = {sessionId,requestId:randomUUID(),prompt:'Publică apartamentul din C.A. Rosetti, ultracentral, pe grupurile Facebook.',currentRecord:null};
    const result = await chatTurn(f.ctx,input);
    expect(result.message.text).toContain('a fost creat');
    expect(result.message.text).not.toContain('Limita Jarvis');
    expect(result.message.planId).toBeUndefined();
    expect((await f.jobs.get()).size).toBe(1);
    const payload = JSON.parse(mocks.runner.mock.calls[0][1].body);
    expect(payload).toMatchObject({propertyId:'property',connectionId:'connection',propertyDescription:'Text CRM EXACT.\nFără rescriere.',propertyImages:['https://example.com/2.jpg','https://example.com/1.jpg']});
    expect(payload.groups.map((g:any)=>g.url)).toEqual(['https://www.facebook.com/groups/sale']);
    await chatTurn(f.ctx,input);
    expect(mocks.runner).toHaveBeenCalledTimes(1); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('asks only for an ambiguous account and resumes the original command', async () => {
    const f = await fixture('cloud'), sessionId = randomUUID();
    await f.property.update({defaultFacebookConnectionId:null});
    await f.agency.collection('facebookCloudConnections').doc('other').set({agencyId:f.ctx.agencyId,ownerUid:f.ctx.uid,status:'connected',runnerMode:'cloud'});
    const first = await chatTurn(f.ctx,{sessionId,requestId:randomUUID(),prompt:'Publică apartamentul din Cișmigiu pe grupurile Facebook.',currentRecord:null});
    expect(first.message.cards?.find(c=>c.source==='facebookConnections')?.rows).toHaveLength(2);
    expect((await f.jobs.get()).empty).toBe(true);
    const result = await chatTurn(f.ctx,{sessionId,requestId:randomUUID(),prompt:'Cont Facebook: connection',currentRecord:null});
    expect(result.message.text).toContain('a fost creat'); expect((await f.jobs.get()).size).toBe(1); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('continues Rosetti with the chosen existing automatic local runner and preserves exact content', async () => {
    const f=await fixture('local'),sessionId=randomUUID();
    await f.property.update({defaultFacebookConnectionId:null,title:'CA Rosetti | Ultra central | Complet renovat | Balcon generos',propertyType:'Garsonieră',description:'Exact CRM.',images:['https://example.com/original.jpg']});
    for(let i=0;i<12;i++) await f.agency.collection('facebookCloudConnections').doc('other'+i).set({agencyId:f.ctx.agencyId,ownerUid:f.ctx.uid,status:'connected',runnerMode:'local',deviceId:'device'});
    const first=await chatTurn(f.ctx,{sessionId,requestId:randomUUID(),prompt:'Publică apartamentul din C.A. Rosetti, ultracentral, pe grupurile Facebook.',currentRecord:null});
    expect(first.message.cards?.find(c=>c.source==='facebookConnections')?.rows).toHaveLength(13);
    const input={sessionId,requestId:randomUUID(),prompt:'Cont Facebook: connection',currentRecord:null};
    const result=await chatTurn(f.ctx,input); expect(result.message.text).toContain('a fost creat');
    expect((await f.jobs.get()).size).toBe(1);
    const response=await claimLocalJob(new NextRequest('http://localhost/api/marketing/facebook-local/runner/claim',{method:'POST'}));
    expect(response.status).toBe(200);const {claim}=await response.json();
    expect(claim.property).toMatchObject({description:'Exact CRM.',images:['https://example.com/original.jpg']});
    await chatTurn(f.ctx,input);expect((await f.jobs.get()).size).toBe(1);expect(mocks.fetch).not.toHaveBeenCalled();expect(mocks.runner).not.toHaveBeenCalled();
  });
  it('asks for an ambiguous property and revalidates the selected ID', async () => {
    const f = await fixture('cloud'), sessionId = randomUUID();
    await f.agency.collection('properties').doc('other').set({...((await f.property.get()).data()),title:'Alt apartament Cișmigiu'});
    const first = await chatTurn(f.ctx,{sessionId,requestId:randomUUID(),prompt:'Publică apartamentul din Cismigiu pe grupurile Facebook.',currentRecord:null});
    expect(first.message.cards?.find(c=>c.source==='properties')?.rows).toHaveLength(2);
    expect((await f.jobs.get()).empty).toBe(true);
    const result = await chatTurn(f.ctx,{sessionId,requestId:randomUUID(),prompt:'Proprietate: property',currentRecord:null});
    expect(result.message.text).toContain('a fost creat'); expect((await f.jobs.get()).size).toBe(1); expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('selects the thirteenth account by name, preserves the saved request and creates only one job',async()=>{
    const f=await fixture(),sessionId=randomUUID();
    await f.property.update({defaultFacebookConnectionId:null,description:'Descriere exactă CRM.',images:['https://example.com/original.jpg']});
    for(let i=0;i<12;i++)await f.agency.collection('facebookCloudConnections').doc('extra'+i).set({agencyId:f.ctx.agencyId,ownerUid:f.ctx.uid,status:'connected',runnerMode:'local',deviceId:'device',label:'Contul '+i});
    const first=await chatTurn(f.ctx,{sessionId,requestId:randomUUID(),prompt:'Publică apartamentul Cișmigiu pe grupurile Facebook.',currentRecord:null});
    const card=first.message.cards!.find(card=>card.choiceSource==='facebookPublicationAccount')!;
    expect(card.rows).toHaveLength(13);
    const pending=first.message.cards!.find(card=>card.source==='facebookImmediateRequest')!.rows[0];
    const ids=pending.connectionIds as string[];expect(ids).toHaveLength(13);
    const row=card.rows.find(row=>row.id===ids[12])!;
    const input={sessionId,requestId:randomUUID(),prompt:namedChoiceText(card.choiceSource!,row),choice:{messageId:first.message.id,source:card.choiceSource!,rowId:String(row.id)},currentRecord:null};
    const result=await chatTurn(f.ctx,input);expect(result.message.text).toContain('a fost creat');
    const jobs=await f.jobs.get();expect(jobs.size).toBe(1);expect(jobs.docs[0].data().connectionId).toBe(row.id);
    expect((await chatTurn(f.ctx,input)).message.id).toBe(result.message.id);expect((await f.jobs.get()).size).toBe(1);
    const saved=(await f.agency.collection('assistantSessions').doc(sessionId).collection('messages').doc(input.requestId+'-user').get()).data()!;
    expect(saved.text).toBe(input.prompt);expect(saved.text).not.toContain('Cont Facebook:');
    const claimed=await claimLocalJob(new NextRequest('http://localhost/api/marketing/facebook-local/runner/claim',{method:'POST'}));
    expect((await claimed.json()).claim.property).toMatchObject({description:'Descriere exactă CRM.',images:['https://example.com/original.jpg']});
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('selects an ambiguous property by name and leaves the other property unpublished',async()=>{
    const f=await fixture(),sessionId=randomUUID();await f.agency.collection('properties').doc('second').set({...(await f.property.get()).data(),title:'Apartament Cișmigiu, balcon'});
    const first=await chatTurn(f.ctx,{sessionId,requestId:randomUUID(),prompt:'Publică apartamentul Cișmigiu pe grupurile Facebook.',currentRecord:null});
    const card=first.message.cards!.find(card=>card.choiceSource==='facebookPublicationProperty')!,row=card.rows.find(row=>row.id==='second')!;
    const result=await chatTurn(f.ctx,{sessionId,requestId:randomUUID(),prompt:namedChoiceText(card.choiceSource!,row),choice:{messageId:first.message.id,source:card.choiceSource!,rowId:'second'},currentRecord:null});
    expect(result.message.text).toContain('a fost creat');const jobs=await f.jobs.get();expect(jobs.size).toBe(1);expect(jobs.docs[0].data().propertyId).toBe('second');
  });
  it.each(['foreign','revoked','device-revoked'])('does not publish using an unavailable configured account: %s',async variant=>{
    const f=await fixture('cloud');
    await f.connection.update(variant==='device-revoked'?{runnerMode:'local'}:variant==='foreign'?{ownerUid:'someone-else'}:{status:'needs_reauthentication'});
    if(variant==='device-revoked') await f.device.update({revokedAt:'now'});
    const result=await chatTurn(f.ctx,{sessionId:randomUUID(),requestId:randomUUID(),prompt:'Publică apartamentul din Cismigiu pe grupurile Facebook.',currentRecord:null});
    expect(result.message.text).not.toContain('a fost creat'); expect((await f.jobs.get()).empty).toBe(true); expect(mocks.runner).not.toHaveBeenCalled();expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('revalidates selected groups instead of publishing to removed destinations', async () => {
    const f = await fixture('cloud'), sessionId = randomUUID();
    const first = await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: 'Creează jobul de publicare Facebook.', currentRecord: { resource: 'properties', id: 'property' } });
    const id = first.message.cards!.find(card => card.source === 'facebookGroups')!.rows[0].id;
    await f.agency.update({ facebookGroups: [{ name: 'Nou', url: 'https://www.facebook.com/groups/new', purpose: 'sale' }] });
    await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: 'Grupuri Facebook: ' + id, currentRecord: null });
    expect((await f.jobs.get()).empty).toBe(true); expect(mocks.runner).not.toHaveBeenCalled();
  });
  it.each(['foreign-group', 'revoked-account', 'different-property'])('does not execute invalid continuation: %s', async variant => {
    const f = await fixture('cloud'), sessionId = randomUUID();
    const first = await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: 'Creează jobul de publicare Facebook.', currentRecord: { resource: 'properties', id: 'property' } });
    const id = first.message.cards!.find(card => card.source === 'facebookGroups')!.rows[0].id;
    if (variant === 'revoked-account') await f.connection.update({ status: 'needs_reauthentication' });
    if (variant === 'different-property') await f.agency.collection('properties').doc('other').set({ ...(await f.property.get()).data(), title: 'Altă proprietate' });
    await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: 'Grupuri Facebook: ' + (variant === 'foreign-group' ? 'abcdef' : id), currentRecord: variant === 'different-property' ? { resource: 'properties', id: 'other' } : null });
    expect((await f.jobs.get()).empty).toBe(true); expect(mocks.runner).not.toHaveBeenCalled();
  });
  for (const mode of ['local', 'cloud']) it('publishes CRM description and photos, never the conversation draft: ' + mode, async () => {
    const f = await fixture(mode), sessionId = randomUUID();
    const description = 'Descrierea agentului: Cișmigiu.\n\nText păstrat EXACT — fără reformulare.';
    const images = ['https://example.com/photo-2.jpg', 'https://example.com/photo-1.jpg'];
    await f.property.update({ description, images, price: 130000, amenities: ['Balcon'] });
    const draft = await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: 'Pregătește textul postării pentru proprietate.', currentRecord: { resource: 'properties', id: 'property' } });
    expect(draft.message.cards?.find(card => card.source === 'facebookPostDraft')?.rows[0].text).not.toBe(description);
    await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: corpus.scenarios.find(row => row.id === 'master-0357')!.text, currentRecord: null });
    const jobs = await f.jobs.get(); expect(jobs.size).toBe(1);
    expect(jobs.docs[0].data().postDraft).toBeUndefined();
    if (mode === 'cloud') {
      expect(mocks.runner).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(mocks.runner.mock.calls[0][1].body);
      expect(payload.propertyDescription).toBe(description); expect(payload.propertyImages).toEqual(images);
    } else {
      await jobs.docs[0].ref.update({ scheduledAt: new Date(Date.now() - 60000).toISOString() });
      const response = await claimLocalJob(new NextRequest('http://localhost/api/marketing/facebook-local/runner/claim', { method: 'POST' }));
      expect(response.status).toBe(200);
      const { claim } = await response.json();
      expect(claim.property.description).toBe(description); expect(claim.property.images).toEqual(images);
      expect(mocks.runner).not.toHaveBeenCalled();
    }
    expect((await f.property.get()).data()).toMatchObject({ description, images });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  for (const mode of ['local', 'cloud']) it('executes master-0357 through chat with ' + mode, async () => {
    const f = await fixture(mode), scenarioId = 'master-0357', prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const input = { sessionId: randomUUID(), requestId: randomUUID(), prompt, currentRecord: null };
    const result = await chatTurn(f.ctx, input);
    expect(result.message.planId).toBeUndefined(); expect(result.message.text).toContain('a fost creat și programat');
    const jobs = await f.jobs.get(); expect(jobs.size).toBe(1);
    const job = jobs.docs[0].data(); expect(bucharestInputFromIso(job.scheduledAt)).toEqual({ date: tomorrowBucharest(new Date()), time: '07:00' });
    expect(job.groups.map((g: any) => g.url)).toEqual(f.body.groupUrls); expect(job.propertyId).toBe('property'); expect(job.status).toBe('scheduled'); expect(job.leaseToken).toBeUndefined();
    await chatTurn(f.ctx, input); expect((await f.jobs.get()).size).toBe(1); expect(mocks.runner).toHaveBeenCalledTimes(mode === 'cloud' ? 1 : 0); expect(mocks.fetch).not.toHaveBeenCalled();
    await mkdir('.tmp/jarvis-facebook-create', { recursive: true }); await writeFile('.tmp/jarvis-facebook-create/' + scenarioId + '-' + mode + '.json', JSON.stringify({ scenarioId, prompt, versions: VERSIONS, executionVerified: true, environment: 'Actual chat/autonomy/POST and local Firestore; ' + mode + ' runner, cloud transport simulated.', runs: [{ phase: 'original', final: result.message }] }, null, 2));
  }, 30000);
  it('executes master-0360 without scheduling a disconnected account', async () => {
    const f = await fixture(); await f.connection.update({ status: 'needs_reauthentication' });
    const scenarioId = 'master-0360', prompt = corpus.scenarios.find(row => row.id === scenarioId)!.text;
    const result = await chatTurn(f.ctx, { sessionId: randomUUID(), requestId: randomUUID(), prompt, currentRecord: null });
    expect(result.message.text).toContain('blocate acum: 1'); expect((await f.jobs.get()).empty).toBe(true);
    const attempted = await call(f.body); expect(attempted.status).toBe(409); expect((await f.jobs.get()).empty).toBe(true); expect(mocks.runner).not.toHaveBeenCalled();
    await mkdir('.tmp/jarvis-facebook-create', { recursive: true }); await writeFile('.tmp/jarvis-facebook-create/' + scenarioId + '-local.json', JSON.stringify({ scenarioId, prompt, versions: VERSIONS, executionVerified: true, environment: 'Chat guard and actual POST refusal against disconnected account on local Firestore.', runs: [{ phase: 'original', final: result.message }] }, null, 2));
  });
  it('continues after choosing one of multiple matching properties', async () => {
    const f = await fixture(); await f.agency.collection('properties').doc('SecondID').set({ ...(await f.property.get()).data(), title: 'Apartament Cişmigiu 2' });
    const sessionId = randomUUID(), prompt = corpus.scenarios.find(row => row.id === 'master-0357')!.text;
    const first = await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt, currentRecord: null }); expect(first.message.text).toContain('Alege proprietatea'); expect((await f.jobs.get()).empty).toBe(true);
    const card=first.message.cards!.find(card=>card.choiceSource==='facebookScheduleProperty')!,row=card.rows.find(row=>row.id==='SecondID')!;
    const result = await chatTurn(f.ctx, { sessionId, requestId: randomUUID(), prompt: namedChoiceText(card.choiceSource!,row), choice:{messageId:first.message.id,source:card.choiceSource!,rowId:'SecondID'}, currentRecord: null }); expect(result.message.text).toContain('a fost creat și programat'); expect((await f.jobs.get()).docs[0].data().propertyId).toBe('SecondID');
  });
  it('serializes concurrent identical requests and rejects payload changes', async () => {
    const f = await fixture();
    const results = await Promise.all([1, 2].map(() => createFacebookJob(db as any, f.ctx.agencyId, f.ctx.uid, f.body, mocks.runner)));
    expect(results.filter(row => row.created)).toHaveLength(1); expect(results[0].job.id).toBe(results[1].job.id); expect((await f.jobs.get()).size).toBe(1);
    await expect(createFacebookJob(db as any, f.ctx.agencyId, f.ctx.uid, { ...f.body, scheduledAt: tomorrowBucharest(new Date()) + 'T05:00:00.000Z' }, mocks.runner)).rejects.toThrow('altei comenzi');
  });
  it('serializes distinct concurrent requests for the same publication', async () => {
    const f = await fixture();
    const results = await Promise.allSettled([1, 2].map(() => createFacebookJob(db as any, f.ctx.agencyId, f.ctx.uid, { ...f.body, requestId: randomUUID() }, mocks.runner)));
    expect(results.filter(row => row.status === 'fulfilled')).toHaveLength(1); expect((await f.jobs.get()).size).toBe(1);
  });
  it.each(['timeout', 'wrong-owner', 'wrong-groups'])('fences an unconfirmed cloud dispatch: %s', async variant => {
    const f = await fixture('cloud'); mocks.runner.mockImplementation(async (_path, options) => {
      if (variant === 'timeout') throw new Error('Timeout'); const data = JSON.parse(options.body);
      return { job: { ...data, status: 'scheduled', groups: data.groups.map((g: any) => ({ ...g, status: 'queued' })), ...(variant === 'wrong-owner' ? { ownerUid: 'other' } : { groups: [] }) } };
    });
    expect((await call(f.body)).status).toBe(409); expect((await call(f.body)).status).toBe(409); expect((await call({ ...f.body, requestId: randomUUID() })).status).toBe(409);
    expect(mocks.runner).toHaveBeenCalledTimes(1); expect((await f.jobs.get()).size).toBe(1); expect((await f.jobs.get()).docs[0].data().dispatchState).toBe('unknown');
  });
  it.each(['owner', 'agency', 'deleted', 'reconnect', 'device', 'profile', 'groups'])('rejects invalid creation: %s', async variant => {
    const f = await fixture();
    if (variant === 'owner') await f.connection.update({ ownerUid: 'other' });
    if (variant === 'agency') await f.connection.update({ agencyId: 'other' });
    if (variant === 'deleted') await f.connection.update({ deletedAt: 'now' });
    if (variant === 'reconnect') await f.connection.update({ status: 'needs_reauthentication' });
    if (variant === 'device') await f.device.update({ revokedAt: 'now' });
    if (variant === 'profile') await f.profile.update({ role: 'disabled' });
    if (variant === 'groups') f.body.groupUrls = ['https://www.facebook.com/groups/rent'];
    expect((await call(f.body)).status).toBeGreaterThanOrEqual(400); expect((await f.jobs.get()).empty).toBe(true); expect(mocks.runner).not.toHaveBeenCalled();
  });
  it.each(['error', 'needs_reauthentication'])('does not restart an existing %s job as a new publication', async status => {
    const f = await fixture(); await call(f.body); const job = (await f.jobs.get()).docs[0];
    await job.ref.update({ status, groups: [{ name: 'Vânzări', url: f.body.groupUrls[0], status: 'submitted' }] });
    expect((await call({ ...f.body, requestId: randomUUID() })).status).toBe(409); expect((await f.jobs.get()).size).toBe(1);
  });
  it('does not dispatch a cloud replay while the first request is still pending', async () => {
    const f = await fixture('cloud'); let release!: () => void, started!: () => void;
    const entered = new Promise<void>(resolve => { started = resolve; }); const gate = new Promise<void>(resolve => { release = resolve; });
    mocks.runner.mockImplementation(async (_path, options) => { started(); await gate; const data = JSON.parse(options.body); return { job: { ...data, status: 'scheduled', groups: data.groups.map((g: any) => ({ ...g, status: 'queued' })) } }; });
    const first = createFacebookJob(db as any, f.ctx.agencyId, f.ctx.uid, f.body, mocks.runner);
    try { await entered; await expect(createFacebookJob(db as any, f.ctx.agencyId, f.ctx.uid, f.body, mocks.runner)).rejects.toThrow('nu este confirmată'); }
    finally { release(); }
    await first; expect(mocks.runner).toHaveBeenCalledTimes(1); expect((await f.jobs.get()).size).toBe(1);
  });
  it('finds an apartment by Romanian location without matching a house in the same area', async () => {
    const f = await fixture(); await f.property.update({ title: 'Două camere centrale', propertyType: 'Apartament', location: 'București, Cişmigiu' });
    await f.agency.collection('properties').doc('house').set({ ...(await f.property.get()).data(), propertyType: 'Casa', title: 'Casă Cișmigiu' });
    const result = await chatTurn(f.ctx, { sessionId: randomUUID(), requestId: randomUUID(), prompt: corpus.scenarios.find(row => row.id === 'master-0357')!.text, currentRecord: null });
    expect(result.message.text).toContain('a fost creat și programat'); expect((await f.jobs.get()).docs[0].data().propertyId).toBe('property');
  });

  it('executes a structured semantic Facebook request through the real job ledger without an imperative template', async()=>{
    const f=await fixture('local');
    const description='Textul original — Cișmigiu. Fără rescriere.';
    const images=['https://example.com/second.jpg','https://example.com/first.jpg'];
    await f.property.update({description,images});
    const prompt='Mi-ar prinde bine să ajungă și pe grupurile de Facebook oferta de la Cismigiu.';
    const prepared=await prepareFacebookPublication(f.ctx,{query:'Cismigiu'});
    expect(prepared?.actions).toHaveLength(1);
    expect((await f.jobs.get()).empty).toBe(true);
    const actions=prepared!.actions;
    const authority=bindSemanticAuthority(prompt,actions,{requirements:[{id:'publish',sourceQuote:prompt,description:'Publicare Facebook',resolution:'planned',steps:[1],evidenceCallIds:['preflight'],execution:{mode:'execute',conditions:[]}}]});
    const requestId=randomUUID();
    const result=await executeSafePrefix(f.ctx,requestId,actions,prompt,authority);
    expect(result.results).toHaveLength(1);
    expect(result.blocked).toBe(false);
    await executeSafePrefix(f.ctx,requestId,actions,prompt,authority);
    const jobs=await f.jobs.get(); expect(jobs.size).toBe(1);
    await jobs.docs[0].ref.update({scheduledAt:new Date(Date.now()-60000).toISOString()});
    const response=await claimLocalJob(new NextRequest('http://localhost/api/marketing/facebook-local/runner/claim',{method:'POST'}));
    expect(response.status).toBe(200);
    const {claim}=await response.json();
    expect(claim.property.description).toBe(description);expect(claim.property.images).toEqual(images);
    expect(mocks.fetch).not.toHaveBeenCalled();expect(mocks.runner).not.toHaveBeenCalled();
  });
  it('does not replace a requested Facebook subset with every configured group',async()=>{
    const f=await fixture();
    await f.agency.update({facebookGroups:[{name:'Primul',url:'https://www.facebook.com/groups/one',purpose:'sale'},{name:'Al doilea',url:'https://www.facebook.com/groups/two',purpose:'sale'}]});
    const prepared=await prepareFacebookPublication(f.ctx,{propertyId:'property',query:'',groupUrls:['https://www.facebook.com/groups/two']});
    expect(prepared?.actions[0]).toMatchObject({body:{groupUrls:['https://www.facebook.com/groups/two']}});
    const rejected=await prepareFacebookPublication(f.ctx,{propertyId:'property',query:'',groupUrls:['https://www.facebook.com/groups/foreign']});
    expect(rejected?.actions).toHaveLength(0);expect((await f.jobs.get()).empty).toBe(true);
  });
});
