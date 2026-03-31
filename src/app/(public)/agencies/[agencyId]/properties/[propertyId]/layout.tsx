import type { Metadata } from 'next';
import { buildPublicPropertyImageUrl, getAgencyById, getFirstPropertyImage, getPropertyForAgency } from '@/lib/public-site-metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ agencyId: string; propertyId: string }>;
}): Promise<Metadata> {
  const { agencyId, propertyId } = await params;

  const [agency, property] = await Promise.all([
    getAgencyById(agencyId),
    getPropertyForAgency(agencyId, propertyId),
  ]);

  if (!agency || !property) {
    return {};
  }

  const title = property.title;
  const description =
    property.description?.slice(0, 220) ||
    `${property.propertyType || 'Proprietate'} de ${property.transactionType || 'vanzare'} in ${property.address || agency.name}.`;
  const baseUrl = `https://${agency.customDomain || 'studio--studio-652232171-42fb6.us-central1.hosted.app'}`;
  const url = `${baseUrl}${
    agency.customDomain ? '' : `/agencies/${agencyId}`
  }/properties/${propertyId}`;
  const image =
    getFirstPropertyImage(property)
      ? buildPublicPropertyImageUrl(baseUrl, agencyId, propertyId)
      : agency.shareImageUrl || agency.logoUrl || undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: agency.name,
      type: 'article',
      images: image ? [{ url: image, alt: property.title }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default function PublicPropertyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
