
import { collection, getDocs, query, where, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { Property } from '@/lib/types';
import { PublicPropertyCard } from '@/components/public/PublicPropertyCard';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { FileQuestion } from 'lucide-react';

export default async function AgencyPropertiesPage({ params }: { params: { agencyId: string } }) {

  // Use a dedicated, temporary Firebase app instance for server-side rendering (SSR/SSG).
  const ssgApp = getApps().find(a => a.name === 'ssg-app') || initializeApp(firebaseConfig, 'ssg-app');
  const firestore = getFirestore(ssgApp);

  const propertiesRef = collection(firestore, 'agencies', params.agencyId, 'properties');
  
  // Secure query that only fetches active properties, matching security rules.
  const q = query(propertiesRef, where('status', '==', 'Activ'));
  const querySnapshot = await getDocs(q);

  const properties = querySnapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as Property))
    .sort((a, b) => {
      // Sort by creation date descending, if available
      return (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    });

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold">Proprietățile Noastre</h1>
        <p className="text-muted-foreground mt-2">Explorați portofoliul nostru de proprietăți disponibile.</p>
      </div>

      {properties.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {properties.map(property => (
            <PublicPropertyCard key={property.id} property={property} agencyId={params.agencyId} />
          ))}
        </div>
      ) : (
        <div className="max-w-md mx-auto">
          <Alert>
            <FileQuestion className="h-4 w-4" />
            <AlertTitle>Nicio Proprietate Disponibilă</AlertTitle>
            <AlertDescription>
              Momentan nu există nicio proprietate publică în portofoliul acestei agenții. Vă rugăm să reveniți mai târziu.
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
}
