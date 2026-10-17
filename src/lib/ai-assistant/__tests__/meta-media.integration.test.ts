import { randomUUID } from 'node:crypto';
import { Firestore } from '@google-cloud/firestore';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
const mocks=vi.hoisted(() => ({ actor: null as any, fetch: vi.fn() }));
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: async () => mocks.actor }));
vi.mock('@/firebase/admin', () => ({ adminAuth: {} }));
import { chatTurn } from '../workspace';
import { executeMetaDraft, prepareMetaDraft } from '../meta-draft';
import { prepareMetaMedia, executeMetaDraftRemoval } from '../meta-media';
import { VERSIONS } from '../models';
import corpus from '../../../../docs/jarvis/evals/master-scenarios.json';
const ids=[415,431,432,433];
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('Meta media and local draft removal', () => {
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
 for(const n of ids)it('executes original master-'+String(n).padStart(4,'0'),async()=>{
  const f=await fixture(),scenarioId='master-'+String(n).padStart(4,'0'),prompt=corpus.scenarios.find(row=>row.id===scenarioId)!.text;
  const setup=await f.send('Creează draft de campanie Meta pentru proprietate.'),doc=(await f.campaigns.get()).docs[0],runs:any[]=[{phase:'context',final:setup.message}];
  if(n===432)await doc.ref.update({mediaItems:[{type:'image',url:'https://other.invalid/foreign.jpg',source:'property'}]});
  if(n===433)await f.property.update({images:[{url:'https://example.invalid/main.jpg',alt:'Principală'}]});
  const before=(await doc.ref.get()).data(),requestId=randomUUID(),result=await f.send(prompt,requestId);runs.push({phase:'original',final:result.message});
  if(n===415){expect((await doc.ref.get()).exists).toBe(false);expect((await f.property.get()).data()?.metaMarketing.latestCampaignDraftId).toBeNull();expect(result.message.text).toContain('a fost eliminat');}
  if(n===431){expect(result.message.cards?.[0].source).toBe('metaMediaSelection');expect(result.message.cards?.[0].rows).toHaveLength(2);const pickId=randomUUID(),selected=await f.send('Material Meta: 2',pickId);runs.push({phase:'selection',final:selected.message});expect(selected.message.text).toContain('Fotografia selectată');expect((await doc.ref.get()).data()?.imageUrl).toBe('https://example.invalid/second.jpg');expect((await doc.ref.get()).data()?.mediaItems).toHaveLength(1);expect((await f.send('Material Meta: 2',pickId)).message.id).toBe(selected.message.id);}
  if(n===432||n===433){expect(result.message.cards?.[0].source).toBe('metaMediaReview');expect(result.message.cards?.[0].rows.some(row=>row.inCurrentProperty===false)).toBe(true);expect((await doc.ref.get()).data()).toEqual(before);expect(result.message.text).toContain('adresa externă nu a fost verificată');}
  expect(result.message.planId).toBeUndefined();expect((await f.send(prompt,requestId)).message.id).toBe(result.message.id);expect(mocks.fetch).not.toHaveBeenCalled();
  await mkdir('.tmp/jarvis-meta-media',{recursive:true});await writeFile('.tmp/jarvis-meta-media/'+scenarioId+'.json',JSON.stringify({scenarioId,prompt,versions:VERSIONS,executionVerified:true,environment:'Persisted application chat and local Firestore: selected CRM photo, CRM association/membership check and atomic local-only draft deletion. No remote file availability claim, Meta deletion or external publication.',runs},null,2));
 });
 it('does not substitute a changed image after showing the selection',async()=>{
  const f=await fixture();await f.send('Creează draft de campanie Meta pentru proprietate.');const doc=(await f.campaigns.get()).docs[0];await f.send('Folosește materialul media pe care l-am selectat.');await f.property.update({images:[{url:'https://example.invalid/replacement.jpg',alt:'Alta'}]});
  const result=await f.send('Material Meta: 1');expect(result.message.text).toContain('s-au schimbat');expect((await doc.ref.get()).data()?.imageUrl).toBe('https://example.invalid/main.jpg');
 });
 it('rejects a forged image from another property at execution',async()=>{
  const f=await fixture();await f.send('Creează draft de campanie Meta pentru proprietate.');const plan=await prepareMetaDraft(f.ctx,'Folosește fotografia principală a proprietății.',await f.history());const action=plan!.actions[0] as any;
  await expect(executeMetaDraft(f.ctx,{...action,body:{...action.body,patch:{selectedImageUrl:'https://other.invalid/foreign.jpg'}}},randomUUID())).rejects.toThrow('Fotografie');
 });
 it.each(['metaCampaignId','metaAdSetId','metaAdId','metaCreativeId'])('refuses deletion after provider object %s appears',async field=>{
  const f=await fixture();await f.send('Creează draft de campanie Meta pentru proprietate.');const doc=(await f.campaigns.get()).docs[0],plan=await prepareMetaMedia(f.ctx,'Elimină draftul greșit dacă este permis.',await f.history());await doc.ref.update({[field]:'remote'});
  await expect(executeMetaDraftRemoval(f.ctx,plan!.actions[0],randomUUID())).rejects.toThrow('schimbat');expect((await doc.ref.get()).exists).toBe(true);
 });
 it('removes only the selected local draft and repairs the property reference while disconnected',async()=>{
  const f=await fixture();await f.send('Creează draft de campanie Meta pentru proprietate.');const first=(await f.campaigns.get()).docs[0],before=first.data();await f.send('Creează draft de campanie Meta pentru proprietate.');await f.integration.update({connected:false});
  const result=await f.send('Elimină draftul greșit dacă este permis.');expect(result.message.text).toContain('a fost eliminat');expect((await f.campaigns.get()).size).toBe(1);expect((await first.ref.get()).data()).toEqual(before);expect((await f.property.get()).data()?.metaMarketing.latestCampaignDraftId).toBe(first.id);
 });
 it('executes concurrent removal once and retains the deleted draft only in its audit record',async()=>{
  const f=await fixture();await f.send('Creează draft de campanie Meta pentru proprietate.');const plan=await prepareMetaMedia(f.ctx,'Elimină draftul greșit dacă este permis.',await f.history()),action=plan!.actions[0],key=randomUUID();
  const results=await Promise.all([executeMetaDraftRemoval(f.ctx,action,key),executeMetaDraftRemoval(f.ctx,action,key)]);expect(results[0]).toEqual(results[1]);expect((await f.campaigns.get()).empty).toBe(true);expect((await f.agency.collection('assistantExecutions').doc(key).get()).data()?.deletedDraft.status).toBe('draft');
 });
 it('rejects deletion after membership revocation without removing the draft',async()=>{
  const f=await fixture();await f.send('Creează draft de campanie Meta pentru proprietate.');const plan=await prepareMetaMedia(f.ctx,'Elimină draftul greșit dacă este permis.',await f.history());await f.profile.update({agencyId:'other'});await expect(executeMetaDraftRemoval(f.ctx,plan!.actions[0],randomUUID())).rejects.toThrow('Acces');expect((await f.campaigns.get()).size).toBe(1);
 });
 it('preserves a long signed image URL through selection and saving',async()=>{
  const f=await fixture(),url='https://example.invalid/photo.jpg?signature='+'x'.repeat(2200);await f.property.update({images:[{url,alt:'Semnată'}]});await f.send('Creează draft de campanie Meta pentru proprietate.');
  const offered=await f.send('Folosește materialul media pe care l-am selectat.');expect(offered.message.cards?.[0].rows[0].url).toBe(url);const selected=await f.send('Material Meta: 1');expect(selected.message.text).toContain('Fotografia selectată');expect((await f.campaigns.get()).docs[0].data().imageUrl).toBe(url);
 });
 it('rejects a stale campaign revision and an unoffered selection without substitution',async()=>{
  const f=await fixture();await f.send('Creează draft de campanie Meta pentru proprietate.');const doc=(await f.campaigns.get()).docs[0];await f.send('Folosește materialul media pe care l-am selectat.');await doc.ref.update({budgetAmount:99});
  const changed=await f.send('Material Meta: 2');expect(changed.message.text).toContain('s-au schimbat');expect((await doc.ref.get()).data()?.imageUrl).toBe('https://example.invalid/main.jpg');
  await f.send('Folosește materialul media pe care l-am selectat.');const missing=await f.send('Material Meta: 999');expect(missing.message.text).toContain('s-au schimbat');expect((await doc.ref.get()).data()?.budgetAmount).toBe(99);
 });});
