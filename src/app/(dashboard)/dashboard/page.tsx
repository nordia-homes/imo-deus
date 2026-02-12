'use client';

import { useMemo, useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { Property, Viewing, Task, Contact, LeadSourceData, SalesData, ConversionData } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgency } from '@/context/AgencyContext';
import { isThisMonth, parseISO, format, isPast, isToday, addDays, isWithinInterval, subDays, eachDayOfInterval } from 'date-fns';
import { ro } from "date-fns/locale";

// Components
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { PriorityTasks } from '@/components/dashboard/PriorityTasks';
import { AiHelperCard } from '@/components/dashboard/AiHelperCard';
import { SalesChart } from '@/components/dashboard/sales-chart';
import { LeadSourceChart } from '@/components/dashboard/lead-source-chart';
import { ConversionChart } from '@/components/dashboard/ConversionChart';
import { StatCard } from '@/components/dashboard/StatCard';
import { Handshake, Bookmark, CalendarCheck, Users, Building2, DollarSign, Target, PlusCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DashboardPropertyList } from '@/components/dashboard/DashboardPropertyList';
import { AddLeadDialog } from '@/components/leads/AddLeadDialog';
import { AddPropertyDialog } from '@/components/properties/add-property-dialog';
import { Button } from '@/components/ui/button';
import { AgendaCard } from '@/components/dashboard/AgendaCard';
import { useToast } from '@/hooks/use-toast';
import { addDocumentNonBlocking } from '@/firebase';
import { AddTaskDialog } from '@/components/tasks/AddTaskDialog';
import { AddViewingDialog } from '@/components/viewings/AddViewingDialog';
import { QuickActionsCard } from '@/components/dashboard/QuickActionsCard';


const formatValue = (num: number) => {
    return `€${num.toLocaleString('ro-RO')}`;
};

