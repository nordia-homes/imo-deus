import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { requireAgencyUserFromBearerToken } from './firebase-app-hosting';

// Shared across Cloud Run instances. Keep one fixed document per principal/scope,
// rather than creating an unbounded collection of request/window documents.
export async function consumeMapsRequest(db: Firestore, principal: string, now = Date.now()) {
  const ref = db.doc(`mapsRequestLimits/${createHash('sha256').update(principal).digest('hex')}`);
  await db.runTransaction(async tx => {
    const saved = (await tx.get(ref)).data() || {};
    const minute = Math.floor(now / 60000);
    const day = Math.floor(now / 86400000);
    const minuteCount = saved.minute === minute ? Number(saved.minuteCount || 0) : 0;
    const dayCount = saved.day === day ? Number(saved.dayCount || 0) : 0;
    if (minuteCount >= 20 || dayCount >= 150) {
      throw Object.assign(new Error('Limita căutărilor de adresă a fost atinsă. Încearcă mai târziu.'), { status: 429 });
    }
    tx.set(ref, { minute, day, minuteCount: minuteCount + 1, dayCount: dayCount + 1 });
  });
}

export async function guardMapsRequest(request: Request) {
  const auth = await requireAgencyUserFromBearerToken(request.headers.get('authorization'));
  const params = new URL(request.url).searchParams;
  if (['address', 'city', 'zone'].some(key => (params.get(key) || '').length > 300) ||
      (params.get('address') || '').trim().length < 3) {
    throw Object.assign(new Error('Introdu o adresă validă, de cel puțin 3 caractere.'), { status: 400 });
  }
  await consumeMapsRequest(auth.adminDb, `${auth.agencyId}:${auth.uid}`);
}

export function mapsGuardError(error: unknown) {
  const status = Number((error as { status?: number })?.status) || 503;
  return NextResponse.json({ message: status === 429
    ? 'Limita căutărilor de adresă a fost atinsă. Încearcă mai târziu.'
    : status === 401 || status === 403 ? 'Autentificare necesară.'
    : status === 400 ? 'Adresă invalidă.' : 'Căutarea adreselor este temporar indisponibilă.' },
  { status, headers: { 'Cache-Control': 'no-store', ...(status === 429 ? { 'Retry-After': '60' } : {}) } });
}
