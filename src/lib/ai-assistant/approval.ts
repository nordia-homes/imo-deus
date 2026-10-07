import { createHash } from 'node:crypto';
import { actionSchema, type AssistantAction } from './contracts';
import { VERSIONS } from './models';
function canonical(value: unknown): unknown { return Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value; }
export function payloadHash(actions: AssistantAction[]) { return createHash('sha256').update(JSON.stringify(canonical(actions.map(action => actionSchema.parse(action))))).digest('hex'); }
export function approvalEnvelope(userId: string, agencyId: string, planId: string, actions: AssistantAction[], expiresAt: number) { return { userId, agencyId, actionId: planId, payloadHash: payloadHash(actions), expiresAt, policyVersion: VERSIONS.policy }; }
export function validateApproval(envelope: ReturnType<typeof approvalEnvelope> | undefined, userId: string, agencyId: string, planId: string, actions: AssistantAction[]) {
  if (actions.some(action => action.kind === 'existing_operation' && action.operation === 'message_send' && (typeof action.body.expectedRecipientRevision !== 'string' || !/^[a-f0-9]{64}$/.test(action.body.expectedRecipientRevision)))) throw new Error('Planul de trimitere nu fixează destinatarul. Pregătește un plan nou pentru aprobare.');
  if (!envelope || envelope.userId !== userId || envelope.agencyId !== agencyId || envelope.actionId !== planId || envelope.payloadHash !== payloadHash(actions) || envelope.expiresAt < Date.now() || envelope.policyVersion !== VERSIONS.policy) throw new Error('Aprobarea a expirat sau nu corespunde planului. Cere un plan nou.');
}
