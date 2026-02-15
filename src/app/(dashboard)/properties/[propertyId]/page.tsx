
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, notFound } from 'next/navigation';
import type { Property, Viewing, UserProfile, Contact } from "@/lib/types";
import { useToast } from '@/hooks/use-toast';

// UI Components
import { Skeleton } from '@/components/ui/skeleton';
import { PropertyHeader } from '@/components/properties/detail/PropertyHeader';
import { MediaColumn } from '@/components/properties/detail/MediaColumn';
import { InfoColumn } from '@/components/properties/detail/InfoColumn';
import { ActionsColumn } from '@/components/properties/detail/ActionsColumn';
import { AddViewingDialog } from '@/components/viewings/AddViewingDialog';

// Firebase & Context
import { useAgency } from '@/context/AgencyContext';
import { useDoc, useCollection, useMemoFirebase, useFirestore, useUser, addDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where, getDoc } from 'firebase/firestore';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { Menu, Info } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

import { PriceStatusCard } from '@/components/properties/detail/actions/PriceStatusCard';
import { AgentCard } from '@/components/properties/detail/actions/AgentCard';
import { ScheduledViewingsCard } from '@/components/properties/detail/actions/ScheduledViewingsCard';
import { PotentialBuyersCard } from '@/components/properties/detail/actions/PotentialBuyersCard';
import { CmaCard } from '@/components/properties/detail/actions/CmaCard';
import { PublishCard } from '@/components/properties/detail/actions/PublishCard';
import { FacebookPromotionCard } from '@/components/properties/detail/actions/FacebookPromotionCard';
import { SocialMediaCard } from '@/components/properties/detail/actions/SocialMediaCard';
import { WebsiteToggleCard } from '@/components/properties/detail/actions/WebsiteToggleCard';
import { PropertyNotesCard } from '@/components/properties/detail/actions/PropertyNotesCard';
import { MatchedLeadsTab } from '@/components/properties/detail/MatchedLeadsTab';
import { RlvTab } from '@/components/properties/detail/RlvTab';
import { InfoDialog } from '@/components/properties/detail/InfoDialog';



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
    const propertyId = params.propertyId as string;
    const { agencyId, userProfile, isAgencyLoading } = useAgency();
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [agentProfile, setAgentProfile] = useState<UserProfile | null>(null);
    const [isAgentLoading, setIsAgentLoading] = useState(true);
    const [isAddViewingOpen, setIsAddViewingOpen] = useState(false);
    const isMobile = useIsMobile();
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
    const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
    const TRUNCATION_LENGTH = 500;

    const propertyDocRef = useMemoFirebase(() => {
        if (!agencyId || !propertyId) return null;
        return doc(firestore, 'agencies', agencyId, 'properties', propertyId);
    }, [firestore, agencyId, propertyId]);
    const { data: property, isLoading: isPropertyLoading, error: propertyError } = useDoc<Property>(propertyDocRef);

    const allPropertiesQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'properties');
    }, [firestore, agencyId]);
    const { data: allProperties, isLoading: areAllPropertiesLoading } = useCollection<Property>(allPropertiesQuery);

    const viewingsQuery = useMemoFirebase(() => {
        if (!agencyId || !propertyId) return null;
        return query(collection(firestore, 'agencies', agencyId, 'viewings'), where('propertyId', '==', propertyId));
    }, [firestore, agencyId, propertyId]);
    const { data: viewings, isLoading: areViewingsLoading } = useCollection<Viewing>(viewingsQuery);

    const allContactsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'contacts');
    }, [firestore, agencyId]);
    const { data: allContacts, isLoading: areContactsLoading } = useCollection<Contact>(allContactsQuery);

    useEffect(() => {
        if (!property?.agentId || !firestore) {
            setIsAgentLoading(false);
            return;
        }

        const fetchAgent = async () => {
            setIsAgentLoading(true);
            try {
                const agentDocRef = doc(firestore, 'users', property.agentId!);
                const agentSnap = await getDoc(agentDocRef);
                if (agentSnap.exists()) {
                    setAgentProfile({ id: agentSnap.id, ...agentSnap.data() } as UserProfile);
                } else {
                    setAgentProfile(null);
                }
            } catch (error) {
                console.error("Error fetching agent profile:", error);
                setAgentProfile(null);
            } finally {
                setIsAgentLoading(false);
            }
        };

        fetchAgent();
    }, [property, firestore]);
    
    const handleAddViewing = (viewingData: Omit<Viewing, 'id' | 'status' | 'agentId' | 'agentName' | 'createdAt' | 'propertyAddress' | 'propertyTitle'>) => {
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

    const isLoading = isAgencyLoading || isPropertyLoading || areViewingsLoading || areAllPropertiesLoading || isAgentLoading || areContactsLoading;
    
    if (isLoading) {
        return <PageSkeleton />;
    }

    if (!property || propertyError) {
        notFound();
        return null;
    }
    
    if (isMobile) {
        return (
          <div className="bg-[#0F1E33] -mt-6 -mx-4 pb-6 min-h-screen">
             <div className="space-y-4">
                 <MediaColumn property={property} />

                <div className="px-4 space-y-4">
                    <Card className="bg-[#152A47] text-white border-none rounded-2xl p-4 space-y-4">
                         <div>
                            <h1 className="text-xl font-bold">{property.title}</h1>
                            <p className="text-sm text-white/70">{property.address}</p>
                        </div>
                        <PriceStatusCard property={property} />
                        <AgentCard agent={{
                            name: agentProfile?.name || property.agentName || "Nealocat",
                            email: agentProfile?.email || null,
                            phone: agentProfile?.phone || null,
                            avatarUrl: agentProfile?.photoUrl || `https://i.pravatar.cc/150?u=${property.agentId || 'unassigned'}`,
                        }} />
                        <Button className="w-full bg-primary hover:bg-primary/90 text-white" onClick={() => setIsAddViewingOpen(true)}>Programează Vizionare</Button>
                    </Card>

                    <Accordion type="multiple" className="w-full space-y-4">
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
                                     {property.amenities && property.amenities.length > 0 && (
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {property.amenities.map(amenity => (
                                                <Badge key={amenity} variant="secondary" className="bg-white/10 text-white border-none">{amenity}</Badge>
                                            ))}
                                        </div>
                                     )}
                                </AccordionContent>
                            </AccordionItem>
                        </Card>

                         <Card className="bg-[#152A47] text-white border-none rounded-2xl overflow-hidden">
                            <AccordionItem value="actions" className="border-b-0">
                                <AccordionTrigger className="p-4 hover:no-underline font-semibold text-white">Acțiuni Marketing</AccordionTrigger>
                                <AccordionContent className="px-4 pb-4 pt-0 space-y-2">
                                     <ScheduledViewingsCard viewings={viewings || []} />
                                     <PotentialBuyersCard property={property} allContacts={allContacts || []} />
                                     <CmaCard property={property} allProperties={allProperties || []} />
                                     <PublishCard property={property} />
                                     <FacebookPromotionCard />
                                     <SocialMediaCard property={property} />
                                     <WebsiteToggleCard property={property} />
                                     <PropertyNotesCard property={property} />
                                </AccordionContent>
                            </AccordionItem>
                        </Card>
                        
                        <Card className="bg-[#152A47] text-white border-none rounded-2xl overflow-hidden">
                             <AccordionItem value="leads" className="border-b-0">
                                <AccordionTrigger className="p-4 hover:no-underline font-semibold text-white">Cumpărători Potriviți</AccordionTrigger>
                                <AccordionContent className="px-0 pb-0 pt-0">
                                     <MatchedLeadsTab property={property} allContacts={allContacts || []} />
                                </AccordionContent>
                            </AccordionItem>
                        </Card>
                        
                        <Card className="bg-[#152A47] text-white border-none rounded-2xl overflow-hidden">
                             <AccordionItem value="rlv" className="border-b-0">
                                <AccordionTrigger className="p-4 hover:no-underline font-semibold text-white">Releveu (RLV)</AccordionTrigger>
                                <AccordionContent className="px-0 pb-0 pt-0">
                                    <RlvTab property={property} />
                                </AccordionContent>
                            </AccordionItem>
                        </Card>
                        
                        <Card className="bg-[#152A47] text-white border-none rounded-2xl overflow-hidden">
                            <AccordionItem value="info" className="border-b-0">
                                <AccordionTrigger className="p-4 hover:no-underline font-semibold text-white">Informații Detaliate</AccordionTrigger>
                                <AccordionContent className="px-4 pb-4 pt-0">
                                     <Button variant="outline" className="w-full mt-2 bg-white/10 border-white/20" onClick={() => setIsInfoDialogOpen(true)}>Vezi toate detaliile</Button>
                                </AccordionContent>
                            </AccordionItem>
                        </Card>

                    </Accordion>
                </div>
                 
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
        <div className="h-full">
            <PropertyHeader 
                property={property} 
                onTriggerAddViewing={() => setIsAddViewingOpen(true)}
            />

             <main className="pt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="col-span-12 lg:col-span-8 space-y-8">
                    <MediaColumn property={property} />
                    <InfoColumn property={property} allContacts={allContacts || []} viewings={viewings || []} />
                </div>

                <div className="col-span-12 lg:col-span-4">
                     <ActionsColumn property={property} allProperties={allProperties || []} viewings={viewings || []} agentProfile={agentProfile} allContacts={allContacts || []} />
                </div>
            </main>
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

    