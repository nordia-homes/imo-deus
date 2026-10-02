import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
const writes = vi.hoisted(()=>({create:vi.fn()}));
vi.mock('@/firebase/admin',()=>({adminDb:{collection:()=>({doc:()=>({})}),runTransaction:async(fn:any)=>fn({get:async()=>({exists:false}),create:writes.create})}}));
vi.mock('@/lib/firebase-app-hosting',()=>({requireAgencyUserFromBearerToken:vi.fn()}));
import { receiveWebhook, verifyWebhook } from '../webhook-handler';
import { parseMetaSignedRequest } from '../meta-signed-request';
import { receiptCorrelation, correlatedJob } from '../receipt-correlation';
import { templateCreationSchema, bodyParameterCount, createWhatsAppTemplate } from '../templates';

describe('WhatsApp webhook and credential isolation',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('META_APP_ID','old');vi.stubEnv('META_APP_SECRET','old-secret');vi.stubEnv('META_WHATSAPP_APP_ID','new');vi.stubEnv('META_WHATSAPP_APP_SECRET','new-secret');vi.stubEnv('META_WEBHOOK_VERIFY_TOKEN','verify');vi.stubEnv('META_TOKEN_ENCRYPTION_KEY','synthetic-key');});
 afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
 const request=(raw:string,secret:string)=>new NextRequest('https://example.test/api/webhooks/whatsapp',{method:'POST',body:raw,headers:{'x-hub-signature-256':'sha256='+createHmac('sha256',secret).update(raw).digest('hex')}});
 it('accepts new WhatsApp secret and persists its app provenance',async()=>{const raw=JSON.stringify({object:'whatsapp_business_account',entry:[]});expect((await receiveWebhook(request(raw,'new-secret'),true)).status).toBe(200);expect(writes.create).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({sourceAppId:'new',channel:'whatsapp',status:'queued'}));});
 it('rejects the old shared secret on WhatsApp',async()=>{expect((await receiveWebhook(request(JSON.stringify({object:'whatsapp_business_account',entry:[]}),'old-secret'),true)).status).toBe(403);expect(writes.create).not.toHaveBeenCalled();});
 it('retains old secret for Facebook and rejects new secret there',async()=>{const raw=JSON.stringify({object:'page',entry:[]});expect((await receiveWebhook(request(raw,'old-secret'),false)).status).toBe(200);expect((await receiveWebhook(request(raw,'new-secret'),false)).status).toBe(403);});
 it('rejects wrong channel and malformed JSON even with valid signature',async()=>{expect((await receiveWebhook(request('{','new-secret'),true)).status).toBe(400);expect((await receiveWebhook(request(JSON.stringify({object:'page',entry:[]}),'new-secret'),true)).status).toBe(400);});
 it('limits payload bytes before signature processing',async()=>{expect((await receiveWebhook(request('a'.repeat(800001),'new-secret'),true)).status).toBe(413);});
 it('verifies the challenge only with the configured verification token',async()=>{expect(await (await verifyWebhook(new NextRequest('https://example.test/?hub.mode=subscribe&hub.verify_token=verify&hub.challenge=123'))).text()).toBe('123');expect((await verifyWebhook(new NextRequest('https://example.test/?hub.mode=subscribe&hub.verify_token=wrong'))).status).toBe(403);});
 function signed(secret:string,algorithm='HMAC-SHA256'){const value=Buffer.from(JSON.stringify({algorithm,user_id:'123'})).toString('base64url');return createHmac('sha256',secret).update(value).digest('base64url')+'.'+value;}
 it('identifies the app signing deauthorization without cross-app fallback',()=>{expect(parseMetaSignedRequest(signed('new-secret'))).toEqual({appId:'new',whatsapp:true,userId:'123'});expect(parseMetaSignedRequest(signed('old-secret'))?.whatsapp).toBe(false);expect(parseMetaSignedRequest(signed('foreign'))).toBeNull();expect(parseMetaSignedRequest(signed('new-secret','none'))).toBeNull();});
 it('rejects receipt correlation tampering and another connection',()=>{const id='a'.repeat(64);const value=receiptCorrelation(id,'conn');expect(correlatedJob(value,'conn')).toBe(id);expect(correlatedJob(value,'other')).toBeNull();expect(correlatedJob(value.replace(id,'b'.repeat(64)),'conn')).toBeNull();expect(correlatedJob(id,'conn')).toBeNull();});
 it('rejects named and non-contiguous template parameters',()=>{const template:any={components:[{type:'BODY',text:'{{first_name}}'}]};expect(bodyParameterCount(template)).toBeNull();template.components[0].text='{{1}} {{3}}';expect(bodyParameterCount(template)).toBeNull();template.components[0].text='{{1}} {{2}} {{1}}';expect(bodyParameterCount(template)).toBe(2);});
 it('validates minimal template creation and sends only supported fields',async()=>{const fetcher=vi.fn(async(_url:any,_init:any)=>({ok:true,json:async()=>({id:'123',status:'PENDING'})}));vi.stubGlobal('fetch',fetcher);const input={name:'pilot_confirmare',language:'ro',category:'UTILITY',body:'Confirmarea solicitată este disponibilă.'};expect(templateCreationSchema.safeParse({...input,body:'Salut {{1}}'}).success).toBe(false);expect(templateCreationSchema.safeParse({...input,name:'Bad Name'}).success).toBe(false);await expect(createWhatsAppTemplate('10','token',input)).resolves.toMatchObject({id:'123',status:'PENDING'});expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({name:input.name,language:'ro',category:'UTILITY',components:[{type:'BODY',text:input.body}]});});
});
