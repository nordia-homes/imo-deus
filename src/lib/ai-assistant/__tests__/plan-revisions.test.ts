import { expect, it } from 'vitest';
import { continuePlanRevision } from '../plan-revisions';
import type { AssistantAction } from '../contracts';

const edit: AssistantAction = { kind: 'update_preferences', contactId: 'c', expectedUpdatedAt: '2026-10-06T10:00:00Z', preferences: { desiredRooms: 3 } };
const receipt = (before: string | null, after: string, id = 'c', resource = 'contacts') => ({ result: { mutationRevision: { resource, id, before, after } } });
it('continues a contiguous series of committed edits without changing approved fields', () => {
  const result = continuePlanRevision(edit, [receipt(edit.expectedUpdatedAt!, '2026-10-06T10:01:00Z'), receipt('2026-10-06T10:01:00Z', '2026-10-06T10:02:00Z')]);
  expect(result).toEqual({ ...edit, expectedUpdatedAt: '2026-10-06T10:02:00Z' });
  expect(edit.expectedUpdatedAt).toBe('2026-10-06T10:00:00Z');
});
it('does not approve a stale explicit baseline or a broken receipt chain', () => {
  expect(continuePlanRevision(edit, [receipt('2026-10-06T09:00:00Z', '2026-10-06T10:01:00Z')])).toEqual(edit);
  expect(continuePlanRevision(edit, [receipt(edit.expectedUpdatedAt!, '2026-10-06T10:01:00Z'), receipt('2026-10-06T10:01:30Z', '2026-10-06T10:02:00Z')])).toEqual(edit);
});
it('separates targets and retains legacy commands without preconditions', () => {
  expect(continuePlanRevision(edit, [receipt(edit.expectedUpdatedAt!, 'later', 'other'), receipt(edit.expectedUpdatedAt!, 'later', 'c', 'properties')])).toEqual(edit);
  const { expectedUpdatedAt, ...legacy } = edit;
  expect(continuePlanRevision(legacy, [receipt(null, 'later')])).toEqual(legacy);
});
it('chains a guarded legacy record whose original revision is null', () => {
  expect(continuePlanRevision({ ...edit, expectedUpdatedAt: null }, [receipt(null, '2026-10-06T10:01:00Z')])).toMatchObject({ expectedUpdatedAt: '2026-10-06T10:01:00Z' });
});
it('chains floor-plan replacement and property edits through the same parent receipt', () => {
  const action: AssistantAction = { kind: 'existing_operation', operation: 'file_apply', params: { uploadId: 'upload' }, query: {}, body: { destination: 'property_rlv', propertyId: 'p', expectedUpdatedAt: edit.expectedUpdatedAt } };
  expect(continuePlanRevision(action, [receipt(edit.expectedUpdatedAt!, '2026-10-06T10:01:00Z', 'p', 'properties')])).toMatchObject({ body: { expectedUpdatedAt: '2026-10-06T10:01:00Z', destination: 'property_rlv', propertyId: 'p' } });
  expect(continuePlanRevision({ kind: 'update_property', propertyId: 'p', expectedUpdatedAt: edit.expectedUpdatedAt, patch: { price: 130000 } }, [receipt(edit.expectedUpdatedAt!, '2026-10-06T10:02:00Z', 'p', 'properties')])).toMatchObject({ expectedUpdatedAt: '2026-10-06T10:02:00Z' });
});
it('permits approved deletion after editing the same task, viewing or template', () => {
  const deletes: AssistantAction[] = [
    { kind: 'delete_task', taskId: 'id', expectedUpdatedAt: edit.expectedUpdatedAt },
    { kind: 'delete_viewing', viewingId: 'id', expectedUpdatedAt: edit.expectedUpdatedAt },
    { kind: 'contract_template_action', action: 'delete', templateId: 'id', expectedUpdatedAt: edit.expectedUpdatedAt },
  ];
  for (const [index, action] of deletes.entries()) expect(continuePlanRevision(action, [receipt(edit.expectedUpdatedAt!, '2026-10-06T10:01:00Z', 'id', ['tasks', 'viewings', 'contractTemplates'][index])])).toMatchObject({ expectedUpdatedAt: '2026-10-06T10:01:00Z' });
});
