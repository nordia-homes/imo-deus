import { getResource,type AssistantContext } from './access';
import { humanReply } from './human-reply';
import type { AccessReference } from './contracts';
export async function humanReplyForActor(ctx:AssistantContext,text:string,refs:AccessReference[]=[],data:unknown[]=[]){
 const relevant=refs.filter((ref,index)=>text.includes(ref.id)&&refs.findIndex(other=>other.resource===ref.resource&&other.id===ref.id)===index);
 const records=await Promise.all(relevant.map(async ref=>{
  try{return await getResource(ctx,ref.resource,ref.id);}catch{return {id:ref.id};}
 }));
 return humanReply(text,[...data,...records]);
}
