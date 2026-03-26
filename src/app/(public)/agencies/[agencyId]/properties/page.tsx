'use client';
import { useMemo, useState } from 'react';
import { PropertyList } from '@/components/properties/PropertyList';
import { usePublicAgency } from '@/context/PublicAgencyContext';
import type { Property } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Filter } from 'lucide-react';
import { PropertyFilters, type PropertyFiltersType } from "@/components/properties/PropertyFilters";
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export default function AgencyAllPropertiesPage() {
  const { agencyId, isAgencyLoading: isAgencyContextLoading } = usePublicAgency();
  const firestore = useFirestore();
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState<PropertyFiltersType | null>(null);

  // Fetch properties from Firestore
  const propertiesQuery = useMemoFirebase(() => {
    if (!agencyId) return null;
    return query(
        collection(firestore, 'agencies', agencyId, 'properties'),
        where('status', '==', 'Activ')
    );
  }, [firestore, agencyId]);
  
  const { data: properties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);
  const isLoading = isAgencyContextLoading || arePropertiesLoading;

  const filteredProperties = useMemo(() => {
    if (!properties) return [];
    if (!filters) return properties;

    return properties.filter(prop => {
      if (filters.transactionType && filters.transactionType !== 'all' && prop.transactionType !== filters.transactionType) return false;
      if (filters.rooms && filters.rooms !== 4 && prop.rooms !== filters.rooms) return false;
      if (filters.rooms && filters.rooms === 4 && prop.rooms < 4) return false;
      
      if (filters.priceMin && prop.price < filters.priceMin) return false;
      if (filters.priceMax && prop.price > filters.priceMax) return false;

      if (filters.hasParking && (!prop.parking || prop.parking === 'Fără')) return false;
      if (filters.heatingSystem && filters.heatingSystem !== 'all' && prop.heatingSystem !== filters.heatingSystem) return false;
      if (filters.nearMetro && !prop.nearMetro) return false;
      if (filters.minSurface && prop.squareFootage < filters.minSurface) return false;
      if (filters.city && filters.city !== 'all' && prop.city !== filters.city) return false;
      if (filters.zones && filters.zones.length > 0 && !filters.zones.includes(prop.zone || '')) return false;
      if (filters.after1977 && prop.constructionYear && prop.constructionYear < 1977) return false;
      if (filters.furnishing && filters.furnishing !== 'all' && prop.furnishing !== filters.furnishing) return false;
      
      return true;
    });
  }, [properties, filters]);

  return (
    <div className={cn("space-y-6 text-stone-100", isMobile ? "p-0" : "p-4 lg:p-6")}>
      {/* Mobile & Tablet View */}
      <div className="lg:hidden space-y-4">
        <Card className="rounded-b-[1.75rem] rounded-t-none border-x-0 border-t-0 border-b border-white/10 bg-[#0d0d10]/90 shadow-[0_18px_40px_-30px_rgba(0,0,0,0.8)]">
          <CardHeader>
            <CardTitle className="text-xl tracking-tight text-stone-100">Proprietăți ({filteredProperties?.length || 0})</CardTitle>
          </CardHeader>
        </Card>
        <div className="px-2">
          <PropertyFilters onApplyFilters={setFilters} onResetFilters={() => setFilters(null)}>
            <Button variant="outline" className="w-full rounded-full border-white/10 bg-white/[0.05] text-stone-100 shadow-sm hover:bg-white/[0.08]">
              <Filter className="mr-2 h-4 w-4" /> Filtrează
            </Button>
          </PropertyFilters>
        </div>
        <div className="px-2">
          <PropertyList properties={filteredProperties} isLoading={isLoading} agencyId={agencyId!} />
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden lg:block space-y-6 px-3">
        <Card className="overflow-hidden rounded-[2rem] border-white/10 bg-white/[0.04] shadow-[0_30px_90px_-45px_rgba(0,0,0,0.85)]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-headline font-bold tracking-tight text-stone-100">Portofoliu Proprietăți ({filteredProperties?.length || 0})</h1>
                <p className="text-stone-300">
                  Explorează portofoliul de proprietăți.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <PropertyFilters onApplyFilters={setFilters} onResetFilters={() => setFilters(null)}>
                  <Button variant="outline" className="rounded-full border-white/10 bg-white/[0.05] text-stone-100 hover:bg-white/[0.08]">
                    <Filter className="mr-2 h-4 w-4" /> Filtrează
                  </Button>
                </PropertyFilters>
              </div>
            </div>
          </CardHeader>
        </Card>
        
        <PropertyList properties={filteredProperties} isLoading={isLoading} agencyId={agencyId!} />
      </div>
    </div>
  );
}
