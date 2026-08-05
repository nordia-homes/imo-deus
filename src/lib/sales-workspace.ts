import type { SaleTransaction } from '@/lib/types';

type FirestoreDateLike = {
  seconds?: number;
  toDate?: () => Date;
  toMillis?: () => number;
};

function validIsoDate(value: Date) {
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

export function normalizeSalesWorkspaceDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return validIsoDate(value);
  if (typeof value === 'number') return validIsoDate(new Date(value));

  if (typeof value === 'object') {
    const candidate = value as FirestoreDateLike;
    try {
      if (typeof candidate.toDate === 'function') return validIsoDate(candidate.toDate());
      if (typeof candidate.toMillis === 'function') return validIsoDate(new Date(candidate.toMillis()));
      if (typeof candidate.seconds === 'number') return validIsoDate(new Date(candidate.seconds * 1000));
    } catch {
      return null;
    }
  }

  return null;
}

export function normalizeSaleForWorkspace(sale: SaleTransaction): SaleTransaction {
  const rawNotary = sale.notary as (SaleTransaction['notary'] & { appointmentAt?: unknown }) | null;
  return {
    ...sale,
    nextActionAt: normalizeSalesWorkspaceDate(sale.nextActionAt),
    notary: rawNotary
      ? { ...rawNotary, appointmentAt: normalizeSalesWorkspaceDate(rawNotary.appointmentAt) }
      : rawNotary,
  };
}
