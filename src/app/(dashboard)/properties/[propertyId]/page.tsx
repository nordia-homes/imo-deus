
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
import { useIsMobile } from '@/hooks/use-mobile';
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
import { Menu, Info, Bed, Ruler, Calendar, Layers, Users, ArrowRight } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


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
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';



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
    const TRUNCATION_LENGTH = 350;

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

    const matchedCumparatori = useMemo(() => {
        if (!allContacts || allContacts.length === 0 || !property) {
            return [];
        }

        return allContacts.filter(contact => {
            if (contact.status === 'Câștigat' || contact.status === 'Pierdut') {
                return false;
            }

            let score = 0;

            const contactBudget = contact.budget || 0;
            if (contactBudget > 0) {
                const lowerBound = contactBudget * 0.8;
                const upperBound = contactBudget * 1.5;
                if (property.price >= lowerBound && property.price <= upperBound) {
                    score += 50;
                }
            }

            const contactRooms = contact.preferences?.desiredRooms || 0;
            if (contactRooms > 0) {
                if (property.rooms === contactRooms) {
                    score += 30;
                } else if (Math.abs(property.rooms - contactRooms) === 1) {
                    score += 15;
                }
            }
            
            const contactCity = contact.city?.toLowerCase();
            const propertyCity = property.location.split(',')[0]?.trim().toLowerCase();
            if (contactCity && propertyCity && propertyCity.includes(contactCity)) {
                score += 20;
            }

            if (contact.zones && contact.zones.length > 0) {
                const propertyLocationLower = property.location.toLowerCase();
                if (contact.zones.some(zone => propertyLocationLower.includes(zone.toLowerCase()))) {
                    score += 25;
                }
            }

            return score > 40;
        }).sort((a, b) => (b.leadScore || 0) - (a.leadScore || 0));

    }, [property, allContacts]);

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
    
    const scheduledViewings = (viewings || []).filter(v => v.status === 'scheduled').sort((a,b) => parseISO(a.viewingDate).getTime() - parseISO(b.viewingDate).getTime());

    if (isMobile) {
        return (
          <div className="bg-[#0F1E33] -mt-6 pb-6 min-h-screen">
             <div className="space-y-4">
                 <MediaColumn property={property} />

                <div className="px-2 space-y-4">
                    <Card className="bg-[#152A47] text-white border-none rounded-2xl">
                        <CardContent className="p-3">
                            <div className="flex justify-around items-center text-sm">
                                <div className="flex items-center gap-2">
                                    <Bed className="h-5 w-5 text-primary" />
                                    <span className="font-semibold">{property.rooms}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Ruler className="h-5 w-5 text-primary" />
                                    <span className="font-semibold">{property.squareFootage} mp</span>
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
                                <AccordionItem value="info" className="border-b-0">
                                    <AccordionTrigger className="p-4 hover:no-underline font-semibold text-white">Informații Detaliate</AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4 pt-0">
                                         <Button variant="outline" className="w-full mt-2 bg-white/10 border-white/20" onClick={() => setIsInfoDialogOpen(true)}>Vezi toate detaliile</Button>
                                    </AccordionContent>
                                </AccordionItem>
                            </Card>

                             <Card className="bg-[#152A47] text-white border-none rounded-2xl overflow-hidden">
                                 <AccordionItem value="rlv" className="border-b-0">
                                    <AccordionTrigger className="p-4 hover:no-underline font-semibold text-white">Releveu Proprietate (RLV)</AccordionTrigger>
                                    <AccordionContent className="px-2 pb-2 pt-0">
                                        <RlvTab property={property} />
                                    </AccordionContent>
                                </AccordionItem>
                            </Card>
                        </Accordion>
                        
                         <Card className="bg-[#152A47] text-white border-none rounded-2xl overflow-hidden">
                            <CardHeader className="p-4">
                                <CardTitle className="font-semibold text-white text-base">Cumpărători Potriviți</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {matchedCumparatori.length > 0 ? (
                                    <Table>
                                        <TableBody>
                                            {matchedCumparatori.map(lead => (
                                                <TableRow key={lead.id} className="border-white/20">
                                                    <TableCell className="font-medium text-white p-2">
                                                        <p>{lead.name}</p>
                                                        <p className="text-xs text-white/70">Buget: €{lead.budget?.toLocaleString()}</p>
                                                    </TableCell>
                                                    <TableCell className="p-2 text-right">
                                                        <Button asChild variant="ghost" size="sm" className="text-white/90 hover:text-white">
                                                            <Link href={`/leads/${lead.id}`}>
                                                                Vezi
                                                                <ArrowRight className="ml-2 h-4 w-4" />
                                                            </Link>
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <div className="text-center text-white/70 py-6 px-4">
                                        <p>Nu au fost găsiți cumpărători compatibili.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Card className="bg-[#152A47] text-white border-none rounded-2xl overflow-hidden">
                            <CardHeader className="p-4">
                                <CardTitle className="font-semibold text-white text-base">Vizionări Programate</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                {scheduledViewings.length > 0 ? (
                                    <div className="space-y-3">
                                        {scheduledViewings.map(viewing => (
                                            <div key={viewing.id} className="flex items-center justify-between p-3 rounded-lg border border-white/20">
                                                <div>
                                                    <p className="font-semibold text-sm">{viewing.contactName}</p>
                                                    <p className="text-xs text-white/70">
                                                        {format(parseISO(viewing.viewingDate), "d MMM, HH:mm", { locale: ro })}
                                                    </p>
                                                </div>
                                                <Button asChild variant="ghost" size="sm" className="text-white/90 hover:text-white">
                                                    <Link href={`/leads/${viewing.contactId}`}>
                                                        <ArrowRight className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-white/70 text-center py-4">
                                        Nicio vizionare programată.
                                    </p>
                                )}
                            </CardContent>
                        </Card>
                        
                        <div className="pt-4 space-y-4">
                            <CmaCard property={property} allProperties={allProperties || []} />
                            <PublishCard property={property} />
                            <FacebookPromotionCard />
                            <SocialMediaCard property={property} />
                            <WebsiteToggleCard property={property} />
                            <PropertyNotesCard property={property} />
                        </div>
                    </div>
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
