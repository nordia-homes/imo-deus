export type MetaImageApproval = {
    campaignId: string;
    adSetId: string;
    adId: string;
    oldCreativeId: string;
    newCreativeId: string;
    accountId: string;
    imageHash: string;
};
const record = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
export function canonicalMetaValue(value: unknown): string {
    if (Array.isArray(value))
        return '[' + value.map(canonicalMetaValue).join(',') + ']';
    if (value && typeof value === 'object')
        return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => JSON.stringify(k) + ':' + canonicalMetaValue(v)).join(',') + '}';
    return JSON.stringify(value) ?? 'null';
}
export const campaignFields = 'id,account_id,status,objective,daily_budget,lifetime_budget';
export const adSetFields = 'id,account_id,campaign_id,status,daily_budget,lifetime_budget,targeting,optimization_goal,billing_event,start_time,end_time';
export const adFields = 'id,account_id,campaign_id,adset_id,status,creative{id}';
export const creativeFields = 'id,account_id,object_story_spec,asset_feed_spec,degrees_of_freedom_spec,url_tags';
function identity(row: Record<string, unknown>, id: string, account: string) { if (row.id !== id || row.account_id !== account)
    throw Error('Identitatea obiectului Meta nu corespunde aprobării.'); }
export function storyWithoutImage(value: unknown) {
    const creative = record(value), story = record(creative.object_story_spec), link = record(story.link_data);
    if (!story.page_id || !link.image_hash || !link.link || story.video_data || link.child_attachments || link.picture || Object.keys(record(creative.asset_feed_spec)).length || Object.keys(record(creative.degrees_of_freedom_spec)).length)
        throw Error('Optimizarea necesită un material simplu cu o singură imagine.');
    const { image_hash: imageHash, ...rest } = link;
    return { imageHash, rest: { story: { ...story, link_data: rest }, urlTags: creative.url_tags ?? null } };
}
/** Only a confirmed creative binding proves the update; configured PAUSED must stay unchanged. */
export async function verifyMetaImageReplacement(approval: MetaImageApproval, io: {
    read: (id: string, fields: string) => Promise<unknown>;
    assertCurrent: () => Promise<void>;
    claim: () => Promise<boolean>;
    replace: () => Promise<unknown>;
}) {
    const a = { ...approval, accountId: approval.accountId.replace(/^act_/, '') };
    if (![a.campaignId, a.adSetId, a.adId, a.oldCreativeId, a.newCreativeId, a.accountId].every(id => /^\d+$/.test(id)) || new Set([a.campaignId, a.adSetId, a.adId, a.oldCreativeId, a.newCreativeId]).size !== 5 || !a.imageHash)
        throw Error('Aprobare Meta invalidă.');
    const readHierarchy = async () => {
        const [campaign, adSet, ad] = await Promise.all([io.read(a.campaignId, campaignFields), io.read(a.adSetId, adSetFields), io.read(a.adId, adFields)]);
        const c = record(campaign), s = record(adSet), d = record(ad);
        identity(c, a.campaignId, a.accountId);
        identity(s, a.adSetId, a.accountId);
        identity(d, a.adId, a.accountId);
        if (s.campaign_id !== a.campaignId || d.campaign_id !== a.campaignId || d.adset_id !== a.adSetId || [c, s, d].some(row => row.status !== 'PAUSED'))
            throw Error('Asocierile sau pauza obiectelor Meta nu corespund aprobării.');
        const creativeId = record(d.creative).id;
        if (creativeId !== a.oldCreativeId && creativeId !== a.newCreativeId)
            throw Error('Reclama a fost modificată separat la Meta.');
        const { creative: _creative, ...adRest } = d;
        return { campaign: c, adSet: s, ad: adRest, creativeId };
    };
    const readCreatives = async () => {
        const [oldCreative, newCreative] = (await Promise.all([io.read(a.oldCreativeId, creativeFields), io.read(a.newCreativeId, creativeFields)])).map(record);
        identity(oldCreative, a.oldCreativeId, a.accountId);
        identity(newCreative, a.newCreativeId, a.accountId);
        const before = storyWithoutImage(oldCreative), after = storyWithoutImage(newCreative);
        if (after.imageHash !== a.imageHash || after.imageHash === before.imageHash || canonicalMetaValue(before.rest) !== canonicalMetaValue(after.rest))
            throw Error('Materialul propus schimbă altceva decât imaginea aprobată.');
        return canonicalMetaValue(after);
    };
    await io.assertCurrent();
    const before = await readHierarchy(), creative = await readCreatives();
    await io.assertCurrent();
    if (before.creativeId !== a.newCreativeId) {
        const current = await readHierarchy();
        if (canonicalMetaValue(current) !== canonicalMetaValue(before))
            throw Error('Configurația Meta s-a schimbat înainte de aplicare.');
        if (await io.claim()) {
            await io.assertCurrent();
            try {
                await io.replace();
            }
            catch { /* Only readback determines whether a lost response applied. */ }
        }
    }
    const after = await readHierarchy(), afterCreative = await readCreatives();
    await io.assertCurrent();
    if (after.creativeId !== a.newCreativeId || creative !== afterCreative || canonicalMetaValue({ ...before, creativeId: a.newCreativeId }) !== canonicalMetaValue(after))
        throw Error('Schimbarea imaginii nu este încă verificată integral la Meta.');
    return { ...a, checkedAt: new Date().toISOString(), adStatus: 'PAUSED' as const, onlyImageChanged: true as const, deliveryConfirmed: false as const };
}

export async function readMetaImageSource(ids: {campaignId:string;adSetId:string;adId:string;oldCreativeId:string;accountId:string}, read:(id:string,fields:string)=>Promise<unknown>) {
 const account=ids.accountId.replace(/^act_/,'');
 if(!Object.values(ids).every(id=>/^(act_)?[0-9]+$/.test(id)))throw Error('Identificatori Meta invalizi.');
 const [campaign,adSet,ad,creative]=(await Promise.all([read(ids.campaignId,campaignFields),read(ids.adSetId,adSetFields),read(ids.adId,adFields),read(ids.oldCreativeId,creativeFields)])).map(record);
 identity(campaign,ids.campaignId,account);identity(adSet,ids.adSetId,account);identity(ad,ids.adId,account);identity(creative,ids.oldCreativeId,account);
 if([campaign,adSet,ad].some(row=>row.status!=='PAUSED')||adSet.campaign_id!==ids.campaignId||ad.campaign_id!==ids.campaignId||ad.adset_id!==ids.adSetId||record(ad.creative).id!==ids.oldCreativeId)throw Error('Campania nu mai corespunde configurației în pauză.');
 storyWithoutImage(creative);
 return {campaign,adSet,ad,creative};
}
