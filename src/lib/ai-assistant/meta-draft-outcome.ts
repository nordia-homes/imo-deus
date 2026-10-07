import type { AssistantContext } from './access';

// Confirm local draft preparation from the handler receipt and current CRM data.
// Neither a draft nor a later status is evidence of publication at Meta.
export function metaDraftOutcome(ctx: Pick<AssistantContext, 'agencyId' | 'uid'>, campaignId: string | undefined, body: Record<string, unknown>, current: Record<string, any> | undefined, original: Record<string, any>) {
  const snapshot = original.campaign;
  const fields = ['propertyId', 'objective', 'budgetType', 'budgetAmount', 'durationDays', 'currency'] as const;
  const confirmed = Boolean(campaignId && snapshot && current
    && [snapshot, current].every(row => row.id === campaignId && row.agencyId === ctx.agencyId && row.createdByUid === ctx.uid)
    && typeof body.propertyId === 'string' && current.propertyId === body.propertyId
    && ['draft', 'ready', 'ready_to_publish'].includes(current.status)
    && fields.every(field => snapshot[field] === current[field])
    && ['leads', 'messages', 'traffic', 'calls'].includes(current.objective)
    && ['daily', 'lifetime'].includes(current.budgetType)
    && ['RON', 'EUR', 'USD'].includes(current.currency)
    && Number.isFinite(current.budgetAmount) && current.budgetAmount > 0
    && Number.isSafeInteger(current.durationDays) && current.durationDays > 0
    && (body.objective === undefined || current.objective === body.objective)
    && (body.budgetType === undefined || current.budgetType === body.budgetType)
    && (body.budgetAmount === undefined || current.budgetAmount === Number(body.budgetAmount))
    && (body.durationDays === undefined || current.durationDays === Number(body.durationDays)));
  return {
    executionState: confirmed ? 'draft' : 'unknown', completionSatisfied: confirmed,
    businessStatus: String(current?.status || 'unknown'), evidenceSource: 'current_domain_state',
    verifiedAt: new Date().toISOString(), watchable: false,
    note: confirmed
      ? 'Draftul Meta salvat corespunde proprietății, autorului și parametrilor de buget din rezultatul creării. Aceasta confirmă pregătirea draftului, nu publicarea sau cheltuirea bugetului.'
      : 'Draftul Meta nu poate fi confirmat pentru proprietatea, autorul și parametrii ceruți. Verifică draftul în modulul dedicat; campania nu a fost recreată sau publicată.',
  };
}
