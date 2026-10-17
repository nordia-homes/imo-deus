import { describe, it, expect } from 'vitest';
import { metaImageAction, metaImageApproved, metaImageRequest } from '../meta-image';
import { operationResult } from '../operation-result';
import { executionConfirmation } from '../execution-confirmation';
import { explicitlyRequestedSafeAction, requestAuthorizedCrmAction } from '../autonomy';
import { requireTool } from '../registry';
const action: any = { kind: 'existing_operation', operation: 'meta_campaign_optimize_image', params: { campaignId: 'campaign' }, query: {}, body: { proposalId: 'a'.repeat(64) } };
describe('approved Meta image action', () => {
    it('recognizes the original request without treating it as a concrete approval', () => { expect(metaImageRequest('Aplică doar optimizarea pe care am aprobat-o.')).toBe(true); expect(metaImageApproved(action, 'Aplică doar optimizarea pe care am aprobat-o.')).toBe(false); });
    it('requires exact proposal approval', () => { expect(metaImageAction(action)).toBe(true); expect(metaImageApproved(action, 'Confirm optimizarea Meta: ' + 'a'.repeat(64))).toBe(true); expect(metaImageApproved(action, 'Confirm optimizarea Meta: ' + 'b'.repeat(64))).toBe(false); });
    it.each(['status', 'imageUrl', 'budget', 'newCreativeId'])('rejects extra %s controls', key => { expect(metaImageAction({ ...action, body: { ...action.body, [key]: 'other' } })).toBe(false); });
    it('rejects negated or mixed requests', () => { expect(metaImageRequest('Nu schimba imaginea campaniei Meta')).toBe(false); expect(metaImageApproved(action, 'Nu confirm optimizarea Meta: ' + 'a'.repeat(64))).toBe(false); });
    it('keeps the operation admin-only', () => { expect(() => requireTool(action.operation, 'agent')).toThrow(); expect(() => requireTool(action.operation, 'admin')).not.toThrow(); });
    it('executes autonomously only after exact approval', () => { expect(requestAuthorizedCrmAction(action)).toBe(true); expect(explicitlyRequestedSafeAction(action, 'Confirm optimizarea Meta: ' + 'a'.repeat(64))).toBe(true); expect(explicitlyRequestedSafeAction(action, 'Aplică optimizarea')).toBe(false); });
    const raw = { campaignId: 'campaign', proposalId: 'a'.repeat(64), proof: { campaignId: '1', adSetId: '2', adId: '3', oldCreativeId: '4', newCreativeId: '5', accountId: '6', imageHash: 'new', checkedAt: '2026-10-17T12:00:00Z', adStatus: 'PAUSED', onlyImageChanged: true, deliveryConfirmed: false } };
    it('confirms the verified image change without delivery claims', () => { const result = operationResult(action.operation, raw); expect(result.completionSatisfied).toBe(true); expect(result.deliveryConfirmed).toBe(false); expect(executionConfirmation([{ result }])).toContain('Meta a confirmat schimbarea fotografiei'); });
    it.each(['checkedAt', 'newCreativeId', 'onlyImageChanged', 'adStatus', 'imageHash'])('does not confirm missing proof %s', key => { const changed: any = structuredClone(raw); delete changed.proof[key]; expect(operationResult(action.operation, changed).completionSatisfied).toBe(false); });
});

it('requires a resume action for a resume command and an exact target when specified',()=>{const resume={...action,body:{...action.body,resume:true}};expect(metaImageApproved(resume,'Reia optimizarea Meta.')).toBe(true);expect(metaImageApproved(action,'Reia optimizarea Meta.')).toBe(false);expect(metaImageApproved(resume,'Confirm optimizarea Meta: '+'a'.repeat(64))).toBe(false);expect(metaImageApproved(resume,'Reia optimizarea Meta: campaign/'+'a'.repeat(64))).toBe(true);expect(metaImageApproved(resume,'Reia optimizarea Meta: other/'+'a'.repeat(64))).toBe(false);expect(metaImageApproved(resume,'Reia optimizarea Meta: campaign/'+'b'.repeat(64))).toBe(false);expect(metaImageApproved(resume,'Nu relua optimizarea Meta')).toBe(false);});
it('rejects non-boolean resume instructions',()=>{expect(metaImageAction({...action,body:{...action.body,resume:'true'}})).toBe(false);expect(metaImageAction({...action,body:{...action.body,resume:false}})).toBe(false);});
