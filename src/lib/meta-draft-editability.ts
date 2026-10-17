const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'?value as Record<string,unknown>:{};
export function isEditableLocalMetaDraft(value:unknown):boolean{
 const row=record(value);
 return !row.deletedAt&&['draft','ready'].includes(String(row.status))&&!['metaCampaignId','metaAdSetId','metaCreativeId','metaAdId','lastPublishAttemptAt','publishAttempts','publicationRun','publicationConfigurationHash','publicationApproval'].some(key=>row[key]);
}
export function canResumeMetaPublication(value:unknown,now=Date.now()):boolean{
 const row=record(value);if(row.deletedAt||!['error','publishing'].includes(String(row.status)))return false;
 if(!row.publicationRun)return true;
 const expires=record(row.publicationRun).expiresAt;
 return typeof expires==='string'&&Number.isFinite(Date.parse(expires))&&Date.parse(expires)<=now;
}
