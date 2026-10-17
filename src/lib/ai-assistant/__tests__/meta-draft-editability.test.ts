import {expect,it} from 'vitest';
import {isEditableLocalMetaDraft,canResumeMetaPublication} from '@/lib/meta-draft-editability';
it.each(['draft','ready'])('allows local %s edits',status=>expect(isEditableLocalMetaDraft({status})).toBe(true));
it.each(['published','paused','publishing','error','deleted'])('prevents local edit of %s',status=>expect(isEditableLocalMetaDraft({status})).toBe(false));
it.each(['metaCampaignId','metaAdSetId','metaCreativeId','metaAdId','lastPublishAttemptAt','publishAttempts','publicationRun','publicationConfigurationHash','publicationApproval','deletedAt'])('locks nominal draft with %s',field=>expect(isEditableLocalMetaDraft({status:'draft',[field]:'present'})).toBe(false));
it.each(['published','paused','deleted','draft'])('does not offer resume for %s',status=>expect(canResumeMetaPublication({status})).toBe(false));
it('allows recovery with persisted configuration only after the lease expires',()=>{const now=Date.parse('2026-10-17T12:00:00Z');expect(canResumeMetaPublication({status:'error'},now)).toBe(true);expect(canResumeMetaPublication({status:'publishing',publicationRun:{expiresAt:'2026-10-17T11:59:59Z'}},now)).toBe(true);expect(canResumeMetaPublication({status:'error',publicationRun:{expiresAt:'2026-10-17T12:01:00Z'}},now)).toBe(false);expect(canResumeMetaPublication({status:'error',publicationRun:{expiresAt:'bad'}},now)).toBe(false);});
