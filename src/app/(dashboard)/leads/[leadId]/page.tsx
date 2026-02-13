'use client';

import { useParams, notFound } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where, getDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { propertyMatcher } from '@/ai/flows/property-matcher';

import type { Contact, Property, Task, UserProfile, Interaction, Agency, Viewing, MatchedProperty, ContactPreferences, PortalRecommendation, Offer } from '@/lib/types';

// UI Components
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';
import { LeadHeader } from '@/components/leads/detail/Header';
import { LeadTimeline } from '@/components/leads/detail/LeadTimeline';
import { MatchedProperties } from '@/components/leads/detail/MatchedProperties';
import { LeadInfoCard } from '@/components/leads/detail/LeadInfoCard';
import { LeadSettingsCard } from '@/components/leads/detail/LeadSettingsCard';
import { ClientPortalManager } from '@/components/leads/detail/ClientPortalManager';
import { LeadDescriptionCard } from '@/components/leads/detail/LeadDescriptionCard';
import { ScheduledViewingsCard } from '@/components/leads/detail/ScheduledViewingsCard';
import { SourcePropertyCard } from '@/components/leads/detail/SourcePropertyCard';
import { SimilarLeadsCard } from '@/components/leads/detail/SimilarLeadsCard';
import { AiLeadScoreCard } from '@/components/leads/detail/AiLeadScoreCard';
import { FinancialStatusCard } from '@/components/leads/detail/FinancialStatusCard';
import { PreferencesCard } from '@/components/leads/detail/PreferencesCard';
import { EditLeadInfoDialog } from '@/components/leads/detail/EditLeadInfoDialog';
import { OfferManagementCard } from '@/components/leads/detail/OfferManagementCard';
import { AddViewingDialog } from '@/components/viewings/AddViewingDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const PageSkeleton = () => (
    <div className="space-y-6">
        <div className="flex flex-col md:flex-row items-center gap-4 mb-6">
            <Skeleton className="h-10 w-48" />
            <div className="flex gap-2 flex-wrap">
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
                <Skeleton className="h-9 w-24" />
            </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-3 space-y-4">
                <Skeleton className="h-48" />
                <Skeleton className="h-64" />
            </div>
            <div className="lg:col-span-6 space-y-4">
                <Skeleton className="h-96" />
                <Skeleton className="h-56" />
            </div>
            <div className="lg:col-span-3 space-y-4">
                <Skeleton className="h-64" />
                <Skeleton className="h-40" />
                <Skeleton className="h-48" />
                <Skeleton className="h-72" />
            </div>
        </div>
    </div>
)


