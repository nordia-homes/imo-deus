'use client';

import { useParams, notFound } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where, getDoc, arrayUnion } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { propertyMatcher } from '@/ai/flows/property-matcher';

import type { Contact, Property, Task, UserProfile, Interaction, Agency, Viewing, MatchedProperty, ContactPreferences, PortalRecommendation } from '@/lib/types';

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


const PageSkeleton = () => (
    <div className="p-4">
        {/* Header Skeleton */}
        <div className="flex items-center gap-4 mb-6">
            <Skeleton className="h-10 w-48" />
        </div>
        {/* Grid Skeleton */}
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
    const leadId = params.leadId as string;
    
    const { agency, isAgencyLoading: isContextLoading } = useAgency();
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    // --- Component State ---
    const [agents, setAgents] = useState<UserProfile[]>([]);
    const [areAgentsLoading, setAreAgentsLoading] = useState(true);
    const [isMatching, setIsMatching] = useState(false);
    const [matchedProperties, setMatchedProperties] = useState<MatchedProperty[]>([]);

    // --- DATA FETCHING ---
    const contactDocRef = useMemoFirebase(() => {
        if (!agency?.id || !leadId) return null;
        return doc(firestore, 'agencies', agency.id, 'contacts', leadId);
    }, [firestore, agency?.id, leadId]);

    const { data: contact, isLoading: isContactLoading, error: contactError } = useDoc<Contact>(contactDocRef);

    const tasksQuery = useMemoFirebase(() => {
        if (!agency?.id || !leadId) return null;
        const tasksCollection = collection(firestore, 'agencies', agency.id, 'tasks');
        return query(tasksCollection, where('contactId', '==', leadId));
    }, [firestore, agency?.id, leadId]);

    const { data: tasks, isLoading: areTasksLoading } = useCollection<Task>(tasksQuery);
    
    const viewingsQuery = useMemoFirebase(() => {
        if (!agency?.id || !leadId) return null;
        const viewingsCollection = collection(firestore, 'agencies', agency.id, 'viewings');
        return query(viewingsCollection, where('contactId', '==', leadId));
    }, [firestore, agency?.id, leadId]);

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
        
        toast({ title: 'Lead actualizat', description: 'Modificările au fost salvate.' });
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
            bedrooms: p.bedrooms || 0,
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
            agentName: user.displayName || user.email,
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
            agentName: user.displayName || user.email,
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
                name: user.displayName || user.email || 'Nespecificat',
            }
        };
        
        await updateDocumentNonBlocking(contactDocRef, {
            interactionHistory: arrayUnion(newInteraction)
        });
    };

    const similarLeads = useMemo(() => {
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
                onAddViewing={handleAddViewing}
                properties={properties || []}
            />

            <main className="pt-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Column */}
                    <div className="lg:col-span-3 space-y-6">
                        <LeadInfoCard contact={contact} />
                        <ScheduledViewingsCard viewings={viewings || []} />
                         <FinancialStatusCard 
                            contact={contact} 
                            onUpdateContact={handleUpdateContact}
                            recommendations={recommendations}
                            properties={properties}
                            portalId={contact.portalId || null}
                            onUpdateRecommendation={handleUpdateRecommendation}
                        />
                        <LeadTimeline 
                            interactions={contact.interactionHistory || []} 
                            tasks={tasks || []}
                            onAddInteraction={handleAddInteraction}
                            onAddTask={handleAddTask}
                            contacts={[contact]}
                        />
                    </div>

                    {/* Center Column */}
                    <div className="lg:col-span-6 space-y-6">
                        <PreferencesCard contact={contact} onUpdateContact={handleUpdateContact} onRematch={handleRematch} isMatching={isMatching} />
                        <MatchedProperties properties={matchedProperties} contact={contact} />
                        <LeadDescriptionCard contact={contact} onUpdateContact={handleUpdateContact} />
                        <SimilarLeadsCard leads={similarLeads} />
                    </div>

                    {/* Right Column */}
                    <div className="lg:col-span-3 space-y-6">
                        <AiLeadScoreCard contact={contact} onUpdateContact={handleUpdateContact} />
                        <ClientPortalManager contact={contact} agency={agency} />
                        <LeadSettingsCard contact={contact} agents={agents} onUpdateContact={handleUpdateContact} />
                        <SourcePropertyCard 
                            property={sourceProperty} 
                            isLoading={isSourcePropertyLoading}
                            allProperties={properties || []}
                            onUpdateContact={handleUpdateContact}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}
