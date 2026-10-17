import type { AssistantContext } from './access';
import { normalized } from './contracts';
import { isDemoAgencyId } from '@/lib/demo/guards';
import { bucharestInputFromIso } from '@/lib/bucharest-time';
export function metaAssetsRequest(prompt: string) { const text = normalized(prompt).trim().replace(/[.!?]+$/, ''); return text === 'arata-mi asseturile disponibile' ? 'list' : text === 'reimprospateaza asseturile meta' ? 'refresh' : null; }
export async function prepareMetaAssets(ctx: AssistantContext, prompt: string) {
    const mode = metaAssetsRequest(prompt);
    if (!mode)
        return null;
    if (isDemoAgencyId(ctx.agencyId) || ctx.runtimeMode === 'demo')
        throw Error('Asseturi externe indisponibile în demo.');
    const { listMetaMarketingAssets } = await import('@/lib/meta-marketing');
    const assets = await listMetaMarketingAssets(ctx.agencyId, { uid: ctx.uid, role: ctx.role }), time = bucharestInputFromIso(new Date().toISOString()), checkedAt = time.date + ' ' + time.time + ', București';
    const rows: Record<string, unknown>[] = [];
    for (const b of assets.businesses)
        rows.push({ id: 'business/' + b.id, assetId: b.id, assetType: 'Business', name: b.name, selected: assets.selected.business?.id === b.id, checkedAt });
    for (const a of assets.adAccounts)
        rows.push({ id: 'account/' + a.id, assetId: a.id, assetType: 'Cont publicitar', name: a.name, currency: a.currency, selected: assets.selected.adAccount?.id === a.id, eligible: a.timezoneName === 'Europe/Bucharest', reason: a.timezoneName === 'Europe/Bucharest' ? 'Fus orar București confirmat.' : 'Contul nu confirmă fusul orar București; nu este eligibil pentru configurare.', checkedAt });
    for (const p of assets.pages) {
        rows.push({ id: 'page/' + p.id, assetId: p.id, assetType: 'Pagină Facebook', name: p.name, selected: assets.selected.page?.id === p.id, checkedAt });
        if (p.instagramBusinessAccount)
            rows.push({ id: 'instagram/' + p.id + '/' + p.instagramBusinessAccount.id, assetId: p.instagramBusinessAccount.id, assetType: 'Instagram asociat paginii', pageId: p.id, name: p.instagramBusinessAccount.name, username: p.instagramBusinessAccount.username, selected: assets.selected.instagramAccount?.id === p.instagramBusinessAccount.id, checkedAt });
    }
    const available = { business: assets.businesses.map(r => r.id), adAccount: assets.adAccounts.map(r => r.id), page: assets.pages.map(r => r.id), instagramAccount: assets.pages.flatMap(r => r.instagramBusinessAccount ? [r.instagramBusinessAccount.id] : []) };
    const missing = Object.entries(assets.selected).filter(([kind, value]) => value && !available[kind as keyof typeof available].includes(value.id)).map(([kind]) => kind);
    return { source: 'metaAssetsReview', rows, text: (mode === 'refresh' ? 'Am reîmprospătat' : 'Am citit') + ' lista disponibilă prin conexiunea Meta a agenției: ' + assets.businesses.length + ' businessuri, ' + assets.adAccounts.length + ' conturi publicitare și ' + assets.pages.length + ' pagini. ' + (missing.length ? 'Selecții salvate care nu mai apar în listă: ' + missing.join(', ') + '. ' : '') + 'Lista descrie accesul conexiunii curente, nu toate asseturile existente la Meta. Conturile trebuie să folosească București pentru configurare. Nu am schimbat selecțiile și nu am publicat campanii.' };
}
