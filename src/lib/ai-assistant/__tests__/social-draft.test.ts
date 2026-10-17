import { expect, it } from 'vitest';
import { socialDraftAction, socialDraftRequest, socialDraftExecutionPrompt } from '../social-draft';
import { explicitlyRequestedSafeAction, requestAuthorizedCrmAction } from '../autonomy';
const action = { kind: 'existing_operation', operation: 'social_create', params: {}, query: {}, body: { propertyId: 'p', connectionId: 'c', draft: true, contentSource: 'crm' } } as const;
it('authorizes only creation of the requested CRM draft', () => {
  expect(socialDraftAction(action)).toBe(true); expect(requestAuthorizedCrmAction(action)).toBe(true);
  expect(explicitlyRequestedSafeAction(action, 'Creează o postare socială pentru proprietatea deschisă.')).toBe(true);
  expect(explicitlyRequestedSafeAction(action, 'Nu crea postarea.')).toBe(false);
  expect(socialDraftAction({ ...action, body: { ...action.body, draft: false } })).toBe(false);
  expect(socialDraftAction({ ...action, body: { ...action.body, text: 'invented' } })).toBe(false);
});
it('requires a pending selection and does not confuse publication with drafting', () => {
  expect(socialDraftRequest('Publică postarea după approval.')).toBe(false);
  expect(socialDraftExecutionPrompt('Cont pentru ciorna sociala: c', [])).toBe('Cont pentru ciorna sociala: c');
});