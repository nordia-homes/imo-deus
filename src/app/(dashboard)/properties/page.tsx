'use client';
import { AddPropertyDialog } from "@/components/properties/add-property-dialog";
import { PropertyList } from "@/components/properties/PropertyList";
import { PlusCircle } from "lucide-react";
import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useAgency } from '@/context/AgencyContext';
import type { Property } from '@/lib/types';
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
            </Card>
            <div className="px-2">
                <PropertyList properties={properties} isLoading={isLoading} />
            </div>
        </div>

        {/* Desktop View */}
        <div className="hidden lg:block space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
