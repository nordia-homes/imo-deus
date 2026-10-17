import type { MetaMarketingCampaignDraft, MetaMarketingIntegrationPublicStatus, Property } from './types';
function withDraftUtmParameters(draft: MetaMarketingCampaignDraft) {
  if (!draft.destinationUrl || !draft.utmEnabled) return draft.destinationUrl || '';
  try {
    const url = new URL(draft.destinationUrl);
    if (draft.utmSource) url.searchParams.set('utm_source', draft.utmSource);
    if (draft.utmMedium) url.searchParams.set('utm_medium', draft.utmMedium);
    if (draft.utmCampaign) url.searchParams.set('utm_campaign', draft.utmCampaign);
    if (draft.utmContent) url.searchParams.set('utm_content', draft.utmContent);
    return url.toString();
  } catch {
    return draft.destinationUrl;
  }
}

export function validateMetaCampaignForPublish(
  draft: MetaMarketingCampaignDraft,
  integration: MetaMarketingIntegrationPublicStatus,
  property: Property
) {
  const errors: string[] = [];
  const mediaItems = Array.isArray(draft.mediaItems) ? draft.mediaItems.filter(Boolean) : [];
  const imageItems = mediaItems.filter((item) => item.type === 'image');
  const hasVideo = Boolean(draft.videoUrl || mediaItems.some((item) => item.type === 'video'));
  const destinationUrl = withDraftUtmParameters(draft);

  if (!integration.connected) errors.push('Conecteaza Meta inainte de publicare.');
  if (!integration.selectedBusiness) errors.push('Selecteaza Business Manager-ul folosit la reclame.');
  if (!integration.selectedAdAccount) errors.push('Selecteaza Ad Account-ul folosit la reclame.');
  if (!integration.selectedPage) errors.push('Selecteaza pagina Facebook folosita in reclama.');
  if (!draft.campaignName || !draft.adSetName || !draft.adName) errors.push('Completeaza numele campaniei, ad setului si reclamei.');
  if (!Number.isFinite(draft.budgetAmount) || draft.budgetAmount < 10) errors.push('Bugetul trebuie să fie un număr finit de minimum 10 în moneda campaniei.');
  if (!['RON', 'EUR', 'USD'].includes(draft.currency)) errors.push('Moneda campaniei nu este validă.');
  if (property.status !== 'Activ') errors.push('Proprietatea trebuie să fie activă pentru publicare.');
  if (!Number.isSafeInteger(draft.durationDays) || draft.durationDays < 1) errors.push('Durata campaniei trebuie sa fie de cel putin o zi.');
  if (!draft.headline?.trim() || !draft.primaryText?.trim()) errors.push('Completeaza titlul si textul reclamei.');
  if (!draft.locationLabel?.trim()) errors.push('Completeaza orasul sau zona metropolitana promovata.');
  if (!Number.isFinite(draft.radiusKm) || Number(draft.radiusKm) < 15) errors.push('Pentru Housing, raza audientei trebuie sa fie de minimum 15 km.');
  if (String(property.latitude).trim() === '' || String(property.longitude).trim() === '' || property.latitude === null || property.latitude === undefined || property.longitude === null || property.longitude === undefined || !Number.isFinite(Number(property.latitude)) || !Number.isFinite(Number(property.longitude)) || Math.abs(Number(property.latitude)) > 90 || Math.abs(Number(property.longitude)) > 180) {
    errors.push('Proprietatea trebuie sa aiba coordonate valide pentru targetarea Housing pe zona larga.');
  }
  if (!draft.placements?.length) errors.push('Selecteaza cel putin un placement.');
  if (draft.creativeFormat === 'video' && !hasVideo) errors.push('Selecteaza un video pentru formatul video.');
  if (draft.creativeFormat !== 'video' && !imageItems.length) errors.push('Selecteaza cel putin o imagine pentru reclama.');
  if (draft.creativeFormat === 'carousel' && imageItems.length < 2) errors.push('Caruselul are nevoie de cel putin doua imagini.');
  if (draft.objective === 'calls' && !draft.phoneNumber?.trim()) errors.push('Adauga numarul de telefon pentru obiectivul Apeluri.');
  if (!destinationUrl || !/^https:\/\//.test(destinationUrl)) {
    errors.push('Linkul de destinatie trebuie sa fie public si HTTPS.');
  }
  if (draft.utmEnabled && (!draft.utmSource || !draft.utmMedium || !draft.utmCampaign)) {
    errors.push('Completeaza parametrii UTM sau dezactiveaza tracking-ul.');
  }

  return { ok: errors.length === 0, errors, destinationUrl };
}
