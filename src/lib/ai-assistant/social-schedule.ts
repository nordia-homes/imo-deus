import { socialDraftRevision } from '@/lib/communications/social-content';
import { z } from 'zod';
import type { AssistantContext } from './access';
import { normalized, type AssistantMessage, type AssistantAction } from './contracts';
import { bucharestLocalToIso, bucharestInputFromIso } from '@/lib/bucharest-time';
const id = z.string().regex(/^[A-Za-z0-9_-]{1,180}$/);
export function socialScheduleRequest(prompt: string) { return ['programeaza postarea prin canalul suportat', 'programeaza postarea organica la ora ceruta'].includes(normalized(prompt).trim().replace(/[.!?]+$/, '')); }
const shape = z.object({ kind: z.literal('existing_operation'), operation: z.literal('social_publish'), params: z.object({ postId: id }).strict(), query: z.object({}).strict(), body: z.object({ scheduledAt: z.string().datetime(), schedulingOnly: z.literal(true), expectedRevision: z.string().regex(/^[a-f0-9]{64}$/) }).strict() }).strict();
export function socialScheduleAction(action: AssistantAction) { return shape.safeParse(action).success; }
function selection(prompt: string) { return /^programare social[aă]:\s*([A-Za-z0-9_-]{1,180})\s*\|\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/i.exec(prompt.trim()); }
function pending(history: AssistantMessage[]) { return history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1)?.cards?.find(card => card.source === 'socialScheduleRequest')?.rows || []; }
export function socialScheduleExecutionPrompt(prompt: string, history: AssistantMessage[]) { return selection(prompt) && pending(history).length ? String(pending(history)[0].prompt) : prompt; }
export function socialScheduleTime(date: string, time: string, now = Date.now()) {
  const iso = bucharestLocalToIso(date, time);
  if (!iso || Date.parse(iso) < now + 60000) return null;
  // An autumn clock overlap requires clarification rather than silently choosing an occurrence.
  if ([-3600000, 3600000].some(offset => { const other = bucharestInputFromIso(new Date(Date.parse(iso) + offset)); return other.date === date && other.time === time; })) return null;
  return iso;
}
export async function prepareSocialSchedule(ctx: AssistantContext, prompt: string, history: AssistantMessage[]) {
  const effective = socialScheduleExecutionPrompt(prompt, history);
  if (!socialScheduleRequest(effective)) return null;
  const chosen = effective !== prompt ? selection(prompt) : null;
  const last = history.filter(row => row.role === 'assistant' && row.id !== 'current-page-context').at(-1);
  const receipts = last?.cards?.filter(card => card.source === 'autonomy').flatMap(card => card.rows).map(row => row.result as Record<string, any>).filter(row => row?.operation === 'social_create' && row.businessStatus === 'draft') || [];
  const latestId = receipts.length === 1 ? receipts[0].postId : null;

  return ctx.adminDb.runTransaction(async tx => {
    const actions: AssistantAction[] = [];
    const profile = (await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
    if (ctx.role !== 'admin' || profile?.role !== 'admin' || profile.agencyId !== ctx.agencyId) throw new Error('Acces indisponibil');
    const posts = await tx.get(ctx.adminDb.collection('agencies').doc(ctx.agencyId).collection('socialPosts'));
    const rows = posts.docs.filter(doc => { const post = doc.data(); return post.agencyId === ctx.agencyId && !post.deletedAt && post.status === 'draft' && post.contentSource === 'crm' && (!latestId || doc.id === latestId); }).map(doc => ({ id: doc.id, propertyTitle: String(doc.data().propertyTitle || 'Proprietate'), prompt: effective, revision: socialDraftRevision(doc.data()) }));
    if (!chosen) return { actions, rows, text: rows.length ? 'Indică ciorna și ora: „Programare sociala: ID | AAAA-LL-ZZ HH:mm”. Folosesc exclusiv ora Bucureștiului. Cererea de programare va pune postarea în coada automată pentru acel moment.' : 'Nu există o ciornă CRM eligibilă. Creează mai întâi ciorna socială pentru proprietate.' };
    const offered = pending(history).find(row => row.id === chosen[1]);
    const current = rows.find(row => row.id === chosen[1]);
    if (!offered || !current || offered.revision !== current.revision) throw new Error('Ciorna s-a schimbat sau nu a fost oferită');
    const scheduledAt = socialScheduleTime(chosen[2], chosen[3]);
    if (!scheduledAt) return { actions, rows, text: 'Alege o dată validă și o oră neambiguă, cu cel puțin un minut în viitor, în București. La schimbarea orei nu aleg automat între două momente cu aceeași oră locală. Folosește „Programare sociala: ID | AAAA-LL-ZZ HH:mm”.' };
    actions.push({ kind: 'existing_operation', operation: 'social_publish', params: { postId: chosen[1] }, query: {}, body: { scheduledAt, schedulingOnly: true, expectedRevision: current.revision } });
    return { actions, rows: [], text: 'Salvez programarea și verific aceeași oră în postare și în coada de publicare.' };
  });
}