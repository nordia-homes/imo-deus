import type { AssistantContext } from './access';
import { normalized, type AssistantMessage } from './contracts';
import { validateMetaCampaignForPublish } from '@/lib/meta-campaign-validation';
import type { MetaMarketingCampaignDraft, MetaMarketingIntegrationPublicStatus, Property } from '@/lib/types';
import { bucharestInputFromIso } from '@/lib/bucharest-time';
const requests = {
  'verifica daca meta ads este conectat': 'connection',
  'arata-mi campaniile proprietatii acesteia': 'property',
  'arata-mi configuratia completa a campaniei': 'configuration',
  'verifica daca este ready pentru publicare': 'readiness',
  'spune-mi ce lipseste pentru publicare': 'missing',
  'arata-mi dashboardul meta': 'dashboard',
  'cat a cheltuit campania aceasta': 'spend',
  'cate leaduri a produs campania': 'leads',
  'care este costul per lead': 'cpl',
  'arata-mi audienta configurata': 'audience',
  'spune-mi campaniile care au spend si zero leaduri': 'zero-leads',
  'arata-mi istoricul operatiilor campaniei': 'history',
  'verifica eventualele erori provider': 'errors',
} as const;
type Mode = typeof requests[keyof typeof requests];
export function metaReviewRequest(prompt: string): Mode | null { return requests[normalized(prompt).trim().replace(/[.!?]+$/, '') as keyof typeof requests] || null; }
function last(history: AssistantMessage[]) { return history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1); }
function selection(prompt: string) { return /^campanie meta:[ ]*([A-Za-z0-9_-]{1,180})$/i.exec(prompt.trim()); }
const text = (value: unknown) => typeof value === 'string' ? value : null;
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
function time(value: unknown) { if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return null; const local = bucharestInputFromIso(value); return local.date + ' ' + local.time + ', București'; }
export function metaReviewMetrics(row: Record<string, any>) {
  const spend = finite(row.insights?.spend), rawLeads = finite(row.insights?.leads), leads = rawLeads !== null && Number.isSafeInteger(rawLeads) ? rawLeads : null;
  const currency = ['EUR', 'RON', 'USD'].includes(row.currency) ? row.currency : null;
  const cpl = spend !== null && leads !== null && leads > 0 ? spend / leads : null;
  return { spend, leads, costPerLead: cpl !== null && Number.isFinite(cpl) ? cpl : null, currency, updatedAt: time(row.insights?.updatedAt), period: 'Perioada de atribuire nu este stocată în acest snapshot.', evidence: 'saved_insights' };
}
export function safeMetaError(value: unknown) {
  if (typeof value !== 'string') return null;
  return value.replace(/Bearer[ ]+[^ ,;"'}]+/gi, 'Bearer [omis]').replace(/https?:[/][/][^ ]+/gi, '[URL omis]').replace(/(access_token|refresh_token|client_secret|authorization|token)["' ]*[:=]["' ]*[^ ,;"'}]+/gi, '$1=[omis]').replace(/Bearer[ ]+[^ ,;]+/gi, 'Bearer [omis]').slice(0, 1000);
}
const configFields = ['campaignName', 'adSetName', 'adName', 'objective', 'budgetType', 'budgetAmount', 'currency', 'durationDays', 'startMode', 'locationLabel', 'radiusKm', 'headline', 'primaryText', 'creativeFormat', 'creativeAspectRatio', 'previewDevice', 'optimizationGoal', 'billingEvent', 'abTestEnabled', 'imageUrl', 'imageAlt', 'videoUrl', 'videoThumbnailUrl', 'destinationUrl', 'destinationType', 'phoneNumber', 'utmEnabled', 'utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'callToAction', 'specialAdCategory'] as const;
function configuration(row: Record<string, any>) {
  const result: Record<string, unknown> = Object.fromEntries(configFields.map(key => [key, ['string', 'number', 'boolean'].includes(typeof row[key]) ? row[key] : null]));
  result.startsAt = time(row.startsAt); result.endsAt = time(row.endsAt);
  result.placements = Array.isArray(row.placements) ? row.placements.filter((item: unknown) => typeof item === 'string') : [];
  result.mediaItems = Array.isArray(row.mediaItems) ? row.mediaItems.map((item: any) => ({ url: text(item?.url), type: text(item?.type), alt: text(item?.alt), name: text(item?.name), thumbnailUrl: text(item?.thumbnailUrl), source: text(item?.source) })) : [];
  result.creativeVariants = Array.isArray(row.creativeVariants) ? row.creativeVariants.map((item: any) => ({ headline: text(item?.headline), primaryText: text(item?.primaryText) })) : [];
  return result;
}
export async function prepareMetaReview(ctx: AssistantContext, prompt: string, history: AssistantMessage[]) {
  const chosen = selection(prompt), pending = last(history)?.cards?.find(card => card.source === 'metaReviewSelection')?.rows || [];
  const effective = chosen && pending.length ? String(pending[0].prompt) : prompt;
  const mode = metaReviewRequest(effective); if (!mode) return null;
  const page = history.find(row => row.id === 'current-page-context')?.cards?.find(card => card.source === 'properties')?.rows;
  const propertyId = page?.length === 1 ? String(page[0].id) : null;
  return ctx.adminDb.runTransaction(async tx => {
    const profile = (await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
    if (!profile || profile.agencyId !== ctx.agencyId || profile.role !== ctx.role || !['admin', 'agent'].includes(ctx.role || '')) throw new Error('Acces revocat');
    const agency = ctx.adminDb.collection('agencies').doc(ctx.agencyId);
    const integration = (await tx.get(agency.collection('integrations').doc('meta'))).data() || {};
    if (integration.agencyId && integration.agencyId !== ctx.agencyId) throw new Error('Integrare inaccesibilă');
    const snapshot = await tx.get(agency.collection('metaCampaignDrafts'));
    const properties = await tx.get(agency.collection('properties'));
    const campaigns = snapshot.docs.filter(doc => { const row = doc.data(); return row.agencyId === ctx.agencyId && !row.deletedAt && row.status !== 'deleted'; }).map(doc => ({ ...doc.data(), id: doc.id } as Record<string, any>));
    const property = (id: string) => { const value = properties.docs.find(doc => doc.id === id)?.data(); return value && !value.deletedAt && (!value.agencyId || value.agencyId === ctx.agencyId) ? value : undefined; };
    const summary = (row: Record<string, any>) => ({ id: row.id, propertyId: text(row.propertyId), campaignName: text(row.campaignName), status: text(row.status), configurationUpdatedAt: time(row.updatedAt), ...metaReviewMetrics(row) });
    const savedNotice = 'Date salvate în CRM; starea live Meta și perioada de atribuire nu au fost reverificate prin această citire.';
    if (mode === 'connection') return { source: 'metaConnectionReview', rows: [{ id: 'meta', connected: integration.connected === true, updatedAt: time(integration.updatedAt), businessId: text(integration.selectedBusiness?.id), adAccountId: text(integration.selectedAdAccount?.id), pageId: text(integration.selectedPage?.id), instagramId: text(integration.selectedInstagramAccount?.id), errorRecorded: Boolean(integration.lastError) }], text: 'Meta Ads apare ' + (integration.connected === true ? 'conectat' : 'neconectat') + ' în configurația salvată. ' + savedNotice };
    if (mode === 'dashboard') return { source: 'metaDashboardReview', rows: campaigns.map(summary), text: 'Dashboard Meta: ' + campaigns.length + ' campanii din istoricul disponibil al agenției, fără limita de 50 de înregistrări. Valorile sunt afișate per campanie și monedă; nu adun cheltuieli din monede sau perioade diferite. ' + savedNotice };
    if (mode === 'property') {
      if (!propertyId || !property(propertyId)) return { source: 'metaPropertyCampaigns', rows: [], text: 'Deschide proprietatea din CRM pentru care vrei lista campaniilor.' };
      const rows = campaigns.filter(row => row.propertyId === propertyId).map(summary);
      return { source: 'metaPropertyCampaigns', rows, text: 'Campaniile proprietății ' + propertyId + ': ' + rows.length + '. ' + savedNotice };
    }
    if (mode === 'zero-leads') {
      const rows = campaigns.filter(row => { const metrics = metaReviewMetrics(row); return metrics.spend !== null && metrics.spend > 0 && metrics.leads === 0; }).map(summary);
      const unknown = campaigns.filter(row => { const metrics = metaReviewMetrics(row); return metrics.spend === null || metrics.leads === null; }).length;
      return { source: 'metaZeroLeadCampaigns', rows, text: rows.length + ' campanii au cheltuieli pozitive și exact zero leaduri în datele salvate. ' + unknown + ' campanii au indicatori lipsă sau invalizi și nu sunt tratate ca zero leaduri. ' + savedNotice };
    }
    const prior = last(history)?.cards?.find(card => card.source === 'metaCampaignReview')?.rows;
    const inferredId = prior?.length === 1 ? prior[0].id : null;
    const candidates = campaigns.filter(row => !propertyId || row.propertyId === propertyId);
    let target = chosen ? candidates.find(row => row.id === chosen[1]) : inferredId ? candidates.find(row => row.id === inferredId) : candidates.length === 1 ? candidates[0] : null;
    if (chosen && (!pending.some(row => row.id === chosen[1]) || !target || pending.some(row => row.contextPropertyId && row.contextPropertyId !== propertyId))) throw new Error('Campania selectată nu mai este accesibilă în context');
    if (!target) return { source: 'metaReviewSelection', rows: candidates.map(row => ({ id: row.id, campaignName: text(row.campaignName), propertyId: text(row.propertyId), contextPropertyId: propertyId, prompt: effective })), text: candidates.length ? 'Alege campania: „Campanie Meta: ID”.' : 'Nu există campanii eligibile în contextul curent.' };
    target = { ...target };
    const base = { id: target.id, propertyId: target.propertyId, campaignName: text(target.campaignName), mode };
    if (mode === 'configuration') return { source: 'metaCampaignReview', rows: [{ ...base, status: target.status, ...configuration(target) }], text: 'Configurația salvată a campaniei ' + target.id + ', inclusiv buget, programare în București, audiență, materiale și tracking.' };
    if (mode === 'audience') return { source: 'metaCampaignReview', rows: [{ ...base, specialAdCategory: text(target.specialAdCategory), locationLabel: text(target.locationLabel), radiusKm: finite(target.radiusKm), placements: configuration(target).placements }], text: 'Audiența configurată pentru ' + target.id + '. Nu deduc criterii de targetare care nu sunt salvate.' };
    if (mode === 'readiness' || mode === 'missing') {
      const record = property(String(target.propertyId));
      const validation = record ? validateMetaCampaignForPublish(target as MetaMarketingCampaignDraft, integration as MetaMarketingIntegrationPublicStatus, record as Property) : { ok: false, errors: ['Proprietatea campaniei nu mai este disponibilă.'] };
      const errors = [...validation.errors, ...(!['draft', 'ready'].includes(target.status) ? ['Campania nu este un draft disponibil pentru publicare.'] : [])];
      return { source: 'metaCampaignReview', rows: [{ ...base, readyLocally: errors.length === 0, errors, providerValidated: false }], text: errors.length ? 'Publicarea este blocată: ' + errors.join(' ') : 'Validatorul folosit la publicare acceptă configurația locală. Accesul live Meta și materialele externe vor fi verificate de fluxul de publicare; această citire nu publică și nu aprobă cheltuieli.' };
    }
    if (mode === 'history') return { source: 'metaCampaignReview', rows: [{ ...base, events: Array.isArray(target.publishLog) ? target.publishLog.map((event: any) => ({ at: time(event?.at), status: text(event?.status), message: safeMetaError(event?.message), metaObjectId: text(event?.metaObjectId) })) : [], attempts: finite(target.publishAttempts), lastAttemptAt: time(target.lastPublishAttemptAt) }], text: 'Istoricul păstrat al operațiilor campaniei ' + target.id + '. Serviciul reține cel mult ultimele 25 de evenimente; nu reprezintă un audit istoric complet.' };
    if (mode === 'errors') return { source: 'metaCampaignReview', rows: [{ ...base, status: text(target.status), lastPublishError: safeMetaError(target.lastPublishError), lastAttemptAt: time(target.lastPublishAttemptAt) }], text: target.lastPublishError ? 'Există o eroare de publicare salvată pentru ' + target.id + '. Cauza live nu a fost reverificată.' : 'Nu este salvată o eroare de publicare pentru ' + target.id + '; aceasta nu confirmă absența erorilor actuale la Meta.' };
    const metrics = metaReviewMetrics(target), value = mode === 'spend' ? metrics.spend : mode === 'leads' ? metrics.leads : metrics.costPerLead;
    return { source: 'metaCampaignReview', rows: [{ ...base, ...metrics }], text: (mode === 'spend' ? 'Cheltuieli' : mode === 'leads' ? 'Leaduri' : 'Cost per lead') + ': ' + (value === null ? 'indisponibil' : String(value) + (mode !== 'leads' ? ' ' + (metrics.currency || '(monedă necunoscută)') : '')) + '. Actualizare: ' + (metrics.updatedAt || 'necunoscută') + '. ' + savedNotice };
  });
}