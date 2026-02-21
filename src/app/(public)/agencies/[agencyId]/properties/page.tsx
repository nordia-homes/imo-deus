'use client';
import { PublicPropertyList } from '@/components/properties/PropertyList';
import { usePublicAgency } from '@/context/PublicAgencyContext';
import { properties as allProperties } from '@/lib/data';
import { useMemo } from 'react';

export default function AgencyAllPropertiesPage() {
  const { agencyId } = usePublicAgency();

  const activeProperties = useMemo(() => {
    return allProperties.filter(p => p.status === 'Activ');
  }, []);


  return (
    <div className="container mx-auto py-12 px-4">
        <div className="text-center mb-12">
             <h1 className="text-4xl font-bold">Toate Proprietățile</h1>
             <p className="text-lg text-muted-foreground mt-2">Explorează portofoliul nostru complet.</p>
        </div>
        <PublicPropertyList properties={activeProperties} agencyId={agencyId!} />
    </div>
  );
}
