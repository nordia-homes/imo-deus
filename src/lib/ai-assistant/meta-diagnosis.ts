type State = {
    kind: string;
    status: string;
    effectiveStatus: string;
};
export function diagnoseMetaState(localStatus: string, states: State[], hierarchyComplete: boolean) {
    const findings: Array<{
        location: string;
        reason: string;
        nextStep: string;
    }> = [];
    const labels: Record<string, string> = { campaign: 'campanie', adSet: 'set de reclame', ad: 'reclamă' };
    const issues: Record<string, string> = { DISAPPROVED: 'respingere', PENDING_BILLING_INFO: 'informații de facturare necesare', WITH_ISSUES: 'probleme raportate' };
    for (const state of states)
        if (issues[state.effectiveStatus])
            findings.push({ location: 'Meta', reason: 'Meta raportează ' + issues[state.effectiveStatus] + ' pentru ' + (labels[state.kind] || state.kind) + '.', nextStep: 'Consultă detaliile obiectului în Meta Ads Manager. Starea nu dovedește cauza inițială sau o defecțiune generală Meta.' });
    const campaign = states.find(row => row.kind === 'campaign');
    if (localStatus === 'paused' && campaign && campaign.status !== 'PAUSED')
        findings.push({ location: 'Date CRM', reason: 'CRM indică pauză, însă campania Meta are starea ' + campaign.status + '.', nextStep: 'Verifică istoricul operațiilor și reconcilierea. Diagnosticul nu retrimite pauza și nu schimbă CRM.' });
    if (hierarchyComplete && ['draft', 'ready', 'publishing', 'error'].includes(localStatus))
        findings.push({ location: 'Date CRM', reason: 'CRM are starea ' + localStatus + ', deși toate cele patru obiecte și asocierile lor există la Meta.', nextStep: 'Verifică execuția de publicare și dovada de reconciliere. Existența obiectelor nu dovedește livrarea sau că o operație incertă este finalizată.' });
    if (!hierarchyComplete)
        findings.push({ location: 'Date insuficiente', reason: states.length ? 'CRM nu are toți identificatorii necesari verificării reclamei. A fost citită doar campania.' : 'CRM nu are un identificator Meta valid pentru campanie. Nu pot verifica efectele externe.', nextStep: 'Verifică istoricul publicării și identificatorii salvați; nu repeta publicarea înainte de a exclude o operație externă deja executată.' });
    if (!findings.length) {
        const pending = states.find(row => ['PENDING_REVIEW', 'IN_PROCESS', 'PREAPPROVED'].includes(row.effectiveStatus)), inactive = states.find(row => ['PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'ARCHIVED', 'DELETED'].includes(row.effectiveStatus));
        findings.push(pending ? { location: 'Flux Meta', reason: 'Meta indică ' + pending.effectiveStatus + ' pentru ' + (labels[pending.kind] || pending.kind) + '. Este o etapă raportată de provider, nu dovada unei erori imoDeus.', nextStep: 'Urmărește starea obiectului în Meta; nu există un termen de aprobare garantat.' } : inactive ? { location: 'Configurație Meta', reason: 'Meta indică ' + inactive.effectiveStatus + ' pentru ' + (labels[inactive.kind] || inactive.kind) + '. Pauza, arhivarea sau ștergerea nu dovedesc o eroare a aplicației.', nextStep: 'Verifică intenția de configurare. Nu activez și nu republic automat.' } : { location: 'Nicio problemă demonstrată de stări', reason: 'Obiectele și asocierile citite sunt valide, fără o problemă explicită în stările raportate.', nextStep: 'Pentru lipsa rezultatelor sunt necesare rapoarte de livrare și conversie. ACTIVE singur nu dovedește afișări sau leaduri.' });
    }
    return { findings, causeConfirmed: false, deliveryConfirmed: false, certainty: 'Localizarea observației nu demonstrează cauza inițială. Nu atribui automat vina imoDeus sau Meta.' };
}
