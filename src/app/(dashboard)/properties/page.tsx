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
  const [portalQuickFilter, setPortalQuickFilter] = useState<'imobiliare' | 'storia-olx' | null>(null);

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
    const agentIdFilter = searchParams.get('agentId');
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

    const portalFiltered = dialogFiltered.filter((prop) => {
      if (!portalQuickFilter) return true;

      const promotionEntries = prop.promotions || {};
      const hasPublishedPromotion = (portalName: string) => promotionEntries[portalName]?.status === 'published';

      if (portalQuickFilter === 'imobiliare') {
        return hasPublishedPromotion('imobiliare') || Boolean(prop.portalProfiles?.imobiliare?.lastPublishedAt);
      }

      return hasPublishedPromotion('storia') || hasPublishedPromotion('publi24') || hasPublishedPromotion('olx');
    });

    const reportPreset = searchParams.get('reportPreset');
    const activeViewingPropertyIds = new Set(
      (viewings || [])
        .filter((item) => item.status === 'completed' || item.status === 'scheduled')
        .map((item) => item.propertyId)
    );
    const now = Date.now();

    return portalFiltered.filter((prop) => {
      if (agentIdFilter && prop.agentId !== agentIdFilter) {
        return false;
      }

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
  }, [properties, filters, portalQuickFilter, searchParams, viewings]);

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
  const agentNameFilter = searchParams.get('agentName');
  const isImobiliareQuickFilterActive = portalQuickFilter === 'imobiliare';
  const isStoriaOlxQuickFilterActive = portalQuickFilter === 'storia-olx';

  return (
    <div className={cn("agentfinder-properties-page space-y-6", isMobile && "p-0")}>
       <AddPropertyDialog 
          isOpen={isAddOpen} 
          onOpenChange={setIsAddOpen}
          property={null}
        />
        
        {/* Mobile & Tablet View */}
        <div className="agentfinder-properties-mobile lg:hidden space-y-4">
            {reportPresetLabel && (
                <div className="px-2">
                    <div className="agentfinder-properties-filter-banner flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-white">
                        <p className="text-sm text-white/90">{reportPresetLabel}</p>
                        <Button asChild size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
                            <Link href="/properties">Reseteaza</Link>
                        </Button>
                    </div>
                </div>
            )}
            {agentNameFilter && !reportPresetLabel ? (
                <div className="px-2">
                    <div className="agentfinder-properties-filter-banner flex items-center justify-between rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-white">
                        <p className="text-sm text-white/90">Portofoliu filtrat pentru agentul: {agentNameFilter}</p>
                        <Button asChild size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
                            <Link href="/properties">Reseteaza</Link>
                        </Button>
                    </div>
                </div>
            ) : null}
            <Card className="agentfinder-properties-header-card bg-[#152A47] text-white border-none rounded-b-2xl rounded-t-none">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-white text-xl">Proprietăți ({filteredProperties?.length || 0})</CardTitle>
                         <div className="flex items-center gap-2">
                           <Button size="sm" className="agentfinder-properties-primary-button bg-white/20 hover:bg-white/30 text-white" onClick={() => setIsAddOpen(true)}>
                             <PlusCircle className="mr-2 h-4 w-4" /> Adaugă
                           </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>
             <div className="px-2">
                <PropertyFilters onApplyFilters={setFilters} onResetFilters={() => setFilters(null)}>
                    <Button variant="outline" className="agentfinder-properties-soft-button w-full bg-[#152A47] text-white border-white/20 hover:bg-white/10 button-glow">
                        <Filter className="mr-2 h-4 w-4" /> Filtrează
                    </Button>
                </PropertyFilters>
            </div>
            <div className="px-2">
              <PropertyList properties={filteredProperties} isLoading={isPageLoading} onDeleteRequest={setDeletingProperty} />
            </div>
        </div>

        {/* Desktop View */}
        <div className="agentfinder-properties-desktop hidden lg:block space-y-6 px-3">
            {reportPresetLabel && (
                <div className="agentfinder-properties-filter-banner rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-white">
                    <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-white/90">{reportPresetLabel}</p>
                        <Button asChild size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
                            <Link href="/properties">Reseteaza filtrul</Link>
                        </Button>
                    </div>
                </div>
            )}
            {agentNameFilter && !reportPresetLabel ? (
                <div className="agentfinder-properties-filter-banner rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-white">
                    <div className="flex items-center justify-between gap-4">
                        <p className="text-sm text-white/90">Portofoliu filtrat pentru agentul: {agentNameFilter}</p>
                        <Button asChild size="sm" variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
                            <Link href="/properties">Reseteaza filtrul</Link>
                        </Button>
                    </div>
                </div>
            ) : null}
            <Card className="agentfinder-properties-hero-card overflow-hidden rounded-[30px] border border-white/8 bg-[radial-gradient(circle_at_top_left,_rgba(52,211,153,0.14),_transparent_28%),linear-gradient(135deg,_rgba(21,42,71,1)_0%,_rgba(18,38,63,1)_52%,_rgba(11,26,45,1)_100%)] text-white shadow-[0_28px_70px_-34px_rgba(0,0,0,0.55)]">
                <CardHeader className="px-7 py-6">
                    <div className="flex items-center justify-between gap-6">
                        <div className="min-w-0">
                            <div className="agentfinder-properties-eyebrow inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-100/85">
                                Portofoliu activ
                            </div>
                            <div className="mt-4 flex items-end gap-4">
                                <div className="min-w-0">
                                    <h1 className="text-4xl font-semibold tracking-tight text-white">
                                        Portofoliu Proprietăți
                                    </h1>
                                    <p className="mt-2 max-w-2xl text-base leading-7 text-white/68">
                                        Vezi rapid tot stocul disponibil, filtrează oportunitățile bune și intră direct în proprietățile care au nevoie de atenție.
                                    </p>
                                </div>
                                <div className="agentfinder-properties-count-card shrink-0 rounded-3xl border border-white/10 bg-white/[0.06] px-5 py-4 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Total</p>
                                    <p className="mt-1 text-3xl font-semibold text-white">{filteredProperties?.length || 0}</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex min-h-[150px] shrink-0 flex-col items-stretch justify-between gap-3 self-stretch">
                            <div className="grid grid-cols-2 gap-3">
                            <PropertyFilters onApplyFilters={setFilters} onResetFilters={() => setFilters(null)}>
                              <Button variant="outline" className="agentfinder-properties-soft-button h-[68px] w-full rounded-[22px] border border-slate-500/35 bg-slate-800/70 px-5 text-base text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:bg-slate-700/80 hover:text-white">
                                <Filter className="mr-2 h-4 w-4" /> Filtrează
                              </Button>
                            </PropertyFilters>
                            <AddPropertyDialog 
                                isOpen={isAddOpen} 
                                onOpenChange={setIsAddOpen}
                                property={null}
                            >
                                <Button className="agentfinder-properties-primary-button h-[68px] w-full rounded-[22px] border border-sky-300/15 bg-[linear-gradient(135deg,rgba(39,66,104,0.95)_0%,rgba(27,52,86,0.98)_100%)] px-6 text-base text-white shadow-[0_18px_38px_-22px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-[linear-gradient(135deg,rgba(46,77,120,0.98)_0%,rgba(31,59,96,1)_100%)]">
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Adaugă Proprietate
                                </Button>
                            </AddPropertyDialog>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setPortalQuickFilter((current) => current === 'imobiliare' ? null : 'imobiliare')}
                                    className={cn(
                                        "agentfinder-properties-portal-button h-[68px] rounded-[22px] px-4 text-sm leading-5 text-slate-50 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
                                        isImobiliareQuickFilterActive
                                            ? "agentfinder-properties-portal-button--active border-sky-300/30 bg-sky-500/20 text-sky-50 hover:bg-sky-500/25"
                                            : "border border-slate-500/35 bg-slate-800/70 hover:bg-slate-700/80 hover:text-white"
                                    )}
                                >
                                    Publicate pe imobiliare.ro
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setPortalQuickFilter((current) => current === 'storia-olx' ? null : 'storia-olx')}
                                    className={cn(
                                        "agentfinder-properties-portal-button h-[68px] rounded-[22px] px-4 text-sm leading-5 text-slate-50 transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
                                        isStoriaOlxQuickFilterActive
                                            ? "agentfinder-properties-portal-button--active border-sky-300/30 bg-sky-500/20 text-sky-50 hover:bg-sky-500/25"
                                            : "border border-slate-500/35 bg-slate-800/70 hover:bg-slate-700/80 hover:text-white"
                                    )}
                                >
                                    Publicate pe Storia/Publi24
                                </Button>
                            </div>
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
