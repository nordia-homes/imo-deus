import type { CSSProperties, ReactNode } from 'react';
import { notFound } from 'next/navigation';
import type { Agency } from '@/lib/types';
import { firebaseConfig } from '@/firebase/config';
import { PublicHeader } from '@/components/public/PublicHeader';
import { PublicFooter } from '@/components/public/PublicFooter';
import { PublicAgencyProvider } from '@/context/PublicAgencyContext';
import { getCanonicalCustomDomain } from '@/lib/domain-routing';
import { getAgencyThemePreset, getAgencyThemeStyle } from '@/lib/theme';

function parseFirestoreValue(value: any): any {
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(parseFirestoreValue);
  }
  if ('mapValue' in value) {
    const fields = value.mapValue.fields || {};
    return Object.fromEntries(Object.entries(fields).map(([key, nestedValue]) => [key, parseFirestoreValue(nestedValue)]));
  }

  return undefined;
}

function parseFirestoreDocument<T>(document: any): T | null {
  if (!document?.fields) return null;
  return Object.fromEntries(
    Object.entries(document.fields).map(([key, value]) => [key, parseFirestoreValue(value)])
  ) as T;
}

async function getPublicDocument<T>(path: string): Promise<T | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${path}?key=${firebaseConfig.apiKey}`;
  const response = await fetch(url, { cache: 'no-store' });

  if (!response.ok) {
    return null;
  }

  const json = await response.json();
  return parseFirestoreDocument<T>(json);
}

async function getServerDocument<T>(path: string): Promise<T | null> {
  try {
    const { adminDb } = await import('@/firebase/admin');
    const segments = path.split('/').filter(Boolean);
    if (!segments.length || segments.length % 2 !== 0) {
      return null;
    }

    let ref: any = adminDb.doc(`${segments[0]}/${segments[1]}`);
    for (let index = 2; index < segments.length; index += 2) {
      ref = ref.collection(segments[index]).doc(segments[index + 1]);
    }

    const snapshot = await ref.get();
    return snapshot.exists ? (snapshot.data() as T) : null;
  } catch {
    return getPublicDocument<T>(path);
  }
}

async function resolveAgencyIdForDomain(domain: string): Promise<string | null> {
  const normalized = domain.trim().toLowerCase();
  const canonical = getCanonicalCustomDomain(normalized);
  const candidates = Array.from(
    new Set([
      normalized,
      canonical,
      canonical ? `www.${canonical}` : '',
      normalized.startsWith('www.') ? normalized.slice(4) : '',
    ].filter(Boolean))
  );

  for (const candidate of candidates) {
    const mapping = await getServerDocument<{ agencyId?: string }>(`publicDomains/${candidate}`);
    if (mapping?.agencyId) {
      return mapping.agencyId;
    }
  }

  return null;
}

export default async function PublicDomainLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;

  const agencyId = await resolveAgencyIdForDomain(domain);
  if (!agencyId) {
    notFound();
  }

  const agencyData = await getServerDocument<Omit<Agency, 'id'>>(`agencies/${agencyId}`);
  if (!agencyData) {
    notFound();
  }

  const agency = { id: agencyId, ...agencyData } as Agency;
  const themePreset = getAgencyThemePreset(agency);
  const themeStyle = getAgencyThemeStyle(agency);

  return (
    <PublicAgencyProvider
      value={{
        agency,
        agencyId,
        isAgencyLoading: false,
        siteBasePath: '',
        isCustomDomain: true,
      }}
    >
      <div data-app-theme={themePreset} style={themeStyle as CSSProperties}>
        <PublicHeader agency={agency} isLoading={false} />
        <main className="min-h-screen [background:var(--public-shell-bg)] text-stone-100">
          {children}
        </main>
        <PublicFooter />
      </div>
    </PublicAgencyProvider>
  );
}
