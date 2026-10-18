import { createHash } from 'node:crypto';
import { collectionFor, getResource, type AssistantContext } from './access';
import type { AssistantAction } from './contracts';
import { startContactConversation } from '@/lib/communications/server';
import { queueMessage } from '@/lib/communications/outbound';
import { prepareMessage } from './message-preparation';
import { recipientRevision } from '@/lib/communications/recipient-revision';
import { operationResult } from './operation-result';
import { executeAction } from './actions';
export async function sendClientPortal(ctx: AssistantContext, action: Extract<AssistantAction,{kind:'send_client_portal'}>, key:string):Promise<Record<string,any>> {
 await getResource(ctx,'contacts',action.contactId);
 const member=await ctx.adminDb.collection('users').doc(ctx.uid).get();
 if(member.data()?.agencyId!==ctx.agencyId||member.data()?.role!==ctx.role)throw Error('Acces revocat.');
 const ref=collectionFor(ctx,'assistantExecutions').doc(key);
 const hash=createHash('sha256').update(JSON.stringify([ctx.uid,action])).digest('hex');
 const saved=await ctx.adminDb.runTransaction(async tx=>{
   const prior=await tx.get(ref);
   if(prior.exists){if(prior.data()?.actionHash!==hash)throw Error('Cheia aparține altei cereri.');return prior.data()!;}
   tx.create(ref,{actorId:ctx.uid,actionHash:hash,status:'pending',createdAt:new Date().toISOString()});return {} as Record<string,any>;
 });
 if(saved.status==='completed'){if(saved.result.conversationId)await getResource(ctx,'conversations',saved.result.conversationId);return saved.result;}
 const receipt:any=await executeAction(ctx,{kind:'recommend_properties',contactId:action.contactId,propertyIds:action.propertyIds,deliveryBatch:true},key+'-portal');
 if(receipt.empty){const result={executionState:'succeeded',completionSatisfied:true,empty:true,contactId:action.contactId,note:'Nu există oferte noi; nu s-a trimis mesaj.'};await ref.update({status:'completed',result});return result;}
 const {conversationId}=await startContactConversation(ctx.adminDb,ctx,{contactId:action.contactId,connectionId:action.connectionId});
 const conversation=await getResource(ctx,'conversations',conversationId);
 if(conversation.contactId!==action.contactId)throw Error('Numărul este asociat altei persoane.');
 let prepared=saved.prepared;
 if(!prepared){
   const candidate=await prepareMessage(ctx,conversationId,{portalBatch:receipt.portalBatch,template:{...action.template,parameters:action.template.parameters.map(value=>value==='{{portal_url}}'?receipt.link:value)},expectedRecipientRevision:recipientRevision(conversation)});
   prepared=await ctx.adminDb.runTransaction(async tx=>{const fresh=await tx.get(ref);if(fresh.data()?.actionHash!==hash)throw Error('Cererea s-a schimbat.');if(fresh.data()?.prepared)return fresh.data()!.prepared;tx.update(ref,{prepared:candidate,conversationId});return candidate;});
 }
 const digest=createHash('sha256').update(ctx.agencyId+':'+key).digest('hex');
 const requestId=digest.slice(0,8)+'-'+digest.slice(8,12)+'-4'+digest.slice(13,16)+'-a'+digest.slice(17,20)+'-'+digest.slice(20,32);
 const queued=await queueMessage(ctx.adminDb,ctx,conversationId,{...prepared,requestId});
 const result={...operationResult('message_send',queued),conversationId,contactId:action.contactId,portalId:receipt.portalId,batchId:receipt.batchId,propertyIds:receipt.propertyIds,link:receipt.link,body:prepared};
 await ref.update({status:'completed',result,completedAt:new Date().toISOString()});
 return result;
}
