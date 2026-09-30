import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { adminDb } from '@/firebase/admin';
import { getActiveLink } from '@/lib/collaboration/server';
import { CollaborationBuyerPage } from '@/components/collaboration/CollaborationBuyerPage';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  try {
    const { listing, link } = await getActiveLink(adminDb, (await params).token);
    return { title: `${listing.title} | ${link.collaboratorName}`, description: `${listing.city}, ${listing.zone} · ${listing.price.toLocaleString('ro-RO')} €`, robots: { index: false, follow: false }, openGraph: { title: listing.title, description: `Prezentată de ${link.collaboratorName}`, images: listing.images[0]?.url ? [listing.images[0].url] : [] } };
  } catch { return { title: 'Proprietate indisponibilă', robots: { index: false, follow: false } }; }
}

export default async function BuyerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let result: Awaited<ReturnType<typeof getActiveLink>>;
  try {
    result = await getActiveLink(adminDb, token);
  } catch { notFound(); }
  const { listing, link } = result;
  const buyerListing = {
    title: listing.title, description: listing.description, city: listing.city, zone: listing.zone,
    price: listing.price, rooms: listing.rooms, squareFootage: listing.squareFootage,
    propertyType: listing.propertyType, transactionType: listing.transactionType, images: listing.images,
  };
  return <CollaborationBuyerPage listing={buyerListing} collaborator={{ name: link.collaboratorName, phone: link.collaboratorPhone, email: link.collaboratorEmail }} token={token} />;
}
