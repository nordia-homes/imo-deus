import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
const mocks=vi.hoisted(() => ({ actor: null as any, fetch: vi.fn() }));
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: async () => mocks.actor }));
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
import { chatTurn } from '../workspace';
import { executeMetaDraft, prepareMetaDraft } from '../meta-draft';
import { VERSIONS } from '../models';
import corpus from '../../../../docs/jarvis/evals/master-scenarios.json';
const ids=[404,405,406,407,423,424,425,430,449,450];
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('atomic Meta draft workflows', () => {
 let db: Firestore; const agencies: string[]=[],users: string[]=[];
 beforeAll(() => { if(!/^(localhost|127[.]0[.]0[.]1):[0-9]+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local emulator required'); db=new Firestore({ projectId: 'demo-imodeus-meta-draft' }); mocks.fetch.mockRejectedValue(new Error('External calls forbidden')); vi.stubGlobal('fetch',mocks.fetch); });
 afterAll(async () => { if(!db)return; for(const id of agencies)await db.recursiveDelete(db.collection('agencies').doc(id)); for(const id of users)await db.collection('users').doc(id).delete(); await db.terminate(); vi.unstubAllGlobals(); });
 async function fixture(role='agent') {
  const agencyId=randomUUID(),uid=randomUUID(); agencies.push(agencyId); users.push(uid); const ctx={ agencyId,uid,role,adminDb:db } as any; mocks.actor=ctx;
  const agency=db.collection('agencies').doc(agencyId),profile=db.collection('users').doc(uid),property=agency.collection('properties').doc('property'),campaigns=agency.collection('metaCampaignDrafts'),integration=agency.collection('integrations').doc('meta');
  await agency.set({ name:'Synthetic',slug:'synthetic' }); await profile.set({ agencyId,role });
  await property.set({ agencyId,title:'Cișmigiu',description:'Descriere exactă CRM.',status:'Activ',latitude:44.4,longitude:26.1,price:120000,city:'București',images:[{url:'https://example.invalid/main.jpg',alt:'Principală'},{url:'https://example.invalid/second.jpg',alt:'Secundară'}] });
  await integration.set({ connected:true,selectedAdAccount:{ id:'account',currency:'EUR' },selectedPage:{id:'page'} });
  const sessionId=randomUUID(), currentRecord={resource:'properties',id:'property'} as const;
  const send=(prompt:string,requestId=randomUUID()) => chatTurn(ctx,{sessionId,requestId,prompt,currentRecord});
  const history=async () => [{id:'current-page-context',role:'assistant',cards:[{source:'properties',rows:[{id:'property'}]}]}] as any;
  return {ctx,agency,profile,property,campaigns,integration,send,sessionId,currentRecord,history};
 }
 for(const n of ids)it('executes original master-'+String(n).padStart(4,'0'),async () => {
  const f=await fixture(),scenarioId='master-'+String(n).padStart(4,'0'),prompt=corpus.scenarios.find(row=>row.id===scenarioId)!.text, runs:any[]=[];
  if([405,406,407,423,430,450].includes(n)) { const setup=await f.send('Creează draft de campanie Meta pentru proprietate.'); expect(setup.message.text).toContain('a fost salvat'); runs.push({phase:'context',final:setup.message}); }
  const before=(await f.campaigns.get()).docs.map(doc=>doc.data()),requestId=randomUUID();
  const original=await f.send(prompt,requestId); runs.push({phase:'original',final:original.message});
  let result=original;
  if([406,407].includes(n)){ expect(original.message.text).toContain('Parametri draft Meta'); result=await f.send(n===406?'Parametri draft Meta: buget 125 EUR zilnic':'Parametri draft Meta: buget 300 EUR total; durata 10 zile'); runs.push({phase:'values',final:result.message}); }
  const docs=(await f.campaigns.get()).docs; expect(docs).toHaveLength(1); const row=docs[0].data();
  expect(row.status).toBe('draft'); expect(row.metaCampaignId).toBeNull(); expect(row.metaAdId).toBeNull(); expect(row.primaryText).toBe('Descriere exactă CRM.'); expect(result.message.planId).toBeUndefined();
  if([405,423,450].includes(n)) expect(docs.map(doc=>doc.data())).toEqual(before); else expect(result.message.text).toContain('a fost salvat');
  if(n===406) expect(row.budgetAmount).toBe(125);
  if(n===407){ expect(row.durationDays).toBe(10);expect(row.budgetType).toBe('lifetime'); }
  if(n===424) expect(row.durationDays).toBe(7);
  if(n===425){ expect(row.budgetAmount).toBe(300); expect(row.budgetType).toBe('lifetime'); expect(row.currency).toBe('EUR'); }
  if(n===430){ expect(row.mediaItems).toHaveLength(1); expect(row.imageUrl).toBe('https://example.invalid/main.jpg'); }
  expect((await f.send(prompt,requestId)).message.id).toBe(original.message.id); expect((await f.campaigns.get()).size).toBe(1); expect(mocks.fetch).not.toHaveBeenCalled();
  expect((await f.property.get()).data()?.metaMarketing.latestCampaignDraftId).toBe(docs[0].id);
  await mkdir('.tmp/jarvis-meta-draft',{recursive:true}); await writeFile('.tmp/jarvis-meta-draft/'+scenarioId+'.json',JSON.stringify({scenarioId,prompt,versions:VERSIONS,executionVerified:true,environment:'Persisted application chat, atomic actual Firestore draft writes and execution ledger on local emulator. No Meta publication or spending.',runs},null,2));
 });
 it('creates once under concurrent execution and rejects a changed payload for the same key',async()=>{
  const f=await fixture(),plan=await prepareMetaDraft(f.ctx,'Creează draft de campanie Meta pentru proprietate.',await f.history()),action=plan!.actions[0];
  const results=await Promise.all([executeMetaDraft(f.ctx,action,'same'),executeMetaDraft(f.ctx,action,'same')]); expect(results[0].campaignId).toBe(results[1].campaignId);expect((await f.campaigns.get()).size).toBe(1);
  await expect(executeMetaDraft(f.ctx,{...action,body:{...(action as any).body,patch:{durationDays:8}}} as any,'same')).rejects.toThrow();
 });
 it.each(['property','membership','integration'])('rechecks %s before writing',async change=>{
  const f=await fixture(),plan=await prepareMetaDraft(f.ctx,'Creează draft de campanie Meta pentru proprietate.',await f.history());
  if(change==='property')await f.property.update({description:'Changed'});
  if(change==='membership')await f.profile.update({agencyId:'other'});
  if(change==='integration')await f.integration.update({connected:false});
  await expect(executeMetaDraft(f.ctx,plan!.actions[0],randomUUID())).rejects.toThrow(); expect((await f.campaigns.get()).empty).toBe(true);
 });
 it('does not reinterpret 300 EUR as 300 RON',async()=>{
  const f=await fixture();await f.integration.update({'selectedAdAccount.currency':'RON'});const result=await f.send('Pregătește campania cu buget total 300 €.');expect(result.message.text).toContain('Moneda');expect((await f.campaigns.get()).empty).toBe(true);
 });
 it('preserves concurrently edited and published campaigns',async()=>{
  const f=await fixture();await f.send('Creează draft de campanie Meta pentru proprietate.'); const doc=(await f.campaigns.get()).docs[0];
  const plan=await prepareMetaDraft(f.ctx,'Folosește fotografia principală a proprietății.',await f.history());
  await doc.ref.update({budgetAmount:777});await expect(executeMetaDraft(f.ctx,plan!.actions[0],randomUUID())).rejects.toThrow('schimbat');expect((await doc.ref.get()).data()?.budgetAmount).toBe(777);
  await doc.ref.update({status:'published',metaCampaignId:'external'});const blocked=await f.send('Folosește fotografia principală a proprietății.');expect(blocked.message.text).toContain('Nu există drafturi');expect((await doc.ref.get()).data()?.status).toBe('published');
 });
 it('selects one of multiple drafts without updating the other',async()=>{
  const f=await fixture();await f.send('Creează draft de campanie Meta pentru proprietate.');await f.send('Creează draft de campanie Meta pentru proprietate.');
  const docs=(await f.campaigns.get()).docs,before=docs[1].data();await f.send('Nu publica draftul încă.');const offered=await f.send('Actualizează campania draft.');expect(offered.message.cards?.[0].rows).toHaveLength(2);
  await f.send('Draft Meta: '+docs[0].id);const final=await f.send('Parametri draft Meta: buget 200 EUR total; durata 9 zile');expect(final.message.text).toContain('a fost salvat');expect((await docs[0].ref.get()).data()?.durationDays).toBe(9);expect((await docs[1].ref.get()).data()).toEqual(before);
 });
 it('refuses a foreign draft and missing property photo without changing the campaign',async()=>{
  const f=await fixture();await f.send('Creează draft de campanie Meta pentru proprietate.');const doc=(await f.campaigns.get()).docs[0];
  await f.property.update({images:[]});const plan=await prepareMetaDraft(f.ctx,'Folosește fotografia principală a proprietății.',await f.history());
  await expect(executeMetaDraft(f.ctx,plan!.actions[0],randomUUID())).rejects.toThrow('Fotografie');expect((await doc.ref.get()).data()?.imageUrl).toBe('https://example.invalid/main.jpg');
  await doc.ref.update({agencyId:'other'});expect((await prepareMetaDraft(f.ctx,'Folosește fotografia principală a proprietății.',await f.history()))?.actions).toEqual([]);
 });
 it('refuses selection after the opened property changes',async()=>{
  const f=await fixture();await f.send('Creează draft de campanie Meta pentru proprietate.');const offer=await prepareMetaDraft(f.ctx,'Actualizează campania draft.',await f.history());
  const history=[{id:'current-page-context',role:'assistant',cards:[{source:'properties',rows:[{id:'other'}]}]},{id:'last',role:'assistant',cards:[{source:'metaDraftSelection',rows:offer!.rows}]}] as any;
  await expect(prepareMetaDraft(f.ctx,'Parametri draft Meta: buget 100 EUR total',history)).rejects.toThrow('Contextul');
 }); it.each(['metaAdSetId','metaCreativeId'])('refuses a partially created remote object %s',async field=>{
  const f=await fixture();await f.send('Creează draft de campanie Meta pentru proprietate.');const doc=(await f.campaigns.get()).docs[0];
  const plan=await prepareMetaDraft(f.ctx,'Folosește fotografia principală a proprietății.',await f.history());
  await doc.ref.update({[field]:'remote-object'});await expect(executeMetaDraft(f.ctx,plan!.actions[0],randomUUID())).rejects.toThrow();
  expect((await prepareMetaDraft(f.ctx,'Folosește fotografia principală a proprietății.',await f.history()))?.actions).toEqual([]);
 }); it('edits an unpublished ready draft and invalidates its old readiness',async()=>{
  const f=await fixture();await f.send('Creează draft de campanie Meta pentru proprietate.');const doc=(await f.campaigns.get()).docs[0];await doc.ref.update({status:'ready'});
  const result=await f.send('Folosește fotografia principală a proprietății.');expect(result.message.text).toContain('a fost salvat');expect((await doc.ref.get()).data()?.status).toBe('draft');expect((await doc.ref.get()).data()?.mediaItems).toHaveLength(1);
 });});
