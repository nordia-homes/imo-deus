import { assessMetaCplAnomaly, META_CPL_RULE } from './meta-cpl-anomaly';
import { assessMetaPerformance } from './meta-performance-assessment';
import type { AssistantContext } from './access';
import { normalized, type AssistantMessage } from './contracts';
import { metaDraftRevision } from './meta-draft';
import { metaComparisonPeriods, metaMetricChanges } from '@/lib/meta-insights-period';
import { bucharestInputFromIso } from '@/lib/bucharest-time';
import { isDemoAgencyId } from '@/lib/demo/guards';
export function metaPerformanceRequest(prompt: string) { const text = normalized(prompt).trim().replace(/[.!?]+$/, ''); return text === 'spune-mi campaniile cu cpl neobisnuit de mare' ? 'anomalies' : text === 'nu trata estimarea drept rezultat cert' ? 'certainty' : text === 'compara ultimele sapte zile cu precedentele sapte' ? 'periods' : text === 'compara doua campanii meta' ? 'campaigns' : text === 'care campanie performeaza mai slab' ? 'weaker' : text === 'recomanda-mi ce as schimba la campania slaba' || text === 'pregateste recomandarea de optimizare' ? 'optimize' : null; }
export async function prepareMetaPerformance(ctx: AssistantContext, prompt: string, history: AssistantMessage[]) {
    const answer = /^Statistici Meta:[ ]*([A-Za-z0-9_-]{1,180})$/i.exec(prompt.trim());
    const last = history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1);
    const offered = last?.cards?.find(card => card.source === 'metaPerformanceSelection');
    const effective = answer && offered?.rows.length ? String(offered.rows[0].prompt) : prompt, mode = metaPerformanceRequest(effective);
    if (!mode && !answer)
        return null;
    if (!mode)
        throw new Error('Selecție expirată');
    if (isDemoAgencyId(ctx.agencyId) || ctx.runtimeMode === 'demo')
        throw new Error('Statistici externe indisponibile în demo');
    const page = history.find(row => row.id === 'current-page-context')?.cards?.find(card => card.source === 'properties')?.rows;
    const propertyId = page?.length === 1 ? String(page[0].id) : null, agency = ctx.adminDb.collection('agencies').doc(ctx.agencyId);
    const snapshot = () => ctx.adminDb.runTransaction(async (tx) => {
        const member = (await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
        if (member?.agencyId !== ctx.agencyId || member.role !== ctx.role || !['admin', 'agent'].includes(ctx.role || ''))
            throw new Error('Acces revocat');
        const campaigns = await tx.get(agency.collection('metaCampaignDrafts')), grant = await tx.get(ctx.adminDb.collection('agencyPrivateIntegrations').doc(ctx.agencyId + '__meta'));
        return { campaigns: campaigns.docs.map(doc => ({ id: doc.id, data: doc.data() })), grant: grant.data() || null };
    });
    const before = await snapshot(), revision = metaDraftRevision(before);
    const candidates = before.campaigns.filter(({ data }) => data.agencyId === ctx.agencyId && !data.deletedAt && data.status !== 'deleted' && /^\d+$/.test(String(data.metaCampaignId || '')) && (!propertyId || data.propertyId === propertyId));
    const required = mode === 'periods' ? 1 : 2;
    const assessment = mode === 'weaker' || mode === 'optimize' || mode === 'certainty';
    const previousPair = assessment ? last?.cards?.find(card => card.source === 'metaPerformanceReview')?.rows : undefined;
    let ids: string[] = [];
    if (mode === 'anomalies')
        ids = candidates.map(row => row.id);
    else if (answer) {
        const chosen = offered?.rows.find(row => row.id === answer[1]);
        if (!chosen || chosen.contextPropertyId !== propertyId || chosen.snapshotRevision !== revision)
            throw new Error('Selecție schimbată');
        ids = [...(Array.isArray(chosen.selectedIds) ? chosen.selectedIds.map(String) : []), answer[1]];
        if (new Set(ids).size !== ids.length || ids.some(id => !candidates.some(row => row.id === id)))
            throw new Error('Selecție invalidă');
    }
    else if (previousPair?.length === 2) {
        ids = previousPair.map(row => String(row.id));
        if (ids.some(id => !candidates.some(row => row.id === id)))
            throw new Error('Campaniile comparate anterior nu mai sunt accesibile în context');
    }
    else if (candidates.length === required)
        ids = candidates.map(row => row.id);
    else if (mode === 'periods') {
        const previous = last?.cards?.find(card => ['metaCampaignReview', 'metaStatusReview', 'metaPerformanceReview'].includes(card.source))?.rows;
        if (previous?.length === 1 && candidates.some(row => row.id === previous[0].id))
            ids = [String(previous[0].id)];
    }
    if (mode === 'anomalies' && !ids.length)
        return { source: 'metaPerformanceReview', rows: [], text: 'Nu există campanii cu identificator Meta în contextul curent. Nu pot evalua CPL.' };
    if (mode !== 'anomalies' && ids.length < required) {
        const enough = candidates.length >= required;
        return { source: 'metaPerformanceSelection', rows: enough ? candidates.filter(row => !ids.includes(row.id)).map(row => ({ id: row.id, campaignName: String(row.data.campaignName || 'Campanie fără denumire'), prompt: effective, contextPropertyId: propertyId, snapshotRevision: revision, selectedIds: ids })) : [], text: enough ? (ids.length ? 'Alege a doua campanie pentru comparație.' : 'Alege campania pentru raport din cardurile afișate.') : 'Nu există suficiente campanii cu identificator Meta în contextul curent.' };
    }
    const { readMetaCampaignPeriodInsights } = await import('@/lib/meta-marketing');
    const periods = metaComparisonPeriods();
    if (new Set(ids.map(id => candidates.find(row => row.id === id)!.data.metaCampaignId)).size !== ids.length)
        throw new Error('Aceeași campanie Meta este asociată mai multor înregistrări.');
    const readRow = async (id: string) => {
        const campaign = candidates.find(row => row.id === id)!;
        const report = await readMetaCampaignPeriodInsights(ctx.agencyId, id, { periods, expectedRevision: metaDraftRevision(campaign.data), actor: { uid: ctx.uid, role: ctx.role } });
        const time = bucharestInputFromIso(report.checkedAt);
        return { id, objective: String(campaign.data.objective || ''), providerObjective: report.providerObjective, campaignName: String(campaign.data.campaignName || 'Campanie fără denumire'), propertyId: String(campaign.data.propertyId || ''), current: report.current, ...(mode === 'periods' || mode === 'anomalies' ? { previous: report.previous, changes: metaMetricChanges(report.current, report.previous) } : {}), attribution: report.attribution, checkedAt: time.date + ' ' + time.time + ', București', providerValidated: true };
    };
    const rows: Awaited<ReturnType<typeof readRow>>[] = [];
    // Bound concurrent provider reads while retaining every eligible campaign.
    for (let offset = 0; offset < ids.length; offset += 4)
        rows.push(...await Promise.all(ids.slice(offset, offset + 4).map(readRow)));
    if (metaDraftRevision(await snapshot()) !== revision)
        throw new Error('Datele sau conexiunea s-au schimbat în timpul comparației');
    if (mode === 'anomalies') {
        const evaluated = rows.map(row => ({ ...row, anomaly: assessMetaCplAnomaly(row) }));
        const flagged = evaluated.filter(row => row.anomaly.flagged === true), unknown = evaluated.filter(row => row.anomaly.flagged === null);
        return { source: 'metaPerformanceReview', rows: evaluated, text: (flagged.length ? 'CPL neobișnuit de mare după regula de monitorizare: ' + flagged.map(row => row.campaignName).join(', ') + '.' : 'Nicio campanie evaluabilă nu depășește pragul ales.') + ' ' + META_CPL_RULE + ' Campanii verificate: ' + rows.length + '; fără clasificare CPL: ' + unknown.length + '. Detaliile și motivele sunt afișate pentru fiecare campanie. Comparația folosește două săptămâni calendaristice încheiate, în ora Bucureștiului. Este un semnal descriptiv, nu o anomalie statistică demonstrată sau o predicție. Nu am modificat campanii sau bugete.' };
    }
    if (assessment) {
        const evaluation = assessMetaPerformance(rows);
        const weak = rows.find(row => row.id === evaluation.weakerId);
        return { source: 'metaPerformanceReview', rows: rows.map(row => ({ ...row, assessment: { metric: evaluation.metric, weaker: row.id === evaluation.weakerId, reason: evaluation.reason, values: evaluation.values, certainty: evaluation.certainty }, ...((mode === 'optimize' || mode === 'certainty') && row.id === evaluation.weakerId && evaluation.recommendation ? { optimization: evaluation.recommendation } : {}) })), text: (mode === 'certainty' ? 'Separ datele raportate de ipoteze: recomandarea este o estimare, fără rezultat garantat. ' : '') + (weak ? weak.campaignName + ' este mai slabă după criteriul ' + evaluation.metric + '. ' : 'Nu pot desemna o campanie mai slabă. ') + evaluation.reason + ' ' + ((mode === 'optimize' || mode === 'certainty') && evaluation.recommendation ? evaluation.recommendation.change + ' ' + evaluation.recommendation.constraints + ' ' + evaluation.recommendation.expectedOutcome : 'Nu am modificat campanii sau bugete.') + ' Comparația privește ultimele șapte zile încheiate în ora Bucureștiului. ' + evaluation.certainty };
    }
    const detail = rows.map(row => row.campaignName + ': ' + row.current.period.since + '–' + row.current.period.until + ', cheltuieli ' + (row.current.spend === null ? 'indisponibile' : row.current.spend + ' ' + row.current.currency) + ', leaduri ' + (row.current.leads ?? 'indisponibile') + ', CPL ' + (row.current.costPerLead === null ? 'indisponibil' : row.current.costPerLead.toFixed(2) + ' ' + row.current.currency)).join('; ');
    return { source: 'metaPerformanceReview', rows, text: detail + '. ' + (mode === 'periods' ? 'Comparația cu precedentele șapte zile și diferențele sunt afișate în raport.' : 'Comparația folosește aceeași perioadă și regulă de atribuire; nu stabilește singură rentabilitatea campaniilor.') + ' Sunt ultimele șapte zile calendaristice încheiate, în ora Bucureștiului; ziua curentă este exclusă. Leadurile folosesc doar indicatorul agregat «lead», fără însumarea categoriilor suprapuse. Valorile lipsă și procentele cu bază zero rămân indisponibile. Rezultatele sunt raportate de Meta la momentul citirii și se pot actualiza ulterior; nu sunt o prognoză sau o garanție comercială. Nu am modificat campanii.' };
}
