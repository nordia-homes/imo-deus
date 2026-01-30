
import { collection, getDocs, query, where, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { Agency } from '@/lib/types';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { FeaturedProperties } from '@/components/public/FeaturedProperties';

export default async function AgencyHomePage({ params }: { params: { agencyId: string } }) {
  // Use a dedicated, temporary Firebase app instance for server-side rendering (SSR/SSG).
  const ssgApp = getApps().find(a => a.name === 'ssg-app') || initializeApp(firebaseConfig, 'ssg-app');
  const firestore = getFirestore(ssgApp);
  
  // Fetch agency details
  const agencyRef = doc(firestore, 'agencies', params.agencyId);
  const agencySnap = await getDoc(agencyRef);
  
  if (!agencySnap.exists()) {
      notFound();
  }
  const agency = agencySnap.data() as Agency;

  const heroImageUrl = agency?.logoUrl || 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?q=80&w=2070&auto=format&fit=crop';
  const tagline = agency?.name ? `Partenerul dumneavoastră de încredere în imobiliare.` : 'Găsiți proprietatea visurilor dumneavoastră.';

  return (
    <div>
      {/* Hero Section */}
      <section className="relative h-[60vh] bg-muted flex items-center justify-center text-center text-white">
        <Image 
          src={heroImageUrl}
          alt={`${agency?.name || 'Real Estate'} hero image`}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 p-4">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">{agency?.name || 'Agenție Imobiliară'}</h1>
          <p className="mt-4 text-lg md:text-xl max-w-2xl mx-auto">
            {tagline}
          </p>
          <div className="mt-8 flex gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href={`/agencies/${params.agencyId}/properties`}>Vezi Proprietățile</Link>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href={`/agencies/${params.agencyId}/contact`}>Contactează-ne</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured Properties Section - Now a Client Component */}
      <FeaturedProperties agencyId={params.agencyId} />
    </div>
  );
}
