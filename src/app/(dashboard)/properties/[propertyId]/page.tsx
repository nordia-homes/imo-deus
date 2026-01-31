'use client';

import { useMemo } from 'react';
import { useParams, notFound } from 'next/navigation';
import type { Property } from '@/lib/types';
import React from 'react';

import { properties as allSampleProperties } from '@/lib/data';
import { PropertyHeader } from '@/components/properties/detail/PropertyHeader';
import { MediaColumn } from '@/components/properties/detail/MediaColumn';
import { InfoColumn } from '@/components/properties/detail/InfoColumn';
import { ActionsColumn } from '@/components/properties/detail/ActionsColumn';
import { useAgency } from '@/context/AgencyContext';
import { useUser } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';


const PageSkeleton = () => (
    <div className="relative">
         {/* Header Skeleton */}
        <header className="fixed top-16 left-0 md:left-[--sidebar-width-icon] group-data-[collapsible=icon]:md:left-[--sidebar-width-icon] group-data-[state=expanded]:md:left-[--sidebar-width] right-0 z-30 bg-background/95 backdrop-blur-sm border-b transition-all duration-200 ease-linear">
            <div className="flex items-center justify-between p-4 h-24">
                <div className="flex items-center gap-4 overflow-hidden">
                    <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
                    <div className="flex-1 overflow-hidden space-y-2">
                        <Skeleton className="h-6 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                    </div>
                </div>
                 <div className="items-center gap-2 hidden md:flex">
                     <Skeleton className="h-10 w-32" />
                     <Skeleton className="h-10 w-24" />
                     <Skeleton className="h-10 w-32" />
                     <Skeleton className="h-10 w-24" />
                 </div>
            </div>
        </header>

        {/* Body Skeleton */}
        <main className="pt-28 -mx-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-4">
                <div className="lg:col-span-5 space-y-6">
                    <Skeleton className="h-[550px] w-full rounded-2xl" />
                </div>
                <div className="lg:col-span-4 space-y-6">
                    <Skeleton className="h-64 w-full rounded-2xl" />
                    <Skeleton className="h-48 w-full rounded-2xl" />
                    <Skeleton className="h-96 w-full rounded-2xl" />
                </div>
                <div className="lg:col-span-3 space-y-6">
                    <Skeleton className="h-24 w-full rounded-2xl" />
                    <Skeleton className="h-32 w-full rounded-2xl" />
                    <Skeleton className="h-40 w-full rounded-2xl" />
                </div>
            </div>
        </main>
    </div>
);


export default function PropertyDetailPage() {
    const params = useParams();
    const propertyId = params.propertyId as string;
    const { agency, agencyId, isAgencyLoading } = useAgency();
    const { user, isUserLoading } = useUser();
    
    // Using static data as requested in previous turns
    const { data: property, isLoading: isDocLoading, error } = useMemo(() => {
        const prop = allSampleProperties.find(p => p.id === propertyId);
        return { data: prop || null, isLoading: false, error: prop ? null : new Error('Property not found') };
    }, [propertyId]);

    const allProperties = allSampleProperties;
    
    const isLoading = isUserLoading || isDocLoading || isAgencyLoading;

    if (isLoading) {
        return <PageSkeleton />;
    }
    
    if (error || !property || !user || !agency || !agencyId) {
        notFound();
        return null;
    }

    return (
        <div className="relative">
            <PropertyHeader property={property} />

            <main className="pt-28 -mx-4">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 px-4">
                    {/* --- Left Column --- */}
                    <div className="lg:col-span-5">
                        <MediaColumn property={property} />
                    </div>

                    {/* --- Center Column --- */}
                    <div className="lg:col-span-4">
                        <InfoColumn property={property} allProperties={allProperties} agencyId={agencyId} />
                    </div>

                    {/* --- Right Column --- */}
                    <div className="lg:col-span-3">
                        <ActionsColumn property={property} />
                    </div>
                </div>
            </main>
        </div>
    )
}
