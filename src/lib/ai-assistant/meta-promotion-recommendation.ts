/** Commercial preparation advice from verified CRM facts; never a forecast or publish approval. */
export function assessMetaPromotion(property: Record<string, unknown>) {
 const present = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
 const photoUrls = new Set((Array.isArray(property.images) ? property.images : []).flatMap(image => {
  if (!image || typeof image !== 'object' || !('url' in image) || typeof image.url !== 'string') return [];
  try { const url = new URL(image.url); return url.protocol === 'https:' && !url.username && !url.password ? [url.href] : []; } catch { return []; }
 }));
 const price = typeof property.price === 'number' && Number.isFinite(property.price) && property.price > 0;
 const location = present(property.location) || (present(property.city) && present(property.zone));
 const transaction = present(property.transactionType) && ['vanzare','inchiriere'].includes(property.transactionType.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim());
 const missing = [property.status !== 'Activ' ? 'proprietate activă' : '', !present(property.title) ? 'titlu' : '', !price ? 'preț pozitiv valid' : '', !transaction ? 'tip tranzacție' : '', !location ? 'localizare' : '', !present(property.description) ? 'descriere CRM' : '', !photoUrls.size ? 'fotografie HTTPS în CRM' : ''].filter(Boolean);
 return {
  title: present(property.title) ? property.title : 'Proprietate fără titlu',
  recommended: missing.length === 0,
  recommendation: missing.length ? 'Completează oferta înainte de promovare' : 'Recomandată pentru pregătirea promovării',
  facts: `Stare: ${String(property.status || 'necunoscută')}; preț înregistrat: ${price ? String(property.price) : 'indisponibil'}; tranzacție: ${transaction ? String(property.transactionType) : 'neclară'}; localizare: ${location ? String(property.location || [property.city,property.zone].join(', ')) : 'incompletă'}; fotografii HTTPS distincte: ${photoUrls.size}.`,
  missing: missing.join(', ') || 'Nicio lipsă în criteriile de pregătire verificate.',
  reason: missing.length ? 'Promovarea înainte de completarea ofertei poate atrage solicitări care nu pot fi calificate din anunț. Rezolvă lipsurile indicate înainte de alocarea bugetului.' : 'Oferta este activă, fără campanie activă asociată în inventarul verificat, și are preț, tip de tranzacție, localizare, descriere și fotografie. Aceste date permit prezentarea ofertei și filtrarea solicitărilor după buget și zonă; este o candidată pentru pregătirea promovării.',
  nextStep: missing.length ? 'Actualizează câmpurile indicate în CRM, apoi cere din nou recomandarea.' : 'Pregătește un draft folosind materialele CRM și validează configurația înainte de publicare. Disponibilitatea fișierelor foto și calitatea vizuală nu sunt confirmate prin această analiză.',
 };
}
