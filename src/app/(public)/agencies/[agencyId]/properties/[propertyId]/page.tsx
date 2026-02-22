
'use client';

import { useParams, notFound } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { Property, UserProfile } from '@/lib/types';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';

import { PublicPropertyHeader } from '@/components/public/PublicPropertyHeader';
import { MediaColumn } from '@/components/properties/detail/MediaColumn';
import { PublicInfoColumn } from '@/components/public/PublicInfoColumn';
import { PublicActionsColumn } from '@/components/public/PublicActionsColumn';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';


const PageSkeleton = () => (
    <div className="space-y-6 lg:p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
            <div className="space-y-2 w-full"> <Skeleton className="h-8 w-3/4" /> <Skeleton className="h-5 w-1/2" /></div>
            <div className="flex gap-2 w-full justify-start md:justify-end"><Skeleton className="h-10 w-32" /><Skeleton className="h-10 w-10" /></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mt-6">
             <div className="lg:col-span-8 space-y-6"> <Skeleton className="h-[250px] md:h-[550px] bg-white/10" /> <Skeleton className="h-96 bg-white/10" /> </div>
             <div className="lg:col-span-4 space-y-4"> <Skeleton className="h-[700px] bg-white/10" /> </div>
        </div>
    </div>
);

export default function PublicPropertyDetailPage() {
    const params = useParams();
    const { agencyId, propertyId } = params as { agencyId: string, propertyId: string };
    const firestore = useFirestore();

    const [agentProfile, setAgentProfile] = useState<UserProfile | null>(null);
    const [isAgentLoading, setIsAgentLoading] = useState(true);

    const propertyDocRef = useMemoFirebase(() => {
        if (!agencyId || !propertyId) return null;
        return doc(firestore, 'agencies', agencyId, 'properties', propertyId);
    }, [firestore, agencyId, propertyId]);
    const { data: property, isLoading: isPropertyLoading, error } = useDoc<Property>(propertyDocRef);

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
    
    const isLoading = isPropertyLoading || isAgentLoading;
    
    if (isLoading) {
        return <div className="h-full bg-background lg:bg-[#0F1E33] text-white"><PageSkeleton /></div>;
    }
    
    if (!property || error || property.status !== 'Activ') {
        notFound();
        return null;
    }

    return (
        <div className={cn("bg-[#0F1E33] text-white animated-glow")}>
             <div className="container mx-auto px-4 py-8">
                <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <div className="col-span-12 lg:col-span-8 space-y-8">
                        <PublicPropertyHeader property={property} />
                        <MediaColumn property={property} />
                        <PublicInfoColumn property={property} />
                    </div>

                    <div className="col-span-12 lg:col-span-4 lg:sticky top-24">
                         <PublicActionsColumn property={property} agentProfile={agentProfile} agencyId={agencyId} />
                    </div>
                </main>
             </div>
        </div>
    );
}
