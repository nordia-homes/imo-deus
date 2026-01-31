'use client';

import { useMemo, useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking, addDocumentNonBlocking } from '@/firebase';
import { doc, collection, query, where, getDoc } from 'firebase/firestore';
import type { Property, Viewing, Contact, Task, UserProfile } from '@/lib/types';
import { useAgency } from '@/context/AgencyContext';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { properties as allSampleProperties } from '@/lib/data';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ro } from 'date-fns/locale';

// UI Components
import { Skeleton } from '@/components/ui/skeleton';
import { PropertyHeader } from '@/components/properties/detail/PropertyHeader';
import { MediaColumn } from '@/components/properties/detail/MediaColumn';
import { PropertyActionPanel } from '@/components/properties/detail/PropertyActionPanel';
import { EssentialFeatures } from '@/components/properties/detail/EssentialFeatures';
import { PropertyTimeline } from '@/components/properties/detail/PropertyTimeline';
import { InfoColumn } from '@/components/properties/detail/InfoColumn';


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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
             {/* Left Column */}
            <div className="lg:col-span-4 space-y-4">
                <Skeleton className="h-20" />
                <Skeleton className="h-64" />
            </div>
            {/* Main Content Area */}
            <div className="lg:col-span-5 space-y-6">
                <Skeleton className="h-[400px]" />
                <Skeleton className="h-40" />
                <Skeleton className="h-64" />
            </div>
            {/* Right Column */}
            <div className="lg:col-span-3 space-y-4">
                <Skeleton className="h-20" />
                <Skeleton className="h-64" />
                <Skeleton className="h-40" />
            </div>
        </div>
    </div>
);


export default function PropertyDetailPage() {
    const params = useParams();
    const propertyId = params.propertyId as string;
    
    const { agency, isAgencyLoading: isContextLoading } = useAgency();
    const { user } = useUser();
    const { toast } = useToast();
    const firestore = useFirestore();

    const [agents, setAgents] = useState<UserProfile[]>([]);
    const [areAgentsLoading, setAreAgentsLoading] = useState(true);

    const agencyId = agency?.id;

    const propertyDocRef = useMemoFirebase(() => {
        if (!agencyId || !propertyId) return null;
        return doc(firestore, 'agencies', agencyId, 'properties', propertyId);
    }, [firestore, agencyId, propertyId]);

    // Data fetching - using static data as a fallback for now
    const { data: property, isLoading: isPropertyLoading, error: propertyError } = useMemo(() => {
        const prop = allSampleProperties.find(p => p.id === propertyId);
        return { data: prop || null, isLoading: false, error: prop ? null : new Error('Property not found') };
    }, [propertyId]);

    const viewingsQuery = useMemoFirebase(() => {
        if (!agencyId || !propertyId) return null;
        return query(collection(firestore, 'agencies', agencyId, 'viewings'), where('propertyId', '==', propertyId));
    }, [firestore, agencyId, propertyId]);
    const { data: viewings, isLoading: areViewingsLoading } = useCollection<Viewing>(viewingsQuery);

    const tasksQuery = useMemoFirebase(() => {
        if (!agencyId || !propertyId) return null;
        return query(collection(firestore, 'agencies', agencyId, 'tasks'), where('propertyId', '==', propertyId));
    }, [firestore, agencyId, propertyId]);
    const { data: tasks, isLoading: areTasksLoading } = useCollection<Task>(tasksQuery);
    
    const allContactsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'contacts');
    }, [firestore, agencyId]);
    const { data: allContacts, isLoading: areContactsLoading } = useCollection<Contact>(allContactsQuery);

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
    
    const isLoading = isContextLoading || areViewingsLoading || areContactsLoading || isPropertyLoading || areTasksLoading || areAgentsLoading;
    
    const onUpdateProperty = (data: Partial<Omit<Property, 'id'>>) => {
        if (!propertyDocRef) return;
        updateDocumentNonBlocking(propertyDocRef, data);
        toast({ title: 'Proprietate actualizată', description: 'Modificările au fost salvate.' });
    };
    
    const onAddTask = (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName' >) => {
        if (!agencyId || !user) return;
        const tasksCollection = collection(firestore, 'agencies', agencyId, 'tasks');
        const taskToAdd: Omit<Task, 'id'> = {
            ...taskData,
            status: 'open',
            agentId: user.uid,
            agentName: user.displayName || user.email,
        };
        addDocumentNonBlocking(tasksCollection, taskToAdd);
        toast({ title: "Task adăugat!" });
    };

    if (isLoading) {
        return <PageSkeleton />;
    }

    if (propertyError || !property || !agencyId) {
        notFound();
        return null;
    }
    
    const owner = {
        name: 'Proprietar Demo',
        phone: '0722000000',
        email: 'owner@demo.com'
    };

    const matchedLeads = allContacts?.filter(c => c.budget && property && c.budget >= property.price * 0.8 && c.budget <= property.price * 1.2).slice(0, 3) || [];

    const creationDate = property.createdAt ? new Date(property.createdAt) : null;
    const ageInDays = creationDate ? differenceInDays(new Date(), creationDate) : null;

    let ageBadgeVariant: 'success' | 'warning' | 'destructive' = 'success';
    if (ageInDays !== null) {
        if (ageInDays > 30) {
            ageBadgeVariant = 'destructive';
        } else if (ageInDays >= 14) {
            ageBadgeVariant = 'warning';
        }
    }


    return (
        <div className="h-full">
            <PropertyHeader property={property} owner={owner} />

             <main className="p-4 md:p-6 lg:p-8 -mx-8 grid grid-cols-12 gap-8 items-start">
                {/* Left Column */}
                <div className="col-span-12 lg:col-span-4 space-y-6">
                    {creationDate && (
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="px-3 py-1 text-xs font-normal">
                                <Calendar className="mr-2 h-3.5 w-3.5" />
                                Creat: {format(creationDate, 'd MMM yyyy', { locale: ro })}
                            </Badge>
                            {ageInDays !== null && (
                                <Badge variant={ageBadgeVariant} className="px-3 py-1 text-xs">
                                    <Clock className="mr-2 h-3.5 w-3.5" />
                                    Vechime: {ageInDays} {ageInDays === 1 ? 'zi' : 'zile'}
                                </Badge>
                            )}
                        </div>
                    )}
                    <EssentialFeatures property={property} />
                    <PropertyTimeline 
                        property={property}
                        viewings={viewings || []}
                        tasks={tasks || []}
                        onAddTask={onAddTask}
                    />
                </div>
                 
                {/* Main Content Column */}
                <div className="col-span-12 lg:col-span-5 space-y-6">
                    <MediaColumn property={property} />
                    <InfoColumn property={property} />
                </div>

                {/* Right Action Panel Column */}
                <div className="col-span-12 lg:col-span-3">
                     <PropertyActionPanel 
                        property={property} 
                        viewings={viewings || []}
                        matchedLeads={matchedLeads}
                        tasks={tasks || []}
                        agents={agents}
                        onUpdateProperty={onUpdateProperty}
                     />
                </div>
            </main>
        </div>
    );
}
