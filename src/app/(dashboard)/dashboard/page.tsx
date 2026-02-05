'use client';

import { useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { Property, Viewing, Task, Contact, LeadSourceData, ConversionData } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';
import { isThisMonth, parseISO, format, isPast, isToday, addDays, isWithinInterval, subDays, eachDayOfInterval } from 'date-fns';
import { ro } from "date-fns/locale";

// Components
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { PriorityTasks } from '@/components/dashboard/PriorityTasks';
import { AiHelperCard } from '@/components/dashboard/AiHelperCard';
import { ConversionChart } from '@/components/dashboard/ConversionChart';
import { LeadSourceChart } from '@/components/dashboard/lead-source-chart';
import { StatCard } from '@/components/dashboard/StatCard';
import { Handshake, Bookmark, CalendarCheck, Users, Building2, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DashboardPropertyList } from '@/components/dashboard/DashboardPropertyList';


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
        viewingsNext7DaysCount,
        activePropertiesCount,
        totalSalesCount,
        newLeadsCount,
        leadSourceData,
        conversionData,
        newLeadsProgress,
        salesProgress,
        soldThisMonthProgress,
        reservedThisMonthProgress,
    } = useMemo(() => {
        const totalPropertiesCount = properties?.length || 0;
        const totalContactsCount = contacts?.length || 0;

        const sold = properties?.filter(p => p.status === 'Vândut' && p.statusUpdatedAt && isThisMonth(parseISO(p.statusUpdatedAt))) || [];
        const reserved = properties?.filter(p => p.status === 'Rezervat' && p.statusUpdatedAt && isThisMonth(parseISO(p.statusUpdatedAt))) || [];
        
        const now = new Date();
        const sevenDaysFromNow = addDays(now, 7);
        const next7DaysViewings = viewings?.filter(v => {
            if (v.status !== 'scheduled') return false;
            const viewingDate = parseISO(v.viewingDate);
            return isWithinInterval(viewingDate, { start: now, end: sevenDaysFromNow });
        }) || [];

        const activePropertiesCount = properties?.filter(p => p.status === 'Activ').length || 0;
        const totalSalesCount = contacts?.filter(c => c.status === 'Câștigat').length || 0;
        
        const oneWeekAgo = addDays(new Date(), -7);
        const newLeadsCount = contacts?.filter(c => c.createdAt && new Date(c.createdAt) > oneWeekAgo).length || 0;

        // Progress calculations
        const newLeadsProgress = totalContactsCount > 0 ? (newLeadsCount / totalContactsCount) * 100 : 0;
        const salesProgress = totalContactsCount > 0 ? (totalSalesCount / totalContactsCount) * 100 : 0;
        const soldThisMonthProgress = totalPropertiesCount > 0 ? (sold.length / totalPropertiesCount) * 100 : 0;
        const reservedThisMonthProgress = totalPropertiesCount > 0 ? (reserved.length / totalPropertiesCount) * 100 : 0;


        // Lead Source Data
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
        
        // Conversion Data (last 30 days)
        const thirtyDaysAgo = subDays(new Date(), 30);
        const today = new Date();
        const dateArray = eachDayOfInterval({ start: thirtyDaysAgo, end: today });

        const conversionMap: Map<string, { vizionari: number; tranzactii: number }> = new Map();
        dateArray.forEach(date => {
            conversionMap.set(format(date, 'd MMM', { locale: ro }), { vizionari: 0, tranzactii: 0 });
        });

        viewings?.forEach(viewing => {
            const viewingDate = parseISO(viewing.viewingDate);
            if (isWithinInterval(viewingDate, { start: thirtyDaysAgo, end: today })) {
                const dayKey = format(viewingDate, 'd MMM', { locale: ro });
                const dayData = conversionMap.get(dayKey);
                if (dayData) {
                    dayData.vizionari++;
                }
            }
        });

        properties?.forEach(property => {
            if ((property.status === 'Vândut' || property.status === 'Rezervat') && property.statusUpdatedAt) {
                const updatedDate = parseISO(property.statusUpdatedAt);
                if (isWithinInterval(updatedDate, { start: thirtyDaysAgo, end: today })) {
                    const dayKey = format(updatedDate, 'd MMM', { locale: ro });
                    const dayData = conversionMap.get(dayKey);
                    if (dayData) {
                        dayData.tranzactii++;
                    }
                }
            }
        });

        const conversionDataResult: ConversionData[] = Array.from(conversionMap.entries()).map(([date, data]) => ({
          date,
          ...data,
        }));


        return {
            soldThisMonth: sold,
            reservedThisMonth: reserved,
            viewingsNext7DaysCount: next7DaysViewings.length,
            activePropertiesCount,
            totalSalesCount,
            newLeadsCount,
            leadSourceData: leadSourceDataResult,
            conversionData: conversionDataResult,
            newLeadsProgress,
            salesProgress,
            soldThisMonthProgress,
            reservedThisMonthProgress,
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
                <StatCard title="Total Vânzări" value={totalSalesCount.toString()} period={`din ${contacts?.length || 0} contacte`} icon={<DollarSign />} progress={salesProgress} />
                <StatCard title="Leaduri Noi" value={`+${newLeadsCount}`} period="în ultima săptămână" icon={<Users />} progress={newLeadsProgress} />
            </div>

             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <StatCard title="Vizionări Programate" value={viewingsNext7DaysCount.toString()} period="în următoarele 7 zile" icon={<CalendarCheck />} />
                <StatCard title="Proprietăți Rezervate" value={reservedThisMonth.length.toString()} period="în luna curentă" icon={<Bookmark />} progress={reservedThisMonthProgress} />
                <StatCard title="Proprietăți Vândute" value={soldThisMonth.length.toString()} period="în luna curentă" icon={<Handshake />} progress={soldThisMonthProgress} />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 shadow-2xl rounded-2xl">
                    <CardHeader>
                        <CardTitle>Rata de Conversie: Vizionări vs. Tranzacții</CardTitle>
                        <CardDescription>Ultimele 30 de zile</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <ConversionChart data={conversionData} />
                    </CardContent>
                </Card>
                <Card className="col-span-3 shadow-2xl rounded-2xl">
                    <CardHeader>
                        <CardTitle>Distribuție Surse Lead-uri</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <LeadSourceChart data={leadSourceData} />
                    </CardContent>
                </Card>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 space-y-6">
                    <PriorityTasks tasks={priorityTasks} isLoading={areTasksLoading} />
                    <RecentActivity />
                </div>
                <div className="lg:col-span-1 space-y-6">
                    <AiHelperCard />
                    <DashboardPropertyList title="Proprietăți Rezervate" properties={reservedThisMonth} />
                    <DashboardPropertyList title="Proprietăți Vândute" properties={soldThisMonth} />
                </div>
            </div>

        </div>
    );
}
