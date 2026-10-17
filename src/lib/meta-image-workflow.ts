import { ensureMetaImageUpload } from './meta-image-upload';
import { createHash } from 'node:crypto';
import { adminDb } from '@/firebase/admin';
import { applyMetaImageOptimization, metaImageWorkflowProvider } from './meta-marketing';
import { canonicalMetaValue, readMetaImageSource } from './meta-image-optimization';
import { ensureMetaPublicationObject } from './meta-publication-journal';
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const stable = (v: unknown) => createHash('sha256').update(canonicalMetaValue(v)).digest('hex');
type Actor = {
    uid: string;
    role?: string;
};
export type MetaImageSelection = {
    campaignId: string;
    imageUrl: string;
    expectedRevision: string;
    propertyRevision: string;
    grantRevision: string;
};
const campaignRef = (agencyId: string, id: string) => adminDb.collection('agencies').doc(agencyId).collection('metaCampaignDrafts').doc(id);
async function context(agencyId: string, campaignId: string, actor: Actor) {
    const ref = campaignRef(agencyId, campaignId), snapshot = await ref.get(), campaign = snapshot.data();
    if (!campaign || campaign.agencyId !== agencyId || campaign.deletedAt || !['published', 'paused'].includes(campaign.status) || campaign.creativeFormat !== 'single_image')
        throw Error('Campanie indisponibilă.');
    const property = adminDb.collection('agencies').doc(agencyId).collection('properties').doc(campaign.propertyId);
    const member = adminDb.collection('users').doc(actor.uid), grant = adminDb.collection('agencyPrivateIntegrations').doc(agencyId + '__meta');
    const guard = async (tx: FirebaseFirestore.Transaction, selection: MetaImageSelection) => {
        const [c, p, m, g] = await Promise.all([tx.get(ref), tx.get(property), tx.get(member), tx.get(grant)]);
        if (m.data()?.agencyId !== agencyId || m.data()?.role !== actor.role || actor.role !== 'admin')
            throw Error('Acces revocat.');
        if (!c.exists || hash(c.data()) !== selection.expectedRevision || !p.exists || p.data()?.deletedAt || p.data()?.agencyId && p.data()?.agencyId !== agencyId || hash(p.data()) !== selection.propertyRevision || !g.exists || hash(g.data()) !== selection.grantRevision)
            throw Error('Configurația aprobată s-a schimbat.');
        if (!selection.imageUrl.startsWith('https://') || selection.imageUrl === c.data()?.imageUrl || !Array.isArray(p.data()?.images) || !p.data()!.images.some((v: {
            url?: string;
        }) => v.url === selection.imageUrl))
            throw Error('Fotografia nu mai este eligibilă.');
    };
    return { ref, campaign, guard };
}
export async function prepareMetaImageProposal(agencyId: string, actor: Actor, selection: MetaImageSelection) {
    const ctx = await context(agencyId, selection.campaignId, actor);
    await adminDb.runTransaction(tx => ctx.guard(tx, selection));
    const provider = await metaImageWorkflowProvider(agencyId);
    if (hash(provider.integration) !== selection.grantRevision)
        throw Error('Conexiune schimbată.');
    const ids = { campaignId: String(ctx.campaign.metaCampaignId || ''), adSetId: String(ctx.campaign.metaAdSetId || ''), adId: String(ctx.campaign.metaAdId || ''), oldCreativeId: String(ctx.campaign.metaCreativeId || ''), accountId: provider.accountId };
    const source = await readMetaImageSource(ids, provider.read), sourceRevision = stable(source);
    const proposal = { campaignId: selection.campaignId, imageUrl: selection.imageUrl, expectedRevision: selection.expectedRevision, propertyRevision: selection.propertyRevision, grantRevision: selection.grantRevision, actorId: actor.uid, propertyId: ctx.campaign.propertyId, ids, source, sourceRevision };
    const proposalId = stable(proposal), ref = ctx.ref.collection('imageProposals').doc(proposalId);
    await adminDb.runTransaction(async (tx) => { await ctx.guard(tx, selection); const existing = await tx.get(ref); if (!existing.exists)
        tx.create(ref, { ...proposal, createdAt: new Date().toISOString() }); });
    return { proposalId, campaignId: selection.campaignId, campaignName: String(ctx.campaign.campaignName || selection.campaignId), imageUrl: selection.imageUrl, previousImageUrl: ctx.campaign.imageUrl ?? null, primaryText: (source.creative.object_story_spec as any).link_data.message ?? null, headline: (source.creative.object_story_spec as any).link_data.name ?? null, destinationUrl: (source.creative.object_story_spec as any).link_data.link, budgetAmount: ctx.campaign.budgetAmount ?? null, currency: ctx.campaign.currency ?? null, sourceRevision };
}
export async function executeMetaImageProposal(agencyId: string, campaignId: string, actor: Actor, proposalId: string, executionGuard?: (tx:FirebaseFirestore.Transaction)=>Promise<void>) {
    const ctx = await context(agencyId, campaignId, actor), ref = ctx.ref.collection('imageProposals').doc(proposalId), snapshot = await ref.get(), proposal = snapshot.data();
    if (!proposal || proposal.actorId !== actor.uid || proposal.campaignId !== campaignId)
        throw Error('Propunere indisponibilă.');
    const selection = proposal as MetaImageSelection;
    const apply = async (imageHash: string, newCreativeId: string) => applyMetaImageOptimization(agencyId, campaignId, actor, { expectedRevision: selection.expectedRevision, propertyRevision: selection.propertyRevision, grantRevision: selection.grantRevision, imageUrl: selection.imageUrl, imageHash, newCreativeId },executionGuard);
    // The replacement primitive verifies the saved committed revision on completed replays.
    if (proposal.newCreativeId && proposal.imageHash && ctx.campaign.metaCreativeId === proposal.newCreativeId)
        return { campaignId, proposalId, proof: await apply(proposal.imageHash, proposal.newCreativeId) };
    const guard = async (tx: FirebaseFirestore.Transaction) => { if(executionGuard)await executionGuard(tx);await ctx.guard(tx, selection); const current = await tx.get(ref); if (!current.exists || current.data()?.sourceRevision !== proposal.sourceRevision || current.data()?.actorId !== actor.uid)
        throw Error('Propunere schimbată.'); };
    await adminDb.runTransaction(guard);
    const provider = await metaImageWorkflowProvider(agencyId);
    if (hash(provider.integration) !== selection.grantRevision)
        throw Error('Conexiune schimbată.');
    const checkSource = async () => {
        const current = await ref.get(), newId = current.data()?.newCreativeId;
        const source = await readMetaImageSource(proposal.ids, async (id, fields) => { const row = await provider.read(id, fields); if (id === proposal.ids.adId && newId && row.creative?.id === newId)
            return { ...row, creative: { id: proposal.ids.oldCreativeId } }; return row; });
        if (stable(source) !== proposal.sourceRevision)
            throw Error('Configurația Meta s-a schimbat după aprobare.');
        await adminDb.runTransaction(guard);
    };
    await checkSource();
    const imageHash = await ensureMetaImageUpload({ref,accountId:provider.accountId,imageUrl:selection.imageUrl,guard,download:()=>provider.download(selection.imageUrl),upload:provider.upload,list:provider.listImages});
    await checkSource();
    const story = structuredClone(proposal.source.creative.object_story_spec);
    story.link_data.image_hash = imageHash;
    const params = { name: 'Optimizare imagine ' + campaignId, object_story_spec: JSON.stringify(story), ...(proposal.source.creative.url_tags ? { url_tags: String(proposal.source.creative.url_tags) } : {}) };
    const created = await ensureMetaPublicationObject({ ref, field: 'newCreativeId', edge: 'adcreatives', accountId: provider.accountId, params, guard, post: provider.create, list: provider.list });
    await checkSource();
    const proof = await apply(imageHash, created.id);
    return { campaignId, proposalId, proof };
}
