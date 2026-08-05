import { describe, expect, it } from 'vitest';

import { normalizeSaleForWorkspace, normalizeSalesWorkspaceDate } from '@/lib/sales-workspace';
import type { SaleTransaction } from '@/lib/types';

describe('sales workspace normalization', () => {
  it('keeps ISO strings unchanged', () => {
    const value = '2026-08-05T14:00:00.000Z';
    expect(normalizeSalesWorkspaceDate(value)).toBe(value);
  });

  it('converts Firestore Timestamp-like values to ISO strings', () => {
    const value = { toDate: () => new Date('2026-08-05T14:00:00.000Z') };
    expect(normalizeSalesWorkspaceDate(value)).toBe('2026-08-05T14:00:00.000Z');
  });

  it('normalizes the dates used when the dossier dialog opens', () => {
    const sale = {
      nextActionAt: { seconds: 1_786_000_000 },
      notary: { appointmentAt: { toMillis: () => 1_786_003_600_000 } },
    } as unknown as SaleTransaction;

    const normalized = normalizeSaleForWorkspace(sale);

    expect(typeof normalized.nextActionAt).toBe('string');
    expect(typeof normalized.notary?.appointmentAt).toBe('string');
  });

  it('returns null for invalid legacy values instead of throwing', () => {
    expect(normalizeSalesWorkspaceDate({ toDate: () => { throw new Error('invalid'); } })).toBeNull();
    expect(normalizeSalesWorkspaceDate({ unexpected: true })).toBeNull();
  });
});
