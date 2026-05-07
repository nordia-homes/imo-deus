import type { Metadata } from 'next';
import { ClientPortalPageContent } from '@/components/portal/ClientPortalPageContent';
import {
  getAgencyById,
  getClientPortalById,
  buildClientPortalMetadata,
} from '@/lib/public-site-metadata';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ domain: string; portalId: string }>;
}): Promise<Metadata> {
  const { domain, portalId } = await params;
  const portal = await getClientPortalById(portalId);
  if (!portal) {
    return {};
  }

  const agency = await getAgencyById(portal.agencyId);
  return buildClientPortalMetadata({ portal, agency, domain });
}

export default async function CustomDomainPortalPage({
  params,
}: {
  params: Promise<{ portalId: string }>;
}) {
  const { portalId } = await params;
  return <ClientPortalPageContent portalId={portalId} />;
}
