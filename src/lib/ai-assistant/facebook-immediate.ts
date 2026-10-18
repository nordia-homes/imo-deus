import { facebookNaturalRequest, facebookNaturalExecutionPrompt, prepareFacebookNatural } from './facebook-natural';
import type { AssistantContext } from './access';
import { normalized, type AssistantMessage, type AssistantAction } from './contracts';
import { facebookGroupSelection, selectedFacebookProperty } from './facebook-setup';
import { facebookCreateSchema } from '@/lib/facebook-job-create';

export function facebookImmediateRequest(prompt: string) {
  return Boolean(facebookNaturalRequest(prompt)) || ['publica proprietatea acum in grupurile selectate', 'creeaza jobul de publicare facebook'].includes(normalized(prompt).trim().replace(/[.!?]+$/, ''));
}
function pendingSelection(history: AssistantMessage[]) {
  const rows = history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1)?.cards?.find(card => card.source === 'facebookImmediateRequest')?.rows;
  return rows?.length === 1 && typeof rows[0].prompt === 'string' && facebookImmediateRequest(rows[0].prompt) ? rows[0] : null;
}
export function facebookImmediateExecutionPrompt(prompt: string, history: AssistantMessage[]) {
  const natural = facebookNaturalExecutionPrompt(prompt, history);
  if (natural !== prompt) return natural;
  return /^grupuri facebook:\s*[a-f0-9,\s]+$/i.test(prompt.trim()) ? String(pendingSelection(history)?.prompt || prompt) : prompt;
}
export function facebookImmediateAction(action: AssistantAction) {
  return action.kind === 'existing_operation' && action.operation === 'facebook_job_create' && !Object.keys(action.params).length && !Object.keys(action.query).length && action.body.scheduledAt === null && !action.body.requestId && facebookCreateSchema.safeParse(action.body).success;
}
export async function prepareFacebookImmediate(ctx: AssistantContext, prompt: string, history: AssistantMessage[]) {
  const natural = await prepareFacebookNatural(ctx, prompt, history);
  if (natural) return natural;
  const effective = facebookImmediateExecutionPrompt(prompt, history);
  if (!facebookImmediateRequest(effective)) return null;
  const pending = effective !== prompt ? pendingSelection(history) : null;
  const pageId = selectedFacebookProperty(history);
  if (pending && pageId && pageId !== pending.propertyId) throw new Error('Proprietatea selectată s-a schimbat');
  const propertyId = pending?.propertyId || pageId;
  const actions: AssistantAction[] = [];
  const empty = { actions, rows: [], pending: null };
  if (typeof propertyId !== 'string' || !/^[A-Za-z0-9_-]{1,180}$/.test(propertyId)) return { ...empty, text: 'Deschide o proprietate din CRM, apoi cere publicarea în grupurile Facebook.' };
  const agency = ctx.adminDb.collection('agencies').doc(ctx.agencyId);
  const profile = (await ctx.adminDb.collection('users').doc(ctx.uid).get()).data();
  if (!profile || profile.agencyId !== ctx.agencyId || profile.role !== ctx.role || !['agent', 'admin'].includes(ctx.role || '')) throw new Error('Acces revocat');
  const property = (await agency.collection('properties').doc(propertyId).get()).data();
  if (!property || property.deletedAt || property.agencyId && property.agencyId !== ctx.agencyId) throw new Error('Proprietate inaccesibilă');
  const mode = /inchir|rent/.test(normalized(String(property.transactionType))) ? 'rent' : 'sale';
  const groups = facebookGroupSelection((await agency.get()).data()?.facebookGroups, mode).rows;
  const selection = pending ? prompt.replace(/^grupuri facebook:\s*/i, '').split(/[\s,]+/).filter(Boolean) : [];
  const requested = [...new Set(selection)];
  const offered = Array.isArray(pending?.groupIds) ? pending.groupIds : [];
  if (!requested.length || requested.some(id => !offered.includes(id) || !groups.some(group => group.id === id))) {
    return { actions, rows: groups, pending: groups.length ? { id: 'pending', prompt: effective, propertyId, groupIds: groups.map(group => group.id) } : null, text: groups.length ? 'Bifează grupurile pentru această proprietate și apasă „Publică în grupurile selectate”. Voi crea jobul folosind descrierea și pozele din CRM.' : 'Nu există grupuri eligibile pentru această proprietate.' };
  }
  const connectionId = property.defaultFacebookConnectionId || profile.defaultFacebookCloudConnectionId;
  if (typeof connectionId !== 'string' || !/^[A-Za-z0-9_-]{1,180}$/.test(connectionId)) return { ...empty, text: 'Configurează contul Facebook al proprietății sau contul implicit al profilului înainte de publicare.' };
  actions.push({ kind: 'existing_operation', operation: 'facebook_job_create', params: {}, query: {}, body: { propertyId, connectionId, groupUrls: groups.filter(group => requested.includes(group.id)).map(group => group.url), scheduledAt: null } });
  return { actions, rows: [], pending: null, text: 'Creez jobul pentru grupurile selectate, cu descrierea și pozele proprietății din CRM.' };
}
