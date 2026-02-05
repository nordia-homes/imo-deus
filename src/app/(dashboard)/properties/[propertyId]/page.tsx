'use client';

import { useMemo, useState, useEffect } from 'react';
import { useParams, notFound } from 'next/navigation';
import type { Property, Viewing, UserProfile, Contact } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

// UI Components
import { Skeleton } from '@/components/ui/skeleton';
import { PropertyHeader } from '@/components/properties/detail/PropertyHeader';
import { MediaColumn } from '@/components/properties/detail/MediaColumn';
import { InfoColumn } from '@/components/properties/detail/InfoColumn';
import { ActionsColumn } from '@/components/properties/detail/ActionsColumn';

// Firebase & Context
import { useAgency } from '@/context/AgencyContext';
import { useDoc, useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { doc, collection, query, where, getDoc } from 'firebase/firestore';


const PageSkeleton = () => (
    <div className="p-4">
        <div className="flex items-center justify-between gap-4 mb-4">
            <div className="space-y-2"> <Skeleton className="h-8 w-96" /> <Skeleton className="h-5 w-64" /> <Skeleton className="h-5 w-80 mt-2"/></div>
            <div className="flex gap-2"><Skeleton className="h-10 w-32" /><Skeleton className="h-10 w-10" /></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-6">
             <div className="lg:col-span-8 space-y-6"> <Skeleton className="h-[405px]" /> <Skeleton className="h-96" /> </div>
             <div className="lg:col-span-4 space-y-4"> <Skeleton className="h-24" /> <Skeleton className="h-32" /> <Skeleton className="h-40" /> <Skeleton className="h-24" /> </div>
        </div>
    </div>
);

export default function PropertyDetailPage() {
    const params = useParams();
    const propertyId = params.propertyId as string;
    const { agencyId, isAgencyLoading } = useAgency();
    const firestore = useFirestore();

    const [agentProfile, setAgentProfile] = useState<UserProfile | null>(null);
    const [isAgentLoading, setIsAgentLoading] = useState(true);

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

    const contactsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'contacts');
    }, [firestore, agencyId]);
    const { data: allContacts, isLoading: areContactsLoading } = useCollection<Contact>(contactsQuery);

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

    const isLoading = isAgencyLoading || isPropertyLoading || areViewingsLoading || areAllPropertiesLoading || isAgentLoading || areContactsLoading;
    
    if (isLoading) {
        return <PageSkeleton />;
    }

    if (!property || propertyError) {
        notFound();
        return null;
    }

    return (
        <div className="h-full">
            <PropertyHeader property={property} />

             <main className="pt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="col-span-12 lg:col-span-8 space-y-8">
                    <MediaColumn property={property} />
                    <InfoColumn property={property} allContacts={allContacts || []} />
                </div>

                <div className="col-span-12 lg:col-span-4">
                     <ActionsColumn property={property} allProperties={allProperties || []} viewings={viewings || []} agentProfile={agentProfile} allContacts={allContacts || []} />
                </div>
            </main>
        </div>
    );
}
