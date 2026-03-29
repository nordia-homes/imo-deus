import type { Metadata } from 'next';
import PublicDomainLayout from '@/app/__public/[domain]/layout';
import { getAgencyById, resolveAgencyIdForDomain } from '@/lib/public-site-metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string }>;
}): Promise<Metadata> {
  const { domain } = await params;
  const agencyId = await resolveAgencyIdForDomain(domain);
  if (!agencyId) {
    return {};
  }

  const agency = await getAgencyById(agencyId);
  if (!agency) {
    return {};
  }

  const title = agency.name;
  const description =
    agency.agencyDescription ||
    `Descopera website-ul public al agentiei ${agency.name} si vezi proprietatile disponibile.`;
  const image = agency.shareImageUrl || agency.logoUrl || undefined;
  const baseUrl = `https://${domain}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: baseUrl,
      siteName: agency.name,
      type: 'website',
      images: image ? [{ url: image, alt: agency.name }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default PublicDomainLayout;
