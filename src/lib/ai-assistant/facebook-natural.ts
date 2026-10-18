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
  const tokens = canonical(query).split(' ').filter(Boolean);
  return tokens.length > 0 && tokens.every(token => fields.some(field => field.includes(token) || field.replace(/ /g, '').includes(token)));
}
export async function prepareFacebookNatural(ctx: AssistantContext, prompt: string, history: AssistantMessage[]) {
  const effective = facebookNaturalExecutionPrompt(prompt, history), request = facebookNaturalRequest(effective);
  if (!request) return null;
  const pending = effective !== prompt ? pendingRequest(history) : null;
  const agency = ctx.adminDb.collection('agencies').doc(ctx.agencyId);
  const member = (await ctx.adminDb.collection('users').doc(ctx.uid).get()).data();
  if (!member || member.agencyId !== ctx.agencyId || member.role !== ctx.role || !['agent', 'admin'].includes(ctx.role || '')) throw new Error('Acces revocat');
  const actions: AssistantAction[] = [];
  const empty = { actions, rows: [] as Record<string, any>[], source: 'properties', pending: null };
  const chosen = /^proprietate:\s*([A-Za-z0-9_-]{1,180})\s*$/i.exec(prompt)?.[1];
  if (chosen && (!Array.isArray(pending?.propertyIds) || !pending.propertyIds.includes(chosen))) return { ...empty, text: 'Alege o proprietate din lista oferită.' };
  const pageId = selectedFacebookProperty(history);
  const propertyId = chosen || (typeof pending?.propertyId === 'string' ? pending.propertyId : !request.query ? pageId : null);
  if (pending?.propertyId && pageId && pageId !== pending.propertyId) return { ...empty, text: 'Proprietatea selectată s-a schimbat. Reia comanda pentru proprietatea dorită.' };
  if (!propertyId && !request.query) return { ...empty, text: 'Precizează proprietatea sau deschide anunțul din CRM pentru publicare.' };
  const docs = propertyId ? [await agency.collection('properties').doc(propertyId).get()] : (await agency.collection('properties').get()).docs;
  const matches = docs.filter(doc => {
    const row = doc.data();
    return row && (!request.propertyType || !row.propertyType || (request.propertyType === 'apartament' ? /apartament|garsonier/.test(normalizeCrmSearch(row.propertyType)) : normalizeCrmSearch(row.propertyType).includes(request.propertyType))) && !row.deletedAt && canReadResource(ctx, 'properties', row) && (!request.query || matchesFacebookProperty(row, request.query));
  });
  const rows = matches.map(doc => ({ id: doc.id, title: String(doc.data()?.title || 'Proprietate') }));
  if (matches.length !== 1) return { ...empty, rows, pending: matches.length ? { id: 'pending', prompt: effective, propertyIds: matches.map(d => d.id) } : null, text: matches.length ? 'Am găsit mai multe proprietăți. Răspunde „Proprietate: ID” din listă pentru a continua publicarea.' : 'Nu am găsit proprietatea cerută în CRM. Precizează titlul sau adresa.' };
  const property = matches[0].data()!, selectedId = matches[0].id;
  assertFacebookPropertyAvailable(property, ctx.agencyId);
  const selectedConnection = /^cont facebook:\s*([A-Za-z0-9_-]{1,180})\s*$/i.exec(prompt)?.[1];
  if (selectedConnection && (!Array.isArray(pending?.connectionIds) || !pending.connectionIds.includes(selectedConnection))) return { ...empty, text: 'Alege un cont din lista oferită.' };
  let connectionId = selectedConnection || property.defaultFacebookConnectionId || member.defaultFacebookCloudConnectionId;
  if (!connectionId) {
    const available = (await readFacebookSetup(ctx, 'accounts', history)).rows.filter(row => 'publishingBlocked' in row && !row.publishingBlocked);
    if (available.length === 1) connectionId = available[0].id;
    else return { ...empty, source: 'facebookConnections', rows: available, pending: available.length ? { id: 'pending', prompt: effective, propertyId: selectedId, connectionIds: available.map(row => row.id) } : null, text: available.length ? 'Alege contul pentru publicare: „Cont Facebook: ID”.' : 'Nu există un cont Facebook propriu conectat și disponibil pentru publicare.' };
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
  const groups = facebookGroupSelection((await agency.get()).data()?.facebookGroups, mode).rows;
  if (!groups.length) return { ...empty, text: 'Nu există grupuri eligibile pentru această proprietate.' };
  actions.push({ kind: 'existing_operation', operation: 'facebook_job_create', params: {}, query: {}, body: { propertyId: selectedId, connectionId, groupUrls: groups.map(g => g.url), scheduledAt: null } });
  return { ...empty, rows, text: 'Creez jobul de publicare automată Facebook în ' + groups.length + ' grupuri eligibile, cu descrierea și pozele exacte din CRM.' };
}
