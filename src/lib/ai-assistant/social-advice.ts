import type { AssistantContext } from './access';
import { normalized } from './contracts';
import { compareSocialPerformance } from './social-performance';
import { readSocialDashboard } from './social-dashboard';
import { INSTAGRAM_POST_LIMITS } from '@/lib/communications/social';

export function socialAdviceRequest(prompt: string) {
  const text = normalized(prompt).trim().replace(/[.!?]+$/, '');
  return text === 'recomanda ce tip de postare sa fac data viitoare' ? 'recommend' : text === 'nu presupune ca regulile celor doua platforme sunt identice' ? 'rules' : null;
}
const labels: Record<string, string> = { text: 'text', photo: 'o fotografie', gallery: 'mai multe fotografii' };
export function recommendSocialFormats(rows: Record<string, any>[], complete: boolean) {
  const groups = new Map<string, { connectionId: string; channel: string; formats: Map<string, { count: number; sum: number }>; excluded: number }>();
  for (const row of rows) {
    const key = row.connectionId + ':' + row.channel;
    const group = groups.get(key) || { connectionId: row.connectionId, channel: row.channel, formats: new Map(), excluded: 0 };
    groups.set(key, group);
    if (!row.available || !labels[row.format] || !Number.isSafeInteger(row.likes) || row.likes < 0 || !Number.isSafeInteger(row.comments) || row.comments < 0 || !Number.isSafeInteger(row.likes + row.comments)) { group.excluded++; continue; }
    const format = group.formats.get(row.format) || { count: 0, sum: 0 };
    if (!Number.isSafeInteger(format.sum + row.likes + row.comments)) { group.excluded++; continue; }
    format.count++; format.sum += row.likes + row.comments; group.formats.set(row.format, format);
  }
  return [...groups.values()].map(group => {
    const samples = [...group.formats].map(([format, value]) => ({ format, count: value.count, meanInteractions: value.sum / value.count }));
    const ranked = samples.filter(sample => sample.count >= 2).sort((a, b) => b.meanInteractions - a.meanInteractions);
    const winner = ranked.length >= 2 && ranked[0].meanInteractions > ranked[1].meanInteractions ? ranked[0] : null;
    const channel = group.channel === 'instagram' ? 'Instagram' : 'Facebook';
    const recommendation = winner ? 'Testează încă o postare cu ' + labels[winner.format] + ' pe același cont: în eșantion, acest format are media cea mai mare de aprecieri + comentarii dintre formatele cu minimum două postări.' : group.channel === 'instagram' ? 'Testează o postare cu o fotografie reală a proprietății și urmărește rezultatele; datele nu susțin alegerea unui format câștigător.' : 'Testează o postare cu fotografii reale ale proprietății și urmărește rezultatele; datele nu susțin alegerea unui format câștigător.';
    return { id: group.connectionId, connectionId: group.connectionId, channel: group.channel, samples, excluded: group.excluded, recommendedFormat: winner?.format || null, evidence: winner ? 'observed_sample' : 'insufficient_comparable_data', complete, description: channel + ': ' + recommendation };
  });
}
export async function prepareSocialAdvice(ctx: AssistantContext, mode: 'recommend' | 'rules') {
  if (mode === 'recommend') {
    const report = await compareSocialPerformance(ctx);
    const rows = recommendSocialFormats(report.rows, report.complete);
    return { rows, source: 'socialRecommendation', complete: report.complete, text: (rows.length ? rows.map(row => row.description).join('\n') : 'Nu există postări publicate eligibile pentru comparație. Ca experiment inițial, folosește fotografii reale și datele actuale ale proprietății.') + '\nRecomandarea este un experiment, nu o promisiune de performanță. Mediile sunt totaluri cumulative; vechimea postărilor, audiența și promovarea plătită nu sunt controlate. Nu compar conturi sau platforme între ele și nu deduc vânzări ori conversii. Analiza folosește maximum 20 de destinații recente.' + (report.complete ? '' : ' Istoricul analizat este incomplet.') + '\nNu am creat sau publicat o postare.' };
  }
  const dashboard = await readSocialDashboard(ctx, 'dashboard');
  const rows = dashboard.connections.map(row => ({ id: row.id, name: row.name, channel: row.channel, status: row.status, publishStatus: row.capabilities.find(cap => cap.capability === 'publish')?.status || 'unknown', description: row.name + ': ' + (row.status === 'connected' && row.capabilities.some(cap => cap.capability === 'publish' && cap.status === 'active') ? 'publicare configurată' : 'publicare indisponibilă sau neconfirmată') }));
  return { rows, source: 'socialPlatformRules', complete: true, text: 'Integrarea existentă tratează separat canalele:\nFacebook: permite text fără fotografie și fotografii atașate; în acest flux nu este definită o limită locală de text sau fotografii, ceea ce nu înseamnă lipsa limitelor Meta.\nInstagram: necesită cel puțin o fotografie, maximum ' + INSTAGRAM_POST_LIMITS.images + ' fotografii și ' + INSTAGRAM_POST_LIMITS.text + ' de caractere. Materialul trebuie procesat înainte de publicare; simpla creare a containerului nu confirmă publicarea.\nAprecierea comentariilor este disponibilă aici pentru Facebook, nu pentru Instagram. Acestea sunt condițiile integrării aplicației, nu o listă exhaustivă a regulilor platformelor.\n' + rows.map(row => row.description).join('\n') + '\nStarea conturilor este citită din configurația curentă; accesul live Meta nu a fost verificat. Pentru grupurile Facebook se păstrează descrierea și fotografiile CRM. Nu am publicat nimic.' };
}