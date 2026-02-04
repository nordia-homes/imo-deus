'use client';

import { useParams, notFound } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import type { ClientPortal, PortalRecommendation, Property } from '@/lib/types';
import { Home } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { RecommendedPropertyCard } from '@/components/portal/RecommendedPropertyCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function PortalContent({ portalId }: { portalId: string }) {
  const firestore = useFirestore();

  // 1. Fetch portal data
  const portalDocRef = useMemoFirebase(() => doc(firestore, 'portals', portalId), [firestore, portalId]);
  const { data: portal, isLoading: isPortalLoading, error: portalError } = useDoc<ClientPortal>(portalDocRef);

  // 2. Fetch recommendations
  const recommendationsQuery = useMemoFirebase(() => collection(firestore, 'portals', portalId, 'recommendations'), [firestore, portalId]);
  const { data: recommendations, isLoading: areRecsLoading } = useCollection<PortalRecommendation>(recommendationsQuery);

  // 3. Extract property IDs from recommendations
  const propertyIds = useMemo(() => {
    if (!recommendations) return [];
    return recommendations.map(rec => rec.propertyId);
  }, [recommendations]);

  // 4. Fetch all recommended properties in a single query
  const propertiesQuery = useMemoFirebase(() => {
    if (!portal || propertyIds.length === 0) return null;
    return query(collection(firestore, 'agencies', portal.agencyId, 'properties'), where('__name__', 'in', propertyIds));
  }, [firestore, portal, propertyIds]);
  const { data: properties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);
  
  const propertiesById = useMemo(() => {
    if (!properties) return new Map();
    return new Map(properties.map(p => [p.id, p]));
  }, [properties]);

  const isLoading = isPortalLoading || areRecsLoading || arePropertiesLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-5xl py-12 px-4 space-y-8">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-6 w-1/2" />
        <div className="grid md:grid-cols-2 gap-8">
          <Skeleton className="h-[500px] w-full" />
          <Skeleton className="h-[500px] w-full" />
        </div>
      </div>
    );
  }

  if (portalError || !portal) {
    // This happens if the portalId is invalid
    notFound();
    return null;
  }

  return (
    <div className="container mx-auto max-w-5xl py-12 px-4">
      <header className="text-center mb-12">
        <Home className="mx-auto h-12 w-12 text-primary mb-4" />
        <h1 className="text-4xl font-bold">Portalul tău personalizat</h1>
        <p className="text-lg text-muted-foreground mt-2">Salut, {portal.contactName}! Agentul tău, {portal.agentName}, a selectat următoarele proprietăți pentru tine.</p>
      </header>

      {(!recommendations || recommendations.length === 0) && (
         <Alert>
            <AlertTitle>Nicio proprietate recomandată</AlertTitle>
            <AlertDescription>
                Agentul tău nu a adăugat încă nicio proprietate aici. Revino mai târziu sau contactează-l direct.
            </AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {recommendations?.map(rec => {
          const property = propertiesById.get(rec.propertyId);
          if (!property) return null;
          return (
            <RecommendedPropertyCard 
                key={rec.id} 
                property={property} 
                recommendation={rec} 
                portalId={portalId}
                agencyId={portal.agencyId}
                contactId={portal.contactId}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function ClientPortalPage() {
  const params = useParams();
  const portalId = params.portalId as string;

  // We need a key on the content to force re-mount if the portalId changes
  return <PortalContent key={portalId} portalId={portalId} />;
}
