import { z } from 'zod';
import type { AssistantContext } from './access';
import { normalized, type AssistantAction, type AssistantMessage } from './contracts';
import { bucharestInputFromIso, bucharestLocalToIso } from '@/lib/bucharest-time';
import { readFacebookMonitor } from './facebook-monitor';
import { assertFacebookControlState } from '@/lib/facebook-job-control';
export function facebookControlRequest(prompt: string): { mode: 'move' | 'cancel'; time?: string } | null {
  const text = normalized(prompt).trim().replace(/[.!?]+$/, '');
  if (text === 'anuleaza jobul daca fluxul suporta anularea') return { mode: 'cancel' };
  const move = /^muta jobul selectat la ora ([0-2]\d:[0-5]\d)$/.exec(text);
  if (move && Number(move[1].slice(0, 2)) < 24) return { mode: 'move', time: move[1] };
  return null;
}
export function facebookControlExecutionPrompt(prompt: string, history: AssistantMessage[]) {
  if (!/^job facebook:\s*[A-Za-z0-9_-]{1,180}\s*$/i.test(prompt.trim())) return prompt;
  const last = history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1);
  const pending = last?.cards?.find(card => card.source === 'facebookControlRequest')?.rows;
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
  return action.operation === 'facebook_job_remove' ? request?.mode === 'cancel' : request?.mode === 'move' && bucharestInputFromIso(String(action.body.scheduledAt)).time === request.time;
}
export async function prepareFacebookControl(ctx: AssistantContext, prompt: string, history: AssistantMessage[]) {
  const effectivePrompt = facebookControlExecutionPrompt(prompt, history), request = facebookControlRequest(effectivePrompt);
  if (!request) return null;
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
export function facebookControlReceipt(operation: string, raw: Record<string, any>, expected: Record<string, unknown>, jobId: string) {
  const job = raw.job;
  const confirmed = job?.id === jobId && (operation === 'facebook_job_remove' ? job.status === 'cancelled' : job.status === 'scheduled' && job.scheduledAt === expected.scheduledAt);
  if (!confirmed) throw new Error('Modificarea jobului Facebook nu este confirmată.');
  return { operation, jobId, executionState: 'succeeded', businessStatus: job.status, scheduledAt: job.scheduledAt || null, publicationConfirmed: false, evidenceSource: 'domain_handler' };
}
