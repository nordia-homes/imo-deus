import { facebookNameMatches } from './facebook-name-match';
import type { AssistantContext } from './access';
import { canReadResource } from './access';
import { normalized, type AssistantMessage, type AssistantAction } from './contracts';
import { normalizeCrmSearch } from '@/lib/crm/search-text';
import { facebookGroupSelection, selectedFacebookProperty, readFacebookSetup } from './facebook-setup';
import { assertFacebookPropertyAvailable } from '@/lib/facebook-job-control';

export function facebookNaturalRequest(prompt: string) {
  const text = normalized(prompt).replace(/[.!?]+$/, '');
  const match = /^(?:publica|posteaza) (apartamentul|proprietatea|anuntul|casa|garsoniera)(.*?) (?:pe|in) (?:toate )?grupurile facebook(?: eligibile)?$/.exec(text);
  if (!match || /\b(?:nu|maine|poimaine|ora|apoi|dupa|doar|numai|fara|exceptand|si trimite|si contacteaza)\b/.test(match[2])) return null;
  const query = match[2].trim().replace(/^(?:din|de pe)\s+/, '').replace(/^[„”"']|[„”"']$/g, '').replace(/,+$/, '').trim();
  return { query: /^(?:aceasta|acesta|selectata|selectat)$/.test(query) ? '' : query, propertyType: match[1] === 'apartamentul' ? 'apartament' : match[1] === 'casa' ? 'casa' : match[1] === 'garsoniera' ? 'garsoniera' : null };
}
function pendingRequest(history: AssistantMessage[]) {
  const row = history.filter(m => m.role === 'assistant' && m.id !== 'current-page-context').at(-1)?.cards?.find(c => c.source === 'facebookImmediateRequest')?.rows[0];
  return row && typeof row.prompt === 'string' && facebookNaturalRequest(row.prompt) ? row : null;
}
export function facebookNaturalExecutionPrompt(prompt: string, history: AssistantMessage[]) {
  return /^(?:proprietate|cont facebook):\s*[A-Za-z0-9_-]{1,180}\s*$/i.test(prompt) ? String(pendingRequest(history)?.prompt || prompt) : prompt;
}
export function matchesFacebookProperty(row: Record<string, unknown>, query: string) {
  // Join initials (C.A. / C A / CA) and spacing variants (ultra central).
  const canonical = (s: unknown) => normalizeCrmSearch(s).replace(/\b([a-z])\s+(?=[a-z]\b)/g, '$1');
  const fields = [row.title, row.location, row.address].filter(v => typeof v === 'string').map(canonical);
  const tokens = canonical(query).split(' ').filter(token => token && !['din','de','pe','la','strada','str','bulevardul','bd'].includes(token));
  return tokens.length > 0 && tokens.every(token => fields.some(field => field.includes(token) || field.replace(/ /g, '').includes(token)));
}
export type FacebookPublicationInput = { query: string; propertyId?: string; connectionId?: string; connectionQuery?: string; groupUrls?: string[] };
export async function prepareFacebookPublication(ctx: AssistantContext, input: FacebookPublicationInput) {
  return prepareFacebookNatural(ctx, '', [], input);
}
export async function prepareFacebookNatural(ctx: AssistantContext, prompt: string, history: AssistantMessage[], semantic?: FacebookPublicationInput) {
  const effective = semantic ? prompt : facebookNaturalExecutionPrompt(prompt, history), request = semantic ? { query: semantic.propertyId ? '' : semantic.query, propertyType: null } : facebookNaturalRequest(effective);
  if (!request) return null;
  const pending = effective !== prompt ? pendingRequest(history) : null;
  const agency = ctx.adminDb.collection('agencies').doc(ctx.agencyId);
  const member = (await ctx.adminDb.collection('users').doc(ctx.uid).get()).data();
  if (!member || member.agencyId !== ctx.agencyId || member.role !== ctx.role || !['agent', 'admin'].includes(ctx.role || '')) throw new Error('Acces revocat');
  const actions: AssistantAction[] = [];
  const empty = { actions, rows: [] as Record<string, any>[], source: 'properties', pending: null };
  const chosen = semantic?.propertyId || /^proprietate:\s*([A-Za-z0-9_-]{1,180})\s*$/i.exec(prompt)?.[1];
  if (!semantic && chosen && (!Array.isArray(pending?.propertyIds) || !pending.propertyIds.includes(chosen))) return { ...empty, text: 'Alege o proprietate din lista oferită.' };
  const pageId = selectedFacebookProperty(history);
  const propertyId = chosen || (typeof pending?.propertyId === 'string' ? pending.propertyId : !request.query ? pageId : null);
  if (pending?.propertyId && pageId && pageId !== pending.propertyId) return { ...empty, text: 'Proprietatea selectată s-a schimbat. Reia comanda pentru proprietatea dorită.' };
  if (!propertyId && !request.query) return { ...empty, text: 'Precizează proprietatea sau deschide anunțul din CRM pentru publicare.' };
  const docs = propertyId ? [await agency.collection('properties').doc(propertyId).get()] : (await agency.collection('properties').get()).docs;
  const matches = docs.filter(doc => {
    const row = doc.data();
    return row && (!request.propertyType || !row.propertyType || (request.propertyType === 'apartament' ? /apartament|garsonier/.test(normalizeCrmSearch(row.propertyType)) : normalizeCrmSearch(row.propertyType).includes(request.propertyType))) && !row.deletedAt && canReadResource(ctx, 'properties', row) && (!request.query || matchesFacebookProperty(row, request.query));
  });
  if (!matches.length && !propertyId && request.query) {
    // Partial textual matches are suggestions only: never silently publish one.
    const terms = normalizeCrmSearch(request.query).split(' ').filter(token => token.length >= 4 && !['apartament','apartamentul','proprietate','proprietatea','publica','posteaza','facebook','grupurile','strada'].includes(token));
    const candidates = docs.filter(doc => {const row=doc.data(); return row && !row.deletedAt && canReadResource(ctx,'properties',row) && terms.some(term=>matchesFacebookProperty(row,term));});
    if(candidates.length) return {...empty,rows:candidates.map(doc=>({id:doc.id,title:String(doc.data()?.title || 'Proprietate')})),pending:{id:'pending',prompt:effective,propertyIds:candidates.map(doc=>doc.id)},text:'Nu am o potrivire exactă pentru toate detaliile, dar am găsit aceste proprietăți cu elemente comune. Care este cea dorită? Confirmă titlul sau adresa; nu am pregătit încă publicarea.'};
  }
  const rows = matches.map(doc => ({ id: doc.id, title: String(doc.data()?.title || 'Proprietate') }));
  if (matches.length !== 1) return { ...empty, rows, pending: matches.length ? { id: 'pending', prompt: effective, propertyIds: matches.map(d => d.id) } : null, text: matches.length ? 'Am găsit mai multe proprietăți care corespund. Pe care vrei să o public? Poți scrie titlul ori adresa sau o poți alege din listă.' : 'Nu am găsit proprietatea cerută în CRM. Precizează titlul sau adresa.' };
  const property = matches[0].data()!, selectedId = matches[0].id;
  assertFacebookPropertyAvailable(property, ctx.agencyId);
  const selectedConnection = semantic?.connectionId || /^cont facebook:\s*([A-Za-z0-9_-]{1,180})\s*$/i.exec(prompt)?.[1];
  if (!semantic && selectedConnection && (!Array.isArray(pending?.connectionIds) || !pending.connectionIds.includes(selectedConnection))) return { ...empty, text: 'Alege un cont din lista oferită.' };
  let namedConnection: string | undefined;
  if (semantic?.connectionQuery) {
    const available = (await readFacebookSetup(ctx, 'accounts', history)).rows.filter(row => 'publishingBlocked' in row && !row.publishingBlocked);
    const matches = facebookNameMatches(available,semantic.connectionQuery);
    const suggestions = matches.suggestions;
    const matching = matches.exact.length ? matches.exact : suggestions.length === 1 ? suggestions : [];
    if (!matching.length && suggestions.length) return {...empty,source:'facebookConnections',rows:suggestions,pending:{id:'pending',prompt:effective,propertyId:selectedId,propertyTitle:String(property.title||'Proprietate'),connectionIds:suggestions.map(row=>row.id)},text:suggestions.length===1?'Te referi la contul Facebook „'+suggestions[0].label+'”? Spune da pentru a continua cererea începută sau indică alt cont.':'Am găsit mai multe conturi cu nume apropiate. Pe care îl folosesc?'};
    if (matching.length !== 1 || (selectedConnection && selectedConnection !== matching[0].id)) return { ...empty, source: 'facebookConnections', rows: matching.length ? matching : available, pending: available.length ? {id:'pending',prompt:effective,propertyId:selectedId,propertyTitle:String(property.title || 'Proprietate'),connectionIds:available.map(row=>row.id)} : null, text: !available.length ? 'Nu există un cont propriu conectat și disponibil pentru publicare. Conectează contul Facebook și apoi reia cererea.' : matching.length > 1 ? 'Mai multe conturi corespund acestui nume. Pe care îl folosesc? Poți scrie denumirea completă sau alege din listă.' : 'Nu pot identifica sigur contul după numele indicat. Iată conturile tale disponibile; spune-mi denumirea dorită sau alege din listă.' };
    namedConnection = String(matching[0].id);
  }
  let connectionId = namedConnection || selectedConnection || property.defaultFacebookConnectionId || member.defaultFacebookCloudConnectionId;
  if (!connectionId) {
    const available = (await readFacebookSetup(ctx, 'accounts', history)).rows.filter(row => 'publishingBlocked' in row && !row.publishingBlocked);
    if (available.length === 1) connectionId = available[0].id;
    else return { ...empty, source: 'facebookConnections', rows: available, pending: available.length ? { id: 'pending', prompt: effective, propertyId: selectedId, propertyTitle: String(property.title || 'Proprietate'), connectionIds: available.map(row => row.id) } : null, text: available.length ? 'Am identificat proprietatea „' + String(property.title || 'Proprietate') + '”. De pe ce cont Facebook vrei să public? Scrie numele contului sau alege-l din lista afișată.' : 'Nu există un cont Facebook propriu conectat și disponibil pentru publicare.' };
  }
  if (typeof connectionId !== 'string' || !/^[A-Za-z0-9_-]{1,180}$/.test(connectionId)) throw new Error('Cont invalid');
  const connection = (await agency.collection('facebookCloudConnections').doc(connectionId).get()).data();
  if (!connection || connection.ownerUid !== ctx.uid || connection.agencyId !== ctx.agencyId || connection.deletedAt || connection.status !== 'connected') return { ...empty, text: 'Contul configurat nu este disponibil pentru publicare automată Facebook. Verifică setarea sau reconectează contul.' };
  if (connection.runnerMode === 'local') {
    const deviceId = typeof connection.deviceId === 'string' && /^[A-Za-z0-9_.:-]{1,180}$/.test(connection.deviceId) ? connection.deviceId : null;
    const device = deviceId ? (await agency.collection('facebookLocalRunnerDevices').doc(deviceId).get()).data() : null;
    if (!device || device.ownerUid !== ctx.uid || device.revokedAt) return { ...empty, text: 'Dispozitivul automatizării Facebook nu mai este disponibil pentru acest cont.' };
  }
  const mode = /inchir|rent/.test(normalized(String(property.transactionType))) ? 'rent' : 'sale';
  const eligibleGroups = facebookGroupSelection((await agency.get()).data()?.facebookGroups, mode).rows;
  if (semantic?.groupUrls?.some(url => !eligibleGroups.some(group => group.url === url))) return { ...empty, text: 'Un grup cerut nu este eligibil pentru această proprietate.' };
  const groups = semantic?.groupUrls ? eligibleGroups.filter(group => semantic.groupUrls!.includes(group.url)) : eligibleGroups;
  if (!groups.length) return { ...empty, text: 'Nu există grupuri eligibile pentru această proprietate.' };
  actions.push({ kind: 'existing_operation', operation: 'facebook_job_create', params: {}, query: {}, body: { propertyId: selectedId, connectionId, groupUrls: groups.map(g => g.url), scheduledAt: null } });
  return { ...empty, rows, text: 'Creez jobul de publicare automată Facebook în ' + groups.length + ' grupuri eligibile, cu descrierea și pozele exacte din CRM.' };
}
