import {randomUUID} from 'node:crypto';
import {Firestore} from '@google-cloud/firestore';
import {NextRequest} from 'next/server';
import {afterAll,beforeAll,describe,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({db:null as any,actor:null as any,fetch:vi.fn()}));
vi.mock('@/firebase/admin',()=>({get adminDb(){return mocks.db;}}));
vi.mock('@/lib/firebase-app-hosting',()=>({requireAgencyUserFromBearerToken:async()=>mocks.actor}));
import {PATCH} from '@/app/api/marketing/meta/property-campaigns/[campaignId]/route';
import {updateMetaCampaignDraft} from '@/lib/meta-marketing';
import {operationResult} from '../operation-result';
import {executionConfirmation} from '../execution-confirmation';
describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)('local Meta draft edit boundary',()=>{
 const agencies:string[]=[],users:string[]=[];
 beforeAll(()=>{if(!/^(localhost|127[.]0[.]0[.]1):[0-9]+$/.test(process.env.FIRESTORE_EMULATOR_HOST||''))throw Error('Local emulator required');mocks.db=new Firestore({projectId:'demo-imodeus-meta-draft-boundary'});vi.stubGlobal('fetch',mocks.fetch);});
 afterAll(async()=>{if(!mocks.db)return;for(const id of agencies)await mocks.db.recursiveDelete(mocks.db.collection('agencies').doc(id));for(const id of users)await mocks.db.collection('users').doc(id).delete();await mocks.db.terminate();vi.unstubAllGlobals();});
 async function fixture(){
  const agencyId=randomUUID(),uid=randomUUID();agencies.push(agencyId);users.push(uid);const actor={agencyId,uid,role:'agent'};mocks.actor=actor;mocks.fetch.mockReset().mockRejectedValue(new Error('External writes forbidden'));
  const agency=mocks.db.collection('agencies').doc(agencyId),campaign=agency.collection('metaCampaignDrafts').doc('selected'),other=agency.collection('metaCampaignDrafts').doc('other'),property=agency.collection('properties').doc('property'),member=mocks.db.collection('users').doc(uid);
  await member.set({agencyId,role:'agent'});await property.set({agencyId,title:'Cișmigiu'});await campaign.set({agencyId,propertyId:'property',status:'draft',headline:'Înainte',budgetAmount:50,currency:'EUR',createdByUid:uid});await other.set({agencyId,status:'draft',headline:'Alta'});
  const send=(body:any={headline:'După'})=>PATCH(new NextRequest('https://example.invalid/api/marketing/meta/property-campaigns/selected',{method:'PATCH',body:JSON.stringify(body)}),{params:Promise.resolve({campaignId:'selected'})});
  return {agencyId,actor,campaign,other,property,member,send};
 }
 it.each(['draft','ready'])('saves only a local %s and confirms no external update',async status=>{const f=await fixture();await f.campaign.update({status});const property=(await f.property.get()).data(),other=(await f.other.get()).data(),response=await f.send();expect(response.status).toBe(200);const body=await response.json();expect(body).toMatchObject({localOnly:true,externalUpdateConfirmed:false,campaign:{id:'selected',status:'draft',headline:'După',budgetAmount:50}});const receipt=operationResult('meta_campaign_update',body);expect(receipt).toMatchObject({executionState:'draft',completionSatisfied:true,externalUpdateConfirmed:false});expect(executionConfirmation([{kind:'existing_operation',result:receipt}])).toContain('salvată local');expect((await f.property.get()).data()).toEqual(property);expect((await f.other.get()).data()).toEqual(other);expect(mocks.fetch).not.toHaveBeenCalled();});
 it.each(['published','paused','publishing','error','deleted'])('does not rewrite %s campaign',async status=>{const f=await fixture();await f.campaign.update({status});const before=(await f.campaign.get()).data();expect((await f.send()).status).toBe(409);expect((await f.campaign.get()).data()).toEqual(before);expect(mocks.fetch).not.toHaveBeenCalled();});
 it.each(['metaCampaignId','metaAdSetId','metaCreativeId','metaAdId','lastPublishAttemptAt','publishAttempts','publicationRun','publicationConfigurationHash','publicationApproval','deletedAt'])('rejects a nominal draft containing %s',async field=>{const f=await fixture();await f.campaign.update({[field]:field==='publishAttempts'?1:'123'});const before=(await f.campaign.get()).data();expect((await f.send()).status).toBe(409);expect((await f.campaign.get()).data()).toEqual(before);});
 it('rejects an unresolved publication journal even without saved IDs',async()=>{const f=await fixture();await f.campaign.collection('publicationSteps').doc('metaCampaignId').set({state:'pending'});expect((await f.send()).status).toBe(409);expect((await f.campaign.get()).data().headline).toBe('Înainte');});
 it.each(['role','agency','missing'])('checks fresh member %s',async kind=>{const f=await fixture();if(kind==='missing')await f.member.delete();else await f.member.update(kind==='role'?{role:'viewer'}:{agencyId:'other'});expect((await f.send()).status).toBe(403);expect((await f.campaign.get()).data().headline).toBe('Înainte');});
 it.each(['missing','deleted','foreign'])('rejects inaccessible property %s',async kind=>{const f=await fixture();if(kind==='missing')await f.property.delete();else await f.property.update(kind==='deleted'?{deletedAt:'now'}:{agencyId:'other'});expect((await f.send()).status).toBe(409);expect((await f.campaign.get()).data().headline).toBe('Înainte');});
 it('does not recreate a deleted campaign',async()=>{const f=await fixture();await f.campaign.delete();expect((await f.send()).status).toBe(404);expect((await f.campaign.get()).exists).toBe(false);});
 it('does not write a foreign campaign',async()=>{const f=await fixture();await f.campaign.update({agencyId:'foreign'});expect((await f.send()).status).toBe(403);expect((await f.campaign.get()).data().headline).toBe('Înainte');});
 it('preserves deletion racing a draft edit',async()=>{const f=await fixture();await Promise.allSettled([updateMetaCampaignDraft(f.agencyId,'selected',{headline:'Race'},f.actor),f.campaign.delete()]);expect((await f.campaign.get()).exists).toBe(false);});
 it.each([null,[],false])('rejects invalid body %j',async body=>{const f=await fixture();expect((await f.send(body)).status).toBe(400);expect((await f.campaign.get()).data().headline).toBe('Înainte');});
});
