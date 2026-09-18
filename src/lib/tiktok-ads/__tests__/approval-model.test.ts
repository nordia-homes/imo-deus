import { describe, expect, it } from 'vitest';
import { assertDraftAction, canEditApproval, validateApprovalDraft, type ApprovalDraft, type ApprovalStatus } from '../approval-model';
import { emptyAdDraft } from '../workspace-model';

const draft: ApprovalDraft = { id: 'draft', advertiserId: 'account', ownerUid: 'agent', version: 2, status: 'draft', data: { ...emptyAdDraft, name: 'Apartament', propertyId: 'property', identityId: 'profile', assetId: 'video', text: 'Vizionare', url: 'https://example.com', adgroupId: 'group' } };
describe('TikTok approval transitions', () => {
  it('allows the owner to submit a valid draft without TikTok write privileges', () => {
    expect(() => assertDraftAction(draft, 'agent', 'agent', 'submit')).not.toThrow();
    expect(() => validateApprovalDraft(draft.data)).not.toThrow();
  });
  it('denies another agent and an unknown role', () => {
    expect(() => assertDraftAction(draft, 'other', 'agent', 'delete')).toThrow();
    expect(() => assertDraftAction(draft, 'agent', undefined, 'submit')).toThrow();
  });
  it('requires an admin and a reason for rejection or changes', () => {
    const submitted = { ...draft, status: 'submitted' as const };
    for (const action of ['reject', 'request_changes']) {
      expect(() => assertDraftAction(submitted, 'agent', 'agent', action, 'Motiv')).toThrow();
      expect(() => assertDraftAction(submitted, 'admin', 'admin', action, ' ')).toThrow();
      expect(() => assertDraftAction(submitted, 'admin', 'admin', action, 'Buget incorect')).not.toThrow();
    }
  });
  it('requires withdrawal before editing or deleting a submitted draft', () => {
    const submitted = { ...draft, status: 'submitted' as const };
    expect(canEditApproval(submitted)).toBe(false);
    expect(() => assertDraftAction(submitted, 'agent', 'agent', 'delete')).toThrow();
    expect(() => assertDraftAction(submitted, 'agent', 'agent', 'withdraw')).not.toThrow();
  });
  it.each(['publishing', 'publication_failed', 'published', 'deleted'] as ApprovalStatus[])('locks %s against deletion and resubmission', status => {
    const locked = { ...draft, status, publishRevision: 2 };
    expect(canEditApproval(locked)).toBe(false);
    expect(() => assertDraftAction(locked, 'admin', 'admin', 'delete')).toThrow();
    expect(() => assertDraftAction(locked, 'agent', 'agent', 'submit')).toThrow();
    expect(() => assertDraftAction(locked, 'admin', 'admin', 'withdraw')).toThrow();
  });
  it('allows rejected drafts to be corrected and deleted but never reopens a publication', () => {
    expect(canEditApproval({ status: 'rejected' })).toBe(true);
    expect(canEditApproval({ status: 'draft', publishRevision: 1 })).toBe(false);
    expect(() => assertDraftAction({ ...draft, status: 'changes_requested' }, 'agent', 'agent', 'delete')).not.toThrow();
  });
  it('validates budget, scheduling and the advertising destination', () => {
    expect(() => validateApprovalDraft({ ...draft.data, url: 'http://example.com' })).toThrow();
    expect(() => validateApprovalDraft({ ...draft.data, adgroupId: '', budget: '-50' })).toThrow();
    expect(() => validateApprovalDraft({ ...draft.data, assetId: '' })).toThrow();
    expect(() => validateApprovalDraft({ ...draft.data, mode: 'post', postId: '' })).toThrow();
  });
});
