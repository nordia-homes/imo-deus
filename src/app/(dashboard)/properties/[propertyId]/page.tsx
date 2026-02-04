'use client';

import { useMemo } from 'react';
import { useParams, notFound } from 'next/navigation';
import type { Property, Viewing, Contact, Task } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

// UI Components
import { Skeleton } from '@/components/ui/skeleton';
import { PropertyHeader } from '@/components/properties/detail/PropertyHeader';
import { MediaColumn } from '@/components/properties/detail/MediaColumn';
import { EssentialFeatures } from '@/components/properties/detail/EssentialFeatures';
import { InfoColumn } from '@/components/properties/detail/InfoColumn';
import { PropertyActionPanel } from '@/components/properties/detail/PropertyActionPanel';

import { properties as allProperties } from '@/lib/data'; // Using static data

const PageSkeleton = () => (
    <div className="p-4">
        <div className="flex items-center gap-4 mb-6"> <Skeleton className="h-8 w-48" /> </div>
        <div className="flex items-center justify-between gap-4 mb-4">
            <div className="space-y-2"> <Skeleton className="h-8 w-96" /> <Skeleton className="h-5 w-64" /> </div>
            <Skeleton className="h-10 w-48" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
             <div className="lg:col-span-2 space-y-4"> <Skeleton className="h-64" /> </div>
             <div className="lg:col-span-7 space-y-6"> <Skeleton className="h-[450px]" /> <Skeleton className="h-96" /> </div>
             <div className="lg:col-span-3 space-y-4"> <Skeleton className="h-20" /> <Skeleton className="h-64" /> <Skeleton className="h-40" /> </div>
        </div>
    </div>
);

export default function PropertyDetailPage() {
    const params = useParams();
    const propertyId = params.propertyId as string;
    
    const property = useMemo(() => allProperties.find(p => p.id === propertyId), [propertyId]);
    const { toast } = useToast();

    // Mock data for display, as we're using static property data
    const viewings: Viewing[] = [];
    const tasks: Task[] = [];
    const matchedLeads: Contact[] = [];
    const isLoading = false; 
    
    if (isLoading) {
        return <PageSkeleton />;
    }

    if (!property) {
        notFound();
        return null;
    }
    
    const onAddTask = () => {
        toast({ title: 'Funcționalitate demo', description: 'Adăugarea de task-uri va fi implementată.' });
    }

    return (
        <div className="h-full">
            <PropertyHeader property={property} />

             <main className="pt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <div className="hidden lg:block lg:col-span-2">
                    <EssentialFeatures property={property} />
                </div>
                 
                <div className="col-span-12 lg:col-span-7 space-y-8">
                    <MediaColumn property={property} />
                    <InfoColumn property={property} />
                </div>

                <div className="col-span-12 lg:col-span-3">
                     <PropertyActionPanel 
                        property={property} 
                        viewings={viewings}
                        matchedLeads={matchedLeads}
                        tasks={tasks}
                        onAddTask={onAddTask}
                     />
                </div>
            </main>
        </div>
    );
}
