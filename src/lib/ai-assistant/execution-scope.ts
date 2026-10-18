import { createHash } from 'node:crypto';
import { payloadHash } from './approval';
import type { AssistantAction } from './contracts';
export function executionScope(sessionId:string, requestId:string, previous?:string) {
 return previous && /^[a-f0-9]{64}$/.test(previous) ? previous : createHash('sha256').update(JSON.stringify([sessionId,requestId])).digest('hex');
}
// Exact create commands only: revisions and intentional state transitions are
// not equivalent merely because they belong to the same original request.
export function scopedCreationKey(scope:string | undefined, action:AssistantAction, occurrences:Map<string,number>) {
 if (!scope || !/^[a-f0-9]{64}$/.test(scope) || !['create_contact','create_property','schedule_viewing'].includes(action.kind)) return undefined;
 const hash=payloadHash([action]), occurrence=occurrences.get(hash) || 0;
 occurrences.set(hash,occurrence+1);
 return 'goal-'+createHash('sha256').update(JSON.stringify([scope,hash,occurrence])).digest('hex');
}
