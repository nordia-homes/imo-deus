
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, notFound } from 'next/navigation';
import type { Property, Viewing, Contact } from "@/lib/types";
import { useToast } from '@/hooks/use-toast';
import { usePropertyBuyerMatches } from '@/hooks/use-property-buyer-matches';
import { buildAgencyPublicUrl } from '@/lib/domain-routing';

// UI Components
import { Skeleton } from '@/components/ui/skeleton';
import { PropertyHeader } from '@/components/properties/detail/PropertyHeader';
import { MediaColumn } from '@/components/properties/detail/MediaColumn';
import { InfoColumn } from '@/components/properties/detail/InfoColumn';
import { ActionsColumn } from '@/components/properties/detail/ActionsColumn';
import { AddViewingDialog } from '@/components/viewings/AddViewingDialog';
import { AddPropertyDialog } from '@/components/properties/add-property-dialog';

// Firebase & Context
import { useAgency } from '@/context/AgencyContext';
import { useDoc, useCollection, useMemoFirebase, useFirestore, useUser, addDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu, Info, Bed, Ruler, Calendar, Layers, Users, ArrowRight, Edit, Calculator, Facebook, Share2, Globe, StickyNote, Phone, MapPinned } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


import { PriceStatusCard } from '@/components/properties/detail/actions/PriceStatusCard';
import { AgentCard } from '@/components/properties/detail/actions/AgentCard';
import { ScheduledViewingsCard } from '@/components/properties/detail/actions/ScheduledViewingsCard';
import { PotentialBuyersCard } from '@/components/properties/detail/actions/PotentialBuyersCard';
import { PublishCard } from '@/components/properties/detail/actions/PublishCard';
import { TikTokAdsCard } from '@/components/properties/detail/actions/TikTokAdsCard';
import { TikTokOrganicPublishingCard } from '@/components/properties/detail/actions/TikTokOrganicPublishingCard';
import { MetaAdsCard } from '@/components/properties/detail/actions/MetaAdsCard';
import { FacebookCloudPublishingCard } from '@/components/properties/detail/actions/FacebookCloudPublishingCard';
import { SocialMediaCard } from '@/components/properties/detail/actions/SocialMediaCard';
import { PropertyNotesCard } from '@/components/properties/detail/actions/PropertyNotesCard';
import { NearbyObjectivesCard } from '@/components/properties/detail/actions/NearbyObjectivesCard';
import { MatchedLeadsTab } from '@/components/properties/detail/MatchedLeadsTab';
import { RlvTab } from '@/components/properties/detail/RlvTab';
import { InfoDialog } from '@/components/properties/detail/InfoDialog';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';
import { WhatsappIcon } from '@/components/icons/WhatsappIcon';
import { OwnerCard } from '@/components/properties/detail/actions/OwnerCard';
import { AdminPropertyDetailsMap } from '@/components/map/AdminPropertyDetailsMap';
import { ACTION_CARD_CLASSNAME, ACTION_PILL_CLASSNAME } from '@/components/properties/detail/actions/cardStyles';
import { useAgencyAgents } from '@/hooks/use-agency-agents';



const PageSkeleton = () => (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
            <div className="space-y-2 w-full"> <Skeleton className="h-8 w-3/4" /> <Skeleton className="h-5 w-1/2" /></div>
            <div className="flex gap-2 w-full justify-start md:justify-end"><Skeleton className="h-10 w-32" /><Skeleton className="h-10 w-10" /></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-6">
             <div className="lg:col-span-8 space-y-6"> <Skeleton className="h-[250px] md:h-[405px]" /> <Skeleton className="h-96" /> </div>
             <div className="lg:col-span-4 space-y-4"> <Skeleton className="h-24" /> <Skeleton className="h-32" /> <Skeleton className="h-40" /> <Skeleton className="h-24" /> </div>
        </div>
    </div>
);

