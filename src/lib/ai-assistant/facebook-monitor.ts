import type { AssistantContext } from './access';
import { normalized, type AssistantMessage } from './contracts';
import { bucharestInputFromIso } from '@/lib/bucharest-time';
import { selectedFacebookProperty } from './facebook-setup';

export type FacebookMonitorMode = 'groups' | 'status' | 'tomorrow' | 'progress' | 'failed' | 'truth' | 'today' | 'attention' | 'schedule-check';
export function facebookMonitorRequest(prompt: string): FacebookMonitorMode | null {
  if (/^job facebook:\s*[A-Za-z0-9_-]{1,180}\s*$/i.test(prompt.trim())) return 'status';
  const commands: Record<string, FacebookMonitorMode> = {
    'arata-mi exact in ce grupuri va fi publicata': 'groups',
    'verifica statusul jobului facebook': 'status',
    'arata-mi joburile facebook programate pentru maine': 'tomorrow',
    'arata-mi progresul jobului de publicare': 'progress',
    'ce grup a esuat la publicare': 'failed',
    'rezuma publicarile facebook de azi': 'today',
    'spune-mi ce publicari necesita interventia mea': 'attention',
    'verifica dupa programare ca ora persistata este corecta': 'schedule-check',
    'nu spune „publicat peste tot” daca un grup a esuat': 'truth',
  };
  return commands[normalized(prompt).trim().replace(/[.!?]+$/, '')] || null;
}
export function tomorrowBucharest(now: Date) {
  const day = bucharestInputFromIso(now).date;
  const date = new Date(day + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
const jobStates = ['scheduled', 'queued', 'running', 'cooldown', 'completed', 'cancelled', 'needs_reauthentication', 'error'];
const groupStates = ['queued', 'publishing', 'submitted', 'pending_approval', 'needs_reauthentication', 'error', 'skipped', 'uncertain'];
function iso(value: unknown) { return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null; }
export function facebookScheduleReceipts(history: AssistantMessage[]) {
  return history.filter(message => message.role === 'assistant' && message.id !== 'current-page-context').flatMap(message => message.cards?.filter(card => card.source === 'autonomy').flatMap(card => card.rows) || []).flatMap(step => {
    const result = step.result as Record<string, unknown> | undefined;
    return result && ['facebook_job_create', 'facebook_job_update'].includes(String(result.operation)) && result.executionState === 'succeeded' && typeof result.jobId === 'string' && iso(result.scheduledAt) ? [{ jobId: result.jobId, scheduledAt: iso(result.scheduledAt)! }] : [];
  });
}
export function facebookScheduleVerification(job: ReturnType<typeof facebookJobSummary>, expected?: string) {
  const active = ['scheduled', 'queued', 'running', 'cooldown'].includes(job.status);
  const match = Boolean(expected && job.scheduledAt && Date.parse(expected) === Date.parse(job.scheduledAt));
  const saved = job.scheduledBucharest ? job.scheduledBucharest.date + ' la ' + job.scheduledBucharest.time + ', ora Bucureștiului' : 'fără oră validă salvată';
  const previous = expected ? bucharestInputFromIso(expected) : null;
  return { ...job, expectedScheduledAt: expected || null, scheduleMatches: expected ? match : null, activeScheduleConfirmed: active && match, text: 'Job ' + job.id + ': ' + saved + '. ' + (!expected ? 'Nu am o confirmare anterioară în conversație pentru comparație.' : match ? 'Ora salvată corespunde ultimei programări confirmate în conversație.' : 'Ora salvată DIFERĂ de ultima programare confirmată în conversație: ' + previous!.date + ' la ' + previous!.time + ', ora Bucureștiului.') + (!active ? ' Starea actuală este ' + job.status + '; nu confirm o programare activă.' : '') };
}
export function facebookJobSummary(id: string, raw: Record<string, any>) {
  const groups = (Array.isArray(raw.groups) ? raw.groups : []).map((group: any, index: number) => ({
    id: String(index), name: typeof group?.name === 'string' ? group.name : 'Grup fără nume',
    status: groupStates.includes(group?.status) ? String(group.status) : 'unknown', submittedAt: iso(group?.submittedAt), failedAt: iso(group?.failedAt), publicationConfirmed: false,
  }));
  const counts = Object.fromEntries([...groupStates, 'unknown'].map(status => [status, groups.filter(group => group.status === status).length]));
  return { id, propertyId: typeof raw.propertyId === 'string' ? raw.propertyId : null, propertyTitle: typeof raw.propertyTitle === 'string' ? raw.propertyTitle : 'Proprietate',
    status: ['pending', 'unknown'].includes(raw.dispatchState) ? 'unknown' : jobStates.includes(raw.status) ? String(raw.status) : 'unknown', scheduledAt: iso(raw.scheduledAt), updatedAt: iso(raw.updatedAt),
    scheduledBucharest: iso(raw.scheduledAt) ? bucharestInputFromIso(raw.scheduledAt) : null,
    actualStartedAt: iso(raw.actualStartedAt), completedAt: iso(raw.completedAt),
    totalGroups: groups.length, counts, groups, publicationConfirmed: false };
}
export function facebookInterventionReasons(job: ReturnType<typeof facebookJobSummary>) {
  const reasons: string[] = [];
  if (job.status === 'unknown' || job.counts.unknown) reasons.push('Stare sau expediere neconfirmată; verifică runnerul înainte de orice reluare.');
  if (job.status === 'needs_reauthentication' || job.counts.needs_reauthentication) reasons.push('Contul Facebook necesită reconectare.');
  if (job.status === 'error' || job.counts.error) reasons.push('Există erori de publicare; verifică grupurile afectate.');
  if (job.counts.uncertain) reasons.push('Trimitere cu rezultat incert; verifică în Facebook înainte de a retrimite.');
  return reasons;
}
export function facebookActivityOnDay(job: ReturnType<typeof facebookJobSummary>, day: string) {
  // Use execution evidence, never updatedAt: edits/cancellations are not publications.
  return [job.actualStartedAt, job.completedAt, ...job.groups.flatMap(group => [group.submittedAt, group.failedAt])]
    .some(value => value && bucharestInputFromIso(value).date === day);
}
export async function readFacebookMonitor(ctx: AssistantContext, mode: FacebookMonitorMode, history: AssistantMessage[], now = new Date(), prompt = '') {
  const pending = history.filter(message => message.role === 'assistant' && message.id !== 'current-page-context').at(-1)?.cards?.find(card => card.source === 'facebookMonitorRequest')?.rows;
  if (mode === 'status' && /^job facebook:\s*[A-Za-z0-9_-]{1,180}\s*$/i.test(prompt.trim()) && pending?.length === 1 && pending[0].mode === 'schedule-check') mode = 'schedule-check';
  return ctx.adminDb.runTransaction(async tx => {
    const agency = ctx.adminDb.collection('agencies').doc(ctx.agencyId);
    const profile = (await tx.get(ctx.adminDb.collection('users').doc(ctx.uid))).data();
    if (!profile || profile.agencyId !== ctx.agencyId || profile.role !== ctx.role || !['agent', 'admin'].includes(ctx.role || '')) throw new Error('Acces revocat');
    const snapshot = await tx.get(agency.collection('facebookCloudPublishingJobs').where('ownerUid', '==', ctx.uid));
    let rows = snapshot.docs.filter(doc => doc.data().agencyId === ctx.agencyId && !doc.data().deletedAt).map(doc => facebookJobSummary(doc.id, doc.data())).sort((a, b) => a.id.localeCompare(b.id));
    const evidence = 'Stare salvată în aplicație; nu am interogat Facebook. Trimiterea și aprobarea în așteptare nu confirmă publicarea.';
    if (mode === 'today') {
      const day = bucharestInputFromIso(now).date;
      rows = rows.filter(row => facebookActivityOnDay(row, day));
      const totals = rows.reduce((sum, row) => ({ submitted: sum.submitted + row.groups.filter(group => ['submitted', 'pending_approval'].includes(group.status) && group.submittedAt && bucharestInputFromIso(group.submittedAt).date === day).length, errors: sum.errors + row.groups.filter(group => group.status === 'error' && group.failedAt && bucharestInputFromIso(group.failedAt).date === day).length }), { submitted: 0, errors: 0 });
      return { rows, needsSelection: false, text: 'Activitate Facebook proprie în ' + day + ' (Europe/Bucharest): ' + rows.length + ' joburi cu date de execuție în această zi; trimiteri înregistrate azi: ' + totals.submitted + ', erori înregistrate azi: ' + totals.errors + '. Joburile fără date de execuție nu pot fi atribuite unei zile. Cardurile arată starea curentă a joburilor. ' + evidence };
    }
    if (mode === 'attention') {
      const attention = rows.map(row => ({ ...row, interventionReasons: facebookInterventionReasons(row) })).filter(row => row.interventionReasons.length);
      return { rows: attention, needsSelection: false, text: 'Publicări proprii care necesită intervenție: ' + attention.length + '. ' + attention.map(row => 'Job ' + row.id + ': ' + row.interventionReasons.join(' ')).join('\n') + ' ' + evidence };
    }
    if (mode === 'tomorrow') {
      const day = tomorrowBucharest(now);
      rows = rows.filter(row => row.scheduledBucharest?.date === day && ['scheduled', 'queued', 'running', 'cooldown'].includes(row.status));
      return { rows, needsSelection: false, text: 'Joburi proprii programate pentru ' + day + ' (Europe/Bucharest): ' + rows.length + '. ' + evidence };
    }
    const last = history.filter(message => message.role === 'assistant' && message.id !== 'current-page-context').at(-1);
    const selected = last?.cards?.filter(card => card.source === 'facebookJobs').flatMap(card => card.rows) || [];
    const receipts = facebookScheduleReceipts(history);
    const lastReceipt = facebookScheduleReceipts(last ? [last] : []).at(-1);
    const propertyId = selectedFacebookProperty(history);
    const explicitId = /^job facebook:\s*([A-Za-z0-9_-]{1,180})\s*$/i.exec(prompt.trim())?.[1];
    if (explicitId) rows = rows.filter(row => row.id === explicitId);
    else if (selected.length === 1) rows = rows.filter(row => row.id === selected[0].id && (!propertyId || row.propertyId === propertyId));
    else if (mode === 'schedule-check' && lastReceipt) rows = rows.filter(row => row.id === lastReceipt.jobId && (!propertyId || row.propertyId === propertyId));
    else if (propertyId) rows = rows.filter(row => row.propertyId === propertyId);
    if (rows.length !== 1) return { rows, needsSelection: rows.length > 0, text: rows.length ? 'Există mai multe joburi. Răspunde cu „Job Facebook: ID” folosind un ID din listă pentru detalii. ' + evidence : 'Nu am găsit un job Facebook accesibil pentru selecția curentă. ' + evidence };
    const job = rows[0];
    if (mode === 'schedule-check') {
      const verified = facebookScheduleVerification(job, receipts.filter(receipt => receipt.jobId === job.id).at(-1)?.scheduledAt);
      return { rows: [verified], needsSelection: false, text: verified.text + ' ' + evidence };
    }
    const groups = mode === 'failed' ? job.groups.filter(group => ['error', 'needs_reauthentication'].includes(group.status)) : job.groups;
    const detail = groups.map(group => group.name + ': ' + group.status).join('; ');
    return { rows, needsSelection: false, text: 'Job ' + job.id + ': ' + job.status + '. Grupuri: ' + job.totalGroups + ', trimise: ' + job.counts.submitted + ', în așteptarea aprobării: ' + job.counts.pending_approval + ', erori: ' + job.counts.error + ', necesită reconectare: ' + job.counts.needs_reauthentication + '. ' + (detail || 'Niciun grup corespunzător în starea salvată.') + ' ' + evidence };
  });
}
