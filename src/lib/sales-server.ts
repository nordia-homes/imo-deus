import 'server-only';

import type { NextRequest } from 'next/server';
import type { DocumentReference, Firestore } from 'firebase-admin/firestore';
import { requireAgencyUserFromBearerToken } from '@/lib/firebase-app-hosting';
import type { SaleTransaction, SalesAuditEvent } from '@/lib/types';

export class SalesApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function requireSaleAccess(request: NextRequest, saleId: string, options?: { adminOnly?: boolean }) {
  const auth = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
  const saleRef = auth.adminDb.collection('agencies').doc(auth.agencyId).collection('sales').doc(saleId);
  const saleSnapshot = await saleRef.get();
  if (!saleSnapshot.exists) throw new SalesApiError('Dosarul de vânzare nu există.', 404);
  const sale = { id: saleSnapshot.id, ...saleSnapshot.data() } as SaleTransaction;
  const isAdmin = auth.role === 'admin';
  if (options?.adminOnly && !isAdmin) throw new SalesApiError('Operațiunea necesită rol de administrator.', 403);
  if (!isAdmin && sale.agentId !== auth.uid) throw new SalesApiError('Nu ai acces la această tranzacție.', 403);
  return { ...auth, saleRef, saleSnapshot, sale, isAdmin };
}

function safeMetadata(metadata?: Record<string, unknown>) {
  const result: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) {
      result[key] = value as string | number | boolean | null;
    }
  }
  return result;
}

export function buildSalesAuditEvent(input: {
  agencyId: string;
  saleId: string;
  actorUid: string | null;
  actorType: SalesAuditEvent['actorType'];
  action: string;
  entityType: SalesAuditEvent['entityType'];
  entityId: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  return {
    agencyId: input.agencyId,
    saleId: input.saleId,
    actorUid: input.actorUid,
    actorType: input.actorType,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    summary: input.summary,
    metadata: safeMetadata(input.metadata),
    createdAt: now,
    expiresAt: new Date(Date.now() + 7 * 365 * 24 * 60 * 60_000).toISOString(),
  } satisfies Omit<SalesAuditEvent, 'id'>;
}

export function appendSalesAudit(
  db: Firestore,
  saleRef: DocumentReference,
  input: Parameters<typeof buildSalesAuditEvent>[0]
) {
  const ref = saleRef.collection('audit').doc();
  return { ref, data: buildSalesAuditEvent(input) };
}

export function salesApiErrorResponse(error: unknown) {
  const status = error instanceof SalesApiError
    ? error.status
    : error && typeof error === 'object' && 'status' in error && typeof error.status === 'number'
      ? error.status
      : 500;
  return { status, message: error instanceof Error ? error.message : 'Operațiunea nu a putut fi finalizată.' };
}
