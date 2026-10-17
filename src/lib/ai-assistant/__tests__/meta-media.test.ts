import { expect, it } from 'vitest';
import { metaDraftAction, requestedMetaDraftAction } from '../meta-draft';
import { metaDraftRemovalAction, localMetaDraft, metaMediaExecutionPrompt } from '../meta-media';
const action={kind:'existing_operation',operation:'meta_campaign_update',params:{},query:{},body:{jarvisDraft:true,propertyId:'p',propertyRevision:'a'.repeat(64),campaignId:'c',campaignRevision:'b'.repeat(64),patch:{selectedImageUrl:'https://example.invalid/photo.jpg'}}} as any;
it('authorizes precisely one selected photo and no additional budget change',()=>{
 expect(metaDraftAction(action)).toBe(true);expect(requestedMetaDraftAction(action,'Folosește materialul media pe care l-am selectat.')).toBe(true);
 expect(requestedMetaDraftAction({...action,body:{...action.body,patch:{...action.body.patch,budgetAmount:500}}},'Folosește materialul media pe care l-am selectat.')).toBe(false);
 expect(metaDraftAction({...action,body:{...action.body,patch:{...action.body.patch,mainPhoto:true}}})).toBe(false);
 expect(metaDraftRemovalAction(action)).toBe(false);
});
it.each(['metaCampaignId','metaAdSetId','metaAdId','metaCreativeId'])('rejects remote object %s for local removal',field=>{expect(localMetaDraft({agencyId:'a',status:'draft',[field]:'remote'},'a')).toBe(false);});
it('does not accept bare selections without saved context',()=>{expect(metaMediaExecutionPrompt('Material Meta: 1',[])).toBe('Material Meta: 1');});
it('accepts only purely local draft and ready records',()=>{expect(localMetaDraft({agencyId:'a',status:'ready'},'a')).toBe(true);expect(localMetaDraft({agencyId:'b',status:'draft'},'a')).toBe(false);expect(localMetaDraft({agencyId:'a',status:'published'},'a')).toBe(false);});
