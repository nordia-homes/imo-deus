import type { AssistantContext } from './access';
import { normalized } from './contracts';
import { stableId, unseal } from '@/lib/communications/crypto';
import { discoverAuthorizedPages } from '@/lib/communications/meta';
export function socialAssetsRequest(prompt: string) { return normalized(prompt).trim().replace(/[.!?]+$/, '') === 'reimprospateaza asseturile meta pentru publicarea sociala'; }
export function safeSocialAssets(pages: Record<string, any>[]) {
  return pages.map(page => ({ id: String(page.id), name: typeof page.name === 'string' ? page.name : String(page.id), channel: 'messenger', instagramId: typeof page.instagram_business_account?.id === 'string' && /^[0-9]+$/.test(page.instagram_business_account.id) ? page.instagram_business_account.id : null, instagramUsername: typeof page.instagram_business_account?.username === 'string' ? page.instagram_business_account.username : null }));
}
export async function refreshSocialAssets(ctx: AssistantContext) {
  const grantRef = ctx.adminDb.collection('communicationGrants').doc(stableId(ctx.agencyId, 'meta'));
  let expectedToken: string | null = null;
  const authorize = () => ctx.adminDb.runTransaction(async tx => {
    const profile = (await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
    const grant = (await tx.get(grantRef)).data();
    if (ctx.role !== 'admin' || profile?.role !== 'admin' || profile.agencyId !== ctx.agencyId) throw new Error('Acces revocat');
    if (!grant || grant.agencyId !== ctx.agencyId || grant.deletedAt || typeof grant.token !== 'string' || grant.expiresAt !== null && grant.expiresAt !== undefined && (!Number.isFinite(grant.expiresAt) || grant.expiresAt <= Date.now())) throw new Error('Reconectare necesară');
    if (expectedToken !== null && grant.token !== expectedToken) throw new Error('Autorizarea s-a schimbat');
    return grant.token as string;
  });
  expectedToken = await authorize();
  const report = await discoverAuthorizedPages(unseal(expectedToken), async () => { await authorize(); });
  const rows = safeSocialAssets(report.pages);
  return { rows, complete: report.complete, refreshedAt: new Date().toISOString(), text: (report.complete ? 'Am reîmprospătat lista paginilor Meta autorizate: ' : 'Lista Meta este incompletă; am putut verifica ') + rows.length + ' pagini, cu conturile Instagram asociate disponibile. ' + (report.complete ? 'Lista a fost citită acum din Meta.' : 'Nu confirm că acestea sunt toate paginile autorizate; reîncearcă actualizarea după verificarea conexiunii.') };
}