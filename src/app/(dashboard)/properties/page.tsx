'use client';
import Link from 'next/link';
import { AddPropertyDialog } from "@/components/properties/add-property-dialog";
import { PropertyList } from "@/components/properties/PropertyList";
import { PlusCircle, Filter } from "lucide-react";
import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { useAgency } from '@/context/AgencyContext';
import type { Property, Viewing } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { deleteDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { DeletePropertyAlert } from "@/components/properties/DeletePropertyAlert";
import { PropertyFilters, type PropertyFiltersType } from "@/components/properties/PropertyFilters";

const REPORT_PRESET_LABELS: Record<string, string> = {
  'active-no-traction': 'Filtru din Rapoarte: Proprietati active fara tractiune',
  'reserved-stale': 'Filtru din Rapoarte: Rezervari stagnante',
  'weak-media': 'Filtru din Rapoarte: Proprietati cu media slaba',
  'weak-description': 'Filtru din Rapoarte: Proprietati cu descrieri insuficiente',
  'new-this-period': 'Filtru din Rapoarte: Proprietati noi in perioada curenta',
  'sold-this-period': 'Filtru din Rapoarte: Proprietati vandute in perioada curenta',
};

export default function PropertiesPage() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { agencyId } = useAgency();
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const [deletingProperty, setDeletingProperty] = useState<Property | null>(null);
  const { toast } = useToast();
  const [filters, setFilters] = useState<PropertyFiltersType | null>(null);

  const propertiesQuery = useMemoFirebase(() => {
    if (!agencyId) return null;
    return collection(firestore, 'agencies', agencyId, 'properties');
  }, [firestore, agencyId]);

  const { data: properties, isLoading } = useCollection<Property>(propertiesQuery);
  const viewingsQuery = useMemoFirebase(() => {
    if (!agencyId) return null;
    return collection(firestore, 'agencies', agencyId, 'viewings');
  }, [firestore, agencyId]);
  const { data: viewings, isLoading: areViewingsLoading } = useCollection<Viewing>(viewingsQuery);
  
  const filteredProperties = useMemo(() => {
    if (!properties) return [];
    const dialogFiltered = !filters ? properties : properties.filter(prop => {
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

    const reportPreset = searchParams.get('reportPreset');
    const activeViewingPropertyIds = new Set(
      (viewings || [])
        .filter((item) => item.status === 'completed' || item.status === 'scheduled')
        .map((item) => item.propertyId)
    );
    const now = Date.now();

    return dialogFiltered.filter((prop) => {
      const createdAt = prop.createdAt ? new Date(prop.createdAt).getTime() : null;

      if (reportPreset === 'active-no-traction') {
        if (prop.status !== 'Activ') return false;
        if (createdAt === null || Number.isNaN(createdAt)) return false;
        return now - createdAt > 1000 * 60 * 60 * 24 * 30 && !activeViewingPropertyIds.has(prop.id);
      }

      if (reportPreset === 'reserved-stale') {
        if (prop.status !== 'Rezervat') return false;
        const statusTime = prop.statusUpdatedAt ? new Date(prop.statusUpdatedAt).getTime() : createdAt;
        return statusTime ? now - statusTime > 1000 * 60 * 60 * 24 * 14 : false;
      }

      if (reportPreset === 'weak-media') {
        return prop.status === 'Activ' && (prop.images?.length || 0) < 8;
      }

      if (reportPreset === 'weak-description') {
        return prop.status === 'Activ' && (prop.description?.trim().length || 0) < 150;
      }

      if (reportPreset === 'new-this-period') {
        return createdAt ? now - createdAt <= 1000 * 60 * 60 * 24 * 30 : false;
      }

      if (reportPreset === 'sold-this-period') {
        if (prop.status !== 'Vândut') return false;
        const soldAt = prop.statusUpdatedAt ? new Date(prop.statusUpdatedAt).getTime() : null;
        return soldAt ? now - soldAt <= 1000 * 60 * 60 * 24 * 30 : false;
      }

      return true;
    });
  }, [properties, filters, searchParams, viewings]);

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

  const isPageLoading = isLoading || areViewingsLoading;
  const reportPreset = searchParams.get('reportPreset');
  const reportPresetLabel = reportPreset ? REPORT_PRESET_LABELS[reportPreset] : null;

  return (
    <div className={cn("space-y-6", isMobile && "p-0")}>
       <AddPropertyDialog 
          isOpen={isAddOpen} 
          onOpenChange={setIsAddOpen}
          property={null}
        />
        
        {/* Mobile & Tablet View */}
        <div className="lg:hidden space-y-4">
            {reportPresetLabel && (
                <div className="px-2">
                    <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-white">
                        <p className="text-sm text-white/90">{reportPresetLabel}</p>
                        <Button asChild size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
                            <Link href="/properties">Reseteaza</Link>
                        </Button>
                    </div>
                </div>
            )}
            <Card className="bg-[#152A47] text-white border-none rounded-b-2xl rounded-t-none">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-white text-xl">Proprietăți ({filteredProperties?.length || 0})</CardTitle>
                         <div className="flex items-center gap-2">
                           <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white" onClick={() => setIsAddOpen(true)}>
                             <PlusCircle className="mr-2 h-4 w-4" /> Adaugă
                           </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>
             <div className="px-2">
                <PropertyFilters onApplyFilters={setFilters} onResetFilters={() => setFilters(null)}>
                    <Button variant="outline" className="w-full bg-[#152A47] text-white border-white/20 hover:bg-white/10 button-glow">
                        <Filter className="mr-2 h-4 w-4" /> Filtrează
                    </Button>
                </PropertyFilters>
            </div>
            <div className="px-2">
              <PropertyList properties={filteredProperties} isLoading={isPageLoading} onDeleteRequest={setDeletingProperty} />
            </div>
        </div>

        {/* Desktop View */}
        <div className="hidden lg:block space-y-6 px-3">
            {reportPresetLabel && (
                <div className="rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-white">
                    <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-white/90">{reportPresetLabel}</p>
                        <Button asChild size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
                            <Link href="/properties">Reseteaza filtrul</Link>
                        </Button>
                    </div>
                </div>
            )}
            <Card className="bg-[#152A47] text-white border-none rounded-2xl">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-headline font-bold">Portofoliu Proprietăți ({filteredProperties?.length || 0})</h1>
                            <p className="text-white/70">
                                Gestionează și analizează portofoliul de proprietăți.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <PropertyFilters onApplyFilters={setFilters} onResetFilters={() => setFilters(null)}>
                              <Button variant="outline" className="bg-white/10 border-white/20 hover:bg-white/20 text-white button-glow">
                                <Filter className="mr-2 h-4 w-4" /> Filtrează
                              </Button>
                            </PropertyFilters>
                            <AddPropertyDialog 
                                isOpen={isAddOpen} 
                                onOpenChange={setIsAddOpen}
                                property={null}
                            >
                                <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Adaugă Proprietate
                                </Button>
                            </AddPropertyDialog>
                        </div>
                    </div>
                </CardHeader>
            </Card>
            
            <PropertyList properties={filteredProperties} isLoading={isPageLoading} onDeleteRequest={setDeletingProperty} />
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
