'use client';

import { useMemo } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { AiHelperCard } from '@/components/dashboard/AiHelperCard';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { SalesAnalyticsChart } from '@/components/dashboard/SalesAnalyticsChart';
import { Building, TrendingUp, Users } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Contact, Property } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';

export default function DashboardPage() {
    const { user } = useUser();
    const { agencyId, isAgencyLoading } = useAgency();
    const firestore = useFirestore();

    // --- DATA FETCHING ---

    const agencyCollectionPath = useMemo(() => {
        if (!agencyId) return null;
        return `agencies/${agencyId}`;
    }, [agencyId]);

    // Leads
    const contactsQuery = useMemoFirebase(() => {
        if (!agencyCollectionPath) return null;
        return collection(firestore, agencyCollectionPath, 'contacts');
    }, [firestore, agencyCollectionPath]);
    const { data: contacts, isLoading: areContactsLoading } = useCollection<Contact>(contactsQuery);
    
    // Won Leads for Sales Volume
    const wonLeadsQuery = useMemoFirebase(() => {
        if (!agencyCollectionPath) return null;
        return query(collection(firestore, agencyCollectionPath, 'contacts'), where('status', '==', 'Câștigat'));
    }, [firestore, agencyCollectionPath]);
    const { data: wonLeads, isLoading: areWonLeadsLoading } = useCollection<Contact>(wonLeadsQuery);

    // Properties
    const propertiesQuery = useMemoFirebase(() => {
        if (!agencyCollectionPath) return null;
        return collection(firestore, agencyCollectionPath, 'properties');
    }, [firestore, agencyCollectionPath]);
    const { data: properties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);


    // --- DATA CALCULATION ---
    const totalLeads = useMemo(() => contacts?.length ?? 0, [contacts]);
    const salesVolume = useMemo(() => wonLeads?.reduce((sum, lead) => sum + (lead.budget || 0), 0) ?? 0, [wonLeads]);
    const activeProperties = useMemo(() => properties?.length ?? 0, [properties]);
    
    const isLoading = isAgencyLoading || areContactsLoading || areWonLeadsLoading || arePropertiesLoading;

    const salesAnalyticsData = useMemo(() => {
        if (!wonLeads) return [];

        const last30Days = new Map<string, number>();
        const today = new Date();
        for (let i = 0; i < 30; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const key = date.toLocaleDateString('en-CA'); // YYYY-MM-DD
            last30Days.set(key, 0);
        }

        wonLeads.forEach(lead => {
            if (lead.createdAt) {
                const leadDate = new Date(lead.createdAt);
                const key = leadDate.toLocaleDateString('en-CA');
                if (last30Days.has(key)) {
                    last30Days.set(key, (last30Days.get(key) || 0) + (lead.budget || 0));
                }
            }
        });

        const sortedData = Array.from(last30Days.entries())
            .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
            .map(([dateStr, sales]) => {
                const date = new Date(dateStr);
                return {
                    name: date.toLocaleDateString('ro-RO', { month: 'short', day: 'numeric' }),
                    'Actual': sales,
                    // Keep AI projected as a mock for now
                    'AI Projected': sales > 0 ? sales * (1 + (Math.random() - 0.4) * 0.3) : (Math.random() * 5000), 
                };
            });
        
        return sortedData;
    }, [wonLeads]);

    // --- RENDER ---

    return (
        <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {isLoading ? (
                    <>
                        <Skeleton className="h-[126px]" />
                        <Skeleton className="h-[126px]" />
                        <Skeleton className="h-[126px]" />
                    </>
                ) : (
                    <>
                        <StatCard title="Total Lead-uri" value={totalLeads.toString()} icon={<Users />} period={`${totalLeads} lead-uri în total`} />
                        <StatCard title="Volum Vânzări" value={`€${salesVolume.toLocaleString()}`} icon={<TrendingUp />} period="Total din tranzacții câștigate" />
                        <StatCard title="Proprietăți Active" value={activeProperties.toString()} icon={<Building />} period={`${activeProperties} proprietăți în portofoliu`} />
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <SalesAnalyticsChart data={salesAnalyticsData} isLoading={isLoading} />
                </div>
                <div className="space-y-6">
                    <AiHelperCard />
                </div>
            </div>
            
            <RecentActivity />
        </div>
    );
}
