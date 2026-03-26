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
    <div className={cn("space-y-6 text-slate-900", isMobile ? "p-0" : "p-4 lg:p-6")}>
      {/* Mobile & Tablet View */}
      <div className="lg:hidden space-y-4">
        <Card className="rounded-b-[1.75rem] rounded-t-none border-x-0 border-t-0 border-b border-slate-200 bg-white/90 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.35)]">
          <CardHeader>
            <CardTitle className="text-xl tracking-tight text-slate-950">Proprietăți ({filteredProperties?.length || 0})</CardTitle>
          </CardHeader>
        </Card>
        <div className="px-2">
          <PropertyFilters onApplyFilters={setFilters} onResetFilters={() => setFilters(null)}>
            <Button variant="outline" className="w-full rounded-full border-slate-300 bg-white/90 text-slate-700 shadow-sm hover:bg-slate-50">
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
        <Card className="overflow-hidden rounded-[2rem] border-slate-200/80 bg-white/90 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.42)]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-headline font-bold tracking-tight text-slate-950">Portofoliu Proprietăți ({filteredProperties?.length || 0})</h1>
                <p className="text-slate-600">
                  Explorează portofoliul de proprietăți.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <PropertyFilters onApplyFilters={setFilters} onResetFilters={() => setFilters(null)}>
                  <Button variant="outline" className="rounded-full border-slate-300 bg-white text-slate-700 hover:bg-slate-50">
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
