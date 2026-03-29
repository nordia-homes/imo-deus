import type { CSSProperties, ReactNode } from 'react';
import { notFound } from 'next/navigation';
import type { Agency } from '@/lib/types';
import { firebaseConfig } from '@/firebase/config';
import { PublicHeader } from '@/components/public/PublicHeader';
import { PublicFooter } from '@/components/public/PublicFooter';
import { PublicAgencyProvider } from '@/context/PublicAgencyContext';
import { getCanonicalCustomDomain } from '@/lib/domain-routing';

function hexToHsl(hex: string): string | null {
  if (!hex || !hex.startsWith('#')) return null;
  let hexValue = hex.replace(/#/, '');
  if (hexValue.length === 3) {
    hexValue = hexValue.split('').map((char) => char + char).join('');
  }
  if (hexValue.length !== 6) return null;

  const r = parseInt(hexValue.substring(0, 2), 16) / 255;
  const g = parseInt(hexValue.substring(2, 4), 16) / 255;
  const b = parseInt(hexValue.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

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
  const primaryHsl = agency.primaryColor ? hexToHsl(agency.primaryColor) : null;

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
      <div style={primaryHsl ? ({ ['--primary' as string]: primaryHsl, ['--ring' as string]: primaryHsl } as CSSProperties) : undefined}>
        <PublicHeader agency={agency} isLoading={false} />
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(212,175,55,0.12),_transparent_24%),linear-gradient(180deg,_#050505_0%,_#0b0b0d_42%,_#121214_100%)] text-stone-100">
          {children}
        </main>
        <PublicFooter />
      </div>
    </PublicAgencyProvider>
  );
}
