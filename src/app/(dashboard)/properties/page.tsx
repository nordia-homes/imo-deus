'use client';
import { AddPropertyDialog } from "@/components/properties/add-property-dialog";
import { PropertyList } from "@/components/properties/PropertyList";
import { PropertyStatCard } from "@/components/properties/PropertyStatCard";
import { Home, DollarSign, TrendingUp, MapPin, PlusCircle } from "lucide-react";
import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useAgency } from '@/context/AgencyContext';
import type { Property } from '@/lib/types';
import { isThisWeek } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export default function PropertiesPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { agencyId } = useAgency();
  const firestore = useFirestore();

  const propertiesQuery = useMemoFirebase(() => {
    if (!agencyId) return null;
    return collection(firestore, 'agencies', agencyId, 'properties');
  }, [firestore, agencyId]);

  const { data: properties, isLoading } = useCollection<Property>(propertiesQuery);

  const stats = useMemo(() => {
    if (!properties) {
      return {
        totalProperties: 0,
        portfolioValue: 0,
        newThisWeek: 0,
        activeToday: 0,
      };
    }

    const portfolioValue = properties.reduce((sum, prop) => sum + prop.price, 0);
    const newThisWeek = properties.filter(prop => prop.createdAt && isThisWeek(new Date(prop.createdAt), { weekStartsOn: 1 })).length;
    const activeToday = properties.filter(prop => prop.status === 'Activ').length;

    return {
      totalProperties: properties.length,
      portfolioValue,
      newThisWeek,
      activeToday,
    };
  }, [properties]);
  
  const formatValue = (num: number) => {
    if (num >= 1000000) {
      return `€${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `€${Math.round(num / 1000)}k`;
    }
    return `€${num}`;
  };


  return (
    <div className="space-y-6">
       <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Proprietăți</h1>
            </div>
            <Button onClick={() => setIsAddOpen(true)}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Adaugă Proprietate
            </Button>
        </div>
        
        <AddPropertyDialog 
          isOpen={isAddOpen} 
          onOpenChange={setIsAddOpen}
          property={null}
        />
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             {isLoading ? (
                <>
                    <Skeleton className="h-[76px]" />
                    <Skeleton className="h-[76px]" />
                    <Skeleton className="h-[76px]" />
                    <Skeleton className="h-[76px]" />
                </>
             ) : (
                <>
                    <PropertyStatCard label="Total Proprietăți" value={stats.totalProperties.toString()} icon={<Home />} />
                    <PropertyStatCard label="Valoare Portofoliu" value={formatValue(stats.portfolioValue)} icon={<DollarSign />} />
                    <PropertyStatCard label="Noi săptămâna aceasta" value={`+${stats.newThisWeek}`} icon={<TrendingUp />} />
                    <PropertyStatCard label="Active" value={stats.activeToday.toString()} icon={<MapPin />} />
                </>
             )}
        </div>
        
        <PropertyList properties={properties} isLoading={isLoading} />
    </div>
  );
}
