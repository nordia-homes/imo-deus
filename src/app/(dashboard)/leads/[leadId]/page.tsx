'use client';

import { useParams, notFound } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where, getDoc, arrayUnion } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';

import type { Contact, Property, Task, UserProfile, Interaction, Agency } from '@/lib/types';

// UI Components
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';
import { LeadHeader } from '@/components/leads/detail/Header';
import { LeadTimeline } from '@/components/leads/detail/Timeline';
import { AiSummary } from '@/components/leads/detail/AiSummary';
import { MatchedProperties } from '@/components/leads/detail/MatchedProperties';
import { LeadActionPanel } from '@/components/leads/detail/ActionPanel';


const PageSkeleton = () => (
    <div className="p-4">
        {/* Header Skeleton */}
        <div className="flex items-center gap-4 mb-6">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="space-y-2">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-5 w-64" />
            </div>
        </div>
        {/* Grid Skeleton */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            <div className="xl:col-span-3 space-y-4">
                <Skeleton className="h-20" />
                <Skeleton className="h-64" />
            </div>
            <div className="xl:col-span-6 space-y-4">
                <Skeleton className="h-56" />
                <Skeleton className="h-96" />
            </div>
            <div className="xl:col-span-3 space-y-4">
                <Skeleton className="h-40" />
                <Skeleton className="h-48" />
                <Skeleton className="h-40" />
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
    
    const propertiesQuery = useMemoFirebase(() => {
        if (!agency?.id) return null;
        return collection(firestore, 'agencies', agency.id, 'properties');
    }, [firestore, agency?.id]);
    const { data: properties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);

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
    
    const handleUpdateTask = (taskId: string, data: Partial<Task>) => {
        if (!agency?.id) return;
        const taskRef = doc(firestore, 'agencies', agency.id, 'tasks', taskId);
        updateDocumentNonBlocking(taskRef, data);
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


    const isLoading = isContactLoading || isContextLoading || areAgentsLoading || areTasksLoading || arePropertiesLoading;

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (contactError || !contact || !agency) {
        notFound();
        return null;
    }

    const mockAiSummary = contact.aiSummary || {
        score: contact.leadScore || 87,
        probability: 72,
        tags: ['Buget realist', 'Răspuns rapid'],
        nextBestAction: 'Sună în următoarele 30 min'
    };

    const matchedProperties = properties?.slice(0,2) || [];


    return (
        <div className="h-full">
            <LeadHeader 
                contact={contact} 
                onUpdateContact={handleUpdateContact}
                onAddTask={handleAddTask}
            />

            <main className="p-4 md:p-6 lg:p-8 -mx-8">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                    <div className="xl:col-span-3">
                        <LeadTimeline 
                            interactions={contact.interactionHistory || []} 
                            tasks={tasks || []} 
                            contact={contact}
                            onAddInteraction={handleAddInteraction}
                            onAddTask={handleAddTask}
                        />
                    </div>

                    <div className="xl:col-span-6 space-y-6">
                        <AiSummary summary={mockAiSummary} />
                        <MatchedProperties properties={matchedProperties} />
                    </div>

                    <div className="xl:col-span-3">
                         <LeadActionPanel 
                            contact={contact} 
                            tasks={tasks || []} 
                            agents={agents} 
                            agency={agency}
                            onUpdateContact={handleUpdateContact}
                            onUpdateTask={handleUpdateTask}
                        />
                    </div>
                </div>
            </main>
        </div>
    );
}
