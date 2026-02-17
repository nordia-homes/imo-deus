'use client';
import { AddPropertyDialog } from "@/components/properties/add-property-dialog";
import { PropertyList } from "@/components/properties/PropertyList";
import { PlusCircle, Filter } from "lucide-react";
import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useAgency } from '@/context/AgencyContext';
import type { Property } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { deleteDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { DeletePropertyAlert } from "@/components/properties/DeletePropertyAlert";
import { PropertyFilters, type PropertyFiltersType } from "@/components/properties/PropertyFilters";

export default function PropertiesPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { agencyId } = useAgency();
  const firestore = useFirestore();
  const isMobile = useIsMobile();
  const [deletingProperty, setDeletingProperty] = useState<Property | null>(null);
  const { toast } = useToast();
  const [filters, setFilters] = useState<PropertyFiltersType | null>(null);

  const propertiesQuery = useMemoFirebase(() => {
    if (!agencyId) return null;
    return collection(firestore, 'agencies', agencyId, 'properties');
  }, [firestore, agencyId]);

  const { data: properties, isLoading } = useCollection<Property>(propertiesQuery);
  
  const filteredProperties = useMemo(() => {
    if (!properties) return [];
    if (!filters) return properties;

    return properties.filter(prop => {
      if (filters.transactionType && filters.transactionType !== 'all' && prop.transactionType !== filters.transactionType) return false;
      if (filters.rooms && filters.rooms !== 4 && prop.rooms !== filters.rooms) return false;
      if (filters.rooms && filters.rooms === 4 && prop.rooms < 4) return false;
      
      if (filters.priceRange && filters.priceRange !== 'all') {
        const [min, max] = filters.priceRange.split('-').map(Number);
        if (prop.price < min || (max !== Infinity && prop.price > max)) return false;
      }

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

  const handleDelete = () => {
    if (!agencyId || !deletingProperty) return;
    const propertyRef = doc(firestore, 'agencies', agencyId, 'properties', deletingProperty.id);
    deleteDocumentNonBlocking(propertyRef);
    toast({
        variant: 'destructive',
        title: "Proprietate ștearsă!",
        description: `Proprietatea "${deletingProperty.title}" a fost ștearsă.`,
    });
    setDeletingProperty(null);
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
            <Card className="bg-[#152A47] text-white border-none rounded-b-2xl rounded-t-none">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-white text-xl">Proprietăți ({filteredProperties?.length || 0})</CardTitle>
                         <div className="flex items-center gap-2">
                           <PropertyFilters onApplyFilters={setFilters} onResetFilters={() => setFilters(null)}>
                              <Button size="sm" variant="outline" className="bg-white/10 hover:bg-white/20 text-white">
                                <Filter className="mr-2 h-4 w-4" /> Filtrează
                              </Button>
                           </PropertyFilters>
                           <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white" onClick={() => setIsAddOpen(true)}>
                             <PlusCircle className="mr-2 h-4 w-4" /> Adaugă
                           </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>
            <div className="px-2">
              <PropertyList properties={filteredProperties} isLoading={isLoading} onDeleteRequest={setDeletingProperty} />
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
                 <div className="flex items-center gap-2">
                    <PropertyFilters onApplyFilters={setFilters} onResetFilters={() => setFilters(null)}>
                      <Button variant="outline">
                        <Filter className="mr-2 h-4 w-4" /> Filtrează Proprietăți
                      </Button>
                    </PropertyFilters>
                    <Button onClick={() => setIsAddOpen(true)} className="w-full md:w-auto">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Adaugă Proprietate
                    </Button>
                </div>
            </div>
            
            <PropertyList properties={filteredProperties} isLoading={isLoading} onDeleteRequest={setDeletingProperty} />
        </div>
        <DeletePropertyAlert
            isOpen={!!deletingProperty}
            onOpenChange={(isOpen) => !isOpen && setDeletingProperty(null)}
            property={deletingProperty}
            onDelete={handleDelete}
        />
    </div>
  );
}
