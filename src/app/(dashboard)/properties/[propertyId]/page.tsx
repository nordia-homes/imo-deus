'use client';

import { useMemo } from 'react';
import { useParams, notFound } from 'next/navigation';
import { useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import type { Property, Viewing, Contact, Task } from '@/lib/types';
import { useAgency } from '@/context/AgencyContext';

// UI Components
import { Skeleton } from '@/components/ui/skeleton';
import { PropertyHeader } from '@/components/properties/detail/PropertyHeader';
import { PropertyTimeline } from '@/components/properties/detail/PropertyTimeline';
import { MediaColumn } from '@/components/properties/detail/MediaColumn';
import { AiPropertyInsights } from '@/components/properties/detail/AiPropertyInsights';
import { PropertyActionPanel } from '@/components/properties/detail/PropertyActionPanel';
import { allSampleProperties } from '@/lib/data';


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
                <Skeleton className="h-96" />
                <Skeleton className="h-56" />
            </div>
            <div className="xl:col-span-3 space-y-4">
                <Skeleton className="h-40" />
                <Skeleton className="h-48" />
                <Skeleton className="h-40" />
            </div>
        </div>
    </div>
)

export default function PropertyDetailPage() {
    const params = useParams();
    const propertyId = params.propertyId as string;
    
    const { agencyId, isAgencyLoading: isContextLoading } = useAgency();
    const firestore = useFirestore();

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
    
    const allContactsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'contacts');
    }, [firestore, agencyId]);
    const { data: allContacts, isLoading: areContactsLoading } = useCollection<Contact>(allContactsQuery);
    
    const isLoading = isContextLoading || areViewingsLoading || areContactsLoading || isPropertyLoading;
    
    if (isLoading) {
        return <PageSkeleton />;
    }

    if (propertyError || !property) {
        notFound();
        return null;
    }
    
    const ownerDetails = {
        name: property.agent?.name || 'Proprietar Nespecificat',
        phone: '0700 000 000', // Placeholder
        email: 'proprietar@email.com', // Placeholder
    };

    // Find some matched leads for the panel
    const matchedLeads = allContacts?.filter(c => c.budget && property && c.budget >= property.price * 0.8 && c.budget <= property.price * 1.2).slice(0, 3) || [];

    return (
        <div className="h-full">
            <PropertyHeader property={property} owner={ownerDetails} />

            <main className="p-4 md:p-6 lg:p-8 -mx-8">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                    <div className="xl:col-span-3">
                        <PropertyTimeline property={property} />
                    </div>

                    <div className="xl:col-span-6 space-y-6">
                        <MediaColumn property={property} />
                        <AiPropertyInsights property={property} />
                    </div>

                    <div className="xl:col-span-3">
                         <PropertyActionPanel 
                            property={property} 
                            viewings={viewings || []}
                            matchedLeads={matchedLeads}
                         />
                    </div>
                </div>
            </main>
        </div>
    );
}
