import { describe, it, expect, vi } from 'vitest';
import { verifyMetaImageReplacement } from '@/lib/meta-image-optimization';
const approval = { campaignId: '1', adSetId: '2', adId: '3', oldCreativeId: '4', newCreativeId: '5', accountId: 'act_6', imageHash: 'new' };
function fixture() {
    const story = (image_hash: string) => ({ page_id: '7', link_data: { message: 'Text identic', name: 'Titlu', link: 'https://example.invalid', image_hash, call_to_action: { type: 'LEARN_MORE', value: { link: 'https://example.invalid' } } } });
    const objects: Record<string, any> = { '1': { id: '1', account_id: '6', status: 'PAUSED', daily_budget: '5000' }, '2': { id: '2', account_id: '6', campaign_id: '1', status: 'PAUSED', targeting: { geo_locations: { countries: ['RO'] } } }, '3': { id: '3', account_id: '6', campaign_id: '1', adset_id: '2', status: 'PAUSED', creative: { id: '4' } }, '4': { id: '4', account_id: '6', object_story_spec: story('old') }, '5': { id: '5', account_id: '6', object_story_spec: story('new') } };
    const io = { read: vi.fn(async (id: string) => structuredClone(objects[id])), assertCurrent: vi.fn(async () => { }), claim: vi.fn(async () => true), replace: vi.fn(async () => { objects['3'].creative.id = '5'; return { success: true }; }) };
    return { objects, io, run: () => verifyMetaImageReplacement(approval, io) };
}
describe('verified single image replacement', () => {
    it('confirms the exact paused hierarchy after replacement', async () => { const f = fixture(); expect(await f.run()).toMatchObject({ newCreativeId: '5', onlyImageChanged: true, adStatus: 'PAUSED', deliveryConfirmed: false }); expect(f.io.replace).toHaveBeenCalledTimes(1); });
    it('recovers a lost POST response through readback', async () => { const f = fixture(); f.io.replace.mockImplementation(async () => { f.objects['3'].creative.id = '5'; throw Error('lost'); }); expect((await f.run()).onlyImageChanged).toBe(true); expect(f.io.replace).toHaveBeenCalledTimes(1); });
    it('does not trust success without changed binding', async () => { const f = fixture(); f.io.replace.mockResolvedValue({ success: true }); await expect(f.run()).rejects.toThrow('verificată'); });
    it('does not redispatch a claimed but uncertain operation', async () => { const f = fixture(); f.io.claim.mockResolvedValue(false); await expect(f.run()).rejects.toThrow(); expect(f.io.replace).not.toHaveBeenCalled(); });
    it('recognizes an already applied change without another POST', async () => { const f = fixture(); f.objects['3'].creative.id = '5'; expect((await f.run()).onlyImageChanged).toBe(true); expect(f.io.replace).not.toHaveBeenCalled(); });
    it.each(['1', '2', '3', '4', '5'])('rejects wrong account on %s', async (id) => { const f = fixture(); f.objects[id].account_id = '999'; await expect(f.run()).rejects.toThrow(); expect(f.io.replace).not.toHaveBeenCalled(); });
    it.each(['1', '2', '3'])('requires pause at level %s', async (id) => { const f = fixture(); f.objects[id].status = 'ACTIVE'; await expect(f.run()).rejects.toThrow(); expect(f.io.replace).not.toHaveBeenCalled(); });
    it.each(['message', 'link', 'name', 'call_to_action'])('rejects an unapproved change to %s', async (field) => { const f = fixture(); f.objects['5'].object_story_spec.link_data[field] = 'changed'; await expect(f.run()).rejects.toThrow(); expect(f.io.replace).not.toHaveBeenCalled(); });
    it('rejects changed URL tracking', async () => { const f = fixture(); f.objects['5'].url_tags = 'utm_source=other'; await expect(f.run()).rejects.toThrow(); expect(f.io.replace).not.toHaveBeenCalled(); });
    it('rejects a different page', async () => { const f = fixture(); f.objects['5'].object_story_spec.page_id = '999'; await expect(f.run()).rejects.toThrow(); });
    it('rejects dynamic creative', async () => { const f = fixture(); f.objects['5'].asset_feed_spec = { images: [{}] }; await expect(f.run()).rejects.toThrow(); });
    it('rejects an unapproved image hash', async () => { const f = fixture(); f.objects['5'].object_story_spec.link_data.image_hash = 'different'; await expect(f.run()).rejects.toThrow(); });
    it('does not overwrite a separately changed creative', async () => { const f = fixture(); f.objects['3'].creative.id = '999'; await expect(f.run()).rejects.toThrow(); expect(f.io.replace).not.toHaveBeenCalled(); });
    it('does not certify a concurrent budget change', async () => { const f = fixture(); f.io.replace.mockImplementation(async () => { f.objects['3'].creative.id = '5'; f.objects['1'].daily_budget = '9000'; return { success: true }; }); await expect(f.run()).rejects.toThrow(); });
    it('honors revocation before dispatch', async () => { const f = fixture(); f.io.assertCurrent.mockRejectedValue(Error('revoked')); await expect(f.run()).rejects.toThrow('revoked'); expect(f.io.replace).not.toHaveBeenCalled(); });
});
