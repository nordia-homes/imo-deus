import { CommunicationError } from '@/lib/communications/server';
import { safeData } from './contracts';
export class OperationFailure extends CommunicationError {
  readonly result: Record<string, unknown>;
  constructor(message: string, status: number, result: Record<string, unknown>) { super(message, status); this.result = safeData(result); }
}
export function unconfirmedOperationResult(result: Record<string, any>) {
  const statuses = [result.status, result.operation?.status, result.operation?.state, result.campaign?.status, result.draft?.status].filter(value => typeof value === 'string').map(value => value.toLowerCase());
  return result.complete === false || statuses.some(value => ['unknown', 'unknown_external_state', 'failed', 'partial'].includes(value));
}
