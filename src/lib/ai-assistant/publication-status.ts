import { getResource, type AssistantContext } from './access';
import type { Property } from '@/lib/types';
export async function propertyPublicationStatus(ctx:AssistantContext, input:{propertyId:string;portal:'imobiliare'|'storia'|'romimo';desired:'published'|'unpublished'}) {
 const property=await getResource(ctx,'properties',input.propertyId);
 let result: {state?:unknown;remoteId?:unknown;remoteUrl?:unknown};
 if(input.portal==='imobiliare'){const {inspectImobiliarePublication}=await import('@/lib/imobiliare');result=await inspectImobiliarePublication(ctx.agencyId,property as Property);}
 else if(input.portal==='storia'){const {inspectStoriaPublication}=await import('@/lib/storia');result=await inspectStoriaPublication(ctx.agencyId,property as Property);}
 else {const {checkOrUnpublish}=await import('@/lib/romimo/service');result=await checkOrUnpublish({db:ctx.adminDb,agencyId:ctx.agencyId,uid:ctx.uid},input.propertyId,false);}
 const fresh=await getResource(ctx,'properties',input.propertyId);
 if(JSON.stringify(property.portalProfiles?.[input.portal] || null)!==JSON.stringify(fresh.portalProfiles?.[input.portal] || null)&&input.portal!=='romimo')throw Error('Identificatorul anunțului s-a schimbat în timpul verificării.');
 const state=String(result.state || 'unknown');
 const published=input.portal==='imobiliare'?state==='online':input.portal==='storia'?state==='active':state==='published';
 const withdrawn=input.portal==='imobiliare'?state==='draft':input.portal==='storia'?state==='removed_by_user':state==='unpublished';
 const complete=input.desired==='published'?published:withdrawn;
 return {propertyId:input.propertyId,title:property.title || '',portal:input.portal,businessStatus:state,executionState:complete?'succeeded':'unknown',completionSatisfied:complete,verifiedAt:new Date().toISOString(),evidenceSource:'current_provider_state',watchable:!complete};
}