export default function PropertyDetailPage() {
    const params = useParams();
    const propertyId = String(params?.propertyId || '');
    const { agencyId, agency, userProfile, isAgencyLoading } = useAgency();
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { agents, error: agentsError } = useAgencyAgents({ enabled: Boolean(agencyId) });

    const [isAddViewingOpen, setIsAddViewingOpen] = useState(false);
    const isMobile = useIsMobile();
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const buyerMatchScope = JSON.stringify([agencyId, user?.uid, propertyId]);
    const [preparedBuyerScope, setPreparedBuyerScope] = useState<string | null>(null);
    const [contactsAttempt, setContactsAttempt] = useState(0);
    const shouldLoadBuyerMatches = preparedBuyerScope === buyerMatchScope;
    const requestBuyerMatches = () => setPreparedBuyerScope(buyerMatchScope);
    const TRUNCATION_LENGTH = 500;

    const propertyDocRef = useMemoFirebase(() => {
        if (!agencyId || !propertyId) return null;
        return doc(firestore, 'agencies', agencyId, 'properties', propertyId);
    }, [firestore, agencyId, propertyId]);
    const { data: property, isLoading: isPropertyLoading, error: propertyError } = useDoc<Property>(propertyDocRef);

    const viewingsQuery = useMemoFirebase(() => {
        if (!agencyId || !propertyId) return null;
        return query(collection(firestore, 'agencies', agencyId, 'viewings'), where('propertyId', '==', propertyId));
    }, [firestore, agencyId, propertyId]);
    const { data: viewings } = useCollection<Viewing>(viewingsQuery);

    const allContactsQuery = useMemoFirebase(() => {
        if (!agencyId || (!isAddViewingOpen && !shouldLoadBuyerMatches)) return null;
        return collection(firestore, 'agencies', agencyId, 'contacts');
    }, [firestore, agencyId, isAddViewingOpen, shouldLoadBuyerMatches, contactsAttempt]);
    const { data: allContacts, error: contactsError } = useCollection<Contact>(allContactsQuery);
    const { matchedBuyers, isMatching, matchingError, retryMatches } = usePropertyBuyerMatches(
        buyerMatchScope, property, allContacts, shouldLoadBuyerMatches && Boolean(user && agencyId),
    );
    const buyerMatchesError = contactsError ? 'Lista cumpărătorilor nu a putut fi încărcată.' : matchingError;
    const isLoadingBuyerMatches = !buyerMatchesError && isMatching;
    const handleRequestBuyerMatches = () => {
        requestBuyerMatches();
        if (contactsError) setContactsAttempt((value) => value + 1);
        if (matchingError) retryMatches();
    };

    useEffect(() => {
        if (!agentsError) return;
        console.error('Error fetching agent profiles:', agentsError);
    }, [agentsError]);

    const agentProfile = useMemo(() => {
        if (!property?.agentId) return null;
        return agents.find((agent) => agent.id === property.agentId) || null;
    }, [agents, property?.agentId]);

    // Let the property render first; prepare the full recommendation during idle
    // time instead of making the user start both the contact fetch and AI call.
    const loadedPropertyId = property?.id;
    const matchingUserId = user?.uid;
    useEffect(() => {
        if (!loadedPropertyId || isPropertyLoading || isAgencyLoading || !matchingUserId || !agencyId || shouldLoadBuyerMatches) return;
        const prepare = () => setPreparedBuyerScope(buyerMatchScope);
        if (typeof window.requestIdleCallback === 'function') {
            const idleId = window.requestIdleCallback(prepare, { timeout: 1200 });
            return () => window.cancelIdleCallback(idleId);
        }
        const timerId = window.setTimeout(prepare, 200);
        return () => window.clearTimeout(timerId);
    }, [loadedPropertyId, isPropertyLoading, isAgencyLoading, matchingUserId, agencyId, buyerMatchScope, shouldLoadBuyerMatches]);

    const handleAddViewing = async (viewingData: Omit<Viewing, 'id' | 'status' | 'agentId' | 'agentName' | 'createdAt' | 'propertyAddress' | 'propertyTitle'>) => {
        if (!agencyId || !user || !property) return;
        
        const viewingsCollection = collection(firestore, 'agencies', agencyId, 'viewings');
        const viewingToAdd: Omit<Viewing, 'id'> = {
            ...viewingData,
            propertyTitle: property.title,
            propertyAddress: property.address,
            status: 'scheduled',
            agentId: user.uid,
            agentName: userProfile?.name || user.displayName || 'Agent neatribuit',
            createdAt: new Date().toISOString(),
        };
        addDocumentNonBlocking(viewingsCollection, viewingToAdd);
        toast({ title: "Vizionare programată!" });
    };

    const isLoading = isAgencyLoading || isPropertyLoading;
    
    if (isLoading) {
        return <PageSkeleton />;
    }

    if (!property || propertyError) {
        notFound();
        return null;
    }
    
    const scheduledViewings = (viewings || []).filter(v => v.status === 'scheduled').sort((a,b) => parseISO(a.viewingDate).getTime() - parseISO(b.viewingDate).getTime());
    const displaySurface = property.totalSurface ?? property.squareFootage;
    const publicPropertyUrl = agencyId
        ? buildAgencyPublicUrl(agency ?? { id: agencyId }, `/properties/${propertyId}`)
        : undefined;

    if (isMobile) {
        return (
          <div className="agentfinder-property-detail-page agentfinder-property-detail-mobile bg-[#0F1E33] -mt-6 pb-6 min-h-screen">
             <div className="space-y-4">
                 <MediaColumn property={property} shareUrl={publicPropertyUrl} showMobileActions />

                <div className="space-y-4 px-2">
                    <Card className={`${ACTION_CARD_CLASSNAME} rounded-[1.55rem]`}>
                        <CardContent className="p-3">
                            <div className="flex justify-around items-center text-sm">
                                <div className="flex items-center gap-2">
                                    <Bed className="h-5 w-5 text-primary" />
                                    <span className="font-semibold">{property.rooms}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Ruler className="h-5 w-5 text-primary" />
                                    <span className="font-semibold">{displaySurface} mp</span>
                                </div>
                                {property.constructionYear && (
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-5 w-5 text-primary" />
                                        <span className="font-semibold">{property.constructionYear}</span>
                                    </div>
                                )}
                                {property.floor && (
                                    <div className="flex items-center gap-2">
                                        <Layers className="h-5 w-5 text-primary" />
                                        <span className="font-semibold">{property.floor}</span>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        <Card className={`${ACTION_CARD_CLASSNAME} rounded-[1.75rem] p-4 space-y-4`}>
                             <div className="space-y-4">
                                <div className="relative flex items-center justify-center">
                                    <h1 className="px-10 text-center text-xl font-bold">{property.title}</h1>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className={`absolute right-0 h-8 w-8 rounded-full text-white/75 hover:text-white ${ACTION_PILL_CLASSNAME}`}
                                        onClick={() => setIsEditDialogOpen(true)}
                                    >
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                </div>
                                <p className="text-center text-sm text-white/70">{property.address}</p>
                            </div>
                            <PriceStatusCard property={property} variant="admin" isMobile={true} />
                             <AgentCard agent={{
                                name: agentProfile?.name || property.agentName,
                                email: agentProfile?.email || null,
                                phone: agentProfile?.phone || null,
                                avatarUrl: agentProfile?.photoUrl || `https://i.pravatar.cc/150?u=${property.agentId || 'unassigned'}`,
                            }} isMobile={true} />
                            <OwnerCard property={property} isMobile={true} />
                            <Button
                                className="w-full rounded-full border border-emerald-300/28 bg-emerald-400/20 text-emerald-50 shadow-[0_18px_40px_-18px_rgba(34,197,94,0.55)] hover:bg-emerald-400/24"
                                onClick={() => setIsAddViewingOpen(true)}
                            >
                                Programează Vizionare
                            </Button>
                        </Card>

                        <Accordion type="multiple" className="w-full space-y-4" defaultValue={['description']}>
                            <Card className="bg-[#152A47] text-white border-none rounded-2xl overflow-hidden">
                                <AccordionItem value="description" className="border-b-0">
                                    <AccordionTrigger className="p-4 hover:no-underline font-semibold text-white">Descriere & Dotări</AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4 pt-0">
                                        <p className="text-sm text-white/80 whitespace-pre-wrap">
                                          {(property.description && property.description.length > TRUNCATION_LENGTH && !isDescriptionExpanded) 
                                              ? `${property.description.substring(0, TRUNCATION_LENGTH)}...`
                                              : property.description || 'Nicio descriere adăugată.'
                                          }
                                        </p>
                                        {property.description && property.description.length > TRUNCATION_LENGTH && (
                                            <Button 
                                                variant="link" 
                                                className="p-0 h-auto mt-2 text-primary"
                                                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                                            >
                                                {isDescriptionExpanded ? 'Citește mai puțin' : 'Citește toată descrierea'}
                                            </Button>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                            </Card>
                            <Card className={`${ACTION_CARD_CLASSNAME} rounded-[1.6rem]`}>
                                <CardContent className="space-y-4 p-5">
                                    <div className="space-y-1 text-center">
                                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                                            Informatii complete
                                        </p>
                                        <h3 className="text-xl font-semibold text-white">
                                            Vezi toate detaliile
                                        </h3>
                                        <p className="text-sm text-white/78">
                                            Deschide fisa completa a proprietatii cu toate informatiile tehnice.
                                        </p>
                                    </div>
                                    <Button className="w-full rounded-full border border-emerald-300/28 bg-emerald-400/20 text-emerald-50 shadow-[0_18px_40px_-18px_rgba(34,197,94,0.55)] hover:bg-emerald-400/24" onClick={() => setIsInfoDialogOpen(true)}>
                                        Vezi Fisa Proprietatii
                                    </Button>
                                </CardContent>
                            </Card>
                             <Card className={`${ACTION_CARD_CLASSNAME} rounded-[1.6rem] overflow-hidden`}>
                                 <AccordionItem value="rlv" className="border-b-0">
                                    <AccordionTrigger className="p-4 hover:no-underline font-semibold text-white">Releveu Proprietate (RLV)</AccordionTrigger>
                                    <AccordionContent className="px-2 pb-2 pt-0">
                                        <RlvTab property={property} />
                                    </AccordionContent>
                                </AccordionItem>
                            </Card>
                            <Card className="overflow-hidden rounded-2xl border-none bg-[#152A47] text-white">
                                <CardHeader className="px-4 pb-2 pt-2">
                                    <CardTitle className="flex items-center gap-2 text-base font-semibold text-white">
                                        <MapPinned className="h-5 w-5 text-primary" />
                                        <span>Locatia proprietatii pe harta</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="h-[240px] overflow-hidden">
                                        <AdminPropertyDetailsMap properties={[property]} />
                                    </div>
                                </CardContent>
                            </Card>
                            <NearbyObjectivesCard property={property} />
                        </Accordion>
                        
                        <div className="pt-4 space-y-4">
                            <PublishCard property={property} />
                            <MetaAdsCard property={property} />
                            <FacebookCloudPublishingCard property={property} />
                            <SocialMediaCard property={property} />
                            <TikTokAdsCard property={property} />
                            <TikTokOrganicPublishingCard property={property} />
                            <PropertyNotesCard property={property} />
                             <PotentialBuyersCard matchedBuyers={matchedBuyers} onRequestMatches={handleRequestBuyerMatches} isLoading={isLoadingBuyerMatches} error={buyerMatchesError} />
                             <ScheduledViewingsCard viewings={viewings || []} />
                        </div>
                    </div>
                </div>
                 
                 <AddPropertyDialog
                    isOpen={isEditDialogOpen}
                    onOpenChange={setIsEditDialogOpen}
                    property={property}
                />
                 <AddViewingDialog
                    isOpen={isAddViewingOpen}
                    onOpenChange={setIsAddViewingOpen}
                    onAddViewing={handleAddViewing}
                    properties={[property]}
                    contacts={allContacts || []}
                />
                 <InfoDialog 
                    property={property}
                    isOpen={isInfoDialogOpen}
                    onOpenChange={setIsInfoDialogOpen}
                />
            </div>
          </div>
        );
    }

    return (
        <div className="agentfinder-property-detail-page h-full">
            <div className="agentfinder-property-detail-desktop hidden lg:block h-full bg-[#0F1E33] -mt-6 -mb-6 px-3 pt-6 pb-6 text-white">
                <PropertyHeader 
                    property={property} 
                    onTriggerAddViewing={() => setIsAddViewingOpen(true)}
                />

                <main className="grid grid-cols-1 items-stretch gap-8 overflow-hidden rounded-tl-lg rounded-tr-[1.85rem] pb-8 lg:grid-cols-12">
                    <div className="col-span-12 lg:col-span-8 space-y-4">
                        <MediaColumn property={property} shareUrl={publicPropertyUrl} />
                        <InfoColumn
                            property={property}
                            matchedBuyers={matchedBuyers}
                            viewings={viewings || []}
                            onRequestBuyerMatches={handleRequestBuyerMatches}
                            isLoadingBuyerMatches={isLoadingBuyerMatches}
                            buyerMatchesError={buyerMatchesError}
                        />
                    </div>

                    <div className="col-span-12 h-full lg:col-span-4">
                         <ActionsColumn property={property} allProperties={[]} viewings={viewings || []} agentProfile={agentProfile} matchedBuyers={matchedBuyers} />
                    </div>
                </main>
            </div>
            <AddViewingDialog
                isOpen={isAddViewingOpen}
                onOpenChange={setIsAddViewingOpen}
                onAddViewing={handleAddViewing}
                properties={[property]}
                contacts={allContacts || []}
            />
        </div>
    );
}

    
