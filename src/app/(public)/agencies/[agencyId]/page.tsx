'use client';
import { PublicPropertyList } from '@/components/properties/PropertyList';
import { usePublicAgency } from '@/context/PublicAgencyContext';
import { Skeleton } from '@/components/ui/skeleton';
import { FeaturedProperties } from '@/components/public/FeaturedProperties';
import { Separator } from '@/components/ui/separator';

export default function AgencyHomePage() {
  const { agencyId, isAgencyLoading } = usePublicAgency();

  if (isAgencyLoading || !agencyId) {
    return (
        <div className="container mx-auto py-8 px-4 space-y-12">
            <div>
              <Skeleton className="h-8 w-64 mb-6" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
                  {[...Array(4)].map((_, i) => (
                      <div key={i} className="space-y-3">
                          <Skeleton className="aspect-square w-full rounded-xl" />
                          <Skeleton className="h-5 w-3/4" />
                          <Skeleton className="h-4 w-1/2" />
                          <Skeleton className="h-5 w-1/3" />
                      </div>
                  ))}
              </div>
            </div>

            <Skeleton className="h-20 w-full rounded-xl" />
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-8">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="space-y-3">
                        <Skeleton className="aspect-square w-full rounded-xl" />
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-5 w-1/3" />
                    </div>
                ))}
            </div>
        </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-12">
      <FeaturedProperties agencyId={agencyId} />
      <div id="properties">
         <h2 className="text-3xl font-bold tracking-tight mb-8">Toate Proprietățile</h2>
         <PublicPropertyList agencyId={agencyId} />
      </div>
    </div>
  );
}

    