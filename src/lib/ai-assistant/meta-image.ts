import { z } from 'zod';
import type { AssistantContext } from './access';
import { normalized, type AssistantAction, type AssistantMessage } from './contracts';
import { metaDraftRevision } from './meta-draft';
const id = z.string().regex(/^[A-Za-z0-9_-]{1,180}$/), hash = z.string().regex(/^[a-f0-9]{64}$/);
export const metaImageActionSchema = z.object({ kind: z.literal('existing_operation'), operation: z.literal('meta_campaign_optimize_image'), params: z.object({ campaignId: id }).strict(), query: z.object({}).strict(), body: z.object({ proposalId: hash, resume:z.literal(true).optional() }).strict() }).strict();
export const metaImageAction = (action: AssistantAction) => metaImageActionSchema.safeParse(action).success;
const approval = (prompt: string) => /^Confirm optimizarea Meta: ([a-f0-9]{64})$/i.exec(prompt.trim());
export const metaImageResumeSelection=(prompt:string)=>/^Reia optimizarea Meta: ([A-Za-z0-9_-]{1,180})\/([a-f0-9]{64})$/i.exec(prompt.trim());
export const metaImageResumeRequest=(prompt:string)=>['reia optimizarea meta','continua optimizarea meta','reia optimizarea aprobata'].includes(normalized(prompt).trim().replace(/[.!?]+$/,''));
export const metaImageApproved = (action: AssistantAction, prompt: string) => { const parsed = metaImageActionSchema.safeParse(action); if(!parsed.success)return false;if(parsed.data.body.resume){const selected=metaImageResumeSelection(prompt);return metaImageResumeRequest(prompt)||selected?.[1]===parsed.data.params.campaignId&&selected?.[2]===parsed.data.body.proposalId;}return approval(prompt)?.[1] === parsed.data.body.proposalId; };
export const metaImageRequest = (prompt: string) => ['aplica doar optimizarea pe care am aprobat-o', 'schimba imaginea campaniei meta'].includes(normalized(prompt).trim().replace(/[.!?]+$/, ''));
export async function prepareMetaImage(ctx: AssistantContext, prompt: string, history: AssistantMessage[]) {
    if(metaImageResumeRequest(prompt)||metaImageResumeSelection(prompt))return (await import('./meta-image-resume')).prepareMetaImageResume(ctx,prompt,history);
    const selected = /^Imagine optimizare Meta: ([A-Za-z0-9_-]{1,180})\/([0-9]+)$/i.exec(prompt.trim()), approved = approval(prompt);
    if (!selected && !approved && !metaImageRequest(prompt))
        return null;
    const actions: AssistantAction[] = [];
    const prior = history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1);
    const page = history.find(row => row.id === 'current-page-context')?.cards?.find(card => card.source === 'properties')?.rows, contextPropertyId = page?.length === 1 ? String(page[0].id) : null;
    const member = (await ctx.adminDb.collection('users').doc(ctx.uid).get()).data();
    if (member?.agencyId !== ctx.agencyId || member.role !== ctx.role || ctx.role !== 'admin')
        throw Error('Acces revocat.');
    if (approved) {
        const offer = prior?.cards?.find(card => card.source === 'metaImageApproval')?.rows.find(row => row.id === approved[1]);
        if (!offer || offer.contextPropertyId !== contextPropertyId)
            throw Error('Aprobarea nu corespunde propunerii.');
        actions.push(metaImageActionSchema.parse({ kind: 'existing_operation', operation: 'meta_campaign_optimize_image', params: { campaignId: offer.campaignId }, query: {}, body: { proposalId: approved[1] } }));
        return { actions, source: 'metaImageReview', rows: [], text: 'Aplic fotografia aprobată și verific rezultatul la Meta. Păstrez campania în pauză.' };
    }
    const agency = ctx.adminDb.collection('agencies').doc(ctx.agencyId);
    const rows = await ctx.adminDb.runTransaction(async (tx) => {
        const [campaigns, properties, grant, currentMember] = await Promise.all([tx.get(agency.collection('metaCampaignDrafts')), tx.get(agency.collection('properties')), tx.get(ctx.adminDb.collection('agencyPrivateIntegrations').doc(ctx.agencyId + '__meta')), tx.get(ctx.adminDb.collection('users').doc(ctx.uid))]);
        if (currentMember.data()?.agencyId !== ctx.agencyId || currentMember.data()?.role !== 'admin' || !grant.exists || !grant.data()?.connected)
            throw Error('Acces sau conexiune indisponibilă.');
        return campaigns.docs.flatMap(doc => {
            const c = doc.data(), property = properties.docs.find(p => p.id === c.propertyId)?.data();
            if (c.agencyId !== ctx.agencyId || c.deletedAt || !['published', 'paused'].includes(c.status) || c.creativeFormat !== 'single_image' || contextPropertyId && c.propertyId !== contextPropertyId || !property || property.deletedAt || property.agencyId && property.agencyId !== ctx.agencyId)
                return [];
            return (Array.isArray(property.images) ? property.images : []).flatMap((image: {
                url?: string;
            }, index: number) => typeof image.url === 'string' && image.url.startsWith('https://') && image.url !== c.imageUrl ? [{ id: doc.id + '/' + index, campaignId: doc.id, campaignName: String(c.campaignName || 'Campanie fără denumire'), imageUrl: image.url, expectedRevision: metaDraftRevision(c), propertyRevision: metaDraftRevision(property), grantRevision: metaDraftRevision(grant.data()), contextPropertyId }] : []);
        });
    });
    if (!selected)
        return { actions, source: 'metaImageSelection', rows, text: rows.length ? 'Alege fotografia concretă. Voi verifica configurația la Meta și îți voi prezenta schimbarea pentru aprobare, fără a modifica reclama.' : 'Nu există fotografii alternative eligibile în contextul curent. Fluxul necesită o reclamă cu o singură imagine, în pauză la Meta.' };
    const key = selected[1] + '/' + selected[2], row = rows.find(r => r.id === key), offered = prior?.cards?.find(card => card.source === 'metaImageSelection')?.rows.find(r => r.id === key);
    if (!row || !offered || ['imageUrl', 'expectedRevision', 'propertyRevision', 'grantRevision', 'contextPropertyId'].some(k => row[k as keyof typeof row] !== offered[k]))
        throw Error('Selecția s-a schimbat.');
    const { prepareMetaImageProposal } = await import('@/lib/meta-image-workflow');
    const proposal = await prepareMetaImageProposal(ctx.agencyId, { uid: ctx.uid, role: ctx.role }, row);
    return { actions, source: 'metaImageApproval', rows: [{ id: proposal.proposalId, ...proposal, contextPropertyId }], text: 'Confirmă schimbarea acestei fotografii. Textul, destinația, bugetul și audiența rămân cele verificate. Campania rămâne în pauză; nu confirm livrare sau rezultate comerciale.' };
}
