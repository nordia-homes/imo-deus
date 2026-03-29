import type { Metadata } from 'next';
import PublicDomainPropertyPage from '@/app/__public/[domain]/properties/[propertyId]/page';
import { getAgencyById, getPropertyForAgency, resolveAgencyIdForDomain } from '@/lib/public-site-metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string; propertyId: string }>;
}): Promise<Metadata> {
  const { domain, propertyId } = await params;
  const agencyId = await resolveAgencyIdForDomain(domain);
  if (!agencyId) {
    return {};
  }

  const [agency, property] = await Promise.all([
    getAgencyById(agencyId),
    getPropertyForAgency(agencyId, propertyId),
  ]);

  if (!agency || !property) {
    return {};
  }

  const image = property.images?.[0]?.url || agency.shareImageUrl || agency.logoUrl || undefined;
  const title = property.title;
  const description =
    property.description?.slice(0, 220) ||
    `${property.propertyType || 'Proprietate'} de ${property.transactionType || 'vanzare'} in ${property.address || agency.name}.`;
  const url = `https://${domain}/properties/${propertyId}`;

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

export default PublicDomainPropertyPage;
