'use client';

import { useMemo } from 'react';
import { useParams, notFound } from 'next/navigation';
import type { Property } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

// UI Components
import { Skeleton } from '@/components/ui/skeleton';
import { PropertyHeader } from '@/components/properties/detail/PropertyHeader';
import { MediaColumn } from '@/components/properties/detail/MediaColumn';
import { InfoColumn } from '@/components/properties/detail/InfoColumn';
import { ActionsColumn } from '@/components/properties/detail/ActionsColumn';

import { properties as allProperties } from '@/lib/data'; // Using static data

const PageSkeleton = () => (
    <div className="p-4">
        <div className="flex items-center justify-between gap-4 mb-4">
            <div className="space-y-2"> <Skeleton className="h-8 w-96" /> <Skeleton className="h-5 w-64" /> <Skeleton className="h-5 w-80 mt-2"/></div>
            <div className="flex gap-2"><Skeleton className="h-10 w-32" /><Skeleton className="h-10 w-10" /></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-6">
             <div className="lg:col-span-8 space-y-6"> <Skeleton className="h-[550px]" /> <Skeleton className="h-96" /> </div>
             <div className="lg:col-span-4 space-y-4"> <Skeleton className="h-24" /> <Skeleton className="h-32" /> <Skeleton className="h-40" /> <Skeleton className="h-24" /> </div>
        </div>
    </div>
);

export default function PropertyDetailPage() {
    const params = useParams();
    const propertyId = params.propertyId as string;
    
    const property = useMemo(() => allProperties.find(p => p.id === propertyId), [propertyId]);
    const isLoading = false; 
    
    if (isLoading) {
        return <PageSkeleton />;
    }

    if (!property) {
        notFound();
        return null;
    }

    return (
        <div className="h-full">
            <PropertyHeader property={property} />

             <main className="pt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="col-span-12 lg:col-span-8 space-y-8">
                    <MediaColumn property={property} />
                    <InfoColumn property={property} />
                </div>

                <div className="col-span-12 lg:col-span-4">
                     <ActionsColumn property={property} />
                </div>
            </main>
        </div>
    );
}
