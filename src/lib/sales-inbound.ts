import 'server-only';

import crypto from 'node:crypto';
import { inferSaleDocumentScope, mergeSaleDocumentVersionHistory } from '@/lib/sales-documents';
import type { SaleDocumentVersion, SaleEmailQuestion, SaleTransaction } from '@/lib/types';

export function createInboundToken() {
  return crypto.randomBytes(18).toString('base64url');
}

export function hashInboundToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function extractInboundToken(recipient: string) {
  const match = recipient.match(/inbox\+([a-zA-Z0-9_-]{12,})@/i);
  return match?.[1] || null;
}

export function extractSaleTrackingCode(subject: string) {
  const match = subject.toUpperCase().match(/\b(IMD-V[A-Z0-9]{5,12})\b/);
  return match?.[1] || null;
}

export function stripQuotedReply(value: string) {
  const normalized = String(value || '').replace(/\r\n/g, '\n').trim();
  const separators = [
    /^On .+wrote:$/im,
    /^În .+a scris:$/im,
    /^De la:\s/im,
    /^From:\s/im,
    /^-{2,}\s*Original Message\s*-{2,}$/im,
  ];
  let end = normalized.length;
  for (const separator of separators) {
    const match = separator.exec(normalized);
    if (match && match.index < end) end = match.index;
  }
  return normalized
    .slice(0, end)
    .split('\n')
    .filter((line) => !line.trim().startsWith('>'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function mapAnswersToQuestions(questions: SaleEmailQuestion[], replyText: string) {
  if (!questions.length) return questions;
  const clean = stripQuotedReply(replyText);
  const numbered = new Map<number, string>();
  for (const line of clean.split('\n')) {
    const match = line.trim().match(/^(?:r(?:ă|a)spuns\s*)?(\d{1,2})[).:\-]\s*(.+)$/i);
    if (match) numbered.set(Number(match[1]), match[2].trim());
  }
  return questions.map((question, index) => {
    const direct = numbered.get(index + 1);
    if (direct) {
      return { ...question, status: 'answered' as const, answer: direct, evidence: direct, confidence: 0.94, reviewStatus: 'pending_agent_review' as const };
    }
    if (questions.length === 1 && clean.length > 1) {
      return { ...question, status: 'answered' as const, answer: clean, evidence: clean.slice(0, 500), confidence: 0.78, reviewStatus: 'pending_agent_review' as const };
    }
    return clean.length > 1
      ? { ...question, status: 'unclear' as const, evidence: clean.slice(0, 500), confidence: 0.35, reviewStatus: 'pending_agent_review' as const }
      : question;
  });
}

const DOCUMENT_HINTS: Array<{ type: string; terms: string[] }> = [
  { type: 'Act de identitate', terms: ['buletin', 'identitate', 'carte identitate', ' ci '] },
  { type: 'Certificat fiscal', terms: ['fiscal', 'taxe locale'] },
  { type: 'Certificat energetic', terms: ['energetic', 'energie'] },
  { type: 'Extras de carte funciară', terms: ['extras cf', 'carte funciara', 'carte funciară'] },
  { type: 'Cadastru / releveu', terms: ['cadastru', 'cadastral', 'releveu', 'rlv'] },
  { type: 'Act de proprietate', terms: ['proprietate', 'vanzare cumparare', 'vânzare cumpărare', 'donatie', 'donație'] },
  { type: 'Certificat de căsătorie', terms: ['casatorie', 'căsătorie'] },
  { type: 'Document bancar', terms: ['banca', 'bancă', 'credit', 'preaprobare', 'iban'] },
];

function normalize(value: string) {
  return ` ${value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[_\-.]+/g, ' ')} `;
}

export function classifyDocumentName(fileName: string) {
  const value = normalize(fileName);
  return DOCUMENT_HINTS.find((item) => item.terms.some((term) => value.includes(normalize(term).trim())))?.type || 'Document primit';
}

export function mergeReceivedDocuments(
  sale: SaleTransaction,
  files: Array<{
    fileName: string;
    downloadUrl: string;
    storagePath?: string;
    receivedAt: string;
    contentType?: string;
    sizeBytes?: number;
    checksumSha256?: string;
    scanStatus?: import('@/lib/types').SaleDocumentScanStatus;
    scanProvider?: string;
    scanMessage?: string | null;
    ocrStatus?: import('@/lib/types').SaleDocumentOcrStatus;
    extractedTextPreview?: string | null;
    classification?: string;
    classificationConfidence?: number;
    qualityScore?: number;
    expiresAt?: string | null;
    duplicateOfDocumentId?: string | null;
  }>,
  participantRole: 'buyer' | 'owner' = 'buyer'
) {
  const checklist = [...(sale.checklist || [])];
  for (const file of files) {
    const classification = file.classification || classifyDocumentName(file.fileName);
    const matchingIndex = checklist.findIndex((item) =>
      !['verified', 'received_needs_review'].includes(item.status) &&
      (normalize(item.label).includes(normalize(classification).trim()) || normalize(classification).includes(normalize(item.label).trim()))
    );
    const current = matchingIndex >= 0 ? checklist[matchingIndex] : null;
    const version = (current?.version || 0) + 1;
    const versionId = crypto.randomUUID();
    const versionRecord: SaleDocumentVersion | null = file.storagePath ? {
      id: versionId,
      version,
      fileName: file.fileName,
      storagePath: file.storagePath,
      downloadUrl: file.downloadUrl,
      contentType: file.contentType || null,
      sizeBytes: file.sizeBytes || null,
      checksumSha256: file.checksumSha256 || null,
      uploadedAt: file.receivedAt,
      uploadedByUid: null,
      scanStatus: file.scanStatus || 'pending',
      ocrStatus: file.ocrStatus || 'not_requested',
      qualityScore: file.qualityScore ?? null,
    } : null;
    const shared = {
      status: 'received_needs_review' as const,
      receivedAt: file.receivedAt,
      uploadedAt: file.receivedAt,
      uploadedByUid: null,
      fileName: file.fileName,
      downloadUrl: file.downloadUrl,
      storagePath: file.storagePath || null,
      contentType: file.contentType || null,
      sizeBytes: file.sizeBytes || null,
      checksumSha256: file.checksumSha256 || null,
      scanStatus: file.scanStatus || 'pending' as const,
      scanProvider: file.scanProvider || null,
      scanMessage: file.scanMessage || null,
      ocrStatus: file.ocrStatus || 'not_requested' as const,
      extractedTextPreview: file.extractedTextPreview || null,
      classification,
      classificationConfidence: file.classificationConfidence ?? null,
      qualityScore: file.qualityScore ?? null,
      expiresAt: file.expiresAt || null,
      duplicateOfDocumentId: file.duplicateOfDocumentId || null,
      reviewStatus: file.scanStatus === 'infected' ? 'rejected' as const : file.duplicateOfDocumentId || file.scanStatus === 'error' || (file.expiresAt && new Date(file.expiresAt).getTime() < Date.now()) ? 'needs_attention' as const : 'unreviewed' as const,
      version,
      activeVersionId: versionRecord?.id || null,
      fileState: 'active' as const,
      archivedAt: null,
      revokedAt: null,
    };
    if (current && matchingIndex >= 0) {
      checklist[matchingIndex] = {
        ...current,
        ...shared,
        versions: versionRecord ? mergeSaleDocumentVersionHistory(current, versionRecord) : current.versions || [],
      };
    } else {
      const newId = crypto.randomUUID();
      checklist.push({
        id: newId,
        label: classification,
        participantRole,
        scope: inferSaleDocumentScope({ label: classification }),
        stage: ['reservation', 'precontract', 'contract'].includes(sale.stage) ? sale.stage as import('@/lib/types').SaleChecklistStage : undefined,
        appliesToStages: ['reservation', 'precontract', 'contract'].includes(sale.stage) ? [sale.stage as import('@/lib/types').SaleChecklistStage] : undefined,
        required: false,
        ...shared,
        versions: versionRecord ? [versionRecord] : [],
      });
    }
  }
  return checklist;
}