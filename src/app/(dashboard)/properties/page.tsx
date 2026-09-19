'use client';
import Image from 'next/image';
import Link from 'next/link';
import { AddPropertyDialog } from "@/components/properties/add-property-dialog";
import { PropertyList } from "@/components/properties/PropertyList";
import { PlusCircle, Filter, Search, X, Loader2, LockKeyhole, ArrowRight, BadgeEuro, KeyRound, Building2, Sparkles, Globe } from "lucide-react";
import { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, writeBatch } from 'firebase/firestore';
import { useAgency } from '@/context/AgencyContext';
import type { Property, PropertyDeletionEvent, PropertyDeletionReason, PropertyStatusEvent, Viewing } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { DeletePropertyAlert, type DeletePropertyPayload } from "@/components/properties/DeletePropertyAlert";
import { PropertyFilters, type PropertyFiltersType } from "@/components/properties/PropertyFilters";
import { getAgencyThemePreset } from '@/lib/theme';
import { isCompletePropertyRecord } from '@/lib/property-record';
import { useSidebar } from '@/components/ui/sidebar';
import '@/components/marketing/tiktok-ads/tiktok-workspace.css';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

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
  const { agency, agencyId } = useAgency();
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const { state: sidebarState } = useSidebar();
  const [deletingProperty, setDeletingProperty] = useState<Property | null>(null);
  const [deletionInitialReason, setDeletionInitialReason] = useState<PropertyDeletionReason>('not_interesting');
  const [isDeletingProperty, setIsDeletingProperty] = useState(false);
  const [reservationProperty, setReservationProperty] = useState<Property | null>(null);
  const [isUpdatingReservation, setIsUpdatingReservation] = useState(false);
  const { toast } = useToast();
  const [filters, setFilters] = useState<PropertyFiltersType | null>(null);
  const [portalQuickFilter, setPortalQuickFilter] = useState<'imobiliare' | 'storia-olx' | null>(null);
  const [transactionQuickFilter, setTransactionQuickFilter] = useState<'rent' | 'sale' | null>(null);
  const [propertySearch, setPropertySearch] = useState('');
  const reportPreset = searchParams?.get('reportPreset');

  const propertiesQuery = useMemoFirebase(() => {
    if (!agencyId) return null;
    return collection(firestore, 'agencies', agencyId, 'properties');
  }, [firestore, agencyId]);

  const { data: properties, isLoading } = useCollection<Property>(propertiesQuery);
  const viewingsQuery = useMemoFirebase(() => {
    if (!agencyId || reportPreset !== 'active-no-traction') return null;
    return collection(firestore, 'agencies', agencyId, 'viewings');
  }, [firestore, agencyId, reportPreset]);
  const { data: viewings } = useCollection<Viewing>(viewingsQuery);

  const normalizedPropertySearch = useMemo(
    () =>
      propertySearch
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim(),
    [propertySearch]
  );
  
  const filteredProperties = useMemo(() => {
    if (!properties) return [];
    const agentIdFilter = searchParams?.get('agentId');
    const completeProperties = properties.filter(isCompletePropertyRecord);
    const dialogFiltered = !filters ? completeProperties : completeProperties.filter(prop => {
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

    const transactionFiltered = !transactionQuickFilter
      ? dialogFiltered
      : dialogFiltered.filter((prop) => {
          const normalizedTransactionType = prop.transactionType
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
          return transactionQuickFilter === 'rent'
            ? normalizedTransactionType.includes('inchiriere')
            : normalizedTransactionType.includes('vanzare');
        });

    const searchedProperties = !normalizedPropertySearch ? transactionFiltered : transactionFiltered.filter((prop) => {
      const displaySurface = prop.totalSurface ?? prop.squareFootage;
      const searchableParts = [
        prop.title,
        prop.address,
        prop.location,
        prop.city,
        prop.zone,
        prop.description,
        prop.status,
        prop.propertyType,
        prop.transactionType,
        prop.agentName,
        prop.ownerName,
        prop.ownerPhone,
        prop.price,
        `${prop.price} eur`,
        prop.price ? prop.price.toLocaleString('en-US') : null,
        prop.price ? prop.price.toLocaleString('ro-RO') : null,
        prop.rooms,
        prop.rooms ? `${prop.rooms} camere` : null,
        prop.bathrooms,
        prop.bathrooms ? `${prop.bathrooms} bai` : null,
        displaySurface,
        displaySurface ? `${displaySurface} mp` : null,
        prop.constructionYear,
      ];
      const searchableText = searchableParts
        .filter((value) => value !== undefined && value !== null && value !== '')
        .join(' ')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

      return normalizedPropertySearch
        .split(/\s+/)
        .every((token) => searchableText.includes(token));
    });

    const portalFiltered = searchedProperties.filter((prop) => {
      if (!portalQuickFilter) return true;

      const promotionEntries = prop.promotions || {};
      const hasPublishedPromotion = (portalName: string) => promotionEntries[portalName]?.status === 'published';

      if (portalQuickFilter === 'imobiliare') {
        return hasPublishedPromotion('imobiliare') || Boolean(prop.portalProfiles?.imobiliare?.lastPublishedAt);
      }

      return hasPublishedPromotion('storia') || hasPublishedPromotion('publi24') || hasPublishedPromotion('olx');
    });

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

      return prop.status !== 'Vândut';
    });
  }, [properties, filters, normalizedPropertySearch, portalQuickFilter, searchParams, transactionQuickFilter, viewings]);

  const handleDelete = async ({ reason, soldDisposition, soldPrice, agentMessage }: DeletePropertyPayload) => {
    if (!agencyId || !deletingProperty || isDeletingProperty) return;

    setIsDeletingProperty(true);

    try {
      const deletedAt = new Date().toISOString();
      const propertyRef = doc(firestore, 'agencies', agencyId, 'properties', deletingProperty.id);
      const batch = writeBatch(firestore);

      if (reason === 'sold' && soldDisposition === 'agency') {
        const statusEventRef = doc(collection(firestore, 'agencies', agencyId, 'propertyStatusEvents'));
        const soldPropertySnapshot: Property = {
          ...deletingProperty,
          price: soldPrice ?? deletingProperty.price,
          status: 'Vândut',
          statusUpdatedAt: deletedAt,
          soldPrice: soldPrice ?? null,
        };
        const statusEvent: PropertyStatusEvent = {
          id: statusEventRef.id,
          agencyId,
          propertyId: deletingProperty.id,
          changedAt: deletedAt,
          previousStatus: deletingProperty.status ?? null,
          nextStatus: 'Vândut',
          reason: 'sale_completed',
          reasonLabel: 'Vandut de agentia mea',
          agentMessage,
          soldPrice: soldPrice ?? null,
          marketAnalysisEligible: true,
          propertySnapshot: soldPropertySnapshot,
        };

        batch.update(propertyRef, {
          price: soldPrice ?? deletingProperty.price,
          status: 'Vândut',
          statusUpdatedAt: deletedAt,
          soldPrice: soldPrice ?? null,
        });
        batch.set(statusEventRef, statusEvent);
        await batch.commit();

        toast({
          title: 'Proprietate mutata in Proprietati Vandute',
          description: `Am salvat vanzarea agentiei pentru "${deletingProperty.title}" si pretul final.`,
        });

        setDeletingProperty(null);
        return;
      }

      const deletionEventRef = doc(collection(firestore, 'agencies', agencyId, 'propertyDeletionEvents'));
      const propertySnapshot: Property = {
        ...deletingProperty,
        price: reason === 'sold' && soldPrice ? soldPrice : deletingProperty.price,
        status: reason === 'sold' ? 'Vândut' : deletingProperty.status ?? 'Inactiv',
        statusUpdatedAt: deletedAt,
      };

      const deletionEvent: PropertyDeletionEvent = {
        id: deletionEventRef.id,
        agencyId,
        propertyId: deletingProperty.id,
        deletedAt,
        reason,
        reasonLabel:
          reason === 'sold'
            ? soldDisposition === 'other_agency'
              ? 'Vandut de alta agentie'
              : 'Vandut de proprietar'
            : reason === 'collaboration_ended'
              ? 'Colaborare incetata'
              : 'Nu prezinta interes',
        agentMessage,
        soldPrice: reason === 'sold' ? soldPrice ?? null : null,
        listingPriceAtDeletion: deletingProperty.price,
        marketAnalysisEligible: reason === 'sold',
        propertySnapshot,
      };

      batch.set(deletionEventRef, deletionEvent);
      batch.delete(propertyRef);
      await batch.commit();

      toast({
        title: reason === 'sold' ? 'Proprietate arhivata ca vanduta' : 'Proprietate stearsa',
        description:
          reason === 'sold'
            ? `Am salvat vanzarea pentru "${deletingProperty.title}" si o vom folosi in analiza de piata.`
            : `Proprietatea "${deletingProperty.title}" a fost scoasa din portofoliu.`,
      });

      setDeletingProperty(null);
    } catch (error) {
      console.error('Property deletion failed:', error);
      toast({
        variant: 'destructive',
        title: 'Stergerea a esuat',
        description: 'Nu am reusit sa sterg proprietatea. Incearca din nou.',
      });
    } finally {
      setIsDeletingProperty(false);
    }
  };

  const handleReservationConfirm = async () => {
    if (!agencyId || !reservationProperty || isUpdatingReservation) return;

    setIsUpdatingReservation(true);
    try {
      const changedAt = new Date().toISOString();
      const isReactivating = reservationProperty.status === 'Rezervat';
      const nextStatus: Property['status'] = isReactivating ? 'Activ' : 'Rezervat';
      const propertyRef = doc(firestore, 'agencies', agencyId, 'properties', reservationProperty.id);
      const batch = writeBatch(firestore);
      batch.update(propertyRef, {
        status: nextStatus,
        statusUpdatedAt: changedAt,
        soldPrice: null,
      });

      if (!isReactivating) {
        const statusEventRef = doc(collection(firestore, 'agencies', agencyId, 'propertyStatusEvents'));
        const reservedPropertySnapshot: Property = {
          ...reservationProperty,
          status: 'Rezervat',
          statusUpdatedAt: changedAt,
          soldPrice: null,
        };
        const statusEvent: PropertyStatusEvent = {
          id: statusEventRef.id,
          agencyId,
          propertyId: reservationProperty.id,
          changedAt,
          previousStatus: reservationProperty.status ?? null,
          nextStatus: 'Rezervat',
          reason: 'reservation_offer_accepted',
          reasonLabel: 'Oferta de rezervare acceptata',
          agentMessage: `Marchez "${reservationProperty.title}" ca rezervata in portofoliul agentiei.`,
          soldPrice: null,
          marketAnalysisEligible: false,
          propertySnapshot: reservedPropertySnapshot,
        };
        batch.set(statusEventRef, statusEvent);
      }

      await batch.commit();

      toast({
        title: isReactivating ? 'Proprietate reactivata' : 'Proprietate rezervata',
        description: isReactivating
          ? `Proprietatea "${reservationProperty.title}" este din nou activa.`
          : `Statusul proprietatii "${reservationProperty.title}" a fost actualizat.`,
      });
      setReservationProperty(null);
    } catch (error) {
      console.error('Property reservation failed:', error);
      toast({
        variant: 'destructive',
        title: 'Actualizarea a esuat',
        description: 'Nu am reusit sa actualizam statusul proprietatii. Incearca din nou.',
      });
    } finally {
      setIsUpdatingReservation(false);
    }
  };

  const isPageLoading = isLoading;
  const reportPresetLabel = reportPreset ? REPORT_PRESET_LABELS[reportPreset] : null;
  const agentNameFilter = searchParams?.get('agentName');
  const isImobiliareQuickFilterActive = portalQuickFilter === 'imobiliare';
  const isStoriaOlxQuickFilterActive = portalQuickFilter === 'storia-olx';
  const deleteModalThemeVariant = getAgencyThemePreset(agency) === 'agentfinder' ? 'light' : 'dark';
  const searchPlaceholder = isMobile ? 'Cauta dupa adresa, pret, cuvinte...' : 'Cauta proprietati dupa titlu, adresa, zona, pret, camere, agent...';
  const searchInput = (
    <div className="agentfinder-property-search relative min-w-0">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-rose-500" />
      <Input
        value={propertySearch}
        onChange={(event) => setPropertySearch(event.target.value)}
        placeholder={searchPlaceholder}
        className="h-12 rounded-2xl border-rose-200 bg-rose-50/90 pl-11 pr-12 text-slate-900 placeholder:text-rose-400/80 focus-visible:ring-rose-300/50"
      />
      {propertySearch ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => setPropertySearch('')}
          className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full text-rose-500 hover:bg-rose-100 hover:text-rose-700"
          aria-label="Sterge cautarea"
          title="Sterge cautarea"
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );

  const transactionQuickFilterControls = (
      <div className="flex shrink-0 items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Închiriere"
              aria-pressed={transactionQuickFilter === 'rent'}
              onClick={() => setTransactionQuickFilter((current) => current === 'rent' ? null : 'rent')}
              className={cn(
                'agentfinder-transaction-quick-filter h-12 w-12 rounded-2xl',
                transactionQuickFilter === 'rent' && 'agentfinder-transaction-quick-filter--active'
              )}
            >
              <KeyRound className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Închiriere</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label="Vânzare"
              aria-pressed={transactionQuickFilter === 'sale'}
              onClick={() => setTransactionQuickFilter((current) => current === 'sale' ? null : 'sale')}
              className={cn(
                'agentfinder-transaction-quick-filter h-12 w-12 rounded-2xl',
                transactionQuickFilter === 'sale' && 'agentfinder-transaction-quick-filter--active'
              )}
            >
              <BadgeEuro className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Vânzare</TooltipContent>
        </Tooltip>
      </div>
  );

  const searchControls = (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="min-w-0 flex-1">{searchInput}</div>
      {transactionQuickFilterControls}
    </div>
  );

  const openDeleteDialog = (property: Property) => {
    setDeletionInitialReason('not_interesting');
    setDeletingProperty(property);
  };

  const openSoldDialog = (property: Property) => {
    setDeletionInitialReason('sold');
    setDeletingProperty(property);
  };

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
                <CardHeader className="px-4 sm:px-6">
                    <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-left text-xl text-white">
                          Proprietăți ({filteredProperties?.length || 0})
                        </CardTitle>
                         <div className="flex shrink-0 items-center gap-2">
                           <Button size="sm" className="agentfinder-properties-primary-button bg-white/20 hover:bg-white/30 text-white" onClick={() => setIsAddOpen(true)}>
                             <PlusCircle className="mr-2 h-4 w-4" /> Adaugă
                           </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>
             <div className="px-2">
                {searchInput}
            </div>
             <div className="flex items-center gap-2 px-2">
                <div className="min-w-0 flex-1">
                  <PropertyFilters onApplyFilters={setFilters} onResetFilters={() => setFilters(null)}>
                      <Button variant="outline" className="agentfinder-properties-soft-button h-12 w-full bg-[#152A47] text-white border-white/20 hover:bg-white/10 button-glow">
                          <Filter className="mr-2 h-4 w-4" /> Filtrează
                      </Button>
                  </PropertyFilters>
                </div>
                {transactionQuickFilterControls}
            </div>
            <div className="px-2">
              <PropertyList
                properties={filteredProperties}
                isLoading={isPageLoading}
                onDeleteRequest={openDeleteDialog}
                onReserveRequest={setReservationProperty}
                onSoldRequest={openSoldDialog}
                enableFacebookPublishing={isMobile}
              />
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
            <div className="tt-design settings-tiktok">
              <style>{`
                .settings-tiktok .tt-hero { min-height: 0 !important; padding: 24px 28px !important; }
              `}</style>
              <header className="tt-hero">
                <div>
                  <div className="tt-hero-kicker">
                    <Building2 size={17} />
                    <span className="tt-eyebrow">PORTOFOLIU ACTIV</span>
                  </div>
                  <h1>Proprietăți <em>({filteredProperties?.length || 0})</em></h1>
                  <p className="tt-hero-lead">
                    Stocul tău disponibil.
                    <br />
                    <strong>Filtrează, adaugă și acționează rapid.</strong>
                  </p>
                  <p>
                    Vezi rapid proprietățile active, folosește filtrele și intră direct în detaliile care au nevoie de atenție.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <PropertyFilters onApplyFilters={setFilters} onResetFilters={() => setFilters(null)}>
                      <Button variant="ghost" className="group flex h-auto min-h-[92px] items-center gap-3 rounded-[24px] border border-cyan-200/80 bg-gradient-to-br from-cyan-50 via-white to-sky-50 p-4 text-left text-cyan-950 shadow-[0_18px_44px_-24px_rgba(8,145,178,0.65)] ring-1 ring-white/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_54px_-24px_rgba(8,145,178,0.8)]">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-cyan-700 shadow-[0_12px_28px_-14px_rgba(8,145,178,0.75)] ring-1 ring-cyan-100 transition-transform duration-300 group-hover:scale-110">
                          <Filter className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-base font-extrabold tracking-[-0.02em]">Filtrează</span>
                        </span>
                        <ArrowRight className="ml-auto h-5 w-5 shrink-0 text-cyan-500 transition-transform duration-300 group-hover:translate-x-1" />
                      </Button>
                    </PropertyFilters>
                    <AddPropertyDialog
                      isOpen={isAddOpen}
                      onOpenChange={setIsAddOpen}
                      property={null}
                    >
                      <Button className="group flex h-auto min-h-[92px] items-center gap-3 rounded-[24px] border border-emerald-200 bg-gradient-to-br from-emerald-300 via-teal-200 to-emerald-200 p-4 text-left text-emerald-950 shadow-[0_20px_48px_-22px_rgba(16,185,129,0.85)] ring-1 ring-white/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_58px_-22px_rgba(16,185,129,1)]">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/85 text-emerald-700 shadow-[0_12px_28px_-14px_rgba(6,95,70,0.65)] ring-1 ring-white transition-transform duration-300 group-hover:scale-110">
                          <PlusCircle className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-base font-extrabold tracking-[-0.02em]">Adaugă</span>
                        </span>
                        <ArrowRight className="ml-auto h-5 w-5 shrink-0 text-emerald-800 transition-transform duration-300 group-hover:translate-x-1" />
                      </Button>
                    </AddPropertyDialog>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setPortalQuickFilter((current) => current === 'imobiliare' ? null : 'imobiliare')}
                      className={cn(
                        'group flex h-auto min-h-[92px] items-center gap-3 rounded-[24px] border p-4 text-left shadow-[0_18px_44px_-24px_rgba(124,58,237,0.55)] ring-1 ring-white/50 transition-all duration-300 hover:-translate-y-1',
                        isImobiliareQuickFilterActive
                          ? 'border-violet-300 bg-gradient-to-br from-violet-300 via-fuchsia-200 to-violet-200 text-violet-950 shadow-[0_24px_54px_-24px_rgba(124,58,237,0.85)]'
                          : 'border-violet-200/80 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 text-violet-950'
                      )}
                    >
                      <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white ring-1 transition-transform duration-300 group-hover:scale-110', isImobiliareQuickFilterActive ? 'text-violet-700 ring-violet-100' : 'text-violet-600 ring-violet-100 shadow-[0_12px_28px_-14px_rgba(124,58,237,0.55)]')}>
                        <Globe className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-extrabold leading-tight">imobiliare.ro</span>
                      </span>
                      <ArrowRight className="ml-auto h-5 w-5 shrink-0 text-violet-500 transition-transform duration-300 group-hover:translate-x-1" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setPortalQuickFilter((current) => current === 'storia-olx' ? null : 'storia-olx')}
                      className={cn(
                        'group flex h-auto min-h-[92px] items-center gap-3 rounded-[24px] border p-4 text-left shadow-[0_18px_44px_-24px_rgba(219,39,119,0.48)] ring-1 ring-white/50 transition-all duration-300 hover:-translate-y-1',
                        isStoriaOlxQuickFilterActive
                          ? 'border-pink-300 bg-gradient-to-br from-pink-300 via-rose-200 to-pink-200 text-pink-950 shadow-[0_24px_54px_-24px_rgba(219,39,119,0.78)]'
                          : 'border-pink-200/80 bg-gradient-to-br from-pink-50 via-white to-rose-50 text-pink-950'
                      )}
                    >
                      <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white ring-1 transition-transform duration-300 group-hover:scale-110', isStoriaOlxQuickFilterActive ? 'text-pink-700 ring-pink-100' : 'text-pink-600 ring-pink-100 shadow-[0_12px_28px_-14px_rgba(219,39,119,0.5)]')}>
                        <Globe className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-extrabold leading-tight">Storia/Publi24</span>
                      </span>
                      <ArrowRight className="ml-auto h-5 w-5 shrink-0 text-pink-500 transition-transform duration-300 group-hover:translate-x-1" />
                    </Button>
                  </div>
                </div>
              </header>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
                {searchControls}
                {propertySearch ? (
                    <div className="rounded-2xl border border-white/10 bg-[#152A47] px-4 py-3 text-sm text-white/65">
                        {filteredProperties.length} rezultate
                    </div>
                ) : null}
            </div>
            
            <PropertyList
              properties={filteredProperties}
              isLoading={isPageLoading}
              onDeleteRequest={openDeleteDialog}
              onReserveRequest={setReservationProperty}
              onSoldRequest={openSoldDialog}
              enableFacebookPublishing={!isMobile}
              compactDetailsAction={sidebarState === 'expanded'}
            />
        </div>
        <DeletePropertyAlert
            isOpen={!!deletingProperty}
            onOpenChange={(isOpen) => !isOpen && setDeletingProperty(null)}
            property={deletingProperty}
            isDeleting={isDeletingProperty}
            themeVariant={deleteModalThemeVariant}
            initialReason={deletionInitialReason}
            onDelete={handleDelete}
        />
        <AlertDialog
          open={!!reservationProperty}
          onOpenChange={(open) => {
            if (!open && !isUpdatingReservation) setReservationProperty(null);
          }}
        >
          <AlertDialogContent
            className={cn(
              'agentfinder-reservation-dialog min-w-0 w-[calc(100vw-1.5rem)] max-w-[460px] overflow-hidden rounded-[28px] p-0 shadow-[0_32px_90px_-32px_rgba(15,23,42,0.55)]',
              deleteModalThemeVariant === 'light'
                ? 'border-slate-200 bg-white text-slate-950'
                : 'border-white/10 bg-[#152A47] text-white'
            )}
          >
            <div
              className={cn(
                'relative overflow-hidden px-6 pb-5 pt-6 sm:px-7 sm:pt-7',
                reservationProperty?.status === 'Rezervat'
                  ? deleteModalThemeVariant === 'light'
                    ? 'bg-[radial-gradient(circle_at_top_right,rgba(219,234,254,0.75),transparent_45%)]'
                    : 'bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.2),transparent_45%)]'
                  : deleteModalThemeVariant === 'light'
                    ? 'bg-[radial-gradient(circle_at_top_right,rgba(254,226,226,0.85),transparent_45%)]'
                    : 'bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,0.2),transparent_45%)]'
              )}
            >
              <AlertDialogHeader className="relative min-w-0 gap-0 text-left">
                <div className="flex min-w-0 items-start gap-4">
                  <div
                    className={cn(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-sm',
                      reservationProperty?.status === 'Rezervat'
                        ? 'border-blue-200 bg-blue-50 text-[#566f9f]'
                        : 'border-red-200 bg-red-50 text-red-600'
                    )}
                  >
                    <LockKeyhole className="h-5 w-5" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p
                      className={cn(
                        'text-[11px] font-bold uppercase tracking-[0.18em]',
                        reservationProperty?.status === 'Rezervat'
                          ? deleteModalThemeVariant === 'light' ? 'text-[#566f9f]' : 'text-blue-200'
                          : deleteModalThemeVariant === 'light' ? 'text-red-600' : 'text-red-200'
                      )}
                    >
                      Confirmare status
                    </p>
                    <AlertDialogTitle className="agentfinder-reservation-dialog__text mt-1.5 text-xl font-bold tracking-tight sm:text-[22px]">
                      {reservationProperty?.status === 'Rezervat'
                        ? 'Reactivezi proprietatea?'
                        : 'Rezervi proprietatea?'}
                    </AlertDialogTitle>
                    <AlertDialogDescription
                      className={cn(
                        'agentfinder-reservation-dialog__text mt-2 min-w-0 text-sm leading-5',
                        deleteModalThemeVariant === 'light' ? 'text-slate-600' : 'text-white/65'
                      )}
                    >
                      {reservationProperty?.status === 'Rezervat'
                        ? 'Proprietatea va reveni în portofoliul activ.'
                        : 'Proprietatea va fi marcată temporar ca rezervată.'}
                    </AlertDialogDescription>
                  </div>
                </div>
              </AlertDialogHeader>
            </div>

            <div className="px-6 pb-6 sm:px-7">
              <div
                className={cn(
                  'flex min-w-0 items-center gap-3 overflow-hidden rounded-[20px] border p-3',
                  deleteModalThemeVariant === 'light'
                    ? 'border-slate-200 bg-slate-50'
                    : 'border-white/10 bg-white/[0.05]'
                )}
              >
                <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-200">
                  <Image
                    src={reservationProperty?.images?.[0]?.url || 'https://via.placeholder.com/300x220.png?text=Imagine+lipsa'}
                    alt={reservationProperty?.title || 'Proprietate'}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="agentfinder-reservation-dialog__property-title line-clamp-2 text-sm font-semibold leading-5" title={reservationProperty?.title}>
                    {reservationProperty?.title}
                  </p>
                  <p
                    className={cn(
                      'mt-1 truncate text-xs',
                      deleteModalThemeVariant === 'light' ? 'text-slate-500' : 'text-white/50'
                    )}
                    title={reservationProperty?.address}
                  >
                    {reservationProperty?.address}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.08em]">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1',
                        reservationProperty?.status === 'Rezervat'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-emerald-100 text-emerald-700'
                      )}
                    >
                      {reservationProperty?.status === 'Rezervat' ? 'Rezervat' : 'Activ'}
                    </span>
                    <ArrowRight className={cn('h-3.5 w-3.5', deleteModalThemeVariant === 'light' ? 'text-slate-400' : 'text-white/35')} />
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1',
                        reservationProperty?.status === 'Rezervat'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      )}
                    >
                      {reservationProperty?.status === 'Rezervat' ? 'Activ' : 'Rezervat'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <AlertDialogFooter
              className={cn(
                'grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 border-t px-6 py-4 sm:grid sm:space-x-0 sm:px-7',
                deleteModalThemeVariant === 'light'
                  ? 'border-slate-200 bg-slate-50/80'
                  : 'border-white/10 bg-black/10'
              )}
            >
              <AlertDialogCancel
                disabled={isUpdatingReservation}
                className={cn(
                  'mt-0 h-11 min-w-0 w-full whitespace-normal rounded-xl px-3 text-center text-sm',
                  deleteModalThemeVariant === 'light'
                    ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    : 'border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white'
                )}
              >
                Anulează
              </AlertDialogCancel>
              <AlertDialogAction
                aria-disabled={isUpdatingReservation}
                className={cn(
                  'agentfinder-reservation-dialog__confirm h-11 min-w-0 w-full whitespace-normal rounded-xl px-3 text-center text-sm shadow-sm',
                  reservationProperty?.status === 'Rezervat'
                    ? 'bg-[#566f9f] text-white hover:bg-[#486188]'
                    : 'bg-red-600 text-white hover:bg-red-700'
                )}
                onClick={(event) => {
                  event.preventDefault();
                  void handleReservationConfirm();
                }}
              >
                {isUpdatingReservation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                <span className="agentfinder-reservation-dialog__confirm-label">
                  {reservationProperty?.status === 'Rezervat' ? 'Reactivează' : 'Rezervă'}
                </span>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
