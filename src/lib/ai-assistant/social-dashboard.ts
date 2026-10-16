import type { AssistantContext } from './access';
import { normalized } from './contracts';

export function socialDashboardRequest(prompt: string) {
  const text = normalized(prompt).trim().replace(/[.!?]+$/, '');
  return text === 'arata-mi dashboardul social' ? 'dashboard' : text === 'spune-mi ce conexiune are probleme' ? 'problems' : null;
}
export function socialConnectionSummary(id: string, raw: Record<string, any>) {
  const status = ['connected', 'disconnected'].includes(raw.status) ? raw.status : 'unknown';
  const capabilities = ['publish', 'comments', 'insights'].map(capability => {
    const state = raw.capabilities?.[capability]?.status;
    return { capability, status: ['active', 'configuration_required', 'reconnect_required', 'unavailable'].includes(state) ? state : 'unknown' };
  });
  const blocked = status !== 'connected' || capabilities.some(row => row.status !== 'active');
  return { id, name: typeof raw.name === 'string' ? raw.name : 'Conexiune socială', channel: raw.channel, status, capabilities, needsAttention: blocked,
    updatedAt: typeof raw.updatedAt === 'string' && Number.isFinite(Date.parse(raw.updatedAt)) ? new Date(raw.updatedAt).toISOString() : null };
}
export async function readSocialDashboard(ctx: AssistantContext, mode: 'dashboard' | 'problems') {
  return ctx.adminDb.runTransaction(async tx => {
    const profile = (await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
    if (!profile || profile.agencyId !== ctx.agencyId || profile.role !== ctx.role || !['agent', 'admin'].includes(ctx.role || '')) throw new Error('Acces revocat');
    const agency = ctx.adminDb.collection('agencies').doc(ctx.agencyId);
    const snapshot = await tx.get(agency.collection('channelConnections'));
    const connections = snapshot.docs.filter(doc => { const row = doc.data(); return row.agencyId === ctx.agencyId && !row.deletedAt && ['messenger', 'instagram'].includes(row.channel); }).map(doc => socialConnectionSummary(doc.id, doc.data())).sort((a, b) => a.id.localeCompare(b.id));
    const selected = mode === 'problems' ? connections.filter(row => row.needsAttention) : connections;
    const posts: Record<string, unknown>[] = [];
    // Match the existing social-post API: post history is restricted to agency administrators.
    if (mode === 'dashboard' && ctx.role === 'admin') {
      const recent = await tx.get(agency.collection('socialPosts').orderBy('createdAt', 'desc').limit(50));
      for (const doc of recent.docs) {
        const row = doc.data(); if (row.agencyId !== ctx.agencyId || row.deletedAt) continue;
        const destinations = Object.entries(row.destinations || {}).map(([connectionId, value]) => {
          const destination = value as Record<string, unknown> | null;
          return { connectionId, status: ['draft', 'queued', 'processing', 'published', 'failed', 'unknown', 'deleted'].includes(String(destination?.status)) ? String(destination?.status) : 'unknown' };
        });
        posts.push({ id: doc.id, propertyId: typeof row.propertyId === 'string' ? row.propertyId : null, propertyTitle: typeof row.propertyTitle === 'string' ? row.propertyTitle : 'Proprietate', status: ['draft', 'queued', 'processing', 'published', 'needs_review', 'deleted'].includes(row.status) ? row.status : 'unknown', destinations });
      }
    }
    const details = selected.map(row => row.name + ' (' + row.id + '): ' + row.status + '; ' + row.capabilities.map(cap => cap.capability + '=' + cap.status).join(', ')).join('\n');
    return { connections: selected, posts, text: (mode === 'problems' ? 'Conexiuni sociale cu limitări sau stare neconfirmată: ' : 'Conexiuni sociale configurate: ') + selected.length + '.\n' + details + (mode === 'dashboard' ? ctx.role === 'admin' ? '\nIstoric: ' + posts.length + ' postări din ultimele 50 de înregistrări. Nu reprezintă totalul istoric.' : '\nIstoricul postărilor sociale este disponibil administratorului în fluxul existent.' : '') + '\nStare salvată în aplicație pentru paginile Facebook și Instagram. Nu am verificat live accesul Meta, performanța sau publicarea și nu am reconectat conturi.' };
  });
}
