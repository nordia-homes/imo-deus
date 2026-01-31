'use client';

import { useParams, notFound } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

import type { Contact, Property, Task, UserProfile, Interaction } from '@/lib/types';

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

    const isLoading = isContactLoading || isContextLoading || areAgentsLoading || areTasksLoading || arePropertiesLoading;

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (contactError || !contact) {
        notFound();
        return null;
    }

    // MOCK DATA for AI Summary - replace with real data when available
    const mockAiSummary = contact.aiSummary || {
        score: contact.leadScore || 87,
        probability: 72,
        tags: ['Buget realist', 'Răspuns rapid'],
        nextBestAction: 'Sună în următoarele 30 min'
    };

    // MOCK DATA for Properties - replace with real matching logic
    const matchedProperties = properties?.slice(0,2) || [];


    return (
        <div className="h-full">
            <LeadHeader contact={contact} />

            <main className="p-4 md:p-6 lg:p-8 -mx-8">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                    {/* Left Column - Timeline */}
                    <div className="xl:col-span-3">
                        <LeadTimeline interactions={contact.interactionHistory || []} tasks={tasks || []} />
                    </div>

                    {/* Center Column - Main Content */}
                    <div className="xl:col-span-6 space-y-6">
                        <AiSummary summary={mockAiSummary} />
                        <MatchedProperties properties={matchedProperties} />
                    </div>

                    {/* Right Column - Action Panel */}
                    <div className="xl:col-span-3">
                         <LeadActionPanel contact={contact} tasks={tasks || []} agents={agents} />
                    </div>
                </div>
            </main>
        </div>
    );
}
