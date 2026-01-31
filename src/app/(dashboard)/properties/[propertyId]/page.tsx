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


export default function PropertyDetailPage() {
    const params = useParams();
    const propertyId = params.propertyId as string;
    const { agency, agencyId, isAgencyLoading } = useAgency();
    const { user, isUserLoading } = useUser();
    

    // Temp fix: Use static data instead of Firestore
    const { data: property, isLoading: isDocLoading, error } = useMemo(() => {
        const prop = allSampleProperties.find(p => p.id === propertyId);
        return { data: prop || null, isLoading: false, error: prop ? null : new Error('Property not found') };
    }, [propertyId]);

    const allProperties = allSampleProperties;
    
    const isLoading = isUserLoading || isDocLoading || isAgencyLoading;

    if (isLoading) {
        return <div>Loading...</div>; // Replace with a proper skeleton loader
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
                    <div className="lg:col-span-5">
                        <MediaColumn property={property} />
                    </div>
                    <div className="lg:col-span-4">
                        <InfoColumn property={property} allProperties={allProperties} agencyId={agencyId} />
                    </div>
                    <div className="lg:col-span-3">
                        <ActionsColumn property={property} />
                    </div>
                </div>
            </main>
        </div>
    )
}
