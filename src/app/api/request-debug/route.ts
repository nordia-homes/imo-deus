import { NextRequest, NextResponse } from 'next/server';
import { getCanonicalCustomDomain, normalizeDomain } from '@/lib/domain-routing';

export const runtime = 'nodejs';

function buildCandidates(input: string) {
  const normalized = normalizeDomain(input);
  const canonical = getCanonicalCustomDomain(normalized);

  return Array.from(
    new Set(
      [
        normalized,
        canonical,
        canonical ? `www.${canonical}` : '',
        normalized.startsWith('www.') ? normalized.slice(4) : '',
      ].filter(Boolean)
    )
  );
}

export async function GET(request: NextRequest) {
  const host = request.headers.get('host');
  const forwardedHost = request.headers.get('x-forwarded-host');
  const nextHostname = request.nextUrl.hostname;
  const chosenHost = normalizeDomain(forwardedHost || host || nextHostname);
  const candidates = buildCandidates(chosenHost);

  const mappingChecks: Array<{
    candidate: string;
    adminFound: boolean;
    adminAgencyId: string | null;
    restFound: boolean;
    restAgencyId: string | null;
  }> = [];

  const agencyChecks: Array<{
    agencyId: string;
    adminFound: boolean;
    restFound: boolean;
    agencyName: string | null;
  }> = [];

  for (const candidate of candidates) {
    let adminFound = false;
    let adminAgencyId: string | null = null;
    let restFound = false;
    let restAgencyId: string | null = null;

    try {
      const { adminDb } = await import('@/firebase/admin');
      const snapshot = await adminDb.collection('publicDomains').doc(candidate).get();
      adminFound = snapshot.exists;
      adminAgencyId = snapshot.exists ? ((snapshot.data()?.agencyId as string | undefined) || null) : null;
    } catch {
      adminFound = false;
      adminAgencyId = null;
    }

    try {
      const { firebaseConfig } = await import('@/firebase/config');
      const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/publicDomains/${candidate}?key=${firebaseConfig.apiKey}`;
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) {
        const payload = await response.json();
        const agencyId =
          payload?.fields?.agencyId?.stringValue ||
          null;
        restFound = true;
        restAgencyId = agencyId;
      }
    } catch {
      restFound = false;
      restAgencyId = null;
    }

    mappingChecks.push({
      candidate,
      adminFound,
      adminAgencyId,
      restFound,
      restAgencyId,
    });

    const agencyId = adminAgencyId || restAgencyId;
    if (agencyId && !agencyChecks.some((entry) => entry.agencyId === agencyId)) {
      let agencyAdminFound = false;
      let agencyRestFound = false;
      let agencyName: string | null = null;

      try {
        const { adminDb } = await import('@/firebase/admin');
        const snapshot = await adminDb.collection('agencies').doc(agencyId).get();
        agencyAdminFound = snapshot.exists;
        agencyName = snapshot.exists ? ((snapshot.data()?.name as string | undefined) || null) : null;
      } catch {
        agencyAdminFound = false;
      }

      try {
        const { firebaseConfig } = await import('@/firebase/config');
        const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/agencies/${agencyId}?key=${firebaseConfig.apiKey}`;
        const response = await fetch(url, { cache: 'no-store' });
        if (response.ok) {
          const payload = await response.json();
          agencyRestFound = true;
          agencyName = agencyName || payload?.fields?.name?.stringValue || null;
        }
      } catch {
        agencyRestFound = false;
      }

      agencyChecks.push({
        agencyId,
        adminFound: agencyAdminFound,
        restFound: agencyRestFound,
        agencyName,
      });
    }
  }

  return NextResponse.json({
    marker: 'IMO-DEUS-REQUEST-DEBUG',
    host,
    forwardedHost,
    nextHostname,
    chosenHost,
    candidates,
    mappingChecks,
    agencyChecks,
  });
}
