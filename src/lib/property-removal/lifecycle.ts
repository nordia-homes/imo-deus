import { randomUUID } from 'node:crypto';
import type { DocumentReference, Firestore, SetOptions } from 'firebase-admin/firestore';

export type PropertyContext = { db: Firestore; agencyId: string; propertyId: string };
export class PropertyLifecycleError extends Error {
  constructor(message: string, public status = 409) { super(message); }
}
export const lifecycleRef = ({ db, agencyId, propertyId }: PropertyContext) =>
  db.collection('agencyPrivateIntegrations').doc(`${agencyId}__property_lifecycle`).collection('operations').doc(propertyId);

// Durable ownership deliberately has no TTL: an expired HTTP request does not
// prove that a remote publication stopped. An interrupted worker needs recovery.
export async function withPropertyOperation<T>(
  ctx: PropertyContext, mode: 'publish' | 'remove', work: () => Promise<T>,
): Promise<T> {
  const ref = lifecycleRef(ctx), owner = randomUUID();
  await ctx.db.runTransaction(async tx => {
    const state = (await tx.get(ref)).data();
    if (state?.owner) throw new PropertyLifecycleError('O operațiune este deja în curs pentru această proprietate. Reîncearcă după finalizare; dacă mesajul persistă, contactează administratorul.');
    if (mode === 'publish' && state?.removalRequested) throw new PropertyLifecycleError('Proprietatea este în curs de retragere sau a fost scoasă din portofoliu. Publicarea este blocată.');
    tx.set(ref, {
      owner, mode, startedAt: new Date().toISOString(),
    }, { merge: true });
  });
  try { return await work(); }
  finally {
    await ctx.db.runTransaction(async tx => {
      const state = (await tx.get(ref)).data();
      if (state?.owner === owner) tx.set(ref, { owner: null }, { merge: true });
    });
  }
}

export async function recordPortalAttempt(ctx: PropertyContext, portal: string) {
  await lifecycleRef(ctx).set({ attemptedPortals: { [portal]: true } }, { merge: true });
}

// Reconciliation and delayed webhooks must never recreate a deleted property.
export async function mergeExistingProperty(ref: DocumentReference, data: FirebaseFirestore.DocumentData, options: SetOptions = { merge: true }) {
  await ref.firestore.runTransaction(async tx => {
    if ((await tx.get(ref)).exists) tx.set(ref, data, options);
  });
}

// Firestore update() has an existence precondition; dotted paths retain the
// nested merge behavior of set(merge:true) for portal webhook projections.
export function propertyUpdateFields(data: Record<string, unknown>, prefix = ''): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype
      ? Object.entries(propertyUpdateFields(value as Record<string, unknown>, path))
      : [[path, value]];
  }));
}
