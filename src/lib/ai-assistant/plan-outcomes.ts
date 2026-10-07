import { getPlan } from './workspace';
import { collectionFor, getResource, referencesAllowed, type AssistantContext } from './access';
import { invokeOperation } from './operations';
import { operationResult } from './operation-result';
import { resolveAction } from './dependencies';
import { CommunicationError } from '@/lib/communications/server';
import { summarizeOutcome } from './outcome';
import { goalCoverageOutcome } from './goal-coverage';
import type { VerifiedOutputs } from './verified-outputs';
import { prospectingOutcome } from './prospecting-outcome';
import { recommendationOutcome } from './recommendation-outcome';
import { messageOutcome } from './message-outcome';
import { facebookOutcome } from './facebook-outcome';
import { tikTokScheduleOutcome } from './tiktok-schedule-outcome';
import { tikTokDraftOutcome } from './tiktok-draft-outcome';
import { tikTokProjectOutcome } from './tiktok-project-outcome';
import { confirmedStudioRender } from '@/lib/tiktok-render-evidence';

// Read current domain evidence. Never replay a write or alter its execution ledger.
export async function readPlanOutcomes(ctx: AssistantContext, planId: string) {
  const { data: plan, revision: planRevision } = await getPlan(ctx, planId);
  const member = await ctx.adminDb.collection('users').doc(ctx.uid).get();
  if (member.data()?.agencyId !== ctx.agencyId || member.data()?.role !== ctx.role) throw new CommunicationError('Acces revocat.', 403);
  const results = [...(plan.results || []), ...(plan.stoppedStep ? [plan.stoppedStep] : [])];
  const rows = await Promise.all(results.map(async (step: any) => {
    const index = Number(step.step) - 1, original = step.result || {};
    const base = { step: step.step, title: `Pasul ${step.step}`, executionState: original.executionState || 'accepted_unverified', businessStatus: original.businessStatus || null, verifiedAt: original.verifiedAt || null };
    let refreshAttempted = false;
    try {
      const action = resolveAction(plan.actions[index], plan.results || []);
      if (action.kind === 'recommend_properties') {
        refreshAttempted = true;
        return { ...base, ...await recommendationOutcome(ctx, action.contactId, action.propertyIds, original) };
      }
      if (action.kind !== 'existing_operation') return { ...base, executionState: step === plan.stoppedStep ? 'unknown' : 'succeeded', evidenceSource: step === plan.stoppedStep ? 'unconfirmed_step' : 'execution_ledger' };
      const id = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,180}$/.test(value) ? value : undefined;
      let current: Record<string, any> | undefined;
      let completionSatisfied: boolean | undefined;
      const outputs: VerifiedOutputs = {};
      const read = (operation: string, params: Record<string, string>) => { refreshAttempted = true; return invokeOperation(ctx, { operation, params, query: {}, body: {} }, true); };
      const listingId = id(action.body.listingId);
      if (action.operation === 'owner_prospect' && listingId) {
        refreshAttempted = true;
        const prospect = await getResource(ctx, 'ownerListingFavorites', listingId);
        return { ...base, ...prospectingOutcome(action.body.action, original, prospect) };
      }
      else if (action.operation === 'video_script') {
        refreshAttempted = true;
        await getResource(ctx, 'properties', action.params.propertyId);
        const valid = typeof original.script === 'string' && original.script.trim().length > 0 && original.script.length <= 12000;
        return { ...base, executionState: valid ? 'succeeded' : 'unknown', completionSatisfied: valid, evidenceSource: 'execution_receipt', note: 'Scenariul generat este verificat separat de randarea materialului video.' };
      }
      else if (action.operation === 'video_create' && id(original.jobId)) {
        current = await read('video_job', { propertyId: action.params.propertyId, jobId: original.jobId });
        if (current?.executionState === 'succeeded') {
          const job = current.job;
          completionSatisfied = job?.id === original.jobId && job?.propertyId === action.params.propertyId && typeof job?.videoUrl === 'string' && job.videoUrl.startsWith('https://');
          if (completionSatisfied) outputs.videoUrl = job.videoUrl;
          else current.executionState = 'unknown';
        }
      }
      else if (['tiktok_studio_project_create', 'tiktok_studio_asset_create'].includes(action.operation)) {
        const project = action.operation === 'tiktok_studio_project_create';
        const targetId = id(project ? original.projectId : original.assetId);
        if (targetId) {
          refreshAttempted = true;
          const row = await getResource(ctx, project ? 'tiktokStudioProjects' : 'tiktokStudioAssets', targetId);
          if (row.ownerUid !== ctx.uid || row.agencyId !== ctx.agencyId) throw new CommunicationError('Materialul Studio nu mai este accesibil.', 403);
          if (project) return { ...base, ...tikTokProjectOutcome(targetId, action.body, row, original) };
          completionSatisfied = (row.propertyId || null) === (action.body.propertyId || null);
          if (!project) {
            let validUrl = false;
            try {
              const url = new URL(row.url);
              validUrl = url.protocol === 'https:' && !url.username && !url.password;
            } catch { /* Missing or malformed media cannot confirm the import. */ }
            completionSatisfied = completionSatisfied && ['video', 'image'].includes(action.body.type as string) && row.type === action.body.type && row.url === action.body.url && validUrl && row.status === 'ready';
            if (completionSatisfied) outputs.assetId = targetId;
          }
          if (!project && !completionSatisfied) {
            return { ...base, executionState: 'unknown', completionSatisfied: false, businessStatus: String(row.status || 'unknown'), evidenceSource: 'current_domain_state', verifiedAt: new Date().toISOString(), watchable: false, note: 'Materialul importat nu mai corespunde tipului, URL-ului, proprietății sau stării ready aprobate. Pasul următor nu poate folosi acest material.' };
          }
          current = operationResult(action.operation, { status: completionSatisfied ? 'draft' : 'unknown' }, true);
        }
      }
      else if (action.operation === 'tiktok_studio_render' && id(original.jobId) && id(action.params.projectId)) {
        refreshAttempted = true;
        const project = await getResource(ctx, 'tiktokStudioProjects', action.params.projectId);
        const job = await ctx.adminDb.collection('tiktokStudioJobs').doc(original.jobId).get();
        const row = job.data();
        if (project.agencyId !== ctx.agencyId || project.ownerUid !== ctx.uid || !row || row.agencyId !== ctx.agencyId || row.uid !== ctx.uid || row.projectId !== action.params.projectId || row.kind !== 'render') throw new CommunicationError('Randarea nu mai este accesibilă.', 403);
        if (action.body.expectedVersion !== undefined && action.body.expectedVersion !== row.version) return { ...base, executionState: 'unknown', completionSatisfied: false, businessStatus: String(row.status || 'unknown'), evidenceSource: 'current_domain_state', verifiedAt: new Date().toISOString(), watchable: false, note: 'Jobul de randare nu corespunde versiunii aprobate. Verifică proiectul înainte de continuare.' };
        current = operationResult(action.operation, { status: row.status }, true);
        if (row.status === 'completed') {
          const assetId = id(project.outputAssetId);
          completionSatisfied = false;
          if (assetId && project.status === 'ready' && (project.version ?? 1) === row.version) {
            const asset = await getResource(ctx, 'tiktokStudioAssets', assetId);
            if (asset.agencyId !== ctx.agencyId || asset.ownerUid !== ctx.uid) throw new CommunicationError('Materialul randat nu mai este accesibil.', 403);
            completionSatisfied = confirmedStudioRender({ agencyId: ctx.agencyId, uid: ctx.uid, projectId: action.params.projectId, version: row.version }, project, asset);
            if (completionSatisfied) outputs.assetId = assetId;
          }
          if (!completionSatisfied && current) {
            return { ...base, executionState: 'unknown', completionSatisfied: false, businessStatus: 'completed', evidenceSource: 'current_domain_state', verifiedAt: new Date().toISOString(), watchable: false, note: 'Jobul s-a încheiat, dar materialul video al aceleiași proprietăți și versiuni nu este confirmat în CRM. Verifică materialul înainte de continuare.' };
          }
        }
      }
      else if (action.operation.startsWith('tiktok_ads_') && id(original.operation?.id || original.operationId)) current = await read('tiktok_ads_operation_status', { operationId: original.operation?.id || original.operationId });
      else if (action.operation === 'tiktok_post_publish') current = await read('tiktok_post_status', { draftId: action.params.draftId });
      else if (action.operation === 'tiktok_post_schedule') {
        refreshAttempted = true;
        const draft = await getResource(ctx, 'tiktokPostDrafts', action.params.draftId);
        const job = await ctx.adminDb.collection('tiktokStudioJobs').doc(`publish_${ctx.agencyId}_${action.params.draftId}`).get();
        const row = job.data();
        if (!row || row.uid !== ctx.uid || row.agencyId !== ctx.agencyId || row.draftId !== action.params.draftId) throw new CommunicationError('Programare inaccesibilă.', 403);
        return { ...base, ...tikTokScheduleOutcome(ctx, action.params.draftId, action.body, draft, row) };
      }
      else if (action.operation === 'tiktok_post_draft' && id(original.draftId)) {
        refreshAttempted = true;
        return { ...base, ...await tikTokDraftOutcome(ctx, original.draftId, action.body, original) };
      }
      else if (action.operation === 'meta_campaign_draft') {
        const targetId = id(original.campaignId);
        if (targetId) {
          refreshAttempted = true;
          const row = await getResource(ctx, 'metaCampaignDrafts', targetId);
          current = operationResult(action.operation, { status: row.status }, true);
          completionSatisfied = ['draft', 'ready', 'ready_to_publish'].includes(row.status);
        }
      }
      else if (action.operation === 'facebook_job_create' && id(original.jobId)) {
        refreshAttempted = true;
        const property = await getResource(ctx, 'properties', String(action.body.propertyId));
        if (!property) throw new CommunicationError('Proprietate inaccesibilă.', 403);
        const job = await collectionFor(ctx, 'facebookCloudPublishingJobs').doc(original.jobId).get();
        const row = job.data();
        if (!row || row.ownerUid !== ctx.uid || row.propertyId !== action.body.propertyId || row.connectionId !== action.body.connectionId) throw new CommunicationError('Job inaccesibil.', 403);
        return { ...base, ...facebookOutcome(ctx, original.jobId, action.body, row) };
      }
      else if (action.operation === 'outreach_start' && id(original.callId)) {
        refreshAttempted = true;
        current = operationResult(action.operation, { call: await getResource(ctx, 'aiOutreachCalls', original.callId) }, true);
      }
      else if (action.operation.startsWith('meta_campaign_') && id(action.params.campaignId || original.campaignId)) {
        refreshAttempted = true;
        current = operationResult(action.operation, { campaign: await getResource(ctx, 'metaCampaignDrafts', action.params.campaignId || original.campaignId) }, true);
      }
      else if (action.operation === 'message_send' && id(original.messageId) && id(action.params.conversationId)) {
        refreshAttempted = true;
        await getResource(ctx, 'conversations', action.params.conversationId);
        const message = await collectionFor(ctx, 'conversations').doc(action.params.conversationId).collection('messages').doc(original.messageId).get();
        if (!message.exists) throw new CommunicationError('Mesajul nu mai există.', 404);
        const job = await ctx.adminDb.collection('communicationOutboundJobs').doc(original.messageId).get();
        const conversation = await getResource(ctx, 'conversations', action.params.conversationId);
        return { ...base, ...messageOutcome(ctx, action.params.conversationId, action.body, conversation, job.data(), message.data()!) };
      }
      if (!current) return { ...base, evidenceSource: 'execution_receipt', note: 'Starea inițială a handlerului. Verificarea curentă se face în modulul dedicat; efectul extern nu se repetă.' };
      return { ...base, executionState: current.executionState, businessStatus: current.businessStatus || null, verifiedAt: current.verifiedAt, evidenceSource: 'current_domain_state', watchable: true, ...(completionSatisfied !== undefined ? { completionSatisfied } : {}), outputs, note: current.note || null };
    } catch (error) {
      if ((error as { status?: number }).status === 403 || (error as { status?: number }).status === 404) return { step: step.step, title: `Pasul ${step.step}`, executionState: 'unavailable', note: 'Rezultatul nu mai este accesibil.' };
      return { ...base, executionState: 'unknown', watchable: refreshAttempted, note: 'Citirea stării curente a eșuat. Acțiunea nu a fost retrimisă.' };
    }
  }));
  if (!(await referencesAllowed(ctx, (plan as any).accessRefs || []))) throw new CommunicationError('Accesul la plan a fost revocat.', 403);
  const finalMember = await ctx.adminDb.collection('users').doc(ctx.uid).get();
  if (finalMember.data()?.agencyId !== ctx.agencyId || finalMember.data()?.role !== ctx.role) throw new CommunicationError('Acces revocat.', 403);
  const outcome = goalCoverageOutcome(summarizeOutcome(plan.status, plan.actions.length, rows), plan.goal?.coverage, rows, plan.goal?.coverageRequired === true);
  const awaiting = !['paused', 'cancelled'].includes(plan.status) && rows.some(row => 'watchable' in row && row.watchable && !('completionSatisfied' in row && row.completionSatisfied) && ['queued', 'running', 'unknown', 'observed', 'accepted_unverified'].includes(row.executionState));
  return { planId, planRevision, executionStatus: plan.status, outcome, rows, pollAfterMs: awaiting ? 15000 : null, checkedAt: outcome.checkedAt, note: 'Starea execuției planului și rezultatele de business sunt verificate separat. Starea CRM nu înlocuiește un receipt extern.' };
}
