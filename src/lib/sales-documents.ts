import type {
  SaleChecklistItem,
  SaleChecklistStage,
  SaleDocumentFileState,
  SaleDocumentScope,
  SaleDocumentVersion,
} from '@/lib/types';

export const SALE_DOCUMENT_STATUS_LABELS: Record<SaleChecklistItem['status'], string> = {
  required: 'Lipsește',
  requested: 'Solicitat',
  received_needs_review: 'De verificat',
  verified: 'Verificat',
  rejected: 'Respins',
  expired: 'Expirat',
  not_required: 'Nu este necesar',
};

export const SALE_DOCUMENT_SCOPE_LABELS: Record<SaleDocumentScope, string> = {
  property: 'Proprietate',
  participant: 'Participant',
  transaction: 'Tranzacție',
};

export function getSaleDocumentStages(item: Pick<SaleChecklistItem, 'stage' | 'appliesToStages'>): SaleChecklistStage[] {
  if (item.appliesToStages?.length) return [...new Set(item.appliesToStages)];
  return item.stage ? [item.stage] : [];
}

export function inferSaleDocumentScope(item: Pick<SaleChecklistItem, 'label' | 'scope'>): SaleDocumentScope {
  if (item.scope) return item.scope;
  const normalized = item.label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const propertyTerms = [
    'act de proprietate',
    'vanzare-cumparare',
    'releveu',
    'rlv',
    'carte funciara',
    'certificat energetic',
    'polita',
    'pad',
    'intabulare',
    'asociatia de proprietari',
    'factura de energie',
    'factura de gaze',
    'achitarii proprietatii',
  ];
  if (propertyTerms.some((term) => normalized.includes(term))) return 'property';
  if (normalized.includes('rezervare') || normalized.includes('antecontract') || normalized.includes('contract final')) return 'transaction';
  return 'participant';
}

export function getSaleDocumentFileState(item: Pick<SaleChecklistItem, 'fileState' | 'storagePath' | 'downloadUrl' | 'archivedAt'>): SaleDocumentFileState {
  if (item.fileState) return item.fileState;
  if (item.archivedAt) return 'archived';
  return item.storagePath || item.downloadUrl ? 'active' : 'missing';
}

export function hasActiveSaleDocumentFile(item: SaleChecklistItem) {
  return getSaleDocumentFileState(item) === 'active' && Boolean(item.storagePath || item.downloadUrl);
}

export function saleDocumentMatchesStage(item: SaleChecklistItem, stage: SaleChecklistStage | 'all') {
  if (stage === 'all') return true;
  const stages = getSaleDocumentStages(item);
  return !stages.length || stages.includes(stage);
}

export function getSaleDocumentSummary(checklist: SaleChecklistItem[], stage: SaleChecklistStage | 'all' = 'all') {
  const visible = checklist.filter((item) => saleDocumentMatchesStage(item, stage));
  const applicable = visible.filter((item) => item.status !== 'not_required');
  const required = applicable.filter((item) => item.required);
  const verified = required.filter((item) => item.status === 'verified');
  const review = applicable.filter((item) => item.status === 'received_needs_review');
  const requested = applicable.filter((item) => item.status === 'requested');
  const missing = required.filter((item) => !['verified', 'received_needs_review', 'requested'].includes(item.status));
  const progress = required.length ? Math.round((verified.length / required.length) * 100) : 0;
  return {
    total: visible.length,
    applicable: applicable.length,
    required: required.length,
    verified: verified.length,
    review: review.length,
    requested: requested.length,
    missing: missing.length,
    progress,
    complete: required.length > 0 && verified.length === required.length,
  };
}

export function activeSaleDocumentVersion(item: SaleChecklistItem): SaleDocumentVersion | null {
  if (!item.storagePath || !item.fileName) return null;
  const existing = item.versions?.find((version) => version.id === item.activeVersionId);
  if (existing) return existing;
  return {
    id: item.activeVersionId || `legacy-${item.id}-v${item.version || 1}`,
    version: item.version || 1,
    fileName: item.fileName,
    storagePath: item.storagePath,
    downloadUrl: item.downloadUrl || null,
    contentType: item.contentType || null,
    sizeBytes: item.sizeBytes || null,
    checksumSha256: item.checksumSha256 || null,
    uploadedAt: item.uploadedAt || item.receivedAt || new Date(0).toISOString(),
    uploadedByUid: item.uploadedByUid || null,
    archivedAt: item.archivedAt || null,
    scanStatus: item.scanStatus,
    ocrStatus: item.ocrStatus,
    qualityScore: item.qualityScore ?? null,
  };
}

export function mergeSaleDocumentVersionHistory(item: SaleChecklistItem, next: SaleDocumentVersion) {
  const current = activeSaleDocumentVersion(item);
  const versions = [...(item.versions || [])];
  if (current && !versions.some((version) => version.id === current.id)) versions.push(current);
  const withoutNext = versions.filter((version) => version.id !== next.id);
  return [...withoutNext, next].sort((left, right) => right.version - left.version).slice(0, 25);
}