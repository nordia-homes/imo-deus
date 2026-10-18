import { z } from 'zod';

// Public selection metadata is not an executable command or a permission grant.
export const choiceSources = ['facebookSemanticProperty','facebookSemanticAccount','facebookPublicationGroups','facebookPublicationProperty','facebookPublicationAccount','facebookDefaultAccount','facebookScheduleProperty','metaImageResumeSelection','metaImageSelection','metaImageApproval','metaPerformanceSelection','metaPublishSelection','metaStatusSelection','metaPauseSelection','metaMediaSelection','metaMediaCampaignSelection','metaReviewSelection','metaDraftSelection'] as const;
export type ChoiceSource = typeof choiceSources[number];
export const namedChoiceSchema = z.object({
 messageId: z.string().min(1).max(180).regex(/^[^/\u0000-\u001f]+$/),
 source: z.enum(choiceSources),
 offerId: z.string().regex(/^[a-f0-9]{64}$/).optional(),
 rowId: z.string().min(1).max(260).regex(/^[^\u0000-\u001f]+$/),
 rowIds: z.array(z.string().regex(/^[a-f0-9]{24}$/)).min(1).max(200).optional(),
}).strict().refine(value => !value.rowIds || (value.source === 'facebookPublicationGroups' && value.rowId === value.rowIds[0] && new Set(value.rowIds).size === value.rowIds.length), 'Selecție multiplă invalidă');
export type NamedChoice = z.infer<typeof namedChoiceSchema>;
export type CardChoice = Omit<NamedChoice, 'messageId'>;
export const choiceLabels: Record<ChoiceSource,string> = {
 facebookSemanticProperty:'Alege proprietatea',facebookSemanticAccount:'Alege contul Facebook',facebookPublicationGroups:'Publică în grupurile selectate',facebookPublicationProperty:'Publică proprietatea',facebookPublicationAccount:'Publică folosind contul',facebookDefaultAccount:'Setează contul proprietății',facebookScheduleProperty:'Programează publicarea proprietății',
 metaImageResumeSelection:'Continuă optimizarea aprobată',metaImageSelection:'Pregătește această fotografie',metaImageApproval:'Confirmă schimbarea fotografiei',metaPerformanceSelection:'Consultă statisticile',metaPublishSelection:'Confirmă publicarea în pauză',metaStatusSelection:'Consultă starea campaniei',metaPauseSelection:'Confirmă pauza',metaMediaSelection:'Selectează fotografia',metaMediaCampaignSelection:'Selectează campania pentru material',metaReviewSelection:'Selectează campania',metaDraftSelection:'Selectează ciorna',
};
export function namedGroupChoiceText(rows: Record<string,unknown>[]) {
 return 'Publică în grupurile selectate: '+rows.slice(0,20).map(row => typeof row.name === 'string' && row.name.trim() && row.name !== row.id ? row.name.trim().slice(0,80).trim() : 'Grup Facebook').join('; ')+(rows.length > 20 ? '; și încă '+(rows.length-20)+' de grupuri selectate' : '');
}
export function namedChoiceText(source: ChoiceSource, row: Record<string,unknown>) {
 const name = ['campaignName','title','name','label','displayName','description','propertyTitle'].map(key=>row[key]).find(value=>typeof value==='string' && value.trim() && value!==row.id);
 return choiceLabels[source]+': '+(typeof name==='string'?name.trim().slice(0,1000).trim():'elementul afișat');
}