export default function DashboardPage() {
    const { user } = useUser();
    const { agencyId, isAgencyLoading, userProfile, agency } = useAgency();
    const firestore = useFirestore();
    const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
    const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
    const [isAddViewingOpen, setIsAddViewingOpen] = useState(false);
    const { toast } = useToast();

    const displayName = userProfile?.name || user?.displayName || user?.email?.split('@')[0] || 'Utilizator';
    const agencyName = agency?.name;

    // --- Action Handlers ---
    const handleAddTask = (taskData: Omit<Task, 'id' | 'status' | 'agentId' | 'agentName'>) => {
        if (!agencyId || !user) return;
        const tasksCollection = collection(firestore, 'agencies', agencyId, 'tasks');
        const taskToAdd: Omit<Task, 'id'> = {
            ...taskData,
            status: 'open',
            agentId: user.uid,
            agentName: userProfile?.name || user.displayName || user.email || 'Nespecificat',
        };
        addDocumentNonBlocking(tasksCollection, taskToAdd);
        toast({
            title: "Task adăugat!",
            description: `Task-ul "${taskData.description}" a fost adăugat.`,
        });
    };

    const handleAddViewing = (viewingData: Omit<Viewing, 'id' | 'status' | 'agentId' | 'agentName' | 'createdAt' | 'propertyAddress' | 'propertyTitle'>) => {
        if (!agencyId || !user) return;

        const selectedProperty = properties?.find(p => p.id === viewingData.propertyId);
        if (!selectedProperty) {
            toast({ variant: 'destructive', title: 'Proprietate invalidă.' });
            return;
        };
        
        const viewingToAdd: Omit<Viewing, 'id'> = {
            ...viewingData,
            propertyTitle: selectedProperty.title,
            propertyAddress: selectedProperty.address,
            status: 'scheduled',
            agentId: user.uid,
            agentName: userProfile?.name || user.displayName || user.email || 'Nespecificat',
            createdAt: new Date().toISOString(),
        };
        
        addDocumentNonBlocking(collection(firestore, `agencies/${agencyId}/viewings`), viewingToAdd);

        toast({ title: 'Vizionare programată!', description: 'Vizionarea a fost adăugată în calendar.' });
    };

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
        viewingsNext7Days,
        activePropertiesCount,
        activeForSaleCount,
        activeForRentCount,
        totalSalesCount,
        newLeadsCount,
        leadSourceData,
        monthlyCommissionData,
        newLeadsProgress,
        salesProgress,
        soldThisMonthProgress,
        reservedThisMonthProgress,
        totalEstimatedCommission,
        realizedCommissionThisMonth,
        commissionProgress,
        todaysTasks,
        todaysViewings,
        conversionData,
    } = useMemo(() => {
        const totalPropertiesCount = properties?.length || 0;
        const totalContactsCount = contacts?.length || 0;

        const calculateCommission = (prop: Property): number => {
            const price = prop.price || 0;
            if (price === 0) return 0;
            if (prop.commissionType === 'fixed') {
                return prop.commissionValue || 0;
            }
            const percentage = prop.commissionValue !== undefined ? prop.commissionValue : 2;
            return price * (percentage / 100);
        };

        const sold = properties?.filter(p => p.status === 'Vândut' && p.statusUpdatedAt && isThisMonth(parseISO(p.statusUpdatedAt))) || [];
        const reserved = properties?.filter(p => p.status === 'Rezervat' && p.statusUpdatedAt && isThisMonth(parseISO(p.statusUpdatedAt))) || [];
        
        const now = new Date();
        const sevenDaysFromNow = addDays(now, 7);
        const next7DaysViewings = viewings?.filter(v => {
            if (v.status !== 'scheduled') return false;
            const viewingDate = parseISO(v.viewingDate);
            return isWithinInterval(viewingDate, { start: now, end: sevenDaysFromNow });
        }) || [];

        const activeProperties = properties?.filter(p => p.status === 'Activ') || [];
        const activePropertiesCount = activeProperties.length;
        const activeForSaleCount = activeProperties.filter(p => p.transactionType === 'Vânzare').length;
        const activeForRentCount = activeProperties.filter(p => p.transactionType === 'Închiriere').length;
        const totalSalesCount = contacts?.filter(c => c.status === 'Câștigat').length || 0;
        
        const oneWeekAgo = addDays(new Date(), -7);
        const newLeadsCount = contacts?.filter(c => c.createdAt && new Date(c.createdAt) > oneWeekAgo).length || 0;

        // Progress calculations
        const newLeadsProgress = totalContactsCount > 0 ? (newLeadsCount / totalContactsCount) * 100 : 0;
        const salesProgress = totalContactsCount > 0 ? (totalSalesCount / totalContactsCount) * 100 : 0;
        const soldThisMonthProgress = totalPropertiesCount > 0 ? (sold.length / totalPropertiesCount) * 100 : 0;
        const reservedThisMonthProgress = totalPropertiesCount > 0 ? (reserved.length / totalPropertiesCount) * 100 : 0;

        // Commission Calculations
        const totalEstimatedCommission = activeProperties.reduce((sum, prop) => sum + calculateCommission(prop), 0);
        const soldOrRentedThisMonth = properties?.filter(p =>
            (p.status === 'Vândut' || p.status === 'Închiriat') &&
            p.statusUpdatedAt &&
            isThisMonth(parseISO(p.statusUpdatedAt))
        ) || [];
        const realizedCommissionThisMonth = soldOrRentedThisMonth.reduce((sum, prop) => sum + calculateCommission(prop), 0);
        const commissionProgress = totalEstimatedCommission > 0 ? (realizedCommissionThisMonth / totalEstimatedCommission) * 100 : 0;

        // Today's Agenda Calculations
        const todaysTasks = openTasks?.filter(task => {
            try { return isToday(new Date(task.dueDate)); } catch (e) { return false; }
        }) || [];

        const todaysViewings = viewings?.filter(viewing => {
            if (viewing.status !== 'scheduled') return false;
            try { return isToday(parseISO(viewing.viewingDate)); } catch (e) { return false; }
        }) || [];

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
        
        // Monthly Commission Data calculation
        const monthlyCommissions: { [key: string]: { sales: number, date: Date } } = {};
        const soldOrRentedAllTime = properties?.filter(p => 
            (p.status === 'Vândut' || p.status === 'Închiriat') && p.statusUpdatedAt
        ) || [];

        soldOrRentedAllTime.forEach(prop => {
            if (!prop.statusUpdatedAt) return;
            const date = parseISO(prop.statusUpdatedAt);
            const monthKey = format(date, 'yyyy-MM');
            if (!monthlyCommissions[monthKey]) {
                monthlyCommissions[monthKey] = { sales: 0, date: new Date(date.getFullYear(), date.getMonth(), 1) };
            }
            monthlyCommissions[monthKey].sales += calculateCommission(prop);
        });

        const monthlyCommissionDataResult: SalesData[] = Object.values(monthlyCommissions)
            .sort((a,b) => a.date.getTime() - b.date.getTime())
            .map(data => ({
                month: data.date.toLocaleString('ro-RO', { month: 'short' }),
                sales: data.sales,
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
            viewingsNext7Days: next7DaysViewings,
            activePropertiesCount,
            activeForSaleCount,
            activeForRentCount,
            totalSalesCount,
            newLeadsCount,
            leadSourceData: leadSourceDataResult,
            monthlyCommissionData: monthlyCommissionDataResult,
            newLeadsProgress,
            salesProgress,
            soldThisMonthProgress,
            reservedThisMonthProgress,
            totalEstimatedCommission,
            realizedCommissionThisMonth,
            commissionProgress,
            todaysTasks,
            todaysViewings,
            conversionData: conversionDataResult,
        };
    }, [properties, viewings, contacts, openTasks]);
    
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
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                    {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-[98px]" />)}
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                    <Card className="col-span-1 md:col-span-2 lg:col-span-4">
                        <CardHeader>
                            <Skeleton className="h-6 w-1/2"/>
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-[300px] w-full"/>
                        </CardContent>
                    </Card>
                    <Card className="col-span-1 md:col-span-2 lg:col-span-3">
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
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="md:hidden bg-[#152a47] text-white p-4 rounded-2xl">
                    <h1 className="text-lg font-bold truncate">
                        {agencyName ? `Buna ${displayName}, de la ${agencyName}!` : `Bine ai revenit, ${displayName}!`}
                    </h1>
                    <p className="text-xs text-white/80">
                        Iata o privire de ansamblu asupra activitatilor.
                    </p>
                </div>

                <div className="hidden md:block text-left overflow-hidden">
                    <h1 className="text-2xl font-headline font-bold text-foreground/90">{agencyName || 'Dashboard'}</h1>
                    <p className="text-muted-foreground">
                        <span className="hidden md:inline">Bine ai revenit, {displayName}! </span>
                        Iata o privire de ansamblu asupra activitatilor.
                    </p>
                </div>
                <div className="hidden md:flex items-center gap-2 flex-wrap">
                    <AddTaskDialog onAddTask={handleAddTask} contacts={contacts || []}>
                        <Button variant="outline" size="sm">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Task
                        </Button>
                    </AddTaskDialog>
                    <Button variant="outline" size="sm" onClick={() => setIsAddViewingOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Vizionare
                    </Button>
                    <Button onClick={() => setIsAddLeadOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Adaugă Cumpărător
                    </Button>
                    <Button onClick={() => setIsAddPropertyOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Adaugă Proprietate
                    </Button>
                </div>
                <AddPropertyDialog isOpen={isAddPropertyOpen} onOpenChange={setIsAddPropertyOpen} property={null} />
                <AddLeadDialog properties={properties || []} isOpen={isAddLeadOpen} onOpenChange={setIsAddLeadOpen} />
                <AddViewingDialog isOpen={isAddViewingOpen} onOpenChange={setIsAddViewingOpen} onAddViewing={handleAddViewing} contacts={contacts || []} properties={properties || []} />
            </div>

            <QuickActionsCard
                onAddLead={() => setIsAddLeadOpen(true)}
                onAddProperty={() => setIsAddPropertyOpen(true)}
                onAddViewing={() => setIsAddViewingOpen(true)}
                onAddTask={handleAddTask}
                contacts={contacts || []}
                realizedCommissionThisMonth={realizedCommissionThisMonth}
                viewings={viewingsNext7Days}
                properties={properties || []}
            />
            

            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                <StatCard title="Proprietăți Active" value={activePropertiesCount.toString()} icon={<Building2 />} period={`${activeForSaleCount} Vânzare / ${activeForRentCount}`} className="bg-muted/50 md:bg-card" />
                <StatCard title="Comision Estimat" value={formatValue(totalEstimatedCommission)} icon={<Target />} period="Total Portofoliu Activ" className="bg-muted/50 md:bg-card" />
                <StatCard title="Comision Realizat" value={formatValue(realizedCommissionThisMonth)} period="luna aceasta" icon={<DollarSign />} progress={commissionProgress} className="bg-muted/50 md:bg-card" />
                <StatCard title="Leaduri Noi" value={`+${newLeadsCount}`} period="în ultima săptămână" icon={<Users />} progress={newLeadsProgress} className="bg-muted/50 md:bg-card" />
                
                <div className="col-span-2 md:hidden">
                    <Card className="shadow-2xl rounded-2xl">
                        <CardHeader>
                            <CardTitle className="text-xl font-semibold">Conversie Vizionari vs. Tranzactii</CardTitle>
                            <CardDescription>Ultimele 30 de zile</CardDescription>
                        </CardHeader>
                        <CardContent className="pl-2">
                            <ConversionChart data={conversionData} />
                        </CardContent>
                    </Card>
                </div>

                <StatCard title="Total Vânzări" value={totalSalesCount.toString()} period={`din ${contacts?.length || 0} contacte`} icon={<Handshake />} progress={salesProgress} className="hidden sm:block" />
                <StatCard title="Vizionări Programate" value={viewingsNext7Days.length.toString()} period="în următoarele 7 zile" icon={<CalendarCheck />} className="hidden sm:block" />
                <StatCard title="Proprietăți Rezervate" value={reservedThisMonth.length.toString()} period={`din ${properties?.length || 0} proprietăți`} icon={<Bookmark />} progress={reservedThisMonthProgress} className="bg-muted/50 md:bg-card" />
                <StatCard title="Proprietăți Vândute" value={soldThisMonth.length.toString()} period={`din ${properties?.length || 0} proprietăți`} icon={<Handshake />} progress={soldThisMonthProgress} className="bg-muted/50 md:bg-card" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <div className="space-y-6">
                    <Card className="shadow-2xl rounded-2xl hidden lg:block">
                        <CardHeader>
                            <CardTitle className="text-xl font-semibold">Conversie Vizionari vs. Tranzactii</CardTitle>
                            <CardDescription>Ultimele 30 de zile</CardDescription>
                        </CardHeader>
                        <CardContent className="pl-2">
                            <ConversionChart data={conversionData} />
                        </CardContent>
                    </Card>
                     <Card className="shadow-2xl rounded-2xl">
                        <CardHeader>
                            <CardTitle className="text-xl font-semibold">Evoluție Comision Lunar</CardTitle>
                            <CardDescription>Comision realizat în ultimele luni</CardDescription>
                        </CardHeader>
                        <CardContent className="pl-2">
                            <SalesChart data={monthlyCommissionData} />
                        </CardContent>
                    </Card>
                </div>
                <div className="space-y-6 hidden md:block">
                    <AgendaCard tasks={todaysTasks} viewings={todaysViewings} contacts={contacts || []} properties={properties || []} />
                    <Card className="shadow-2xl rounded-2xl h-[289px]">
                        <CardHeader>
                            <CardTitle className="text-xl font-semibold">Distribuție Surse Lead-uri</CardTitle>
                            <CardDescription>Canalele care aduc cei mai mulți clienți.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <LeadSourceChart data={leadSourceData} />
                        </CardContent>
                    </Card>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                <div className="lg:col-span-2 space-y-6">
                    <PriorityTasks tasks={priorityTasks} isLoading={areTasksLoading} />
                    <RecentActivity />
                </div>
                <div className="lg:col-span-1 space-y-6">
                    <div className='hidden md:block'>
                        <AiHelperCard />
                    </div>
                    <DashboardPropertyList title="Proprietăți Rezervate" properties={reservedThisMonth} />
                    <DashboardPropertyList title="Proprietăți Vândute" properties={soldThisMonth} />
                </div>
            </div>

        </div>
    );
}