// Main Component
export default function LeadDetailPage() {
    const params = useParams();
    const cumparatorId = params.leadId as string;
    
    const { agency, userProfile, isAgencyLoading: isContextLoading } = useAgency();
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    // --- Component State ---
    const [agents, setAgents] = useState<UserProfile[]>([]);
    const [areAgentsLoading, setAreAgentsLoading] = useState(true);
    const [isMatching, setIsMatching] = useState(false);
    const [matchedProperties, setMatchedProperties] = useState<MatchedProperty[]>([]);
    const [isEditInfoOpen, setIsEditInfoOpen] = useState(false);
    const [isAddViewingOpen, setIsAddViewingOpen] = useState(false);

    // --- DATA FETCHING ---
    const contactDocRef = useMemoFirebase(() => {
        if (!agency?.id || !cumparatorId) return null;
        return doc(firestore, 'agencies', agency.id, 'contacts', cumparatorId);
    }, [firestore, agency?.id, cumparatorId]);

    const { data: contact, isLoading: isContactLoading, error: contactError } = useDoc<Contact>(contactDocRef);

    const tasksQuery = useMemoFirebase(() => {
        if (!agency?.id || !cumparatorId) return null;
        const tasksCollection = collection(firestore, 'agencies', agency.id, 'tasks');
        return query(tasksCollection, where('contactId', '==', cumparatorId));
    }, [firestore, agency?.id, cumparatorId]);

    const { data: tasks, isLoading: areTasksLoading } = useCollection<Task>(tasksQuery);
    
    const viewingsQuery = useMemoFirebase(() => {
        if (!agency?.id || !cumparatorId) return null;
        const viewingsCollection = collection(firestore, 'agencies', agency.id, 'viewings');
        return query(viewingsCollection, where('contactId', '==', cumparatorId));
    }, [firestore, agency?.id, cumparatorId]);

    const { data: viewings, isLoading: areViewingsLoading } = useCollection<Viewing>(viewingsQuery);

    const propertiesQuery = useMemoFirebase(() => {
        if (!agency?.id) return null;
        return collection(firestore, 'agencies', agency.id, 'properties');
    }, [firestore, agency?.id]);
    const { data: properties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);

    const sourcePropertyDocRef = useMemoFirebase(() => {
        if (!agency?.id || !contact?.sourcePropertyId) return null;
        return doc(firestore, 'agencies', agency.id, 'properties', contact.sourcePropertyId);
    }, [firestore, agency?.id, contact?.sourcePropertyId]);
    const { data: sourceProperty, isLoading: isSourcePropertyLoading } = useDoc<Property>(sourcePropertyDocRef);

    // Fetch all contacts to find similar ones
    const allContactsQuery = useMemoFirebase(() => {
        if (!agency?.id) return null;
        return collection(firestore, 'agencies', agency.id, 'contacts');
    }, [firestore, agency?.id]);
    const { data: allContacts, isLoading: areAllContactsLoading } = useCollection<Contact>(allContactsQuery);

    const recommendations = useMemo(() => {
        if (!contact?.recommendationHistory) return [];
        // Convert the recommendationHistory map to an array for the component
        return Object.values(contact.recommendationHistory);
    }, [contact?.recommendationHistory]);
    const areRecsLoading = isContactLoading; // Loading is now tied to the contact loading


    // --- Side Effects & Memoization ---
    useEffect(() => {
        if (!agency?.agentIds || agency.agentIds.length === 0) {
            setAreAgentsLoading(false);
            return;
        }

        const fetchAgents = async () => {
            setAreAgentsLoading(true);
            try {
                const agentPromises = agency.agentIds.map(id => getDoc(doc(firestore, 'users', id)));
                const agentDocs = await Promise.all(agentPromises);
                const agentProfiles = agentDocs
                    .filter(docSnap => docSnap.exists())
                    .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as UserProfile));
                setAgents(agentProfiles);
            } catch (error) {
                console.error("Error fetching agent profiles:", error);
                toast({ variant: 'destructive', title: 'Eroare la încărcare', description: 'Nu am putut încărca lista de agenți.' });
            } finally {
                setAreAgentsLoading(false);
            }
        };

        fetchAgents();
    }, [agency, firestore, toast]);

    useEffect(() => {
        if (properties) {
            const initialMatched = properties.slice(0, 2).map(p => ({...p, matchScore: 0, reasoning: ''}));
            setMatchedProperties(initialMatched);
        }
    }, [properties]);
    
    // --- MUTATION HANDLERS ---
    const handleUpdateContact = (data: Partial<Omit<Contact, 'id'>>) => {
        if (!contactDocRef) return;
        
        let finalData = { ...data };
        if (data.preferences && contact?.preferences) {
            finalData.preferences = { ...contact.preferences, ...data.preferences };
        }
        
        updateDocumentNonBlocking(contactDocRef, finalData);
        
        toast({ title: 'Cumpărător actualizat', description: 'Modificările au fost salvate.' });
    };
    
    const handleUpdateRecommendation = (recommendationId: string, data: Partial<Omit<PortalRecommendation, 'id'>>) => {
        if (!contact?.portalId || !contactDocRef) return;

        // Also update the live portal for the client
        const recRef = doc(firestore, 'portals', contact.portalId, 'recommendations', recommendationId);
        updateDocumentNonBlocking(recRef, data);
        
        // Update the historical record on the contact
        const existingRec = contact.recommendationHistory?.[recommendationId];
        if (existingRec) {
            const updatedRec = { ...existingRec, ...data };
            updateDocumentNonBlocking(contactDocRef, {
                [`recommendationHistory.${recommendationId}`]: updatedRec
            });
        }
    };

    const handleRematch = async (preferences: ContactPreferences) => {
        if (!contact || !properties) {
            toast({ variant: "destructive", title: "Date lipsă", description: "Nu s-au putut încărca proprietățile."});
            return;
        }

        setIsMatching(true);
        
        const matcherProperties = properties.map(p => ({
            ...p,
            address: p.address || p.location || '',
            price: p.price || 0,
            rooms: p.rooms || 0,
            bathrooms: p.bathrooms || 0,
            squareFootage: p.squareFootage || 0,
            description: p.description || p.title || '',
            image: p.images?.[0]?.url || `https://picsum.photos/seed/${p.id}/400/300`,
        }));

        try {
            const result = await propertyMatcher({
                clientPreferences: preferences,
                properties: matcherProperties,
            });
            setMatchedProperties(result.matchedProperties as MatchedProperty[]);
            if (result.matchedProperties.length === 0) {
                toast({
                    title: 'Nicio potrivire perfectă găsită',
                    description: 'AI-ul nu a găsit nicio proprietate care să corespundă noilor criterii.',
                });
            }
        } catch (error) {
            console.error('Property matching failed:', error);
            toast({ variant: "destructive", title: "A apărut o eroare", description: "Nu am putut găsi proprietăți potrivite."});
        } finally {
            setIsMatching(false);
        }
    }

    const handleAddTask = (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName' >) => {
        if (!agency?.id || !user) return;
        const tasksCollection = collection(firestore, 'agencies', agency.id, 'tasks');
        const taskToAdd: Omit<Task, 'id'> = {
            ...taskData,
            status: 'open',
            agentId: user.uid,
            agentName: userProfile?.name || user.displayName || user.email,
        };
        addDocumentNonBlocking(tasksCollection, taskToAdd);
        toast({ title: "Task adăugat!" });
    };
    
    const handleAddViewing = (viewingData: Omit<Viewing, 'id' | 'status' | 'agentId' | 'agentName' | 'createdAt' | 'propertyAddress' | 'propertyTitle'>) => {
        if (!agency?.id || !user) return;

        const selectedProperty = properties?.find(p => p.id === viewingData.propertyId);
        if (!selectedProperty) return;
        
        const viewingsCollection = collection(firestore, 'agencies', agency.id, 'viewings');
        const viewingToAdd: Omit<Viewing, 'id'> = {
            ...viewingData,
            propertyTitle: selectedProperty.title,
            propertyAddress: selectedProperty.address,
            status: 'scheduled',
            agentId: user.uid,
            agentName: userProfile?.name || user.displayName || user.email,
            createdAt: new Date().toISOString(),
        };
        addDocumentNonBlocking(viewingsCollection, viewingToAdd);
        toast({ title: "Vizionare programată!" });
    };

    const handleAddInteraction = async (interactionData: Omit<Interaction, 'id' | 'date' | 'agent'>) => {
        if (!contactDocRef || !user) return Promise.reject("User or contact not available");
        
        const newInteraction: Interaction = {
            ...interactionData,
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            agent: {
                name: userProfile?.name || user.displayName || user.email || 'Nespecificat',
            }
        };
        
        await updateDocumentNonBlocking(contactDocRef, {
            interactionHistory: arrayUnion(newInteraction)
        });
    };

     const handleToggleTask = (task: Task) => {
        if (!agency?.id) return;
        const taskRef = doc(firestore, 'agencies', agency.id, 'tasks', task.id);
        const newStatus = task.status === 'completed' ? 'open' : 'completed';
        updateDocumentNonBlocking(taskRef, { status: newStatus });
        toast({
            title: `Task ${newStatus === 'completed' ? 'completat' : 'redeschis'}!`,
            description: `"${task.description}" a fost actualizat.`,
        });
    };

    const similarCumparatori = useMemo(() => {
        if (!contact || !allContacts || allContacts.length <= 1) return [];

        const hasFilterCriteria = (contact.zones && contact.zones.length > 0) || contact.budget;
        if (!hasFilterCriteria) {
            return [];
        }

        const budgetFlexibility = 0.20; // 20% flexibility
        const minBudget = contact.budget ? contact.budget * (1 - budgetFlexibility) : 0;
        const maxBudget = contact.budget ? contact.budget * (1 + budgetFlexibility) : Infinity;

        return allContacts.filter(otherLead => {
            if (otherLead.id === contact.id) return false;

            const budgetMatch = contact.budget && otherLead.budget 
                ? (otherLead.budget >= minBudget && otherLead.budget <= maxBudget)
                : false;
            
            const zoneMatch = contact.zones && contact.zones.length > 0 && otherLead.zones && otherLead.zones.length > 0
                ? contact.zones.some(zone => otherLead.zones!.includes(zone))
                : false;
            
            return budgetMatch || zoneMatch;
        }).slice(0, 5);
    }, [contact, allContacts]);

    const handleAddOffer = (offerData: Omit<Offer, 'id' | 'date' | 'status'>) => {
        if (!contactDocRef) return;
        const newOffer: Offer = {
            ...offerData,
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            status: 'În așteptare',
        };
        updateDocumentNonBlocking(contactDocRef, {
            offers: arrayUnion(newOffer)
        });
        toast({ title: 'Ofertă adăugată!' });
    };

    const handleUpdateOffer = (offerId: string, data: Partial<Omit<Offer, 'id'>>) => {
        if (!contactDocRef || !contact || !contact.offers) return;

        const updatedOffers = contact.offers.map(offer => {
            if (offer.id === offerId) {
                return { ...offer, ...data };
            }
            return offer;
        });

        updateDocumentNonBlocking(contactDocRef, { offers: updatedOffers });
        toast({ title: 'Status ofertă actualizat!' });
    };

    const handleDeleteOffer = (offerId: string) => {
        if (!contactDocRef || !contact || !contact.offers) return;

        const offerToDelete = contact.offers.find(offer => offer.id === offerId);
        if (offerToDelete) {
             updateDocumentNonBlocking(contactDocRef, {
                offers: arrayRemove(offerToDelete)
            });
            toast({ title: 'Ofertă ștearsă!', variant: 'destructive' });
        }
    };


    const isLoading = isContactLoading || isContextLoading || areAgentsLoading || areTasksLoading || arePropertiesLoading || areViewingsLoading || isSourcePropertyLoading || areAllContactsLoading || areRecsLoading;

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (contactError || !contact || !agency) {
        notFound();
        return null;
    }

    return (
        <div className="h-full flex flex-col">
            <LeadHeader 
                contact={contact} 
                onUpdateContact={handleUpdateContact}
                onAddTask={handleAddTask}
                onTriggerAddViewing={() => setIsAddViewingOpen(true)}
                properties={properties || []}
            />

            <main className="pt-6">
                {/* Mobile View: Tabs */}
                <div className="lg:hidden">
                    <Tabs defaultValue="general" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="general">General</TabsTrigger>
                            <TabsTrigger value="timeline">Cronologie</TabsTrigger>
                            <TabsTrigger value="properties">Proprietăți</TabsTrigger>
                            <TabsTrigger value="portal">Portal</TabsTrigger>
                        </TabsList>
                        <TabsContent value="general" className="mt-6 space-y-6">
                            <LeadInfoCard contact={contact} onEdit={() => setIsEditInfoOpen(true)} />
                            <AiLeadScoreCard contact={contact} onUpdateContact={handleUpdateContact} />
                            <FinancialStatusCard 
                                contact={contact} 
                                onUpdateContact={handleUpdateContact}
                                recommendations={recommendations}
                                properties={properties}
                                portalId={contact.portalId || null}
                                onUpdateRecommendation={handleUpdateRecommendation}
                            />
                            <LeadDescriptionCard contact={contact} onUpdateContact={handleUpdateContact} />
                            <LeadSettingsCard contact={contact} agents={agents} onUpdateContact={handleUpdateContact} />
                        </TabsContent>
                        <TabsContent value="timeline" className="mt-6 space-y-6">
                            <LeadTimeline 
                                interactions={contact.interactionHistory || []} 
                                tasks={tasks || []}
                                onAddInteraction={handleAddInteraction}
                                onAddTask={handleAddTask}
                                contacts={[contact]}
                                onToggleTask={handleToggleTask}
                            />
                            <ScheduledViewingsCard viewings={viewings || []} />
                        </TabsContent>
                        <TabsContent value="properties" className="mt-6 space-y-6">
                             <PreferencesCard contact={contact} onUpdateContact={handleUpdateContact} onRematch={handleRematch} isMatching={isMatching} />
                             <SourcePropertyCard 
                                property={sourceProperty} 
                                isLoading={isSourcePropertyLoading}
                                allProperties={properties || []}
                                onUpdateContact={handleUpdateContact}
                            />
                            <MatchedProperties properties={matchedProperties} contact={contact} />
                            <OfferManagementCard
                                contact={contact}
                                properties={properties || []}
                                onAddOffer={handleAddOffer}
                                onUpdateOffer={handleUpdateOffer}
                                onDeleteOffer={handleDeleteOffer}
                            />
                            <SimilarLeadsCard leads={similarCumparatori} />
                        </TabsContent>
                        <TabsContent value="portal" className="mt-6 space-y-6">
                            <ClientPortalManager contact={contact} agency={agency} />
                        </TabsContent>
                    </Tabs>
                </div>
                
                {/* Desktop View: Grid */}
                <div className="hidden lg:grid lg:grid-cols-12 gap-6 items-start">
                    <div className="lg:col-span-3 space-y-6">
                        <LeadInfoCard contact={contact} onEdit={() => setIsEditInfoOpen(true)} />
                        <AiLeadScoreCard contact={contact} onUpdateContact={handleUpdateContact} />
                        <LeadSettingsCard contact={contact} agents={agents} onUpdateContact={handleUpdateContact} />
                        <ClientPortalManager contact={contact} agency={agency} />
                    </div>

                    <div className="lg:col-span-5 space-y-6">
                        <LeadTimeline 
                            interactions={contact.interactionHistory || []} 
                            tasks={tasks || []}
                            onAddInteraction={handleAddInteraction}
                            onAddTask={handleAddTask}
                            contacts={[contact]}
                            onToggleTask={handleToggleTask}
                        />
                        <LeadDescriptionCard contact={contact} onUpdateContact={handleUpdateContact} />
                        <FinancialStatusCard 
                            contact={contact} 
                            onUpdateContact={handleUpdateContact}
                            recommendations={recommendations}
                            properties={properties}
                            portalId={contact.portalId || null}
                            onUpdateRecommendation={handleUpdateRecommendation}
                        />
                         <OfferManagementCard
                            contact={contact}
                            properties={properties || []}
                            onAddOffer={handleAddOffer}
                            onUpdateOffer={handleUpdateOffer}
                            onDeleteOffer={handleDeleteOffer}
                        />
                    </div>

                    <div className="lg:col-span-4 space-y-6">
                         <PreferencesCard contact={contact} onUpdateContact={handleUpdateContact} onRematch={handleRematch} isMatching={isMatching} />
                         <MatchedProperties properties={matchedProperties} contact={contact} />
                         <SourcePropertyCard 
                            property={sourceProperty} 
                            isLoading={isSourcePropertyLoading}
                            allProperties={properties || []}
                            onUpdateContact={handleUpdateContact}
                        />
                        <ScheduledViewingsCard viewings={viewings || []} />
                        <SimilarLeadsCard leads={similarCumparatori} />
                    </div>
                </div>
            </main>

             <EditLeadInfoDialog 
                contact={contact}
                isOpen={isEditInfoOpen}
                onOpenChange={setIsEditInfoOpen}
                onUpdateContact={handleUpdateContact}
            />
            <AddViewingDialog
                isOpen={isAddViewingOpen}
                onOpenChange={setIsAddViewingOpen}
                onAddViewing={handleAddViewing}
                properties={properties || []}
                contacts={allContacts || []}
            />
        </div>
    );
}
