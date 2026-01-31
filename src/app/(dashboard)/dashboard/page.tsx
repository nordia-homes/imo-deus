'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, where, limit } from 'firebase/firestore';
import type { Property, Viewing, Task } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';
import { isThisMonth, parseISO, format, isPast, isToday, isThisWeek } from 'date-fns';
import { ro } from "date-fns/locale";
import { DashboardSection } from '@/components/dashboard/DashboardSection';
import { CalendarCheck, Handshake, Bookmark } from 'lucide-react';
import Link from 'next/link';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { PriorityTasks } from '@/components/dashboard/PriorityTasks';
import { AiHelperCard } from '@/components/dashboard/AiHelperCard';
import { SalesAnalyticsChart } from '@/components/dashboard/SalesAnalyticsChart';

// Component to display a list of items on the dashboard
function DashboardInfoList({ items, emptyText, renderItem }: { items: any[], emptyText: string, renderItem: (item: any) => React.ReactNode }) {
    if (!items || items.length === 0) {
        return <p className="text-sm text-muted-foreground text-center p-4">{emptyText}</p>;
    }
    return <div className="space-y-3">{items.map(renderItem)}</div>;
}

export default function DashboardPage() {
    const { user } = useUser();
    const displayName = user?.displayName || user?.email?.split('@')[0] || 'Utilizator';
    
    const { agencyId, isAgencyLoading } = useAgency();
    const firestore = useFirestore();

    // --- DATA FETCHING for cards ---
    const propertiesQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'properties');
    }, [firestore, agencyId]);
    const { data: properties, isLoading: arePropertiesLoading } = useCollection<Property>(propertiesQuery);
    
    const viewingsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return query(collection(firestore, 'agencies', agencyId, 'viewings'), orderBy('viewingDate', 'asc'));
    }, [firestore, agencyId]);
    const { data: viewings, isLoading: areViewingsLoading } = useCollection<Viewing>(viewingsQuery);

    // --- DATA FETCHING for original components ---
    const tasksQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return query(
            collection(firestore, 'agencies', agencyId, 'tasks'), 
            where('status', '==', 'open'),
            orderBy('dueDate', 'asc')
        );
    }, [firestore, agencyId]);
    const { data: openTasks, isLoading: areTasksLoading } = useCollection<Task>(tasksQuery);
    
    // --- DATA CALCULATION ---
    const { soldThisMonth, reservedThisMonth, viewingsThisWeek } = useMemo(() => {
        const sold = properties?.filter(p => 
            p.status === 'Vândut' && p.statusUpdatedAt && isThisMonth(parseISO(p.statusUpdatedAt))
        ) || [];

        const reserved = properties?.filter(p => 
            p.status === 'Rezervat' && p.statusUpdatedAt && isThisMonth(parseISO(p.statusUpdatedAt))
        ) || [];
        
        const weeklyViewings = viewings?.filter(v => {
            try {
                return v.status === 'scheduled' && isThisWeek(parseISO(v.viewingDate), { weekStartsOn: 1 });
            } catch (e) {
                return false;
            }
        }) || [];

        return {
            soldThisMonth: sold,
            reservedThisMonth: reserved,
            viewingsThisWeek: weeklyViewings,
        };
    }, [properties, viewings]);
    
    const priorityTasks = useMemo(() => {
        if (!openTasks) return [];
        return openTasks.filter(task => {
            try {
                const dueDate = new Date(task.dueDate);
                return isPast(dueDate) && !isToday(dueDate);
            } catch(e) {
                return false;
            }
        }).slice(0, 5);
    }, [openTasks]);

    // Placeholder data for SalesAnalyticsChart
    const salesData = [
        { name: "Week 1", "Actual": 4000, "AI Projected": 2400 },
        { name: "Week 2", "Actual": 3000, "AI Projected": 1398 },
        { name: "Week 3", "Actual": 9800, "AI Projected": 2000 },
        { name: "Week 4", "Actual": 2780, "AI Projected": 3908 },
    ];
    
    const isLoading = isAgencyLoading || arePropertiesLoading || areViewingsLoading || areTasksLoading;
    
    // --- RENDER ---
    if (isLoading) {
        return (
            <div className="space-y-6">
                 <Skeleton className="h-10 w-64 mb-2" />
                 <Skeleton className="h-80 w-full mb-6" />
                <div className="grid gap-6 lg:grid-cols-3">
                    <Skeleton className="lg:col-span-2 h-96" />
                    <div className="space-y-6">
                        <Skeleton className="h-48" />
                        <Skeleton className="h-48" />
                        <Skeleton className="h-48" />
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-headline font-bold">Bine ai revenit, {displayName}!</h1>
            
            <SalesAnalyticsChart data={salesData} isLoading={isLoading} />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2">
                    <RecentActivity />
                </div>
                <div className="space-y-6">
                    <AiHelperCard />
                    <PriorityTasks tasks={priorityTasks} isLoading={areTasksLoading} />

                    <DashboardSection
                        title="Proprietăți Rezervate Luna Aceasta"
                        icon={<Bookmark className="h-6 w-6 text-yellow-600" />}
                        count={reservedThisMonth.length}
                    >
                         <DashboardInfoList
                            items={reservedThisMonth}
                            emptyText="Nicio proprietate rezervată luna aceasta."
                            renderItem={(prop: Property) => (
                                <Link href={`/properties/${prop.id}`} key={prop.id} className="block p-3 rounded-md hover:bg-muted transition-colors">
                                    <p className="font-semibold truncate">{prop.title}</p>
                                    <p className="text-sm text-muted-foreground">{prop.address}</p>
                                    <p className="text-sm font-medium text-yellow-600 mt-1">€{prop.price.toLocaleString()}</p>
                               </Link>
                            )}
                        />
                    </DashboardSection>

                    <DashboardSection
                        title="Proprietăți Vândute Luna Aceasta"
                        icon={<Handshake className="h-6 w-6 text-green-600" />}
                        count={soldThisMonth.length}
                    >
                         <DashboardInfoList
                            items={soldThisMonth}
                            emptyText="Nicio proprietate vândută luna aceasta."
                            renderItem={(prop: Property) => (
                                 <Link href={`/properties/${prop.id}`} key={prop.id} className="block p-3 rounded-md hover:bg-muted transition-colors">
                                    <p className="font-semibold truncate">{prop.title}</p>
                                    <p className="text-sm text-muted-foreground">{prop.address}</p>
                                    <p className="text-sm font-medium text-green-600 mt-1">€{prop.price.toLocaleString()}</p>
                                </Link>
                            )}
                        />
                    </DashboardSection>

                    <DashboardSection
                        title="Vizionări Săptămâna Aceasta"
                        icon={<CalendarCheck className="h-6 w-6 text-primary" />}
                        count={viewingsThisWeek.length}
                    >
                        <DashboardInfoList
                            items={viewingsThisWeek}
                            emptyText="Nicio vizionare programată săptămâna aceasta."
                            renderItem={(viewing: Viewing) => (
                                 <Link href={`/viewings`} key={viewing.id} className="block p-3 rounded-md hover:bg-muted transition-colors">
                                    <p className="font-semibold truncate">{viewing.propertyTitle}</p>
                                    <p className="text-sm text-muted-foreground">{viewing.contactName}</p>
                                    <p className="text-sm font-medium text-primary mt-1">
                                        {format(parseISO(viewing.viewingDate), 'eeee, d MMMM, HH:mm', { locale: ro })}
                                    </p>
                                </Link>
                            )}
                        />
                    </DashboardSection>
                </div>
            </div>

        </div>
    );
}
