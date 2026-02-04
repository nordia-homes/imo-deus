'use client';

import { useParams, notFound } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where, getDoc, arrayUnion } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';

import type { Contact, Property, Task, UserProfile, Interaction, Agency, Viewing } from '@/lib/types';

// UI Components
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';
import { LeadHeader } from '@/components/leads/detail/Header';
import { LeadTimeline } from '@/components/leads/detail/Timeline';
import { MatchedProperties } from '@/components/leads/detail/MatchedProperties';
import { LeadInfoCard } from '@/components/leads/detail/LeadInfoCard';
import { LeadSettingsCard } from '@/components/leads/detail/LeadSettingsCard';
import { LeadZonesCard } from '@/components/leads/detail/LeadZonesCard';
import { ClientPortalManager } from '@/components/leads/ClientPortalManager';
import { LeadDescriptionCard } from '@/components/leads/detail/LeadDescriptionCard';
import { ScheduledViewingsCard } from '@/components/leads/detail/ScheduledViewingsCard';
import { SourcePropertyCard } from '@/components/leads/detail/SourcePropertyCard';


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

    // --- AGENT PROFILES STATE ---
    const [agents, setAgents] = useState<UserProfile[]>([]);
    const [areAgentsLoading, setAreAgentsLoading] = useState(true);

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

    // --- AGENT PROFILES FETCHING ---
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
    
    // --- MUTATION HANDLERS ---
    const handleUpdateContact = (data: Partial<Omit<Contact, 'id'>>) => {
        if (!contactDocRef) return;
        updateDocumentNonBlocking(contactDocRef, data);
        toast({ title: 'Lead actualizat', description: 'Modificările au fost salvate.' });
    };

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

    const handleAddInteraction = (interactionData: Omit<Interaction, 'id' | 'date' | 'agent'>) => {
        if (!contactDocRef || !user) return Promise.reject("User or contact not available");
        
        const newInteraction = {
            ...interactionData,
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            agent: {
                name: user.displayName || user.email || 'Nespecificat',
            }
        };
        
        updateDocumentNonBlocking(contactDocRef, {
            interactionHistory: arrayUnion(newInteraction)
        });

        toast({ title: 'Interacțiune adăugată.' });
        return Promise.resolve();
    };


    const isLoading = isContactLoading || isContextLoading || areAgentsLoading || areTasksLoading || arePropertiesLoading || areViewingsLoading || isSourcePropertyLoading;

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (contactError || !contact || !agency) {
        notFound();
        return null;
    }

    const matchedProperties = properties?.slice(0,2) || [];


    return (
        <div className="h-full flex flex-col">
            <LeadHeader 
                contact={contact} 
                onUpdateContact={handleUpdateContact}
                onAddTask={handleAddTask}
                onAddViewing={handleAddViewing}
                properties={properties || []}
            />

            <main className="flex-1 p-4 md:p-6 -mx-8 overflow-y-auto">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Column */}
                    <div className="lg:col-span-3 space-y-6">
                        <LeadInfoCard contact={contact} onAddInteraction={handleAddInteraction} onAddTask={handleAddTask} />
                        <LeadZonesCard contact={contact} />
                        <LeadTimeline 
                            interactions={contact.interactionHistory || []} 
                            tasks={tasks || []}
                            viewings={viewings || []}
                        />
                    </div>

                    {/* Center Column */}
                    <div className="lg:col-span-6 space-y-6">
                        <MatchedProperties properties={matchedProperties} />
                        <LeadDescriptionCard contact={contact} onUpdateContact={handleUpdateContact} />
                    </div>

                    {/* Right Column */}
                    <div className="lg:col-span-3 space-y-6">
                        <LeadSettingsCard contact={contact} agents={agents} onUpdateContact={handleUpdateContact} />
                        <ScheduledViewingsCard viewings={viewings || []} />
                        <ClientPortalManager contact={contact} agency={agency} />
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
