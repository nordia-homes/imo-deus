import type { AssistantContext } from './access';
import { normalized, type AssistantMessage, type AssistantAction } from './contracts';
import { bucharestLocalToIso } from '@/lib/bucharest-time';
import { tomorrowBucharest } from './facebook-monitor';
import { facebookGroupSelection } from './facebook-setup';
import { facebookCreateSchema } from '@/lib/facebook-job-create';
export function facebookScheduleRequest(prompt: string) {
  const text = normalized(prompt).trim().replace(/[.!?]+$/, '');
  const match = /^programeaza (.+) in toate grupurile facebook eligibile maine la ([0-2]\d:[0-5]\d)$/.exec(text);
  if (!match || Number(match[2].slice(0, 2)) > 23) return null;
  const query = match[1].replace(/^(?:apartamentul|proprietatea|apartament)\s+(?:din\s+)?/, '').replace(/[„”"']/g, '').trim();
  return query ? { query, time: match[2] } : null;
}
export function facebookScheduleExecutionPrompt(prompt: string, history: AssistantMessage[]) {
  if (!/^proprietate:\s*[A-Za-z0-9_-]{1,180}\s*$/i.test(normalized(prompt).trim())) return prompt;
  const last = history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1);
  const rows = last?.cards?.find(card => card.source === 'facebookScheduleRequest')?.rows;
  return rows?.length === 1 && typeof rows[0].prompt === 'string' && facebookScheduleRequest(rows[0].prompt) ? rows[0].prompt : prompt;
}
export function facebookScheduleAction(action: AssistantAction) {
  return action.kind === 'existing_operation' && action.operation === 'facebook_job_create' && !Object.keys(action.params).length && !Object.keys(action.query).length && typeof action.body.scheduledAt === 'string' && !action.body.requestId && facebookCreateSchema.safeParse(action.body).success;
}
export async function prepareFacebookSchedule(ctx: AssistantContext, prompt: string, history: AssistantMessage[]) {
  const effective = facebookScheduleExecutionPrompt(prompt, history), request = facebookScheduleRequest(effective);
  if (!request) return null;
  const pending = history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1)?.cards?.find(card => card.source === 'facebookScheduleRequest')?.rows[0];
  const scheduledAt = effective !== prompt && typeof pending?.scheduledAt === 'string' ? pending.scheduledAt : bucharestLocalToIso(tomorrowBucharest(new Date()), request.time);
  if (!scheduledAt || !Number.isFinite(Date.parse(scheduledAt)) || Date.parse(scheduledAt) < Date.now() + 60_000) throw new Error('Ora inițială nu mai este în viitor');
  const agency = ctx.adminDb.collection('agencies').doc(ctx.agencyId);
  const member = (await ctx.adminDb.collection('users').doc(ctx.uid).get()).data();
  if (!member || member.agencyId !== ctx.agencyId || member.role !== ctx.role || !['agent', 'admin'].includes(ctx.role || '')) throw new Error('Acces revocat');
  const selected = /^proprietate:\s*([A-Za-z0-9_-]{1,180})\s*$/i.exec(prompt.trim())?.[1];
  const snapshot = await agency.collection('properties').get();
  const matches = snapshot.docs.filter(doc => {
    const row = doc.data();
    const title = normalized(String(row.title || ''));
    const apartment = /^programeaza apartament/.test(normalized(effective));
    const compatible = !apartment || (row.propertyType ? normalized(String(row.propertyType)).includes('apartament') : title.includes('apartament'));
    const searchable = [row.title, row.location, row.address].filter(value => typeof value === 'string').map(value => normalized(value)).join(' ');
    return !row.deletedAt && compatible && searchable.includes(request.query) && (!selected || doc.id === selected);
  });
  const actions: AssistantAction[] = [];
  const rows = matches.map(doc => ({ id: doc.id, title: String(doc.data().title || 'Proprietate') }));
  if (matches.length !== 1) return { actions, rows, scheduledAt, pendingPrompt: matches.length ? effective : null, text: matches.length ? 'Am găsit mai multe proprietăți. Răspunde cu „Proprietate: ID” din listă; voi continua programarea.' : 'Nu am găsit proprietatea cerută după titlu, localizare sau adresă. Precizează titlul exact al anunțului din CRM.' };
  const property = matches[0].data(), propertyId = matches[0].id;
  const connectionId = property.defaultFacebookConnectionId || member.defaultFacebookCloudConnectionId;
  if (typeof connectionId !== 'string' || !connectionId) return { actions, rows, pendingPrompt: null, text: 'Proprietatea și profilul nu au un cont Facebook implicit configurat. Setează contul dorit înainte de programare.' };
  const connection = (await agency.collection('facebookCloudConnections').doc(connectionId).get()).data();
  if (!connection || connection.ownerUid !== ctx.uid || connection.agencyId !== ctx.agencyId || connection.deletedAt || connection.status !== 'connected') return { actions, rows, pendingPrompt: null, text: 'Contul Facebook configurat nu este accesibil sau necesită reconectare. Nu am creat jobul.' };
  const agencyData = (await agency.get()).data();
  const mode = /inchir|rent/.test(normalized(String(property.transactionType))) ? 'rent' : 'sale';
  const groups = facebookGroupSelection(agencyData?.facebookGroups, mode).rows;
  if (!groups.length) return { actions, rows, pendingPrompt: null, text: 'Nu există grupuri Facebook eligibile în configurația agenției. Nu am creat jobul.' };
  actions.push({ kind: 'existing_operation', operation: 'facebook_job_create', params: {}, query: {}, body: { propertyId, connectionId, groupUrls: groups.map(group => group.url), scheduledAt } });
  return { actions, rows, pendingPrompt: null, text: 'Programez proprietatea în ' + groups.length + ' grupuri eligibile, mâine la ' + request.time + ', ora Bucureștiului.' };
}
