'use client';

import { useMemo } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { PriorityTasks } from '@/components/dashboard/PriorityTasks';
import { AiHelperCard } from '@/components/dashboard/AiHelperCard';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { SalesAnalyticsChart } from '@/components/dashboard/SalesAnalyticsChart';
import { Building, TrendingUp, Users } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { Contact, Property, Task } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function DashboardPage() {
    const { user } = useUser();
    const firestore = useFirestore();

    // --- DATA FETCHING ---

    // Leads
    const contactsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return collection(firestore, 'users', user.uid, 'contacts');
    }, [firestore, user]);
    const { data: contacts, isLoading: areContactsLoading } = useCollection<Contact>(contactsQuery);
    
    // Won Leads for Sales Volume
    const wonLeadsQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(collection(firestore, 'users', user.uid, 'contacts'), where('status', '==', 'Câștigat'));
    }, [firestore, user]);
    const { data: wonLeads, isLoading: areWonLeadsLoading } = useCollection<Contact>(wonLeadsQuery);

    // Properties
    const propertiesQuery = useMemoFirebase(() => {
        if (!user) return null;
        return collection(firestore, 'users', user.uid, 'properties');
    }, [firestore, user]);
    const { data: properties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);
    
    // Priority Tasks
    const tasksQuery = useMemoFirebase(() => {
        if (!user) return null;
        return query(
            collection(firestore, 'users', user.uid, 'tasks'),
            where('status', '==', 'open'),
            limit(3)
        );
    }, [firestore, user]);
    const { data: tasks, isLoading: areTasksLoading } = useCollection<Task>(tasksQuery);


    // --- DATA CALCULATION ---
    const totalLeads = useMemo(() => contacts?.length ?? 0, [contacts]);
    const salesVolume = useMemo(() => wonLeads?.reduce((sum, lead) => sum + (lead.budget || 0), 0) ?? 0, [wonLeads]);
    const activeProperties = useMemo(() => properties?.length ?? 0, [properties]);
    
    const isLoading = areContactsLoading || areWonLeadsLoading || arePropertiesLoading;

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
                    <PriorityTasks tasks={tasks} isLoading={areTasksLoading} />
                    <AiHelperCard />
                </div>
            </div>
            
            <RecentActivity />
        </div>
    );
}
