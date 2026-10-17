import { expect, it } from 'vitest';
import { metaDraftRequest, metaDraftAction, metaDraftExecutionPrompt, requestedMetaDraftAction } from '../meta-draft';
const action = { kind: 'existing_operation', operation: 'meta_campaign_draft', params: {}, query: {}, body: { jarvisDraft: true, propertyId: 'p', propertyRevision: 'a'.repeat(64), patch: {} } } as any;
it('authorizes only the requested draft parameters and never a publication', () => {
 expect(requestedMetaDraftAction(action,'Creează draft de campanie Meta pentru proprietate.')).toBe(true);
 expect(requestedMetaDraftAction({ ...action, body: { ...action.body, patch: { budgetAmount: 999 } } },'Creează draft de campanie Meta pentru proprietate.')).toBe(false);
 expect(metaDraftAction({ ...action, operation: 'meta_campaign_publish' })).toBe(false);
 expect(metaDraftAction({ ...action, body: { ...action.body, published: true } })).toBe(false);
 expect(requestedMetaDraftAction(action,'Nu publica draftul încă.')).toBe(false);
});
it.each([0,-1,NaN,Infinity,1000001])('rejects invalid budget %s', budgetAmount => { expect(metaDraftAction({ ...action, body: { ...action.body, patch: { budgetAmount } } })).toBe(false); });
it('does not accept a selected draft or parameters without conversation context', () => { expect(metaDraftExecutionPrompt('Draft Meta: p',[])).toBe('Draft Meta: p'); expect(metaDraftRequest('Publică campania.')).toBeNull(); });
it('enforces total 300 EUR as total and not daily', () => {
 const request='Pregătește campania cu buget total 300 €.';
 expect(requestedMetaDraftAction({ ...action, body: { ...action.body, patch: { budgetAmount: 300, currency: 'EUR', budgetType: 'lifetime' } } },request)).toBe(true);
 expect(requestedMetaDraftAction({ ...action, body: { ...action.body, patch: { budgetAmount: 300, currency: 'EUR', budgetType: 'daily' } } },request)).toBe(false);
});
