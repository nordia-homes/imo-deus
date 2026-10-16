import type { AssistantContext } from './access';
import { normalized, type AssistantAction, type AssistantMessage } from './contracts';
import { readFacebookSetup, selectedFacebookProperty } from './facebook-setup';

export function facebookAccountRequest(prompt: string) {
  return normalized(prompt).trim().replace(/[.!?]+$/, '') === 'seteaza contul corect daca am permisiune';
}
function pendingAccount(history: AssistantMessage[]) {
  const rows = history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1)?.cards?.find(card => card.source === 'facebookAccountRequest')?.rows;
  return rows?.length === 1 && typeof rows[0].prompt === 'string' && facebookAccountRequest(rows[0].prompt) ? rows[0] : null;
}
export function facebookAccountExecutionPrompt(prompt: string, history: AssistantMessage[]) {
  return /^cont facebook:\s*[A-Za-z0-9_-]{1,180}\s*$/i.test(prompt.trim()) ? String(pendingAccount(history)?.prompt || prompt) : prompt;
}
export async function prepareFacebookAccount(ctx: AssistantContext, prompt: string, history: AssistantMessage[]) {
  const effective = facebookAccountExecutionPrompt(prompt, history);
  if (!facebookAccountRequest(effective)) return null;
  const pending = effective !== prompt ? pendingAccount(history) : null;
  const pageId = selectedFacebookProperty(history), propertyId = pending?.propertyId || pageId;
  const actions: AssistantAction[] = [];
  if (!propertyId || typeof propertyId !== 'string' || !/^[A-Za-z0-9_-]{1,180}$/.test(propertyId)) return { actions, rows: [], pending: null, text: 'Deschide proprietatea pentru care vrei să setezi contul Facebook.' };
  if (pending && pageId && pageId !== propertyId) throw new Error('Proprietatea selectată s-a schimbat');
  const property = (await ctx.adminDb.collection('agencies').doc(ctx.agencyId).collection('properties').doc(propertyId).get()).data();
  if (!property || property.deletedAt || property.agencyId && property.agencyId !== ctx.agencyId) throw new Error('Proprietate inaccesibilă');
  const setup = await readFacebookSetup(ctx, 'accounts', history);
  const rows = setup.rows.filter(row => 'publishingBlocked' in row && !row.publishingBlocked);
  const chosen = pending ? /^cont facebook:\s*([A-Za-z0-9_-]{1,180})\s*$/i.exec(prompt.trim())?.[1] : null;
  if (!chosen || !Array.isArray(pending?.connectionIds) || !pending.connectionIds.includes(chosen) || !rows.some(row => row.id === chosen)) return { actions, rows, pending: rows.length ? { id: 'pending', prompt: effective, propertyId, connectionIds: rows.map(row => row.id) } : null, text: rows.length ? 'Alege contul dorit: răspunde „Cont Facebook: ID” din listă. Îl voi salva pe proprietate.' : 'Nu există un cont Facebook propriu disponibil pentru publicare. Conectează contul înainte de setare.' };
  if (property.defaultFacebookConnectionId === chosen) return { actions, rows: [], pending: null, text: 'Contul Facebook ales este deja setat pe proprietate.' };
  actions.push({ kind: 'update_property', propertyId, expectedUpdatedAt: property.updatedAt || null, patch: { defaultFacebookConnectionId: chosen } });
  return { actions, rows: [], pending: null, text: 'Salvez contul Facebook ales pe proprietate.' };
}
