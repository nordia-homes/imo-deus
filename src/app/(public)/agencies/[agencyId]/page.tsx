import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { getSdks } from '@/firebase';
import type { Property, Agency } from '@/lib/types';
import { doc, getDoc } from 'firebase/firestore';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { PublicPropertyCard } from '@/components/public/PropertyCard';

export default async function AgencyHomePage({ params }: { params: { agencyId: string } }) {
  const { firestore } = getSdks();
  
  // Fetch agency details
  const agencyRef = doc(firestore, 'agencies', params.agencyId);
  const agencySnap = await getDoc(agencyRef);
  const agency = agencySnap.exists() ? (agencySnap.data() as Agency) : null;

  // Fetch featured properties
  const propertiesRef = collection(firestore, 'agencies', params.agencyId, 'properties');
  const q = query(
    propertiesRef, 
    where('status', '==', 'Activ'), 
    where('visibility', '==', 'Colaborare'),
    where('featured', '==', true),
    limit(3)
  );
  const querySnapshot = await getDocs(q);
  const featuredProperties = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));

  return (
    <div>
      {/* Hero Section */}
      <section className="relative h-[60vh] bg-muted flex items-center justify-center text-center text-white">
        <Image 
          src={agency?.heroImageUrl || 'https://images.unsplash.com/photo-1582407947304-fd86f028f716?q=80&w=2070&auto=format&fit=crop'}
          alt={`${agency?.name || 'Real Estate'} hero image`}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 p-4">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight">{agency?.name || 'Agenție Imobiliară'}</h1>
          <p className="mt-4 text-lg md:text-xl max-w-2xl mx-auto">
            {agency?.tagline || 'Partenerul dumneavoastră de încredere în imobiliare.'}
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

      {/* Featured Properties Section */}
      {featuredProperties.length > 0 && (
        <section className="container mx-auto py-16 px-4">
          <h2 className="text-3xl font-bold text-center mb-8">Proprietăți Recomandate</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredProperties.map(property => (
              <PublicPropertyCard key={property.id} property={property} agencyId={params.agencyId} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
