import 'server-only';

import crypto from 'node:crypto';
import { extractDocumentTextWithGoogleVision } from '@/lib/google-vision';
import { extractTextFromPdfBuffer } from '@/lib/pdf-text';
import { classifyDocumentName } from '@/lib/sales-inbound';
import type { SaleDocumentOcrStatus, SaleDocumentScanStatus } from '@/lib/types';

const BLOCKED_EXTENSIONS = new Set(['exe', 'com', 'bat', 'cmd', 'ps1', 'js', 'jse', 'vbs', 'scr', 'msi', 'dll', 'jar', 'html', 'htm', 'svg']);
const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'txt']);

function extension(fileName: string) {
  return fileName.toLowerCase().split('.').pop() || '';
}

function detectedMime(bytes: Buffer) {
  if (bytes.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return 'application/zip';
  return 'application/octet-stream';
}

function contentClassification(text: string, fileName: string) {
  const normalized = `${fileName} ${text}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const candidates: Array<{ label: string; terms: string[] }> = [
    { label: 'Certificat fiscal', terms: ['certificat fiscal', 'impozite si taxe locale'] },
    { label: 'Extras de carte funciară', terms: ['extras de carte funciara', 'oficiul de cadastru', 'carte funciara'] },
    { label: 'Certificat energetic', terms: ['certificat de performanta energetica', 'clasa energetica'] },
    { label: 'Act de proprietate', terms: ['contract de vanzare', 'contract de donatie', 'titlu de proprietate'] },
    { label: 'Cadastru / releveu', terms: ['releveu', 'plan cadastral', 'numar cadastral'] },
    { label: 'Act de identitate', terms: ['carte de identitate', 'cod numeric personal', 'cetatenia'] },
    { label: 'Document bancar', terms: ['preaprobare', 'credit ipotecar', 'institutie de credit', 'iban'] },
  ];
  const match = candidates.find((candidate) => candidate.terms.some((term) => normalized.includes(term)));
  return match ? { label: match.label, confidence: text.length > 100 ? 0.92 : 0.72 } : { label: classifyDocumentName(fileName), confidence: 0.55 };
}

async function scanWithProvider(bytes: Buffer, fileName: string, contentType: string, required: boolean) {
  const endpoint = process.env.SALES_DOCUMENT_SCAN_URL;
  if (!endpoint) return required
    ? { status: 'error' as SaleDocumentScanStatus, provider: 'local-policy', message: 'Politica agenției cere un scanner antivirus extern, dar acesta nu este configurat.' }
    : { status: 'safe_by_policy' as SaleDocumentScanStatus, provider: 'local-policy', message: 'Tip permis; antivirus extern neconfigurat.' };
  const form = new FormData();
  form.set('file', new Blob([Uint8Array.from(bytes).buffer], { type: contentType }), fileName);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: process.env.SALES_DOCUMENT_SCAN_TOKEN ? { Authorization: `Bearer ${process.env.SALES_DOCUMENT_SCAN_TOKEN}` } : undefined,
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) return { status: 'error' as SaleDocumentScanStatus, provider: 'external', message: `Scanner HTTP ${response.status}` };
  const payload = await response.json() as { safe?: boolean; infected?: boolean; message?: string; provider?: string };
  return {
    status: payload.infected || payload.safe === false ? 'infected' as const : 'safe' as const,
    provider: payload.provider || 'external',
    message: payload.message || null,
  };
}

export async function processSalesDocument(input: { bytes: Buffer; fileName: string; contentType?: string | null; forceOcr?: boolean; requireMalwareScanner?: boolean }) {
  const ext = extension(input.fileName);
  const mime = detectedMime(input.bytes);
  const checksumSha256 = crypto.createHash('sha256').update(input.bytes).digest('hex');
  if (!input.bytes.length || input.bytes.length > 15 * 1024 * 1024 || BLOCKED_EXTENSIONS.has(ext) || !ALLOWED_EXTENSIONS.has(ext)) {
    return { allowed: false, checksumSha256, detectedContentType: mime, scanStatus: 'unsupported' as SaleDocumentScanStatus, scanProvider: 'local-policy', scanMessage: 'Tip de fișier neacceptat.', ocrStatus: 'not_requested' as SaleDocumentOcrStatus, classification: classifyDocumentName(input.fileName), classificationConfidence: 0.2, qualityScore: 0, extractedTextPreview: null, expiresAt: null };
  }
  const scan = await scanWithProvider(input.bytes, input.fileName, input.contentType || mime, input.requireMalwareScanner === true);
  if (scan.status === 'infected' || (input.requireMalwareScanner && scan.status !== 'safe')) {
    return { allowed: false, checksumSha256, detectedContentType: mime, scanStatus: scan.status, scanProvider: scan.provider, scanMessage: scan.message, ocrStatus: 'not_requested' as SaleDocumentOcrStatus, classification: classifyDocumentName(input.fileName), classificationConfidence: 0.2, qualityScore: 0, extractedTextPreview: null, expiresAt: null };
  }
  const shouldOcr = input.forceOcr || process.env.SALES_DOCUMENT_OCR_ENABLED === 'true';
  let text = '';
  let ocrStatus: SaleDocumentOcrStatus = shouldOcr ? 'pending' : 'not_requested';
  if (shouldOcr && ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
    try {
      text = mime === 'application/pdf'
        ? await extractTextFromPdfBuffer(input.bytes)
        : (await extractDocumentTextWithGoogleVision({ contentBase64: input.bytes.toString('base64'), mimeType: mime })).fullText;
      ocrStatus = text.trim().length >= 30 ? 'completed' : 'low_quality';
    } catch (error) {
      ocrStatus = 'error';
    }
  }
  const classification = contentClassification(text, input.fileName);
  const expiryMatch = text.match(/(?:expir(?:ă|a|are)|valabil(?:itate)?)[^\d\n]{0,30}(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/i);
  const expiresAt = expiryMatch ? new Date(Date.UTC(Number(expiryMatch[3]), Number(expiryMatch[2]) - 1, Number(expiryMatch[1]), 23, 59, 59)).toISOString() : null;
  const qualityScore = ocrStatus === 'completed' ? Math.min(100, 55 + Math.round(Math.min(45, text.length / 70))) : ocrStatus === 'low_quality' ? 35 : 50;
  return {
    allowed: true,
    checksumSha256,
    detectedContentType: mime === 'application/octet-stream' || (mime === 'application/zip' && ['docx', 'xlsx'].includes(ext)) ? input.contentType || mime : mime,
    scanStatus: scan.status,
    scanProvider: scan.provider,
    scanMessage: scan.message,
    ocrStatus,
    classification: classification.label,
    classificationConfidence: classification.confidence,
    qualityScore,
    extractedTextPreview: text ? text.replace(/\s+/g, ' ').trim().slice(0, 800) : null,
    expiresAt,
  };
}
