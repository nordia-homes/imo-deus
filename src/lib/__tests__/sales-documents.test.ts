import { describe, expect, it } from 'vitest';
import {
  getSaleDocumentFileState,
  getSaleDocumentStages,
  getSaleDocumentSummary,
  inferSaleDocumentScope,
  mergeSaleDocumentVersionHistory,
} from '@/lib/sales-documents';
import type { SaleChecklistItem, SaleDocumentVersion } from '@/lib/types';

function requirement(patch: Partial<SaleChecklistItem> = {}): SaleChecklistItem {
  return {
    id: patch.id || 'document-1',
    label: patch.label || 'Certificat energetic',
    participantRole: patch.participantRole || 'owner',
    stage: patch.stage || 'precontract',
    status: patch.status || 'required',
    required: patch.required ?? true,
    ...patch,
  };
}

describe('sales document workspace helpers', () => {
  it('keeps legacy stage fields compatible with the multi-stage model', () => {
    expect(getSaleDocumentStages(requirement())).toEqual(['precontract']);
    expect(getSaleDocumentStages(requirement({ appliesToStages: ['precontract', 'contract'] }))).toEqual(['precontract', 'contract']);
  });

  it('infers the entity that owns a requirement', () => {
    expect(inferSaleDocumentScope(requirement({ label: 'Extras de carte funciară pentru informare' }))).toBe('property');
    expect(inferSaleDocumentScope(requirement({ label: 'Carte de identitate cumpărător' }))).toBe('participant');
  });

  it('separates missing, requested, review and verified requirements', () => {
    const result = getSaleDocumentSummary([
      requirement({ id: 'missing' }),
      requirement({ id: 'requested', status: 'requested' }),
      requirement({ id: 'review', status: 'received_needs_review' }),
      requirement({ id: 'verified', status: 'verified' }),
      requirement({ id: 'ignored', status: 'not_required' }),
    ]);
    expect(result).toMatchObject({ required: 4, missing: 1, requested: 1, review: 1, verified: 1, progress: 25 });
  });

  it('recognizes active and archived file states', () => {
    expect(getSaleDocumentFileState(requirement())).toBe('missing');
    expect(getSaleDocumentFileState(requirement({ storagePath: 'sales/file.pdf' }))).toBe('active');
    expect(getSaleDocumentFileState(requirement({ archivedAt: '2026-08-10T10:00:00.000Z' }))).toBe('archived');
  });

  it('keeps ordered version history without duplicate entries', () => {
    const previous: SaleDocumentVersion = {
      id: 'v1',
      version: 1,
      fileName: 'document-v1.pdf',
      storagePath: 'v1.pdf',
      uploadedAt: '2026-08-10T10:00:00.000Z',
    };
    const next: SaleDocumentVersion = {
      id: 'v2',
      version: 2,
      fileName: 'document-v2.pdf',
      storagePath: 'v2.pdf',
      uploadedAt: '2026-08-11T10:00:00.000Z',
    };
    const item = requirement({ versions: [previous], activeVersionId: 'v1', storagePath: previous.storagePath, fileName: previous.fileName, version: 1 });
    expect(mergeSaleDocumentVersionHistory(item, next).map((version) => version.id)).toEqual(['v2', 'v1']);
  });
});