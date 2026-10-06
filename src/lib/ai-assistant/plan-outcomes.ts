import { getPlan } from './workspace';
import { collectionFor, getResource, referencesAllowed, type AssistantContext } from './access';
import { invokeOperation } from './operations';
import { operationResult } from './operation-result';
import { resolveAction } from './dependencies';
import { CommunicationError } from '@/lib/communications/server';

// Read current domain evidence. Never replay a write or alter its execution ledger.
export async function readPlanOutcomes(ctx: AssistantContext, planId: string) {
  const { data: plan } = await getPlan(ctx, planId);
  const member = await ctx.adminDb.collection('users').doc(ctx.uid).get();
  if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new CommunicationError('Acces revocat.', 403);
  const results = [...(plan.results || []), ...(plan.stoppedStep ? [plan.stoppedStep] : [])];
  const rows = await Promise.all(results.map(async (step: any) => {
    const index = Number(step.step) - 1, original = step.result || {};
    const base = { step: step.step, title: `Pasul ${step.step}`, executionState: original.executionState || 'accepted_unverified', businessStatus: original.businessStatus || null, verifiedAt: original.verifiedAt || null };
    try {
      const action = resolveAction(plan.actions[index], plan.results || []);
      if (action.kind !== 'existing_operation') return { ...base, executionState: 'succeeded', evidenceSource: 'atomic_crm_transaction' };
      const id = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,180}$/.test(value) ? value : undefined;
      let current: Record<string, any> | undefined;
      const read = (operation: string, params: Record<string, string>) => invokeOperation(ctx, { operation, params, query: {}, body: {} }, true);
      if (action.operation === 'video_create' && id(original.jobId)) current = await read('video_job', { propertyId: action.params.propertyId, jobId: original.jobId });
      else if (action.operation === 'tiktok_studio_render' && id(original.jobId) && id(action.params.projectId)) {
        const project = await getResource(ctx, 'tiktokStudioProjects', action.params.projectId);
        const job = await ctx.adminDb.collection('tiktokStudioJobs').doc(original.jobId).get();
        const row = job.data();
        if (project.ownerUid !== ctx.uid || !row || row.agencyId !== ctx.agencyId || row.uid !== ctx.uid || row.projectId !== action.params.projectId || row.kind !== 'render') throw new CommunicationError('Randarea nu mai este accesibilă.', 403);
        current = operationResult(action.operation, { status: row.status }, true);
      }
      else if (action.operation.startsWith('tiktok_ads_') && id(original.operation?.id || original.operationId)) current = await read('tiktok_ads_operation_status', { operationId: original.operation?.id || original.operationId });
      else if (action.operation === 'tiktok_post_publish') current = await read('tiktok_post_status', { draftId: action.params.draftId });
      else if (action.operation === 'outreach_start' && id(original.callId)) current = operationResult(action.operation, { call: await getResource(ctx, 'aiOutreachCalls', original.callId) }, true);
      else if (action.operation.startsWith('meta_campaign_') && id(action.params.campaignId || original.campaignId)) current = operationResult(action.operation, { campaign: await getResource(ctx, 'metaCampaignDrafts', action.params.campaignId || original.campaignId) }, true);
      else if (action.operation === 'message_send' && id(original.messageId) && id(action.params.conversationId)) {
        await getResource(ctx, 'conversations', action.params.conversationId);
        const message = await collectionFor(ctx, 'conversations').doc(action.params.conversationId).collection('messages').doc(original.messageId).get();
        if (!message.exists) throw new CommunicationError('Mesajul nu mai există.', 404);
        current = operationResult(action.operation, { status: message.data()?.status || 'unknown' }, true);
        await getResource(ctx, 'conversations', action.params.conversationId);
      }
      if (!current) return { ...base, evidenceSource: 'execution_receipt', note: 'Starea inițială a handlerului. Verificarea curentă se face în modulul dedicat; efectul extern nu se repetă.' };
      return { ...base, executionState: current.executionState, businessStatus: current.businessStatus || null, verifiedAt: current.verifiedAt, evidenceSource: 'current_domain_state', watchable: true, note: current.note || null };
    } catch (error) {
      if ((error as { status?: number }).status === 403 || (error as { status?: number }).status === 404) return { step: step.step, title: `Pasul ${step.step}`, executionState: 'unavailable', note: 'Rezultatul nu mai este accesibil.' };
      return { ...base, executionState: 'unknown', note: 'Citirea stării curente a eșuat. Acțiunea nu a fost retrimisă.' };
    }
  }));
  if (!(await referencesAllowed(ctx, (plan as any).accessRefs || []))) throw new CommunicationError('Accesul la plan a fost revocat.', 403);
  const finalMember = await ctx.adminDb.collection('users').doc(ctx.uid).get();
  if (finalMember.data()?.agencyId !== ctx.agencyId || finalMember.data()?.role !== ctx.role) throw new CommunicationError('Acces revocat.', 403);
  const awaiting = rows.some(row => 'watchable' in row && row.watchable && (['queued', 'running', 'unknown', 'observed', 'accepted_unverified'].includes(row.executionState) || row.businessStatus === 'sent'));
  return { planId, executionStatus: plan.status, rows, pollAfterMs: awaiting ? 15000 : null, checkedAt: new Date().toISOString(), note: 'Starea execuției planului și rezultatele de business sunt verificate separat. Starea CRM nu înlocuiește un receipt extern.' };
}
