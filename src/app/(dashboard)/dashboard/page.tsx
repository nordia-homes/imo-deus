'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { Property, Viewing, Task, Contact, SalesData, LeadSourceData } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';
import { isThisMonth, parseISO, format, isPast, isToday, isThisWeek, subDays } from 'date-fns';
import { ro } from "date-fns/locale";

// Components
import { DashboardSection } from '@/components/dashboard/DashboardSection';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { PriorityTasks } from '@/components/dashboard/PriorityTasks';
import { AiHelperCard } from '@/components/dashboard/AiHelperCard';
import { SalesChart } from '@/components/dashboard/sales-chart';
import { LeadSourceChart } from '@/components/dashboard/lead-source-chart';
import { StatCard } from '@/components/dashboard/StatCard';
import Link from 'next/link';
import { Handshake, Bookmark, CalendarCheck, Users, Building2, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';


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

    // --- DATA FETCHING ---
    const contactsQuery = useMemoFirebase(() => {
        if (!agencyId) return null;
        return collection(firestore, 'agencies', agencyId, 'contacts');
    }, [firestore, agencyId]);
    const { data: contacts, isLoading: areContactsLoading } = useCollection<Contact>(contactsQuery);

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
    const { 
        soldThisMonth, 
        reservedThisMonth, 
        viewingsThisWeek,
        activePropertiesCount,
        totalSalesCount,
        newLeadsCount,
        salesData,
        leadSourceData
    } = useMemo(() => {
        // Calculations for new sections
        const sold = properties?.filter(p => p.status === 'Vândut' && p.statusUpdatedAt && isThisMonth(parseISO(p.statusUpdatedAt))) || [];
        const reserved = properties?.filter(p => p.status === 'Rezervat' && p.statusUpdatedAt && isThisMonth(parseISO(p.statusUpdatedAt))) || [];
        const weeklyViewings = viewings?.filter(v => v.status === 'scheduled' && isThisWeek(parseISO(v.viewingDate), { weekStartsOn: 1 })) || [];

        // Calculations for restored components
        const activePropertiesCount = properties?.filter(p => p.status === 'Activ').length || 0;
        const totalSalesCount = contacts?.filter(c => c.status === 'Câștigat').length || 0;
        
        const oneWeekAgo = subDays(new Date(), 7);
        const newLeadsCount = contacts?.filter(c => c.createdAt && new Date(c.createdAt) > oneWeekAgo).length || 0;

        // Calculations for charts
        const wonLeads = contacts?.filter(c => c.status === 'Câștigat') || [];

        const monthlySales: { [key: string]: { sales: number, date: Date } } = {};
        wonLeads.forEach(lead => {
            if (lead.createdAt) {
                const date = new Date(lead.createdAt);
                const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
                if (!monthlySales[monthKey]) {
                    monthlySales[monthKey] = { sales: 0, date: new Date(date.getFullYear(), date.getMonth(), 1) };
                }
                monthlySales[monthKey].sales += (lead.budget || 0);
            }
        });

        const salesDataResult: SalesData[] = Object.values(monthlySales)
            .sort((a,b) => a.date.getTime() - b.date.getTime())
            .map(data => ({
                month: data.date.toLocaleString('ro-RO', { month: 'short' }),
                sales: data.sales,
            }));

        const sourceCounts: { [key: string]: number } = {};
        contacts?.forEach(contact => {
            const source = contact.source || 'Necunoscută';
            sourceCounts[source] = (sourceCounts[source] || 0) + 1;
        });
        const chartColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE'];
        const leadSourceDataResult: LeadSourceData[] = Object.keys(sourceCounts).map((source, index) => ({
            source,
            count: sourceCounts[source],
            fill: chartColors[index % chartColors.length],
        }));

        return {
            soldThisMonth: sold,
            reservedThisMonth: reserved,
            viewingsThisWeek: weeklyViewings,
            activePropertiesCount,
            totalSalesCount,
            newLeadsCount,
            salesData: salesDataResult,
            leadSourceData: leadSourceDataResult
        };
    }, [properties, viewings, contacts]);
    
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

    const isLoading = isAgencyLoading || arePropertiesLoading || areViewingsLoading || areTasksLoading || areContactsLoading;
    
    // --- RENDER ---
    if (isLoading) {
        return (
            <div className="space-y-6">
                <Skeleton className="h-10 w-64 mb-4" />
                <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
                    <Skeleton className="h-[108px]"/>
                    <Skeleton className="h-[108px]"/>
                    <Skeleton className="h-[108px]"/>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-4">
                        <CardHeader>
                            <Skeleton className="h-6 w-1/2"/>
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-[300px] w-full"/>
                        </CardContent>
                    </Card>
                    <Card className="col-span-3">
                         <CardHeader>
                            <Skeleton className="h-6 w-1/2"/>
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-[300px] w-full"/>
                        </CardContent>
                    </Card>
                </div>
                 <div className="grid gap-6 lg:grid-cols-3">
                    <Skeleton className="lg:col-span-2 h-96" />
                    <div className="space-y-6">
                        <Skeleton className="h-48" />
                        <Skeleton className="h-48" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-headline font-bold">Bine ai revenit, {displayName}!</h1>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <StatCard title="Proprietăți Active" value={activePropertiesCount.toString()} icon={<Building2 />} />
                <StatCard title="Total Vânzări" value={totalSalesCount.toString()} period="Tranzacții câștigate" icon={<DollarSign />} />
                <StatCard title="Leaduri Noi" value={`+${newLeadsCount}`} period="în ultima săptămână" icon={<Users />} />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Volum Vânzări Lunare</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <SalesChart data={salesData} />
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Distribuție Surse Lead-uri</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <LeadSourceChart data={leadSourceData} />
                    </CardContent>
                </Card>
            </div>
            
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
