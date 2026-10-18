import { z } from 'zod';

// Public selection metadata is not an executable command or a permission grant.
export const choiceSources = ['metaImageResumeSelection','metaImageSelection','metaImageApproval','metaPerformanceSelection','metaPublishSelection','metaStatusSelection','metaPauseSelection','metaMediaSelection','metaMediaCampaignSelection','metaReviewSelection','metaDraftSelection'] as const;
export type ChoiceSource = typeof choiceSources[number];
export const namedChoiceSchema = z.object({
 messageId: z.string().min(1).max(180).regex(/^[^/\u0000-\u001f]+$/),
 source: z.enum(choiceSources),
 rowId: z.string().min(1).max(260).regex(/^[^\u0000-\u001f]+$/),
}).strict();
export type NamedChoice = z.infer<typeof namedChoiceSchema>;
export type CardChoice = Omit<NamedChoice, 'messageId'>;
export const choiceLabels: Record<ChoiceSource,string> = {
 metaImageResumeSelection:'Continuă optimizarea aprobată',metaImageSelection:'Pregătește această fotografie',metaImageApproval:'Confirmă schimbarea fotografiei',metaPerformanceSelection:'Consultă statisticile',metaPublishSelection:'Confirmă publicarea în pauză',metaStatusSelection:'Consultă starea campaniei',metaPauseSelection:'Confirmă pauza',metaMediaSelection:'Selectează fotografia',metaMediaCampaignSelection:'Selectează campania pentru material',metaReviewSelection:'Selectează campania',metaDraftSelection:'Selectează ciorna',
};
export function namedChoiceText(source: ChoiceSource, row: Record<string,unknown>) {
 const name = ['campaignName','title','name','label','displayName','description','propertyTitle'].map(key=>row[key]).find(value=>typeof value==='string' && value.trim() && value!==row.id);
 return choiceLabels[source]+': '+(typeof name==='string'?name.trim().slice(0,1000).trim():'elementul afișat');
}
