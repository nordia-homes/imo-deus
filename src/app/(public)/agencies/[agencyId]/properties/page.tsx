'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { PropertyList } from '@/components/properties/PropertyList';
import { usePublicAgency } from '@/context/PublicAgencyContext';
import type { Property } from '@/lib/types';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Filter } from 'lucide-react';
import { PropertyFilters, type PropertyFiltersType } from "@/components/properties/PropertyFilters";
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { usePublicPath } from '@/context/PublicAgencyContext';

export default function AgencyAllPropertiesPage() {
  const { agencyId, isAgencyLoading: isAgencyContextLoading } = usePublicAgency();
  const publicPath = usePublicPath();
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
    <div className={cn("space-y-6 text-stone-100", isMobile ? "p-0 pb-4" : "p-4 pb-6 lg:p-6 lg:pb-8")}>
      <section className={cn(
        "overflow-hidden rounded-[2rem] border border-emerald-400/15 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.18),transparent_28%),linear-gradient(145deg,rgba(10,18,14,0.98)_0%,rgba(10,11,12,0.98)_52%,rgba(15,24,18,0.96)_100%)] shadow-[0_28px_90px_-44px_rgba(0,0,0,0.86)]",
        isMobile ? "rounded-b-[1.9rem] rounded-t-none border-x-0 border-t-0 px-4 pb-6 pt-5" : "px-6 py-7 md:px-8"
      )}>
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
            Portofoliu public
          </div>
          <h1 className="mt-4 text-[clamp(2rem,5vw,3.35rem)] font-semibold tracking-tight text-white">
            Proprietati disponibile in acest moment
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50/78 md:text-base">
            Rasfoieste selectia publica, intra in detalii si foloseste filtrele ca sa ajungi mai repede la proprietatile care merita vazute.
          </p>
          <div className="mt-5 inline-flex items-center rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-stone-100">
            {filteredProperties?.length || 0} proprietati disponibile
          </div>
        </div>
      </section>

      {/* Mobile & Tablet View */}
      <div className="lg:hidden space-y-4">
        <div className="px-2">
          <div className="overflow-hidden rounded-[1.75rem] border border-emerald-400/15 bg-[radial-gradient(circle_at_top_left,rgba(74,222,128,0.18),transparent_28%),linear-gradient(145deg,rgba(10,18,14,0.98)_0%,rgba(10,11,12,0.98)_52%,rgba(15,24,18,0.96)_100%)] p-3 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.86)]">
            <PropertyFilters onApplyFilters={setFilters} onResetFilters={() => setFilters(null)}>
              <Button variant="outline" className="w-full rounded-full border-emerald-300/18 bg-emerald-400/10 text-stone-100 shadow-sm hover:bg-emerald-400/14">
                <Filter className="mr-2 h-4 w-4" /> Filtrează
              </Button>
            </PropertyFilters>
          </div>
        </div>
        <div className="px-1">
          <PropertyList properties={filteredProperties} isLoading={isLoading} agencyId={agencyId!} publicBasePath={publicPath()} />
        </div>
        <div className="px-2">
          <Card className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.04] shadow-[0_26px_70px_-42px_rgba(0,0,0,0.86)]">
            <CardHeader className="space-y-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200/75">Contact</p>
              <CardTitle className="text-2xl font-semibold tracking-tight text-white">
                Ai nevoie de ajutor cu selectia?
              </CardTitle>
              <p className="text-sm leading-7 text-stone-300">
                Daca vrei sa restrangi mai repede optiunile, spune-ne ce cauti si te ghidam mai departe.
              </p>
              <Button asChild className="mx-auto mt-1 w-full rounded-full bg-white text-black hover:bg-stone-100">
                  <Link href={publicPath('/contact')} className="inline-flex items-center justify-center gap-2 text-black no-underline">
                  Contacteaza un consultant
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
          </Card>
        </div>
      </div>

      {/* Desktop View */}
      <div className="hidden lg:block space-y-6 px-3">
        <Card className="overflow-hidden rounded-[2rem] border-white/10 bg-white/[0.04] shadow-[0_30px_90px_-45px_rgba(0,0,0,0.85)]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl font-headline font-bold tracking-tight text-stone-100">
                  Portofoliu Proprietati
                </CardTitle>
                <p className="mt-2 text-stone-300">
                  {filteredProperties?.length || 0} proprietati disponibile pentru vizualizare si comparatie.
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
        
        <PropertyList properties={filteredProperties} isLoading={isLoading} agencyId={agencyId!} publicBasePath={publicPath()} />

        <Card className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-[0_28px_90px_-45px_rgba(0,0,0,0.85)]">
          <CardHeader className="flex flex-row items-center justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200/75">Contact</p>
              <CardTitle className="mt-3 text-3xl font-semibold tracking-tight text-white">
                Ai nevoie de ajutor cu selectia?
              </CardTitle>
              <p className="mt-3 text-sm leading-7 text-stone-300">
                Daca vrei sa compari mai bine optiunile sau sa mergi direct spre ce are sens pentru bugetul tau, scrie-ne
                si continuam de acolo.
              </p>
            </div>
            <Button asChild className="rounded-full bg-white px-7 text-black hover:bg-stone-100">
              <Link href={publicPath('/contact')} className="inline-flex items-center justify-center gap-2 text-black no-underline">
                Contacteaza un consultant
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
