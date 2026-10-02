import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
vi.mock('@/lib/firebase-app-hosting', () => ({ requireAgencyUserFromBearerToken: vi.fn() }));
import { startWhatsAppSignup, finishWhatsApp, preserveVerifiedConnection, connectionToken } from '../meta';
import { whatsappAccess } from '../whatsapp-config';
import { stableId, seal } from '../crypto';
import type { Connection } from '../model';

const actor = {uid:'pilot',agencyId:'agency',role:'admin'};
function memoryDb() {
 const values = new Map<string,any>();
 const snap = (path:string):any => ({exists:values.has(path),data:()=>values.get(path),ref:doc(path)});
 const doc = (path:string):any => ({path,get:async()=>snap(path),collection:(name:string)=>collection(path+'/'+name),create:async(v:any)=>values.set(path,v),update:async(v:any)=>values.set(path,{...values.get(path),...v})});
 const collection = (path:string):any => ({doc:(id:string)=>doc(path+'/'+id)});
 const db = {collection,runTransaction:async(fn:any)=>{const writes:Array<()=>void>=[];const result=await fn({get:async(ref:any)=>{if(writes.length)throw new Error('Read after write');return snap(ref.path)},set:(ref:any,v:any)=>writes.push(()=>values.set(ref.path,v)),update:(ref:any,v:any)=>writes.push(()=>values.set(ref.path,{...values.get(ref.path),...v}))});writes.forEach(w=>w());return result;}};
 return {db:db as unknown as Firestore,values};
}
const base:Connection={id:'conn',agencyId:'agency',appId:'new',channel:'whatsapp',externalId:'20',name:'pilot',status:'connected',updatedAt:'',capabilities:{receive:{status:'configuration_required',reason:''}}};
describe('WhatsApp isolated signup',()=>{
 beforeEach(()=>{vi.stubEnv('META_APP_ID','old');vi.stubEnv('META_APP_SECRET','old-secret');vi.stubEnv('META_WHATSAPP_APP_ID','new');vi.stubEnv('META_WHATSAPP_APP_SECRET','new-secret');vi.stubEnv('META_WHATSAPP_CONFIG_ID','config');vi.stubEnv('META_TOKEN_ENCRYPTION_KEY','test-encryption');vi.stubEnv('WHATSAPP_ONBOARDING_MODE','test');vi.stubEnv('WHATSAPP_TEST_USER_IDS','pilot');vi.stubEnv('WHATSAPP_TEST_AGENCY_IDS','');});
 afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
 it('never falls back to the general Meta secret',()=>{vi.stubEnv('META_WHATSAPP_APP_SECRET','');expect(whatsappAccess(actor).whatsappReady).toBe(false);});
 it('limits test access to allowlisted administrators',()=>{expect(whatsappAccess(actor).whatsappReady).toBe(true);expect(whatsappAccess({...actor,uid:'other'}).whatsappReady).toBe(false);expect(whatsappAccess({...actor,role:'agent'}).whatsappReady).toBe(false);vi.stubEnv('WHATSAPP_TEST_AGENCY_IDS','different');expect(whatsappAccess(actor).whatsappReady).toBe(false);});
 it('requires explicit billing and approval gates in production',()=>{vi.stubEnv('WHATSAPP_ONBOARDING_MODE','production');vi.stubEnv('WHATSAPP_META_APPROVALS_READY','false');vi.stubEnv('WHATSAPP_DIRECT_BILLING_READY','true');expect(whatsappAccess(actor).whatsappReady).toBe(false);vi.stubEnv('WHATSAPP_META_APPROVALS_READY','true');expect(whatsappAccess(actor).whatsappReady).toBe(true);});
 it('does not carry verified receive capability between apps',()=>{expect(preserveVerifiedConnection(base,{...base,appId:'old',capabilities:{receive:{status:'active',reason:'verified'}}}).capabilities.receive?.status).toBe('configuration_required');});
 async function setup(options:{currency?:string|null,wabaId?:string,status?:string,biz?:boolean,platform?:string,app?:string,scopes?:string[],subscribe?:boolean,paginate?:boolean}={}) {
  const store=memoryDb(); const {signupState}=await startWhatsAppSignup(store.db,actor,{mode:options.biz?'coexistence':'cloud'});
  const mutations:string[]=[];
  const fetcher=vi.fn(async(input:any,init:any)=>{const url=new URL(String(input));if(init.method==='POST')mutations.push(url.pathname);
   let value:any;
   if(url.pathname.endsWith('/oauth/access_token')) {expect(url.searchParams.get('client_id')).toBe('new');expect(url.searchParams.get('client_secret')).toBe('new-secret');value={access_token:'token'};}
   else if(url.pathname.endsWith('/debug_token'))value={data:{is_valid:true,app_id:options.app||'new',scopes:options.scopes||['whatsapp_business_management','whatsapp_business_messaging']}};
   else if(url.pathname.endsWith('/phone_numbers'))value=options.paginate&&!url.searchParams.has('after')?{data:[],paging:{next:'https://untrusted.invalid/next',cursors:{after:'second'}}}:{data:[{id:'20',status:options.status||'CONNECTED',is_on_biz_app:Boolean(options.biz),platform_type:options.platform||'CLOUD_API',verified_name:'Pilot',display_phone_number:'123'}]};
   else if(url.pathname.endsWith('/10'))value={id:options.wabaId ?? '10',currency:options.currency === undefined ? 'EUR' : options.currency};
   else value={success:options.subscribe!==false};
   return {ok:true,status:200,json:async()=>value};
  });vi.stubGlobal('fetch',fetcher);
  const input={code:'code',signupState,wabaId:'10',phoneNumberId:'20',mode:options.biz?'coexistence':'cloud',pin:'123456'};
  return {...store,input,fetcher,mutations};
 }
 it('connects a registered phone without registering again, including pagination',async()=>{const s=await setup({paginate:true});await finishWhatsApp(s.db,actor,s.input);expect(s.mutations).toEqual(['/v23.0/10/subscribed_apps']);expect([...s.values.values()].some(v=>v.appId==='new'&&v.channel==='whatsapp')).toBe(true);});
 it.each([null, '', 'eur', 'INVALID'])('connects with missing or invalid currency %j but blocks sending',async(currency)=>{const s=await setup({currency,status:'PENDING'});await finishWhatsApp(s.db,actor,s.input);const row=s.values.get('agencies/agency/channelConnections/'+stableId('agency','whatsapp','20'));expect(row.status).toBe('connected');expect(row).not.toHaveProperty('currency');expect(row.capabilities.send.status).toBe('configuration_required');await expect(connectionToken(s.db,actor,row.id,'send')).rejects.toThrow();await expect(connectionToken(s.db,actor,row.id,'media')).resolves.toMatchObject({token:'token'});expect(s.mutations).toEqual(['/v23.0/20/register','/v23.0/10/subscribed_apps']);});
 it('rejects a mismatched WABA even when billing is missing',async()=>{const s=await setup({wabaId:'99',currency:null});await expect(finishWhatsApp(s.db,actor,s.input)).rejects.toThrow('autorizării');expect(s.mutations).toEqual([]);});
 it('enables the send capability only with verified currency',async()=>{const s=await setup({currency:'USD'});await finishWhatsApp(s.db,actor,s.input);const row=s.values.get('agencies/agency/channelConnections/'+stableId('agency','whatsapp','20'));expect(row.currency).toBe('USD');expect(row.capabilities.send.status).toBe('active');});
 it('registers an unregistered dedicated phone before subscribing',async()=>{const s=await setup({status:'UNREGISTERED'});await finishWhatsApp(s.db,actor,s.input);expect(s.mutations).toEqual(['/v23.0/20/register','/v23.0/10/subscribed_apps']);});
 it('does not register a Business App phone in coexistence',async()=>{const s=await setup({biz:true});await finishWhatsApp(s.db,actor,s.input);expect(s.mutations).toEqual(['/v23.0/10/subscribed_apps']);});
 it.each([{app:'old'},{scopes:['whatsapp_business_messaging']},{platform:'ON_PREMISE'},{status:'UNKNOWN'}])('rejects unsafe signup before provider mutations: %j',async(options)=>{const s=await setup(options);await expect(finishWhatsApp(s.db,actor,s.input)).rejects.toThrow();expect(s.mutations).toEqual([]);});
 it('reserves ownership before any external mutation',async()=>{const s=await setup({status:'UNREGISTERED'});s.values.set('communicationAccountOwners/'+stableId('whatsapp','20'),{agencyId:'other'});await expect(finishWhatsApp(s.db,actor,s.input)).rejects.toThrow('altă agenție');expect(s.mutations).toEqual([]);});
 it('rejects false subscription response without creating a connection',async()=>{const s=await setup({subscribe:false});await expect(finishWhatsApp(s.db,actor,s.input)).rejects.toThrow('abonarea');expect([...s.values.keys()].some(k=>k.includes('/channelConnections/'))).toBe(false);});
 it('rejects replay before token exchange',async()=>{const s=await setup();await finishWhatsApp(s.db,actor,s.input);s.fetcher.mockClear();await expect(finishWhatsApp(s.db,actor,s.input)).rejects.toThrow('expirat');expect(s.fetcher).not.toHaveBeenCalled();});
 it.each(['appId','configId','uid','agencyId','mode'])('binds state to %s',async(field)=>{const s=await setup();s.values.get('communicationWhatsAppSignupStates/'+stableId(s.input.signupState))[field]='different';await expect(finishWhatsApp(s.db,actor,s.input)).rejects.toThrow('expirat');expect(s.fetcher).not.toHaveBeenCalled();});
 it('rejects expiry at exactly now',async()=>{const s=await setup();s.values.get('communicationWhatsAppSignupStates/'+stableId(s.input.signupState)).expiresAt=Date.now();await expect(finishWhatsApp(s.db,actor,s.input)).rejects.toThrow('expirat');});
 it('preflights encryption before consuming state or calling Meta',async()=>{const s=await setup();vi.stubEnv('META_TOKEN_ENCRYPTION_KEY','');vi.stubEnv('TOKEN_ENCRYPTION_KEY','');await expect(finishWhatsApp(s.db,actor,s.input)).rejects.toThrow('criptare');expect(s.fetcher).not.toHaveBeenCalled();expect(s.values.get('communicationWhatsAppSignupStates/'+stableId(s.input.signupState)).consumed).toBe(false);});
 it('allows inbound media when sending is unavailable',async()=>{const s=memoryDb();s.values.set('agencies/agency/channelConnections/conn',{...base,capabilities:{send:{status:'unavailable'}}});s.values.set('communicationSecrets/conn',{agencyId:'agency',token:seal('valid-token')});await expect(connectionToken(s.db,actor,'conn','media')).resolves.toMatchObject({token:'valid-token'});await expect(connectionToken(s.db,actor,'conn','send')).rejects.toThrow();});
});
