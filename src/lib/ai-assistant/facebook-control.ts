import { z } from 'zod';
import type { AssistantContext } from './access';
import { normalized, type AssistantAction, type AssistantMessage } from './contracts';
import { bucharestInputFromIso, bucharestLocalToIso } from '@/lib/bucharest-time';
import { readFacebookMonitor } from './facebook-monitor';
import { assertFacebookControlState } from '@/lib/facebook-job-control';
export function facebookControlRequest(prompt: string): { mode: 'move' | 'cancel' | 'shift'; time?: string } | null {
  const text = normalized(prompt).trim().replace(/[.!?]+$/, '');
  if (text === 'anuleaza jobul daca fluxul suporta anularea') return { mode: 'cancel' };
  if (text === 'muta toate joburile selectate cu o ora mai tarziu') return { mode: 'shift' };
  const move = /^muta jobul selectat la ora ([0-2]\d:[0-5]\d)$/.exec(text);
  if (move && Number(move[1].slice(0, 2)) < 24) return { mode: 'move', time: move[1] };
  return null;
}
export function facebookControlExecutionPrompt(prompt: string, history: AssistantMessage[]) {
  if (!/^(?:job facebook:\s*[A-Za-z0-9_-]{1,180}|joburi facebook:\s*[A-Za-z0-9_,\s-]+)\s*$/i.test(prompt.trim())) return prompt;
  const last = history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1);
  const pending = last?.cards?.find(card => card.source === 'facebookControlRequest')?.rows;
  if (/^joburi facebook:/i.test(prompt.trim()) && facebookControlRequest(String(pending?.[0]?.prompt || ''))?.mode !== 'shift') return prompt;
  return pending?.length === 1 && typeof pending[0].prompt === 'string' && facebookControlRequest(pending[0].prompt) ? pending[0].prompt : prompt;
}
const revision = z.string().datetime();
const moveSchema = z.object({ expectedUpdatedAt: revision, scheduledAt: revision, connectionId: z.string().min(1), groupUrls: z.array(z.string().url()).min(1) }).strict();
const cancelSchema = z.object({ expectedUpdatedAt: revision }).strict();
export function facebookControlAction(action: AssistantAction) {
  return action.kind === 'existing_operation' && Object.keys(action.params).length === 1 && Boolean(action.params.jobId) && Object.keys(action.query).length === 0 && (action.operation === 'facebook_job_update' ? moveSchema.safeParse(action.body).success : action.operation === 'facebook_job_remove' && cancelSchema.safeParse(action.body).success);
}
export function requestedFacebookControl(action: AssistantAction, prompt: string) {
  if (!facebookControlAction(action) || action.kind !== 'existing_operation') return false;
  const request = facebookControlRequest(prompt);
  return action.operation === 'facebook_job_remove' ? request?.mode === 'cancel' : request?.mode === 'shift' || request?.mode === 'move' && bucharestInputFromIso(String(action.body.scheduledAt)).time === request.time;
}
export async function prepareFacebookShift(ctx: AssistantContext, prompt: string, effectivePrompt: string, history: AssistantMessage[]) {
  const selectedIds = effectivePrompt !== prompt && /^joburi facebook:/i.test(prompt.trim()) ? [...new Set(prompt.replace(/^joburi facebook:\s*/i, '').trim().split(/[\s,]+/).filter(Boolean))] : [];
  const last = history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1);
  const offered = last?.cards?.find(card => card.source === 'facebookJobs')?.rows.map(row => row.id) || [];
  return ctx.adminDb.runTransaction(async tx => {
    const profile = (await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
    if (!profile || profile.agencyId !== ctx.agencyId || profile.role !== ctx.role || !['agent', 'admin'].includes(ctx.role || '')) throw new Error('Acces revocat');
    const snapshot = await tx.get(ctx.adminDb.collection('agencies').doc(ctx.agencyId).collection('facebookCloudPublishingJobs').where('ownerUid', '==', ctx.uid));
    const available = snapshot.docs.filter(doc => doc.data().agencyId === ctx.agencyId && !doc.data().deletedAt);
    const rows = available.flatMap(doc => { try { assertFacebookControlState(doc.data(), false); return [{ id: doc.id, propertyTitle: String(doc.data().propertyTitle || 'Proprietate'), scheduledAt: doc.data().scheduledAt || null }]; } catch { return []; } });
    const actions: AssistantAction[] = [];
    if (!selectedIds.length) return { rows, actions, needsSelection: rows.length > 0, pendingPrompt: rows.length ? effectivePrompt : null, text: rows.length ? 'Selectează joburile de mutat: răspunde „Joburi Facebook: ID1, ID2”. Fiecare programare va fi mutată cu 60 de minute mai târziu; joburile deja pornite sau terminate nu sunt eligibile.' : 'Nu există joburi proprii eligibile pentru reprogramare.' };
    if (selectedIds.length > 100 || selectedIds.some(id => !offered.includes(id) || !rows.some(row => row.id === id))) throw new Error('Selecție modificată sau job pornit');
    for (const id of selectedIds) {
      const row = available.find(doc => doc.id === id)!.data();
      const timestamp = typeof row.scheduledAt === 'string' ? Date.parse(row.scheduledAt) : NaN;
      if (!Number.isFinite(timestamp) || timestamp + 3600000 < Date.now() + 60000 || timestamp + 3600000 > Date.now() + 366 * 86400000) throw new Error('Dată invalidă');
      const action: AssistantAction = { kind: 'existing_operation', operation: 'facebook_job_update', params: { jobId: id }, query: {}, body: { expectedUpdatedAt: row.updatedAt, connectionId: row.connectionId, groupUrls: row.groups.map((group: any) => group.url), scheduledAt: new Date(timestamp + 3600000).toISOString() } };
      if (!facebookControlAction(action)) throw new Error('Job incomplet');
      actions.push(action);
    }
    return { rows: rows.filter(row => selectedIds.includes(row.id)), actions, needsSelection: false, pendingPrompt: null, text: 'Mut cele ' + actions.length + ' programări selectate cu 60 de minute mai târziu.' };
  });
}
export async function prepareFacebookControl(ctx: AssistantContext, prompt: string, history: AssistantMessage[]) {
  const effectivePrompt = facebookControlExecutionPrompt(prompt, history), request = facebookControlRequest(effectivePrompt);
  if (!request) return null;
  if (request.mode === 'shift') return prepareFacebookShift(ctx, prompt, effectivePrompt, history);
  const selected = await readFacebookMonitor(ctx, 'status', history, new Date(), prompt);
  const actions: AssistantAction[] = [];
  if (selected.rows.length !== 1) return { ...selected, actions, pendingPrompt: selected.rows.length ? effectivePrompt : null };
  const id = selected.rows[0].id;
  const row = (await ctx.adminDb.collection('agencies').doc(ctx.agencyId).collection('facebookCloudPublishingJobs').doc(id).get()).data();
  if (!row || row.ownerUid !== ctx.uid || row.agencyId !== ctx.agencyId || row.deletedAt) throw new Error('Job inaccesibil');
  assertFacebookControlState(row, request.mode === 'cancel');
  const body: Record<string, unknown> = { expectedUpdatedAt: row.updatedAt };
  if (request.mode === 'move') {
    if (typeof row.scheduledAt !== 'string' || !Number.isFinite(Date.parse(row.scheduledAt))) throw new Error('Data originală lipsește');
    const scheduledAt = bucharestLocalToIso(bucharestInputFromIso(row.scheduledAt).date, request.time!);
    if (!scheduledAt || Date.parse(scheduledAt) < Date.now() + 60_000) throw new Error('Ora cerută nu mai este în viitor');
    Object.assign(body, { scheduledAt, connectionId: row.connectionId, groupUrls: row.groups.map((group: any) => group.url) });
  }
  const action: AssistantAction = { kind: 'existing_operation', operation: request.mode === 'move' ? 'facebook_job_update' : 'facebook_job_remove', params: { jobId: id }, query: {}, body };
  if (!facebookControlAction(action)) throw new Error('Job incomplet');
  actions.push(action);
  return { ...selected, actions, pendingPrompt: null, text: request.mode === 'move' ? 'Mut programarea la ' + request.time + ', ora Bucureștiului, în aceeași zi.' : 'Anulez jobul selectat; postările deja trimise nu vor fi retrase.' };
}
export function facebookControlReceipt(operation: string, raw: Record<string, any>, expected: Record<string, unknown>, jobId: string, actor: { uid: string; agencyId: string }) {
  const job = raw.job;
  const identity = job?.id === jobId && job.ownerUid === actor.uid && job.agencyId === actor.agencyId && !job.deletedAt;
  const urls = Array.isArray(expected.groupUrls) && expected.groupUrls.every(url => typeof url === 'string') ? [...new Set(expected.groupUrls as string[])].sort() : [];
  const groups = Array.isArray(job?.groups) ? job.groups : [];
  const sameGroups = urls.length > 0 && groups.length === urls.length && groups.every((group: any) => group && typeof group.url === 'string' && group.status === 'queued') && JSON.stringify(groups.map((group: any) => group.url).sort()) === JSON.stringify(urls);
  const requestedTime = typeof expected.scheduledAt === 'string' ? Date.parse(expected.scheduledAt) : NaN;
  const confirmed = identity && (operation === 'facebook_job_remove' ? job.status === 'cancelled' : operation === 'facebook_job_update' && job.status === 'scheduled' && !['pending', 'unknown'].includes(job.dispatchState) && job.connectionId === expected.connectionId && Number.isFinite(requestedTime) && Date.parse(job.scheduledAt) === requestedTime && sameGroups);
  if (!confirmed) throw new Error('Modificarea jobului Facebook nu este confirmată.');
  return { operation, jobId, executionState: 'succeeded', businessStatus: job.status, scheduledAt: job.scheduledAt || null, publicationConfirmed: false, evidenceSource: 'domain_handler' };
}
