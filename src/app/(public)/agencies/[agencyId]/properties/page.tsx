
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import type { Property } from '@/lib/types';
import { PublicPropertyCard } from '@/components/public/PublicPropertyCard';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { FileQuestion } from 'lucide-react';

export default async function AgencyPropertiesPage({ params }: { params: { agencyId: string } }) {

  const { firestore } = initializeFirebase();
  const propertiesRef = collection(firestore, 'agencies', params.agencyId, 'properties');
  const q = query(propertiesRef, where('status', '==', 'Activ'));
  const querySnapshot = await getDocs(q);

  const properties = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Property));
  // Sort by creation date descending, if available
  properties.sort((a, b) => {
    if (a.createdAt && b.createdAt) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return 0;
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
