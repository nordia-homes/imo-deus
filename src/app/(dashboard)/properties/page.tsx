'use client';
import { AddPropertyDialog } from "@/components/properties/add-property-dialog";
import { PropertyList } from "@/components/properties/PropertyList";
import { StatCard } from "@/components/dashboard/StatCard";
import { Home, DollarSign, TrendingUp, MapPin, PlusCircle } from "lucide-react";
import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useAgency } from '@/context/AgencyContext';
import type { Property } from '@/lib/types';
import { isThisWeek, isThisMonth, parseISO } from 'date-fns';
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
        totalCommissionValue: 0,
        realizedCommissionValue: 0,
        commissionProgress: 0,
        newThisWeek: 0,
        newThisWeekProgress: 0,
        soldOrReservedThisMonth: 0,
        soldReservedProgress: 0,
        forSaleCount: 0,
        forRentCount: 0,
      };
    }
    
    const calculateCommission = (prop: Property): number => {
        const price = prop.price || 0;
        if (price === 0) return 0;
        if (prop.commissionType === 'fixed') {
            return prop.commissionValue || 0;
        }
        const percentage = prop.commissionValue !== undefined ? prop.commissionValue : 2;
        return price * (percentage / 100);
    };

    const totalProperties = properties.length;
    const forSaleCount = properties.filter(p => p.transactionType === 'Vânzare').length;
    const forRentCount = properties.filter(p => p.transactionType === 'Închiriere').length;

    const totalCommissionValue = properties.reduce((sum, prop) => sum + calculateCommission(prop), 0);
    
    const realizedCommissionValue = properties
        .filter(prop => prop.status === 'Vândut' || prop.status === 'Rezervat')
        .reduce((sum, prop) => sum + calculateCommission(prop), 0);
        
    const commissionProgress = totalCommissionValue > 0 ? (realizedCommissionValue / totalCommissionValue) * 100 : 0;

    const newThisWeek = properties.filter(prop => prop.createdAt && isThisWeek(new Date(prop.createdAt), { weekStartsOn: 1 })).length;
    const newThisWeekProgress = totalProperties > 0 ? (newThisWeek / totalProperties) * 100 : 0;
    
    const soldOrReservedThisMonth = properties.filter(prop =>
      (prop.status === 'Vândut' || prop.status === 'Rezervat') &&
      prop.statusUpdatedAt &&
      isThisMonth(parseISO(prop.statusUpdatedAt))
    ).length;

    const soldReservedProgress = totalProperties > 0 ? (soldOrReservedThisMonth / totalProperties) * 100 : 0;

    return {
      totalProperties,
      totalCommissionValue,
      realizedCommissionValue,
      commissionProgress,
      newThisWeek,
      newThisWeekProgress,
      soldOrReservedThisMonth,
      soldReservedProgress,
      forSaleCount,
      forRentCount
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
       <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
                <h1 className="text-3xl font-headline font-bold">Portofoliu Proprietăți</h1>
                <p className="text-muted-foreground">
                    Gestionează și analizează portofoliul de proprietăți.
                </p>
            </div>
            <Button onClick={() => setIsAddOpen(true)} className="w-full md:w-auto">
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
                    <Skeleton className="h-[98px]" />
                    <Skeleton className="h-[98px]" />
                    <Skeleton className="h-[98px]" />
                    <Skeleton className="h-[98px]" />
                </>
             ) : (
                <>
                    <StatCard 
                        title="Total Proprietăți" 
                        value={stats.totalProperties.toString()} 
                        icon={<Home />} 
                        period={`${stats.forSaleCount} Vânzare / ${stats.forRentCount} Închiriere`}
                    />
                    <StatCard 
                        title="Noi săptămâna aceasta" 
                        value={stats.newThisWeek.toString()} 
                        period={`din ${stats.totalProperties}`}
                        icon={<TrendingUp />}
                        progress={stats.newThisWeekProgress}
                    />
                    <StatCard 
                        title="Comision Realizat" 
                        value={formatValue(stats.realizedCommissionValue)} 
                        period={`din ${formatValue(stats.totalCommissionValue)}`}
                        icon={<DollarSign />}
                        progress={stats.commissionProgress}
                    />
                    <StatCard 
                        title="Vândute/Rezervate Luna Aceasta" 
                        value={stats.soldOrReservedThisMonth.toString()} 
                        period={`din ${stats.totalProperties}`}
                        icon={<MapPin />}
                        progress={stats.soldReservedProgress}
                    />
                </>
             )}
        </div>
        
        <PropertyList properties={properties} isLoading={isLoading} />
    </div>
  );
}
