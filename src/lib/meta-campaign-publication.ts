export type MetaPublicationIds = { campaignId: string; adSetId: string; creativeId: string; adId: string; accountId: string };
export type MetaPublicationProof = MetaPublicationIds & { campaignStatus: 'PAUSED'; adSetStatus: 'PAUSED'; adStatus: 'PAUSED'; campaignEffectiveStatus: string; adSetEffectiveStatus: string; adEffectiveStatus: string; checkedAt: string };
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
/** Verify persisted provider objects and their relationships, never infer delivery or approval. */
export async function verifyMetaPublication(ids: MetaPublicationIds, read: (id: string, fields: string) => Promise<unknown>): Promise<MetaPublicationProof> {
 const accountId = ids.accountId.replace(/^act_/, '');
 if (new Set([ids.campaignId,ids.adSetId,ids.creativeId,ids.adId]).size !== 4) throw new Error('Obiectele Meta trebuie să aibă identificatori distincți.');
 if (![ids.campaignId,ids.adSetId,ids.creativeId,ids.adId,accountId].every(id => /^\d+$/.test(id))) throw new Error('Identificatori Meta incompleți sau invalizi.');
 const [campaign,adSet,creative,ad] = (await Promise.all([
  read(ids.campaignId,'id,account_id,status,effective_status'),
  read(ids.adSetId,'id,account_id,campaign_id,status,effective_status'),
  read(ids.creativeId,'id,account_id'),
  read(ids.adId,'id,account_id,campaign_id,adset_id,creative{id},status,effective_status'),
 ])).map(record);
 for (const [row,id] of [[campaign,ids.campaignId],[adSet,ids.adSetId],[creative,ids.creativeId],[ad,ids.adId]] as const) {
  if (row.id !== id || row.account_id !== accountId) throw new Error('Meta nu a confirmat obiectele în contul selectat.');
 }
 if (adSet.campaign_id !== ids.campaignId || ad.campaign_id !== ids.campaignId || ad.adset_id !== ids.adSetId || record(ad.creative).id !== ids.creativeId) throw new Error('Asocierile dintre obiectele Meta nu corespund campaniei.');
 if (campaign.status !== 'PAUSED' || campaign.effective_status !== 'PAUSED' || adSet.status !== 'PAUSED' || !['PAUSED','CAMPAIGN_PAUSED'].includes(String(adSet.effective_status)) || ad.status !== 'PAUSED' || !['PAUSED','CAMPAIGN_PAUSED','ADSET_PAUSED','PENDING_REVIEW','IN_PROCESS'].includes(String(ad.effective_status))) throw new Error('Meta nu a confirmat încă toate obiectele create în pauză. Verifică starea înainte de o nouă publicare.');
 return {...ids,accountId,campaignStatus:'PAUSED',adSetStatus:'PAUSED',adStatus:'PAUSED',campaignEffectiveStatus:String(campaign.effective_status),adSetEffectiveStatus:String(adSet.effective_status),adEffectiveStatus:String(ad.effective_status),checkedAt:new Date().toISOString()};
}
export function hasMetaPublicationProof(campaign: Record<string, unknown> | undefined): boolean {
 const proof=record(campaign?.providerPublicationVerification);
 return campaign?.status === 'published' && typeof campaign.id === 'string' && !!campaign.id &&
  [['campaignId','metaCampaignId'],['adSetId','metaAdSetId'],['creativeId','metaCreativeId'],['adId','metaAdId']].every(([key,field])=>typeof campaign[field]==='string' && /^\d+$/.test(campaign[field] as string) && proof[key]===campaign[field]) &&
  typeof proof.accountId==='string' && /^\d+$/.test(proof.accountId) && proof.campaignStatus==='PAUSED' && proof.adSetStatus==='PAUSED' && proof.adStatus==='PAUSED' && proof.campaignEffectiveStatus==='PAUSED' && ['PAUSED','CAMPAIGN_PAUSED'].includes(String(proof.adSetEffectiveStatus)) && ['PAUSED','CAMPAIGN_PAUSED','ADSET_PAUSED','PENDING_REVIEW','IN_PROCESS'].includes(String(proof.adEffectiveStatus)) && typeof proof.checkedAt==='string' && Number.isFinite(Date.parse(proof.checkedAt)) && proof.checkedAt===campaign.updatedAt;
}

export async function observeMetaPublication(ids: MetaPublicationIds, read: (id: string, fields: string) => Promise<unknown>) {
 const accountId = ids.accountId.replace(/^act_/, '');
 if (new Set([ids.campaignId,ids.adSetId,ids.creativeId,ids.adId]).size !== 4) throw new Error('Obiectele Meta trebuie să aibă identificatori distincți.');
 if (![ids.campaignId,ids.adSetId,ids.creativeId,ids.adId,accountId].every(id => /^\d+$/.test(id))) throw new Error('Identificatori Meta incompleți sau invalizi.');
 const [campaign,adSet,creative,ad] = (await Promise.all([
  read(ids.campaignId,'id,account_id,status,effective_status'),
  read(ids.adSetId,'id,account_id,campaign_id,status,effective_status'),
  read(ids.creativeId,'id,account_id'),
  read(ids.adId,'id,account_id,campaign_id,adset_id,creative{id},status,effective_status'),
 ])).map(record);
 for (const [row,id] of [[campaign,ids.campaignId],[adSet,ids.adSetId],[creative,ids.creativeId],[ad,ids.adId]] as const) {
  if (row.id !== id || row.account_id !== accountId) throw new Error('Meta nu a confirmat obiectele în contul selectat.');
 }
 if (adSet.campaign_id !== ids.campaignId || ad.campaign_id !== ids.campaignId || ad.adset_id !== ids.adSetId || record(ad.creative).id !== ids.creativeId) throw new Error('Asocierile dintre obiectele Meta nu corespund campaniei.');
 const configured=['ACTIVE','PAUSED','ARCHIVED','DELETED'];
 const common=[...configured,'IN_PROCESS','WITH_ISSUES'];
 const states=[
  {kind:'campaign',id:ids.campaignId,row:campaign,allowed:common},
  {kind:'adSet',id:ids.adSetId,row:adSet,allowed:[...common,'CAMPAIGN_PAUSED']},
  {kind:'ad',id:ids.adId,row:ad,allowed:[...common,'CAMPAIGN_PAUSED','ADSET_PAUSED','PENDING_REVIEW','DISAPPROVED','PENDING_BILLING_INFO','PREAPPROVED']},
 ].map(({kind,id,row,allowed})=>{
  if(!configured.includes(String(row.status))||!allowed.includes(String(row.effective_status)))throw new Error('Meta a returnat o stare necunoscută.');
  return {kind,id,status:String(row.status),effectiveStatus:String(row.effective_status)};
 });
 return {states,creativeId:ids.creativeId,checkedAt:new Date().toISOString()};
}
