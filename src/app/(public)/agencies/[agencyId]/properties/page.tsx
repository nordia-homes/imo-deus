
'use client';
import { PublicPropertyList } from '@/components/public/PublicPropertyList';

export default function AgencyPropertiesPage({ params }: { params: { agencyId: string } }) {

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold">Proprietățile Noastre</h1>
        <p className="text-muted-foreground mt-2">Explorați portofoliul nostru de proprietăți disponibile.</p>
      </div>

      <PublicPropertyList agencyId={params.agencyId} />
    </div>
  );
}
