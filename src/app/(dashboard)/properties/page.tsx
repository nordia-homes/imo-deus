'use client';
import { AddPropertyDialog } from "@/components/properties/add-property-dialog";
import { PropertyList } from "@/components/properties/PropertyList";
import { StatCard } from "@/components/dashboard/StatCard";
import { Home, DollarSign, TrendingUp, MapPin, PlusCircle, Filter } from "lucide-react";
import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useAgency } from '@/context/AgencyContext';
import type { Property } from '@/lib/types';
import { isThisWeek, isThisMonth, parseISO } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export default function PropertiesPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { agencyId } = useAgency();
  const firestore = useFirestore();
  const isMobile = useIsMobile();

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
    <div className={cn("space-y-6", isMobile && "p-0")}>
       <AddPropertyDialog 
          isOpen={isAddOpen} 
          onOpenChange={setIsAddOpen}
          property={null}
        />
        
        {/* Mobile & Tablet View */}
        <div className="lg:hidden space-y-4">
            <Card className="bg-[#152A47] text-white border-none rounded-b-2xl rounded-t-none -mt-4">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-white text-xl">Proprietăți ({properties?.length || 0})</CardTitle>
                        <Button size="sm" className="bg-white/10 hover:bg-white/20 text-white" onClick={() => setIsAddOpen(true)}><PlusCircle className="mr-2 h-4 w-4" /> Adaugă</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <Skeleton className="h-24 w-full" />
                    ) : (
                        <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="p-2 rounded-lg bg-white/10">
                                <p className="font-bold text-lg">{stats.totalProperties}</p>
                                <p className="text-xs text-white/80">Total</p>
                            </div>
                            <div className="p-2 rounded-lg bg-white/10">
                                <p className="font-bold text-lg">{stats.forSaleCount}/{stats.forRentCount}</p>
                                <p className="text-xs text-white/80">Vânz/Înch</p>
                            </div>
                            <div className="p-2 rounded-lg bg-white/10">
                                <p className="font-bold text-lg">{formatValue(stats.realizedCommissionValue)}</p>
                                <p className="text-xs text-white/80">Comision Realizat</p>
                            </div>
                            <div className="p-2 rounded-lg bg-white/10">
                                <p className="font-bold text-lg">{stats.soldOrReservedThisMonth}</p>
                                <p className="text-xs text-white/80">Finalizate Luna</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
            <div className="px-2">
                <PropertyList properties={properties} isLoading={isLoading} />
            </div>
        </div>

        {/* Desktop View */}
        <div className="hidden lg:block space-y-6">
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
            
            <PropertyList properties={properties} isLoading={isLoading} />
        </div>
    </div>
  );
}
