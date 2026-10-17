import type { PerformanceEvidence } from './meta-performance-assessment';
export const META_CPL_RULE = 'Regulă de monitorizare: CPL actual strict peste dublul CPL din precedentele șapte zile, cu minimum 5 leaduri și cheltuieli pozitive în fiecare perioadă. Pragul este euristic, nu un standard Meta.';
export function assessMetaCplAnomaly(row: PerformanceEvidence & {
    previous?: PerformanceEvidence['current'];
}) {
    const base = { flagged: null as boolean | null, currentCpl: null as number | null, previousCpl: null as number | null, ratio: null as number | null, reason: '', rule: META_CPL_RULE };
    const unknown = (reason: string) => ({ ...base, reason });
    const a = row.current, b = row.previous;
    if (row.objective !== 'leads' || !['OUTCOME_LEADS', 'LEAD_GENERATION'].includes(row.providerObjective || ''))
        return unknown('Obiectivul CRM și Meta nu confirmă leaduri; nu clasific alte obiective după CPL.');
    if (!b || !a.dataAvailable || !b.dataAvailable || a.leadMetric !== 'lead' || b.leadMetric !== 'lead' || a.currency !== b.currency)
        return unknown('Lipsesc rapoarte comparabile pentru ambele perioade.');
    const day = 86400000, stamp = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date + 'T00:00:00Z')) && new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date ? Date.parse(date + 'T00:00:00Z') : NaN;
    if ([a, b].some(p => stamp(p.period.until) - stamp(p.period.since) !== 6 * day) || stamp(a.period.since) - stamp(b.period.until) !== day)
        return unknown('Perioadele nu sunt două săptămâni consecutive complete.');
    if ([a, b].some(p => p.spend === null || !Number.isFinite(p.spend) || p.spend <= 0 || p.leads === null || !Number.isSafeInteger(p.leads) || p.leads < 0))
        return unknown('Lipsesc cheltuieli pozitive sau valori valide pentru leaduri.');
    if (a.leads === 0)
        return unknown('Există cheltuieli și zero leaduri raportate în perioada curentă. CPL este nedefinit; verifică măsurarea și campania.');
    if (a.leads! < 5 || b.leads! < 5)
        return unknown('Mai puțin de 5 leaduri în cel puțin o perioadă; bază insuficientă pentru această regulă.');
    const currentCpl = a.spend! / a.leads!, previousCpl = b.spend! / b.leads!, ratio = currentCpl / previousCpl;
    if (!Number.isFinite(ratio) || !Number.isFinite(currentCpl) || !Number.isFinite(previousCpl) || previousCpl <= 0)
        return unknown('Raportul CPL nu poate fi calculat valid.');
    const flagged = ratio > 2;
    return { ...base, flagged, currentCpl, previousCpl, ratio, reason: flagged ? 'CPL depășește de peste două ori propria perioadă precedentă. Nu demonstrează cauza, rentabilitatea sau performanța viitoare.' : 'CPL nu depășește strict dublul propriei perioade precedente. Aceasta nu certifică rentabilitatea campaniei.' };
}
