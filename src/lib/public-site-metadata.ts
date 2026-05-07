import type { Agency, ClientPortal, Property } from '@/lib/types';
import type { Metadata } from 'next';
import { firebaseConfig } from '@/firebase/config';
import { getCanonicalCustomDomain } from '@/lib/domain-routing';

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
    return Object.fromEntries(
      Object.entries(fields).map(([key, nestedValue]) => [key, parseFirestoreValue(nestedValue)])
    );
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

export async function resolveAgencyIdForDomain(domain: string): Promise<string | null> {
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

export async function getAgencyById(agencyId: string): Promise<Agency | null> {
  const agencyData = await getServerDocument<Omit<Agency, 'id'>>(`agencies/${agencyId}`);
  if (!agencyData) return null;
  return { id: agencyId, ...agencyData } as Agency;
}

export async function getClientPortalById(portalId: string): Promise<ClientPortal | null> {
  const portalData = await getServerDocument<Omit<ClientPortal, 'id'>>(`portals/${portalId}`);
  if (!portalData) return null;
  return { id: portalId, ...portalData } as ClientPortal;
}

export async function getPropertyForAgency(agencyId: string, propertyId: string): Promise<Property | null> {
  const propertyData = await getServerDocument<Omit<Property, 'id'>>(`agencies/${agencyId}/properties/${propertyId}`);
  if (!propertyData) return null;
  return { id: propertyId, ...propertyData } as Property;
}

export function buildPublicPropertyImageUrl(baseUrl: string, agencyId: string, propertyId: string): string {
  return `${baseUrl.replace(/\/$/, '')}/api/public-property-image?agencyId=${encodeURIComponent(agencyId)}&propertyId=${encodeURIComponent(propertyId)}`;
}

function getDefaultPublicBaseUrl(): string {
  return 'https://studio--studio-652232171-42fb6.us-central1.hosted.app';
}

function buildAbsoluteUrl(baseUrl: string, value?: string | null): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;

  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedValue = value.startsWith('/') ? value : `/${value}`;
  return `${normalizedBase}${normalizedValue}`;
}

export function getFirstPropertyImage(property?: Property | null): string | undefined {
  if (!property?.images?.length) {
    return undefined;
  }

  const firstImage = property.images[0] as unknown;
  if (typeof firstImage === 'string') {
    return firstImage;
  }

  if (firstImage && typeof firstImage === 'object' && 'url' in (firstImage as Record<string, unknown>)) {
    const url = (firstImage as { url?: string }).url;
    return typeof url === 'string' ? url : undefined;
  }

  return undefined;
}

export function buildClientPortalMetadata({
  portal,
  agency,
  domain,
}: {
  portal: ClientPortal;
  agency: Agency | null;
  domain?: string;
}): Metadata {
  const title = agency?.name
    ? `${agency.name} | Selectie personalizata pentru ${portal.contactName}`
    : `Selectie personalizata pentru ${portal.contactName}`;
  const description = `Buna ${portal.contactName}, gasesti aici o selectie personalizata de proprietati, fara comision, recomandate pentru cerintele tale.`;
  const baseUrl = domain
    ? `https://${domain.replace(/^https?:\/\//, '').replace(/\/+$/, '')}`
    : agency?.customDomain
      ? `https://${getCanonicalCustomDomain(agency.customDomain)}`
      : getDefaultPublicBaseUrl();
  const image = buildAbsoluteUrl(baseUrl, agency?.shareImageUrl || agency?.logoUrl) || `${baseUrl}/imodeus-logo.png`;
  const url = baseUrl ? `${baseUrl}/portal/${portal.id}` : undefined;

  return {
    metadataBase: new URL(baseUrl),
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: agency?.name || 'Portal Client',
      type: 'website',
      url,
      images: [{ url: image, alt: agency?.name || portal.contactName }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
  };
}
